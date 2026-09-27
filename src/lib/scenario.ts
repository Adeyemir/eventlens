export type PerpDirection = "long" | "short";
export type PredictionSide = "up" | "down";

export type ScenarioInputs = {
  entryPrice: number;
  positionSizeBtc: number;
  collateralUsd: number;
  direction: PerpDirection;
  thresholdPrice: number;
  predictionSide: PredictionSide;
  predictionPrice: number;
  predictionStakeUsd: number;
  maintenanceMarginRate: number;
};

export type ScenarioPoint = {
  btcPrice: number;
  perpPnl: number;
  predictionPnl: number;
  combinedPnl: number;
  perpEquity: number;
  maintenanceRequirement: number;
  marginBuffer: number;
  predictionWins: boolean;
};

export const DEFAULT_SCENARIO: ScenarioInputs = {
  entryPrice: 64_000,
  positionSizeBtc: 0.08,
  collateralUsd: 850,
  direction: "long",
  thresholdPrice: 64_800,
  predictionSide: "down",
  predictionPrice: 0.38,
  predictionStakeUsd: 75,
  maintenanceMarginRate: 0.03,
};

export function calculateScenario(
  inputs: ScenarioInputs,
  btcPrice: number,
): ScenarioPoint {
  const price = Math.max(0, btcPrice);
  const size = Math.max(0, inputs.positionSizeBtc);
  const stake = Math.max(0, inputs.predictionStakeUsd);
  const contractPrice = Math.min(0.99, Math.max(0.01, inputs.predictionPrice));
  const direction = inputs.direction === "long" ? 1 : -1;
  const perpPnl = direction * size * (price - inputs.entryPrice);
  const upWins = price >= inputs.thresholdPrice;
  const predictionWins = inputs.predictionSide === "up" ? upWins : !upWins;
  const contracts = stake / contractPrice;
  const predictionPnl = contracts * (predictionWins ? 1 : 0) - stake;
  const perpEquity = inputs.collateralUsd + perpPnl;
  const maintenanceRequirement =
    price * size * Math.max(0, inputs.maintenanceMarginRate);

  return {
    btcPrice: price,
    perpPnl,
    predictionPnl,
    combinedPnl: perpPnl + predictionPnl,
    perpEquity,
    maintenanceRequirement,
    marginBuffer: perpEquity - maintenanceRequirement,
    predictionWins,
  };
}

export function buildScenarioSeries(
  inputs: ScenarioInputs,
  focusPrice: number,
): ScenarioPoint[] {
  const anchor = Math.max(inputs.entryPrice, inputs.thresholdPrice, focusPrice, 1);
  const lower = Math.max(
    1,
    Math.min(inputs.entryPrice, inputs.thresholdPrice, focusPrice) - anchor * 0.065,
  );
  const upper =
    Math.max(inputs.entryPrice, inputs.thresholdPrice, focusPrice) + anchor * 0.065;
  const points = Array.from({ length: 101 }, (_, index) =>
    lower + ((upper - lower) * index) / 100,
  );

  // A binary payout jumps at the threshold; preserve both sides in the chart.
  if (inputs.thresholdPrice > lower && inputs.thresholdPrice < upper) {
    points.push(inputs.thresholdPrice - 0.001, inputs.thresholdPrice);
  }

  return points
    .sort((a, b) => a - b)
    .map((price) => calculateScenario(inputs, price));
}
