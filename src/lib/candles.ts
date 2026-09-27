export type BtcCandle = {
  time: number;
  low: number;
  high: number;
  open: number;
  close: number;
  volume: number;
};

export type BtcQuote = { price: number; time: number; kind: "trade" | "candle" };

export function normalizeBitstampCandles(payload: unknown): BtcCandle[] {
  const rows = (payload as { data?: { ohlc?: unknown } } | null)?.data?.ohlc;
  if (!Array.isArray(rows)) return [];

  const byTime = new Map<number, BtcCandle>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const values = row as Record<string, unknown>;
    const time = Number(values.timestamp);
    const low = Number(values.low);
    const high = Number(values.high);
    const open = Number(values.open);
    const close = Number(values.close);
    const volume = Number(values.volume);
    if (
      ![time, low, high, open, close, volume].every(Number.isFinite) ||
      time <= 0 || low <= 0 || open <= 0 || close <= 0 || volume < 0 ||
      high < Math.max(low, open, close) ||
      low > Math.min(open, close)
    ) continue;

    byTime.set(time, { time, low, high, open, close, volume });
  }

  return [...byTime.values()].sort((a, b) => a.time - b.time).slice(-100);
}

export function normalizeBitstampTicker(payload: unknown): BtcQuote | null {
  if (!payload || typeof payload !== "object") return null;
  const ticker = payload as Record<string, unknown>;
  const price = Number(ticker.last);
  const time = Number(ticker.timestamp);
  return Number.isFinite(price) && price > 0 && Number.isFinite(time) && time > 0
    ? { price, time, kind: "trade" }
    : null;
}
