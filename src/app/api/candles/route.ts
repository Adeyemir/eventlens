import { normalizeBitstampCandles, normalizeBitstampTicker, type BtcQuote } from "@/lib/candles";

const allowedGranularities = new Set(["60", "300", "900"]);

export async function GET(request: Request) {
  const granularity = new URL(request.url).searchParams.get("granularity") ?? "60";
  if (!allowedGranularities.has(granularity)) {
    return Response.json({ error: "Unsupported candle interval." }, { status: 400 });
  }

  const candleUrl = new URL("https://www.bitstamp.net/api/v2/ohlc/btcusd/");
  candleUrl.searchParams.set("step", granularity);
  candleUrl.searchParams.set("limit", "100");

  const [candleResult, tickerResult] = await Promise.allSettled([
    fetch(candleUrl, { headers: { Accept: "application/json" }, next: { revalidate: 30 }, signal: AbortSignal.timeout(12_000) })
      .then(async (response) => response.ok ? normalizeBitstampCandles(await response.json()) : []),
    fetch("https://www.bitstamp.net/api/v2/ticker/btcusd/", { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(12_000) })
      .then(async (response) => response.ok ? normalizeBitstampTicker(await response.json()) : null),
  ]);

  const candles = candleResult.status === "fulfilled" ? candleResult.value : [];
  const ticker = tickerResult.status === "fulfilled" ? tickerResult.value : null;
  const latest = candles.at(-1);
  const now = Math.floor(Date.now() / 1000);
  const freshTicker = ticker && ticker.time <= now + 60 && now - ticker.time <= 180 ? ticker : null;
  const candlesAreFresh = Boolean(latest && latest.time <= now + 60 && now - latest.time <= Number(granularity) * 2 + 60);
  const freshCandle = latest && candlesAreFresh
    ? { price: latest.close, time: latest.time, kind: "candle" as const }
    : null;
  const quote: BtcQuote | null = freshTicker ?? freshCandle;
  if (!quote) return Response.json({ error: "Live BTC/USD price is temporarily unavailable." }, { status: 502 });

  return Response.json({ candles: candlesAreFresh ? candles : [], quote, source: "Bitstamp BTC/USD spot", fetchedAt: new Date().toISOString() });
}
