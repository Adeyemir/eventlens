import { normalizeForecastMarket, normalizeForecastMarkets } from "@/lib/markets";

export async function GET(request: Request) {
  const apiKey = process.env.JUPITER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "JUPITER_API_KEY is not configured. Add it to .env.local to load live markets." },
      { status: 503 },
    );
  }

  try {
    const marketId = new URL(request.url).searchParams.get("marketId");
    if (marketId && !/^BISON-[A-Za-z0-9-]{8,90}-(UP|DOWN)$/.test(marketId)) {
      return Response.json({ error: "Invalid Forecast market ID." }, { status: 400 });
    }
    const path = marketId
      ? `/markets/${encodeURIComponent(marketId)}`
      : "/events?provider=bisonfi&category=crypto&tag=15m&includeMarkets=true";
    const response = await fetch(`https://api.jup.ag/prediction/v1${path}`, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      return Response.json(
        { error: `Jupiter market request failed (${response.status}).` },
        { status: 502 },
      );
    }

    const payload = await response.json();
    if (marketId) {
      const market = normalizeForecastMarket(payload, null);
      if (!market || market.marketId !== marketId) {
        return Response.json({ error: "This Forecast side is no longer active." }, { status: 404 });
      }
      return Response.json({ market, fetchedAt: new Date().toISOString() });
    }
    const markets = normalizeForecastMarkets(payload);
    return Response.json({ markets, fetchedAt: new Date().toISOString() });
  } catch {
    return Response.json(
      { error: "Jupiter market data is temporarily unavailable." },
      { status: 502 },
    );
  }
}
