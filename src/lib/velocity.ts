import { Connection, PublicKey, type Transaction } from "@solana/web3.js";
import {
  BASE_PRECISION,
  BulkAccountLoader,
  calculateEntryPrice,
  convertToNumber,
  decodeName,
  initialize,
  PRICE_PRECISION,
  QUOTE_PRECISION,
  VELOCITY_PROGRAM_ID,
  VelocityClient,
  VelocityCore,
} from "@velocity-exchange/sdk/lib/node/index.js";

initialize({ env: "mainnet-beta" });

export type VelocityPosition = {
  source: "Velocity mainnet";
  owner: string;
  subAccountId: number;
  accountPda: string;
  market: "BTC-PERP";
  direction: "long" | "short";
  sizeBtc: number;
  entryPriceUsd: number;
  oraclePriceUsd: number;
  unrealizedPnlUsd: number;
  fundingPnlUsd: number;
  accountHealth: number;
  accountCollateralUsd: number;
  accountMaintenanceUsd: number;
  fetchedAt: string;
};

export type VelocityLookup =
  | { status: "position"; position: VelocityPosition }
  | { status: "no-account" | "no-btc-position"; owner: string; subAccountId: number };

const denySigning = async (): Promise<Transaction> => {
  throw new Error("EventLens is read-only.");
};

export function parseVelocityLookup(owner: string, subAccountId: number) {
  if (!Number.isInteger(subAccountId) || subAccountId < 0 || subAccountId > 15) {
    throw new Error("Subaccount must be an integer from 0 to 15.");
  }
  try {
    const key = new PublicKey(owner);
    if (key.toBase58() !== owner) throw new Error();
    return key;
  } catch {
    throw new Error("Enter a valid Solana wallet address.");
  }
}

export async function loadVelocityPosition(
  owner: PublicKey,
  subAccountId: number,
): Promise<VelocityLookup> {
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const programId = new PublicKey(VELOCITY_PROGRAM_ID);
  const accountPda = VelocityCore.pdas.getUserAccountPublicKeySync(
    programId,
    owner,
    subAccountId,
  );
  const account = await VelocityCore.fetchUserAccount(connection, accountPda);
  if (!account) {
    return { status: "no-account", owner: owner.toBase58(), subAccountId };
  }
  if (!account.authority.equals(owner) || account.subAccountId !== subAccountId) {
    throw new Error("Velocity account authority mismatch.");
  }

  const client = new VelocityClient({
    connection,
    wallet: {
      publicKey: owner,
      signTransaction: denySigning,
      signAllTransactions: async () => {
        throw new Error("EventLens is read-only.");
      },
    },
    authority: owner,
    env: "mainnet-beta",
    subAccountIds: [subAccountId],
    activeSubAccountId: subAccountId,
    accountSubscription: {
      type: "polling",
      accountLoader: new BulkAccountLoader(connection, "confirmed", 0),
    },
  });

  try {
    const subscribed = await client.subscribe();
    if (!subscribed) throw new Error("Velocity account subscription failed.");
    await client.fetchAccounts();
    const market = client.getPerpMarketAccounts().find(
      (candidate) => decodeName(candidate.name) === "BTC-PERP",
    );
    if (!market) throw new Error("BTC-PERP market unavailable.");
    const user = client.getUser(subAccountId);
    const position = user.getPerpPosition(market.marketIndex);
    if (!position || position.baseAssetAmount.isZero()) {
      return { status: "no-btc-position", owner: owner.toBase58(), subAccountId };
    }

    const signedSizeBtc = convertToNumber(position.baseAssetAmount, BASE_PRECISION);
    const entryPriceUsd = convertToNumber(calculateEntryPrice(position), PRICE_PRECISION);
    const oraclePriceUsd = convertToNumber(
      client.getOracleDataForPerpMarket(market.marketIndex).price,
      PRICE_PRECISION,
    );
    const result: VelocityPosition = {
      source: "Velocity mainnet",
      owner: owner.toBase58(),
      subAccountId,
      accountPda: accountPda.toBase58(),
      market: "BTC-PERP",
      direction: signedSizeBtc > 0 ? "long" : "short",
      sizeBtc: Math.abs(signedSizeBtc),
      entryPriceUsd,
      oraclePriceUsd,
      unrealizedPnlUsd: convertToNumber(
        user.getUnrealizedPNL(true, market.marketIndex),
        QUOTE_PRECISION,
      ),
      fundingPnlUsd: convertToNumber(
        user.getUnrealizedFundingPNL(market.marketIndex),
        QUOTE_PRECISION,
      ),
      accountHealth: user.getHealth(),
      accountCollateralUsd: convertToNumber(
        user.getTotalCollateral("Maintenance"),
        QUOTE_PRECISION,
      ),
      accountMaintenanceUsd: convertToNumber(
        user.getMarginRequirement("Maintenance"),
        QUOTE_PRECISION,
      ),
      fetchedAt: new Date().toISOString(),
    };
    if (
      Object.values(result).some((value) => typeof value === "number" && !Number.isFinite(value)) ||
      result.sizeBtc <= 0 ||
      result.entryPriceUsd <= 0 ||
      result.oraclePriceUsd <= 0
    ) {
      throw new Error("Velocity returned invalid position values.");
    }
    return { status: "position", position: result };
  } finally {
    await client.unsubscribe();
  }
}
