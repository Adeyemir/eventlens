export type ForecastMarket = {
  marketId: string;
  title: string;
  side: "up" | "down";
  buyPriceUsd: number;
  openTime: number | string | null;
  closeTime: number | string | null;
  rulesPrimary: string;
};

type JupiterMarket = {
  marketId?: unknown;
  title?: unknown;
  provider?: unknown;
  tradable?: unknown;
  openTime?: unknown;
  closeTime?: unknown;
  rulesPrimary?: unknown;
  pricing?: { buyYesPriceUsd?: unknown };
};

type JupiterEvent = {
  markets?: JupiterMarket[];
};

function timeValue(value: unknown): number | string | null {
  return typeof value === "number" || typeof value === "string" ? value : null;
}

export function normalizeForecastMarkets(payload: unknown): ForecastMarket[] {
  const data = (payload as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];

  return data.flatMap((event: JupiterEvent) => {
    if (!Array.isArray(event.markets)) return [];

    return event.markets.flatMap((market): ForecastMarket[] => {
      if (
        market.provider !== "bisonfi" ||
        market.tradable !== true ||
        typeof market.marketId !== "string"
      ) {
        return [];
      }

      const side = market.marketId.endsWith("-UP")
        ? "up"
        : market.marketId.endsWith("-DOWN")
          ? "down"
          : null;
      const nativePrice = Number(market.pricing?.buyYesPriceUsd);
      if (
        !side ||
        !Number.isFinite(nativePrice) ||
        nativePrice <= 0 ||
        nativePrice > 1_000_000
      ) return [];

      return [
        {
          marketId: market.marketId,
          title:
            typeof market.title === "string" &&
            !["up", "down"].includes(market.title.toLowerCase())
              ? market.title
              : `BTC ${side.toUpperCase()} · 15 min`,
          side,
          buyPriceUsd: nativePrice / 1_000_000,
          openTime: timeValue(market.openTime),
          closeTime: timeValue(market.closeTime),
          rulesPrimary:
            typeof market.rulesPrimary === "string" ? market.rulesPrimary : "",
        },
      ];
    });
  });
}
