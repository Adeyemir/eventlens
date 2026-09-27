import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateScenario,
  buildScenarioSeries,
  DEFAULT_SCENARIO,
} from "../src/lib/scenario.ts";

test("a down contract wins below the threshold while a long perp loses", () => {
  const result = calculateScenario(DEFAULT_SCENARIO, 63_000);
  assert.equal(result.perpPnl, -80);
  assert.equal(result.predictionWins, true);
  assert.ok(Math.abs(result.predictionPnl - 122.36842105263159) < 0.000001);
  assert.ok(result.marginBuffer > 0);
});

test("a down contract expires at zero at the exact threshold", () => {
  const result = calculateScenario(DEFAULT_SCENARIO, 64_800);
  assert.equal(result.predictionWins, false);
  assert.equal(result.predictionPnl, -75);
  assert.equal(result.perpPnl, 64);
  assert.equal(result.combinedPnl, -11);
});

test("prediction payout never increases perp margin buffer", () => {
  const inputs = { ...DEFAULT_SCENARIO, collateralUsd: 160 };
  const result = calculateScenario(inputs, 60_000);
  assert.ok(result.predictionPnl > 0);
  assert.ok(result.marginBuffer < 0);
});

test("chart samples the two sides of the binary payoff jump", () => {
  const series = buildScenarioSeries(DEFAULT_SCENARIO, 63_000);
  const before = series.find((point) => point.btcPrice === 64_800 - 0.001);
  const at = series.find((point) => point.btcPrice === 64_800);
  assert.ok(before);
  assert.ok(at);
  assert.equal(before.predictionWins, true);
  assert.equal(at.predictionWins, false);
});
