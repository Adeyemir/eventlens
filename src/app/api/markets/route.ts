import { normalizeForecastMarkets } from "@/lib/markets";

export async function GET() {
  const apiKey = process.env.JUPITER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "JUPITER_API_KEY is not configured. Add it to .env.local to load live markets." },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(
      "https://api.jup.ag/prediction/v1/events?provider=bisonfi&category=crypto&tag=15m&includeMarkets=true",
      { headers: { "x-api-key": apiKey }, cache: "no-store" },
    );

    if (!response.ok) {
      return Response.json(
        { error: `Jupiter market request failed (${response.status}).` },
        { status: 502 },
      );
    }

    const markets = normalizeForecastMarkets(await response.json());
    return Response.json({ markets, fetchedAt: new Date().toISOString() });
  } catch {
    return Response.json(
      { error: "Jupiter market data is temporarily unavailable." },
      { status: 502 },
    );
  }
}
