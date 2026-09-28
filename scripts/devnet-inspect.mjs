import { readFile } from "node:fs/promises";
import path from "node:path";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BulkAccountLoader, initialize, VelocityClient, Wallet } from "@velocity-exchange/sdk/lib/node/index.js";

const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(
  await readFile(path.join(process.cwd(), ".local", "devnet-demo-keypair.json"), "utf8"),
)));
const connection = new Connection(process.env.DEVNET_RPC_URL || "https://api.devnet.solana.com", "confirmed");
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
  if (!client.hasUser(0)) await client.addUser(0);
  const user = client.getUser(0);
  await user.fetchAccounts();
  console.log("Wallet:", keypair.publicKey.toBase58());
  console.log("Wallet SOL:", (await connection.getBalance(keypair.publicKey)) / LAMPORTS_PER_SOL);
  console.log("Velocity SOL collateral:", user.getTokenAmount(1).toString(), "lamports");
  console.log("BTC-PERP base amount:", user.getPerpPosition(1)?.baseAssetAmount.toString() ?? "none");
  console.log("Open orders:", user.getOpenOrders().map((order) => ({
    id: order.orderId,
    market: order.marketIndex,
    direction: order.direction,
    baseAssetAmount: order.baseAssetAmount.toString(),
    baseAssetAmountFilled: order.baseAssetAmountFilled.toString(),
    slot: order.slot.toString(),
    auctionDuration: order.auctionDuration,
  })));
} finally {
  await client.unsubscribe();
}
