import type { PerpDirection, PredictionSide } from "./scenario";

export type HedgeProposal = {
  side: PredictionSide;
  adverseCloseUsd: number;
  adverseMovePercent: number;
  perpChangeUsd: number;
  stakeUsd: number;
  contracts: number;
  winningPredictionPnlUsd: number;
  combinedChangeUsd: number;
  coveragePercent: number;
  cappedByOrderLimit: boolean;
};

export function adverseSide(direction: PerpDirection): PredictionSide {
  return direction === "long" ? "down" : "up";
}

export function sizeHedge({
  direction,
  sizeBtc,
  currentPriceUsd,
  openingPriceUsd,
  contractPriceUsd,
}: {
  direction: PerpDirection;
  sizeBtc: number;
  currentPriceUsd: number;
  openingPriceUsd: number;
  contractPriceUsd: number;
}): HedgeProposal | null {
  if (
    ![sizeBtc, currentPriceUsd, openingPriceUsd, contractPriceUsd].every(Number.isFinite) ||
    sizeBtc <= 0 ||
    currentPriceUsd <= 0 ||
    openingPriceUsd <= 0.01 ||
    contractPriceUsd <= 0 ||
    contractPriceUsd >= 1
  ) return null;

  // Move at least 3% against the perp, crossing the binary round's open line.
  const adverseCloseUsd = direction === "long"
    ? Math.max(0.01, Math.min(currentPriceUsd * 0.97, openingPriceUsd - 0.01))
    : Math.max(currentPriceUsd * 1.03, openingPriceUsd);
  if (direction === "long" && adverseCloseUsd >= openingPriceUsd) return null;
  const lossUsd = sizeBtc * Math.abs(adverseCloseUsd - currentPriceUsd);
  if (lossUsd <= 0) return null;

  // A winning $1 contract returns stake / price; the stake itself is the premium.
  const stakeToCoverLoss = lossUsd * contractPriceUsd / (1 - contractPriceUsd);
  const stakeUsd = Math.min(250, Math.max(5, Math.ceil(stakeToCoverLoss * 100) / 100));
  const winningPredictionPnlUsd = stakeUsd * (1 / contractPriceUsd - 1);

  return {
    side: adverseSide(direction),
    adverseCloseUsd,
    adverseMovePercent: Math.abs(adverseCloseUsd / currentPriceUsd - 1) * 100,
    perpChangeUsd: -lossUsd,
    stakeUsd,
    contracts: stakeUsd / contractPriceUsd,
    winningPredictionPnlUsd,
    combinedChangeUsd: -lossUsd + winningPredictionPnlUsd,
    coveragePercent: winningPredictionPnlUsd / lossUsd * 100,
    cappedByOrderLimit: stakeToCoverLoss > 250,
  };
}
