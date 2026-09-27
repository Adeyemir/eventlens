import test from "node:test";
import assert from "node:assert/strict";
import { normalizeForecastMarkets } from "../src/lib/markets.ts";

test("Forecast market quotes convert from micro dollars and identify the side", () => {
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
      ],
    }],
  });

  assert.equal(markets.length, 1);
  assert.equal(markets[0].side, "down");
  assert.equal(markets[0].buyPriceUsd, 0.683672);
  assert.equal(markets[0].title, "BTC DOWN · 15 min");
});
