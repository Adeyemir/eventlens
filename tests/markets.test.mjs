import test from "node:test";
import assert from "node:assert/strict";
import { normalizeForecastMarkets } from "../src/lib/markets.ts";

test("Forecast separates live and scheduled sides without inventing missing quotes", () => {
  const markets = normalizeForecastMarkets({
    data: [{
      markets: [
        {
          marketId: "BISON-example-DOWN",
          title: "Down",
          provider: "bisonfi",
          tradable: true,
          openTime: 1790497800,
          closeTime: 1790498700,
          pricing: { buyYesPriceUsd: 683672 },
        },
        {
          marketId: "BISON-future-UP",
          title: "Up",
          provider: "bisonfi",
          tradable: false,
          openTime: 1790500000,
          closeTime: 1790500900,
        },
      ],
    }],
  }, 1790498000);

  assert.equal(markets.length, 2);
  assert.equal(markets[0].side, "down");
  assert.equal(markets[0].state, "live");
  assert.equal(markets[0].buyPriceUsd, 0.683672);
  assert.equal(markets[0].title, "BTC DOWN · 15 min");
  assert.equal(markets[1].state, "scheduled");
  assert.equal(markets[1].buyPriceUsd, null);
});
