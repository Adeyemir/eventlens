import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  BulkAccountLoader,
  getMarketOrderParams,
  initialize,
  PositionDirection,
  VelocityClient,
  Wallet,
} from "@velocity-exchange/sdk/lib/node/index.js";

const walletPath = path.join(process.cwd(), ".local", "devnet-demo-keypair.json");
const rpcUrl = process.env.DEVNET_RPC_URL || "https://api.devnet.solana.com";

async function loadDemoWallet() {
  await mkdir(path.dirname(walletPath), { recursive: true });
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(walletPath, "utf8"))));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const keypair = Keypair.generate();
    await writeFile(walletPath, JSON.stringify(Array.from(keypair.secretKey)), { mode: 0o600, flag: "wx" });
    return keypair;
  }
}

const keypair = await loadDemoWallet();
const connection = new Connection(rpcUrl, "confirmed");
console.log("Demo wallet:", keypair.publicKey.toBase58());

async function simulateOrThrow(label, transaction) {
  const { value } = await connection.simulateTransaction(transaction);
  if (value.err) {
    console.error(`${label} simulation failed:`, JSON.stringify(value.err));
    console.error(value.logs?.slice(-12).join("\n") ?? "No program logs returned");
    throw new Error(`${label} was not sent`);
  }
  console.log(`${label} simulation passed (${value.unitsConsumed ?? "unknown"} compute units)`);
}

let balance = await connection.getBalance(keypair.publicKey);
console.log("Devnet SOL:", balance / LAMPORTS_PER_SOL);
if (balance < 0.4 * LAMPORTS_PER_SOL) {
  const signature = await connection.requestAirdrop(keypair.publicKey, LAMPORTS_PER_SOL / 2);
  const blockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature, ...blockhash }, "confirmed");
  balance = await connection.getBalance(keypair.publicKey);
  console.log("Airdrop:", signature, "balance:", balance / LAMPORTS_PER_SOL);
}

initialize({ env: "devnet" });
const client = new VelocityClient({
  connection,
  wallet: new Wallet(keypair),
  env: "devnet",
  accountSubscription: {
    type: "polling",
    accountLoader: new BulkAccountLoader(connection, "confirmed", 1000),
  },
});

try {
  if (!await client.subscribe()) throw new Error("Velocity devnet subscription failed");
  if (!client.hasUser(0)) {
    const [initializeIxs, userAddress] = await client.getInitializeUserAccountIxs(0);
    if (await connection.getAccountInfo(userAddress)) {
      await client.addUser(0);
    } else {
      await simulateOrThrow("Initialize user", await client.buildTransaction(initializeIxs));
      const [signature] = await client.initializeUserAccount(0);
      console.log("Initialize user:", signature);
    }
  }
  const user = client.getUser(0);
  await user.fetchAccounts();
  const solDeposit = client.convertToSpotPrecision(1, 0.2);
  const depositShortfall = solDeposit.sub(user.getTokenAmount(1));
  if (depositShortfall.gtn(1)) {
    const label = `Deposit ${depositShortfall.toNumber() / LAMPORTS_PER_SOL} devnet SOL`;
    await simulateOrThrow(label, await client.createDepositTxn(depositShortfall, 1, keypair.publicKey, 0));
    const depositSignature = await client.deposit(depositShortfall, 1, keypair.publicKey, 0);
    console.log(`${label}:`, depositSignature);
    await user.fetchAccounts();
  } else {
    console.log("Existing Velocity SOL collateral:", user.getTokenAmount(1).toString(), "lamports");
  }
  const targetBaseAmount = client.convertToPerpPrecision(0.0001);
  if (user.getPerpPosition(1)?.baseAssetAmount.gte(targetBaseAmount)) {
    console.log("BTC-PERP position already open:", user.getPerpPosition(1).baseAssetAmount.toString());
  } else {
    if (user.getOpenOrders().some((order) => order.marketIndex === 1)) {
      throw new Error("BTC-PERP order is still open; wait for it to fill before rerunning");
    }
    const orderParams = getMarketOrderParams({
      marketIndex: 1,
      direction: PositionDirection.LONG,
      baseAssetAmount: targetBaseAmount,
    });
    await simulateOrThrow("BTC-PERP order", await client.buildTransaction(await client.getPlacePerpOrderIx(orderParams, 0)));
    const orderSignature = await client.placePerpOrder(orderParams);
    console.log("BTC-PERP order:", orderSignature);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await user.fetchAccounts();
      if (user.getPerpPosition(1)?.baseAssetAmount.gte(targetBaseAmount)) break;
      if (attempt < 19) await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  const position = client.getUser(0).getPerpPosition(1);
  console.log("Position base amount:", position?.baseAssetAmount.toString() ?? "none");
  if (!position?.baseAssetAmount.gte(targetBaseAmount)) {
    throw new Error("BTC-PERP position has not filled yet; inspect the open order before retrying");
  }
} finally {
  await client.unsubscribe();
}
