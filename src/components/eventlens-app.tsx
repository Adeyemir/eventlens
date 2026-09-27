"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BtcMarketChart from "@/components/btc-market-chart";
import type { ForecastMarket } from "@/lib/markets";
import {
  buildScenarioSeries,
  calculateScenario,
  DEFAULT_SCENARIO,
  type ScenarioInputs,
  type ScenarioPoint,
} from "@/lib/scenario";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const priceFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function signedUsd(value: number) {
  return `${value >= 0 ? "+" : "−"}${usd.format(Math.abs(value))}`;
}

function formatTime(value: number | string | null) {
  if (value === null) return "Time unavailable";
  const date = new Date(typeof value === "number" ? value * 1000 : value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function fetchMarkets(): Promise<ForecastMarket[]> {
  const response = await fetch("/api/markets", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Market request failed.");
  return result.markets;
}

function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  min = 0,
  max,
  step = "any",
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: string;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-control">
        {prefix && <span className="field-affix">{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix && <span className="field-affix">{suffix}</span>}
      </span>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function PayoffChart({
  series,
  selected,
  threshold,
}: {
  series: ScenarioPoint[];
  selected: ScenarioPoint;
  threshold: number;
}) {
  const width = 760;
  const height = 330;
  const left = 62;
  const right = 18;
  const top = 25;
  const bottom = 47;
  const minPrice = series[0].btcPrice;
  const maxPrice = series[series.length - 1].btcPrice;
  const values = series.flatMap((point) => [point.perpPnl, point.combinedPnl]);
  const maxAbs = Math.max(100, ...values.map((value) => Math.abs(value))) * 1.13;
  const x = (price: number) =>
    left + ((price - minPrice) / (maxPrice - minPrice)) * (width - left - right);
  const y = (pnl: number) =>
    top + ((maxAbs - pnl) / (2 * maxAbs)) * (height - top - bottom);
  const line = (key: "perpPnl" | "combinedPnl") =>
    series
      .map((point, index) =>
        `${index === 0 ? "M" : "L"}${x(point.btcPrice).toFixed(2)},${y(point[key]).toFixed(2)}`,
      )
      .join(" ");
  const ticks = Array.from({ length: 5 }, (_, index) => maxAbs - (index * maxAbs) / 2);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Perp and combined profit or loss across BTC settlement prices">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={left} y1={y(tick)} x2={width - right} y2={y(tick)} className="grid-line" />
            <text x={left - 12} y={y(tick) + 4} textAnchor="end" className="chart-label">
              {tick === 0 ? "$0" : `${tick > 0 ? "+" : "−"}$${Math.round(Math.abs(tick))}`}
            </text>
          </g>
        ))}
        <line x1={x(threshold)} y1={top} x2={x(threshold)} y2={height - bottom} className="threshold-line" />
        <text x={x(threshold) + 6} y={top + 13} className="chart-threshold-label">MARKET LINE</text>
        <path d={line("perpPnl")} className="perp-line" />
        <path d={line("combinedPnl")} className="combined-line" />
        <line x1={x(selected.btcPrice)} y1={top} x2={x(selected.btcPrice)} y2={height - bottom} className="selected-line" />
        <circle cx={x(selected.btcPrice)} cy={y(selected.combinedPnl)} r="7" className="selected-dot-outer" />
        <circle cx={x(selected.btcPrice)} cy={y(selected.combinedPnl)} r="3.5" className="selected-dot" />
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const price = minPrice + (maxPrice - minPrice) * ratio;
          return (
            <text key={ratio} x={x(price)} y={height - 16} textAnchor="middle" className="chart-label">
              ${(price / 1000).toFixed(1)}k
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default function EventLensApp() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [chartView, setChartView] = useState<"market" | "payoff">("market");
  const [inputs, setInputs] = useState<ScenarioInputs>(DEFAULT_SCENARIO);
  const [selectedPrice, setSelectedPrice] = useState(63_000);
  const [markets, setMarkets] = useState<ForecastMarket[]>([]);
  const [marketStatus, setMarketStatus] = useState<"idle" | "loading" | "loaded" | "error">("loading");
  const [marketError, setMarketError] = useState("");
  const [selectedMarket, setSelectedMarket] = useState<ForecastMarket | null>(null);
  const [referenceNeeded, setReferenceNeeded] = useState(false);
  const priceEditedRef = useRef(false);
  const liveAnchorAppliedRef = useRef(false);

  const selected = useMemo(() => calculateScenario(inputs, selectedPrice), [inputs, selectedPrice]);
  const series = useMemo(() => buildScenarioSeries(inputs, selectedPrice), [inputs, selectedPrice]);
  const minPrice = series[0].btcPrice;
  const maxPrice = series[series.length - 1].btcPrice;
  const scenarioCards = [
    { label: "BTC drops 3%", price: inputs.entryPrice * 0.97 },
    { label: "At market line", price: inputs.thresholdPrice },
    { label: "BTC rises 3%", price: inputs.entryPrice * 1.03 },
  ];

  function update<K extends keyof ScenarioInputs>(key: K, value: ScenarioInputs[K]) {
    if (key === "entryPrice" || key === "thresholdPrice") priceEditedRef.current = true;
    setInputs((current) => ({ ...current, [key]: value }));
  }

  const useLiveSpotAsStartingPoint = useCallback((price: number) => {
    if (liveAnchorAppliedRef.current || priceEditedRef.current) return;
    liveAnchorAppliedRef.current = true;
    const rounded = Math.round(price);
    setInputs((current) => ({ ...current, entryPrice: rounded, thresholdPrice: rounded }));
    setSelectedPrice(rounded);
  }, []);

  const loadMarkets = useCallback(async () => {
    try {
      setMarkets(await fetchMarkets());
      setMarketError("");
      setMarketStatus("loaded");
    } catch (error) {
      setMarketStatus("error");
      setMarketError(error instanceof Error ? error.message : "Market request failed.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchMarkets().then((currentMarkets) => {
      if (!active) return;
      setMarkets(currentMarkets);
      setMarketStatus("loaded");
    }).catch((error) => {
      if (!active) return;
      setMarketStatus("error");
      setMarketError(error instanceof Error ? error.message : "Market request failed.");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest(".brand-cluster")) setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", closeOutside);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pointerdown", closeOutside);
    };
  }, [menuOpen]);

  function selectMarket(market: ForecastMarket) {
    setSelectedMarket(market);
    setReferenceNeeded(true);
    setInputs((current) => ({
      ...current,
      predictionSide: market.side,
      predictionPrice: market.buyPriceUsd,
    }));
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand-cluster">
          <button className="menu-trigger" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-controls="site-menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><span /><span /><span /></button>
          <a className="brand" href="#top" aria-label="EventLens home"><span className="brand-lens" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="10.5" cy="10.5" r="5.8" stroke="currentColor" strokeWidth="2" /><path d="m15 15 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></span><span className="brand-word">eventlens<span>.</span></span></a>
          {menuOpen && <div id="site-menu" className="menu-popover"><strong>Navigate</strong><a href="#lab" onClick={() => setMenuOpen(false)}>Workspace <span>↗</span></a><a href="#markets" onClick={() => setMenuOpen(false)}>Forecast markets <span>↗</span></a><a href="#method" onClick={() => setMenuOpen(false)}>Model notes <span>↗</span></a></div>}
        </div>
        <nav aria-label="Main navigation">
          <a href="#lab">Workspace</a>
          <a href="#markets">Markets</a>
          <a href="#method">Model notes</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">BTC PERPS &amp; FORECAST</div>
            <h1>One position.<span>Every outcome.</span></h1>
            <p>Explore how a BTC perpetual and a prediction contract behave together at settlement.</p>
          </div>
        </section>

        <section id="lab" className="lab-section">
          <div className="section-heading">
            <div>
                <div className="eyebrow">01 / WORKSPACE</div>
                <h2>Scenario analysis</h2>
                <p>Set a closing price to inspect both legs of the position.</p>
            </div>
            <span className="source-badge">Hypothetical position</span>
          </div>

          <div className="lab-grid">
            <div className="analysis-column">
              <div className="panel chart-panel">
                <div className="analysis-tab-bar" role="tablist" aria-label="Chart view">
                  <button type="button" role="tab" aria-selected={chartView === "market"} className={chartView === "market" ? "selected" : ""} onClick={() => setChartView("market")}>BTC price</button>
                  <button type="button" role="tab" aria-selected={chartView === "payoff"} className={chartView === "payoff" ? "selected" : ""} onClick={() => setChartView("payoff")}>Risk payoff</button>
                  <span className="analysis-tab-note">Market context / scenario model</span>
                </div>
                {chartView === "market" ? <BtcMarketChart onLivePrice={useLiveSpotAsStartingPoint} /> : <div className="payoff-chart-content">
                  <div className="panel-topline">
                    <div><span className="panel-kicker">SETTLEMENT VIEW</span><h3>Payoff at settlement</h3></div>
                    <div className="legend"><span><i className="legend-line legend-perp" /> Perp only</span><span><i className="legend-line legend-combined" /> Combined</span></div>
                  </div>
                  <PayoffChart series={series} selected={selected} threshold={inputs.thresholdPrice} />
                </div>}
                <div className="scenario-slider">
                <div className="slider-head"><label htmlFor="btc-price">Hypothetical BTC close</label><strong>{priceFormat.format(selectedPrice)}</strong></div>
                <input
                  id="btc-price"
                  className="price-slider"
                  type="range"
                  min={Math.floor(minPrice)}
                  max={Math.ceil(maxPrice)}
                  step="1"
                  value={selectedPrice}
                  onChange={(event) => { priceEditedRef.current = true; setSelectedPrice(Number(event.target.value)); }}
                />
                <div className="slider-range"><span>{priceFormat.format(minPrice)}</span><span>{priceFormat.format(maxPrice)}</span></div>
                </div>
              </div>

              <div className="metric-grid">
                <div className="metric-card"><span>PERP P&L</span><strong className={selected.perpPnl >= 0 ? "positive" : "negative"}>{signedUsd(selected.perpPnl)}</strong><small>{inputs.direction.toUpperCase()} {inputs.positionSizeBtc} BTC</small></div>
                <div className="metric-card"><span>PREDICTION P&L</span><strong className={selected.predictionPnl >= 0 ? "positive" : "negative"}>{signedUsd(selected.predictionPnl)}</strong><small>{selected.predictionWins ? "Contract wins" : "Contract expires at $0"}</small></div>
                <div className="metric-card metric-highlight"><span>COMBINED P&L</span><strong className={selected.combinedPnl >= 0 ? "positive" : "negative"}>{signedUsd(selected.combinedPnl)}</strong><small>Before fees and funding</small></div>
              </div>

              <div className="panel outcomes-panel">
                <div className="panel-topline"><div><span className="panel-kicker">QUICK COMPARISON</span><h3>Three possible closes</h3></div></div>
                <div className="outcome-list">
                  {scenarioCards.map((card) => {
                    const result = calculateScenario(inputs, card.price);
                    return <button key={card.label} className="outcome-row" onClick={() => { priceEditedRef.current = true; setSelectedPrice(Math.round(card.price)); }}>
                      <span><strong>{card.label}</strong><small>{priceFormat.format(card.price)}</small></span>
                      <span className={result.combinedPnl >= 0 ? "positive" : "negative"}>{signedUsd(result.combinedPnl)}</span>
                      <span className="row-arrow">↗</span>
                    </button>;
                  })}
                </div>
              </div>
            </div>

            <aside className="controls-column">
              <div className="panel setup-panel">
                <div className="panel-topline"><div><span className="panel-kicker">INPUTS</span><h3>Position setup</h3></div></div>
                <div className="control-section">
                  <div className="control-title"><span className="control-number">01</span><h4>Perpetual position</h4></div>
                  <div className="segmented" role="group" aria-label="Perp direction">
                    <button aria-pressed={inputs.direction === "long"} className={inputs.direction === "long" ? "active" : ""} onClick={() => update("direction", "long")}>Long</button>
                    <button aria-pressed={inputs.direction === "short"} className={inputs.direction === "short" ? "active" : ""} onClick={() => update("direction", "short")}>Short</button>
                  </div>
                  <div className="field-grid">
                    <NumberField label="Entry price" value={inputs.entryPrice} onChange={(value) => update("entryPrice", value)} prefix="$" min={1} step="100" />
                    <NumberField label="Position size" value={inputs.positionSizeBtc} onChange={(value) => update("positionSizeBtc", value)} suffix="BTC" step="0.01" />
                    <NumberField label="Collateral" value={inputs.collateralUsd} onChange={(value) => update("collateralUsd", value)} prefix="$" step="50" />
                    <NumberField label="Assumed maintenance" value={inputs.maintenanceMarginRate * 100} onChange={(value) => update("maintenanceMarginRate", value / 100)} suffix="%" min={0} max={100} step="0.1" />
                  </div>
                </div>
                <div className="control-section">
                  <div className="control-title"><span className="control-number">02</span><h4>Prediction contract</h4></div>
                  <div className="segmented" role="group" aria-label="Prediction side">
                    <button aria-pressed={inputs.predictionSide === "up"} className={inputs.predictionSide === "up" ? "active" : ""} onClick={() => update("predictionSide", "up")}>BTC up</button>
                    <button aria-pressed={inputs.predictionSide === "down"} className={inputs.predictionSide === "down" ? "active" : ""} onClick={() => update("predictionSide", "down")}>BTC down</button>
                  </div>
                  <div className="field-grid">
                    <NumberField label="Opening reference price" value={inputs.thresholdPrice} onChange={(value) => { update("thresholdPrice", value); setReferenceNeeded(false); }} prefix="$" min={1} step="100" hint={referenceNeeded ? "Enter this round's verified opening BTC price." : undefined} />
                    <NumberField label="Price per contract" value={inputs.predictionPrice} onChange={(value) => update("predictionPrice", value)} prefix="$" min={0.01} max={0.99} step="0.01" />
                    <NumberField label="Amount spent" value={inputs.predictionStakeUsd} onChange={(value) => update("predictionStakeUsd", value)} prefix="$" min={0} step="5" />
                  </div>
                  <p className="contract-rule">{inputs.predictionSide.toUpperCase()} pays $1 per contract if BTC closes {inputs.predictionSide === "up" ? "at or above" : "below"} {priceFormat.format(inputs.thresholdPrice)}.</p>
                </div>
              </div>

              <div className={`risk-card ${selected.marginBuffer <= 0 ? "risk-danger" : ""}`}>
                <div className="risk-icon">!</div>
                <div><strong>{selected.marginBuffer <= 0 ? "Maintenance level crossed" : "Margin buffer at this price"}</strong><p>{selected.marginBuffer <= 0 ? "The perp may be liquidated before the prediction contract settles." : `${usd.format(selected.marginBuffer)} above the assumed maintenance requirement.`}</p></div>
              </div>
            </aside>
          </div>
        </section>

        <section id="markets" className="markets-section">
          <div className="section-heading"><div><div className="eyebrow">02 / LIVE MARKETS</div><h2>Forecast rounds</h2><p>Select a Jupiter BTC market to use its indicative quote in the scenario.</p></div></div>
          <div className="panel market-panel">
            <div className="market-panel-heading"><div className="market-source"><span className="market-source-mark">J</span><span><strong>Jupiter Forecast</strong><small>BTC · 15-minute markets</small></span></div><button className="primary-button" onClick={() => { setMarketStatus("loading"); void loadMarkets(); }} disabled={marketStatus === "loading"}>{marketStatus === "loading" ? "Loading…" : "Refresh markets"}<span>↗</span></button></div>
            {(marketStatus === "idle" || (marketStatus === "loading" && markets.length === 0)) && <p className="market-placeholder">Loading current BTC rounds…</p>}
            {marketStatus === "error" && <p className="market-error" role="status">{marketError}</p>}
            {marketStatus === "loaded" && markets.length === 0 && <p className="market-placeholder">No tradable BTC rounds are available right now. Jupiter schedules these rounds rather than running them continuously.</p>}
            {markets.length > 0 && <div className="market-list">{markets.slice(0, 8).map((market) => <button key={market.marketId} className={`market-row ${selectedMarket?.marketId === market.marketId ? "market-selected" : ""}`} onClick={() => selectMarket(market)}><span className={`market-side ${market.side}`}>{market.side === "up" ? "↑" : "↓"}</span><span className="market-description"><strong>{market.title}</strong><small>Closes {formatTime(market.closeTime)} · {market.side.toUpperCase()} contract</small></span><span className="market-quote">{usd.format(market.buyPriceUsd)}<small>BUY PRICE</small></span><span className="row-arrow">↗</span></button>)}</div>}
            {selectedMarket && <p className="market-footnote">Live quote selected for {selectedMarket.side.toUpperCase()}. Confirm the round&apos;s opening BTC price and enter it in the scenario above. Displayed prices are indicative; execution price may differ.</p>}
          </div>
        </section>

        <section id="method" className="method-section"><div><div className="eyebrow">MODEL NOTES</div><h2>What this includes</h2></div><p>The chart combines perpetual P&amp;L with a binary contract payout at settlement. Estimates exclude funding, trading fees, slippage, and liquidation along the price path. Prediction payouts are not treated as perp collateral; maintenance margin is an input, not a live venue value.</p></section>
      </main>
      <footer><span className="brand footer-brand">eventlens<span>.</span></span><p>Built for exploring exposure, not placing orders.</p><span>SOLANA · DEMO</span></footer>
    </div>
  );
}
