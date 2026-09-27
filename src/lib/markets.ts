export type ForecastMarket = {
  marketId: string;
  eventId: string | null;
  title: string;
  side: "up" | "down";
  state: "live" | "scheduled";
  buyPriceUsd: number | null;
  openTime: number;
  closeTime: number;
  rulesPrimary: string;
};

type JupiterMarket = {
  marketId?: unknown;
  eventId?: unknown;
  title?: unknown;
  provider?: unknown;
  tradable?: unknown;
  openTime?: unknown;
  closeTime?: unknown;
  rulesPrimary?: unknown;
  pricing?: { buyYesPriceUsd?: unknown };
};

type JupiterEvent = {
  eventId?: unknown;
  markets?: JupiterMarket[];
};

function quote(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const native = Number(value);
  if (!Number.isFinite(native) || native <= 0 || native >= 1_000_000) return null;
  return native / 1_000_000;
}

export function normalizeForecastMarket(
  market: JupiterMarket,
  eventId: string | null,
  nowSeconds = Math.floor(Date.now() / 1000),
): ForecastMarket | null {
  if (market.provider !== "bisonfi" || typeof market.marketId !== "string") return null;
  const side = market.marketId.endsWith("-UP")
    ? "up"
    : market.marketId.endsWith("-DOWN")
      ? "down"
      : null;
  if (!market.marketId.startsWith("BISON-") || !side) return null;
  const openTime = Number(market.openTime);
  const closeTime = Number(market.closeTime);
  if (
    !Number.isFinite(openTime) ||
    !Number.isFinite(closeTime) ||
    openTime <= 0 ||
    closeTime <= openTime ||
    closeTime <= nowSeconds
  ) return null;
  const live = market.tradable === true && openTime <= nowSeconds;
  if (!live && openTime <= nowSeconds) return null;

  return {
    marketId: market.marketId,
    eventId: typeof market.eventId === "string" ? market.eventId : eventId,
    title:
      typeof market.title === "string" &&
      !["up", "down"].includes(market.title.toLowerCase())
        ? market.title
        : `BTC ${side.toUpperCase()} · 15 min`,
    side,
    state: live ? "live" : "scheduled",
    buyPriceUsd: live ? quote(market.pricing?.buyYesPriceUsd) : null,
    openTime,
    closeTime,
    rulesPrimary: typeof market.rulesPrimary === "string" ? market.rulesPrimary : "",
  };
}

export function normalizeForecastMarkets(
  payload: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
): ForecastMarket[] {
  const data = (payload as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];

  const byId = new Map<string, ForecastMarket>();
  for (const event of data as JupiterEvent[]) {
    if (!Array.isArray(event.markets)) continue;
    for (const rawMarket of event.markets) {
      const market = normalizeForecastMarket(
        rawMarket,
        typeof event.eventId === "string" ? event.eventId : null,
        nowSeconds,
      );
      if (market) byId.set(market.marketId, market);
    }
  }

  return [...byId.values()].sort((a, b) =>
    (a.state === "live" ? 0 : 1) - (b.state === "live" ? 0 : 1) ||
    a.openTime - b.openTime ||
    a.side.localeCompare(b.side),
  );
}
