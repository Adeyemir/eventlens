import test from "node:test";
import assert from "node:assert/strict";
import { sizeHedge } from "../src/lib/hedge.ts";

test("a long position is sized against a DOWN outcome that wins below the opening line", () => {
  const result = sizeHedge({
    direction: "long",
    sizeBtc: 0.1,
    currentPriceUsd: 100_000,
    openingPriceUsd: 99_000,
    contractPriceUsd: 0.4,
  });
  assert.equal(result?.side, "down");
  assert.equal(result?.adverseCloseUsd, 97_000);
  assert.equal(result?.perpChangeUsd, -300);
  assert.equal(result?.stakeUsd, 200);
  assert.equal(result?.combinedChangeUsd, 0);
});

test("a distant opening line expands the target and caps the suggested order", () => {
  const result = sizeHedge({
    direction: "short",
    sizeBtc: 1,
    currentPriceUsd: 100_000,
    openingPriceUsd: 110_000,
    contractPriceUsd: 0.5,
  });
  assert.equal(result?.side, "up");
  assert.equal(result?.adverseCloseUsd, 110_000);
  assert.equal(result?.stakeUsd, 250);
  assert.equal(result?.cappedByOrderLimit, true);
  assert.equal(result?.combinedChangeUsd, -9_750);
});
