import {
  loadVelocityPosition,
  parseVelocityLookup,
  type VelocityLookup,
  type VelocityNetwork,
} from "@/lib/velocity";

export const runtime = "nodejs";

const cache = new Map<string, { expiresAt: number; value: VelocityLookup }>();

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const ownerText = params.get("owner") ?? "";
  const subAccountId = Number(params.get("subaccount") ?? "0");
  const network = params.get("network") ?? "mainnet-beta";
  if (network !== "devnet" && network !== "mainnet-beta") {
    return Response.json({ error: "Choose devnet or mainnet-beta." }, { status: 400 });
  }
  let owner;
  try {
    owner = parseVelocityLookup(ownerText, subAccountId);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid lookup." },
      { status: 400 },
    );
  }

  const cacheKey = `${network}:${owner.toBase58()}:${subAccountId}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return Response.json(cached.value, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const value = await loadVelocityPosition(owner, subAccountId, network as VelocityNetwork);
    if (cache.size > 64) cache.clear();
    cache.set(cacheKey, { value, expiresAt: Date.now() + 20_000 });
    return Response.json(value, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Velocity position read failed:", error);
    return Response.json(
      { error: "Velocity position data is unavailable. Try another Solana RPC endpoint." },
      { status: 502 },
    );
  }
}
