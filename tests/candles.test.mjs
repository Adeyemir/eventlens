import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBitstampCandles, normalizeBitstampTicker } from "../src/lib/candles.ts";

test("Bitstamp candles are validated, sorted, and deduplicated", () => {
  const candles = normalizeBitstampCandles({ data: { ohlc: [
    { timestamp: "120", low: "99", high: "106", open: "100", close: "105", volume: "2" },
    { timestamp: "60", low: "95", high: "102", open: "101", close: "96", volume: "4" },
    { timestamp: "120", low: "99", high: "106", open: "100", close: "104", volume: "3" },
    { timestamp: "180", low: "105", high: "100", open: "103", close: "102", volume: "1" },
    { timestamp: "240", low: "90", high: "110", open: "100", close: "105", volume: "-1" },
  ] } });

  assert.deepEqual(candles.map((candle) => candle.time), [60, 120]);
  assert.equal(candles[1].close, 104);
  assert.equal(candles[1].volume, 3);
});

test("Bitstamp ticker returns a real trade price only for valid responses", () => {
  assert.deepEqual(normalizeBitstampTicker({ last: "84972.92", timestamp: "1790513091" }), {
    price: 84972.92, time: 1790513091, kind: "trade",
  });
  assert.equal(normalizeBitstampTicker({ last: "0", timestamp: "1790513091" }), null);
});
