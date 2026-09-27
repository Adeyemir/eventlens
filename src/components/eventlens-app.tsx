"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BtcMarketChart from "@/components/btc-market-chart";
import { adverseSide, sizeHedge } from "@/lib/hedge";
import type { ForecastMarket } from "@/lib/markets";
import type { VelocityLookup, VelocityPosition } from "@/lib/velocity";
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

function countdown(target: number, now: number) {
  const seconds = Math.max(0, target - now);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, "0")}m`
    : `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

async function fetchMarkets(): Promise<ForecastMarket[]> {
  const response = await fetch("/api/markets", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Market request failed.");
  return result.markets;
}

async function fetchMarketDetails(marketId: string): Promise<{ market: ForecastMarket; fetchedAt: string }> {
  const response = await fetch(`/api/markets?marketId=${encodeURIComponent(marketId)}`, {
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Forecast quote unavailable.");
  return result;
}

async function fetchPosition(owner: string, subAccountId: number): Promise<VelocityLookup> {
  const params = new URLSearchParams({ owner: owner.trim(), subaccount: String(subAccountId) });
  const response = await fetch(`/api/position?${params}`, { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Velocity position unavailable.");
  return result;
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
  const [referenceConfirmed, setReferenceConfirmed] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [subAccountId, setSubAccountId] = useState(0);
  const [positionStatus, setPositionStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [positionError, setPositionError] = useState("");
  const [livePosition, setLivePosition] = useState<VelocityPosition | null>(null);
  const [positionEdited, setPositionEdited] = useState(false);
  const [liveSpot, setLiveSpot] = useState<{ price: number; seenAt: number } | null>(null);
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));
  const [quoteError, setQuoteError] = useState("");
  const [selectedQuoteSeenAt, setSelectedQuoteSeenAt] = useState<number | null>(null);
  const priceEditedRef = useRef(false);
  const liveAnchorAppliedRef = useRef(false);
  const selectedMarketIdRef = useRef<string | null>(null);

  const selected = useMemo(() => calculateScenario(inputs, selectedPrice), [inputs, selectedPrice]);
  const series = useMemo(() => buildScenarioSeries(inputs, selectedPrice), [inputs, selectedPrice]);
  const currentSpotPrice = liveSpot && nowSeconds - liveSpot.seenAt <= 180 ? liveSpot.price : null;
  const proposal = useMemo(
    () => currentSpotPrice === null ? null : sizeHedge({
      direction: inputs.direction,
      sizeBtc: inputs.positionSizeBtc,
      currentPriceUsd: currentSpotPrice,
      openingPriceUsd: inputs.thresholdPrice,
      contractPriceUsd: inputs.predictionPrice,
    }),
    [currentSpotPrice, inputs.direction, inputs.positionSizeBtc, inputs.thresholdPrice, inputs.predictionPrice],
  );
  const selectedRoundLive = Boolean(
    selectedMarket?.state === "live" &&
    selectedMarket.closeTime > nowSeconds &&
    selectedMarket.openTime <= nowSeconds,
  );
  const roundLinked = Boolean(
    selectedRoundLive &&
    selectedMarket?.buyPriceUsd !== null &&
    selectedQuoteSeenAt !== null &&
    nowSeconds - selectedQuoteSeenAt <= 60 &&
    referenceConfirmed &&
    inputs.predictionSide === adverseSide(inputs.direction) &&
    inputs.predictionPrice === selectedMarket?.buyPriceUsd,
  );
  const minPrice = series[0].btcPrice;
  const maxPrice = series[series.length - 1].btcPrice;
  const scenarioCards = [
    { label: "BTC drops 3%", price: inputs.entryPrice * 0.97 },
    { label: "At market line", price: inputs.thresholdPrice },
    { label: "BTC rises 3%", price: inputs.entryPrice * 1.03 },
  ];

  function update<K extends keyof ScenarioInputs>(key: K, value: ScenarioInputs[K]) {
    if (key === "entryPrice" || key === "thresholdPrice") priceEditedRef.current = true;
    if (livePosition && (key === "entryPrice" || key === "positionSizeBtc" || key === "direction")) {
      setPositionEdited(true);
    }
    if (key === "thresholdPrice") setReferenceConfirmed(false);
    setInputs((current) => ({ ...current, [key]: value }));
  }

  const useLiveSpotAsStartingPoint = useCallback((price: number) => {
    setLiveSpot({ price, seenAt: Math.floor(Date.now() / 1000) });
    if (liveAnchorAppliedRef.current || priceEditedRef.current) return;
    liveAnchorAppliedRef.current = true;
    const rounded = Math.round(price);
    setInputs((current) => ({ ...current, entryPrice: rounded, thresholdPrice: rounded }));
    setSelectedPrice(rounded);
  }, []);

  async function importPosition() {
    setPositionStatus("loading");
    setPositionError("");
    try {
      const lookup = await fetchPosition(walletAddress, subAccountId);
      if (lookup.status !== "position") {
        setLivePosition(null);
        setPositionStatus("error");
        setPositionError(
          lookup.status === "no-account"
            ? "No Velocity subaccount exists for this address and number."
            : "This Velocity subaccount has no open BTC-PERP position.",
        );
        return;
      }
      const position = lookup.position;
      priceEditedRef.current = true;
      setLivePosition(position);
      setPositionEdited(false);
      setInputs((current) => ({
        ...current,
        direction: position.direction,
        positionSizeBtc: position.sizeBtc,
        entryPrice: position.entryPriceUsd,
        predictionSide: adverseSide(position.direction),
      }));
      if (currentSpotPrice) setSelectedPrice(Math.round(currentSpotPrice));
      setPositionStatus("loaded");
    } catch (error) {
      setPositionStatus("error");
      setPositionError(error instanceof Error ? error.message : "Velocity position unavailable.");
    }
  }

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
    const refresh = () => {
      void fetchMarkets().then((currentMarkets) => {
        if (!active) return;
        setMarkets(currentMarkets);
        setMarketError("");
        setMarketStatus("loaded");
      }).catch((error) => {
        if (!active) return;
        setMarketStatus("error");
        setMarketError(error instanceof Error ? error.message : "Market request failed.");
      });
    };
    refresh();
    const marketTimer = window.setInterval(refresh, 60_000);
    const clockTimer = window.setInterval(() => setNowSeconds(Math.floor(Date.now() / 1000)), 1_000);
    return () => {
      active = false;
      window.clearInterval(marketTimer);
      window.clearInterval(clockTimer);
    };
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
    selectedMarketIdRef.current = market.marketId;
    setReferenceNeeded(true);
    setReferenceConfirmed(false);
    setQuoteError("");
    setSelectedQuoteSeenAt(null);
    setInputs((current) => ({
      ...current,
      predictionSide: market.side,
      predictionPrice: market.buyPriceUsd ?? current.predictionPrice,
    }));
    if (market.state !== "live") return;
    void refreshQuote(market.marketId);
  }

  async function refreshQuote(marketId: string) {
    try {
      const { market: detail, fetchedAt } = await fetchMarketDetails(marketId);
      if (selectedMarketIdRef.current !== marketId) return;
      setQuoteError("");
      setSelectedMarket(detail);
      if (detail.buyPriceUsd !== null) {
        setInputs((current) => ({ ...current, predictionPrice: detail.buyPriceUsd! }));
        const fetchedSeconds = Math.floor(Date.parse(fetchedAt) / 1000);
        setSelectedQuoteSeenAt(Number.isFinite(fetchedSeconds) ? fetchedSeconds : null);
      } else {
        setSelectedQuoteSeenAt(null);
        setQuoteError("This round is live, but Jupiter has not returned a usable quote.");
      }
    } catch (error) {
      if (selectedMarketIdRef.current !== marketId) return;
      setSelectedQuoteSeenAt(null);
      setQuoteError(error instanceof Error ? error.message : "Forecast quote unavailable.");
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand-cluster">
          <button className="menu-trigger" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-controls="site-menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><span /><span /><span /></button>
          <a className="brand" href="#top" aria-label="EventLens home"><span className="brand-lens" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="10.5" cy="10.5" r="5.8" stroke="currentColor" strokeWidth="2" /><path d="m15 15 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></span><span className="brand-word">eventlens<span>.</span></span></a>
          {menuOpen && <div id="site-menu" className="menu-popover"><strong>Navigate</strong><a href="#lab" onClick={() => setMenuOpen(false)}>Workspace <span>↗</span></a><a href="#hedge" onClick={() => setMenuOpen(false)}>Hedge draft <span>↗</span></a><a href="#markets" onClick={() => setMenuOpen(false)}>Forecast markets <span>↗</span></a><a href="#method" onClick={() => setMenuOpen(false)}>Model notes <span>↗</span></a></div>}
        </div>
        <nav aria-label="Main navigation">
          <a href="#lab">Workspace</a>
          <a href="#hedge">Hedge draft</a>
          <a href="#markets">Markets</a>
          <a href="#method">Model notes</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">BTC PERPS &amp; FORECAST</div>
            <h1>One position.<span>Every outcome.</span></h1>
            <p>See how a BTC prediction contract could offset a perp drawdown—and where liquidation still breaks the hedge.</p>
          </div>
        </section>

        <section id="lab" className="lab-section">
          <div className="section-heading">
            <div>
                <div className="eyebrow">01 / WORKSPACE</div>
                <h2>Scenario analysis</h2>
                <p>Set a closing price to inspect both legs of the position.</p>
            </div>
            <span className="source-badge">{livePosition ? positionEdited ? "Imported position · scenario edited" : "Velocity position imported" : "Hypothetical position"}</span>
          </div>

          <div className="panel position-panel">
            <div className="position-panel-copy">
              <span className="panel-kicker">READ-ONLY POSITION</span>
              <h3>Import from Velocity</h3>
              <p>Enter a public wallet address to load its BTC-PERP position. No wallet connection or signature is required.</p>
            </div>
            <form className="position-form" onSubmit={(event) => { event.preventDefault(); void importPosition(); }}>
              <label><span>Solana wallet address</span><input value={walletAddress} onChange={(event) => setWalletAddress(event.target.value)} placeholder="Wallet address" autoComplete="off" spellCheck={false} /></label>
              <label className="subaccount-field"><span>Subaccount</span><input type="number" min="0" max="15" step="1" value={subAccountId} onChange={(event) => setSubAccountId(Number(event.target.value))} /></label>
              <button className="primary-button" type="submit" disabled={positionStatus === "loading"}>{positionStatus === "loading" ? "Reading…" : livePosition ? "Refresh position" : "Import position"}<span>↗</span></button>
            </form>
            {positionStatus === "error" && <p className="position-message" role="status">{positionError}</p>}
            {livePosition && <div className="position-summary">
              <div><span>BTC-PERP</span><strong>{livePosition.direction.toUpperCase()} {livePosition.sizeBtc} BTC</strong><small>Entry {priceFormat.format(livePosition.entryPriceUsd)} · oracle {priceFormat.format(livePosition.oraclePriceUsd)}</small></div>
              <div><span>ACCOUNT HEALTH</span><strong>{livePosition.accountHealth}/100</strong><small>Velocity maintenance health</small></div>
              <div><span>ACCOUNT COLLATERAL</span><strong>{usd.format(livePosition.accountCollateralUsd)}</strong><small>Maintenance requirement {usd.format(livePosition.accountMaintenanceUsd)}</small></div>
              <div><span>BTC POSITION P&L</span><strong>{signedUsd(livePosition.unrealizedPnlUsd)}</strong><small>Includes {signedUsd(livePosition.fundingPnlUsd)} funding · read {new Date(livePosition.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div>
            </div>}
            {livePosition && <p className="position-caveat">Health and collateral are for the entire Velocity subaccount. The scenario below remains a simplified BTC-only settlement model; its margin buffer is not the venue&apos;s liquidation calculation.</p>}
          </div>

          <div className="lab-grid">
            <div className="analysis-column">
              <div className="panel chart-panel">
                <div className="analysis-tab-bar" role="tablist" aria-label="Chart view">
                  <button type="button" role="tab" aria-selected={chartView === "market"} className={chartView === "market" ? "selected" : ""} onClick={() => setChartView("market")}>BTC price</button>
                  <button type="button" role="tab" aria-selected={chartView === "payoff"} className={chartView === "payoff" ? "selected" : ""} onClick={() => setChartView("payoff")}>Risk payoff</button>
                  <span className="analysis-tab-note">Market context / scenario model</span>
                </div>
                <div hidden={chartView !== "market"}><BtcMarketChart onLivePrice={useLiveSpotAsStartingPoint} /></div>
                <div hidden={chartView !== "payoff"} className="payoff-chart-content">
                  <div className="panel-topline">
                    <div><span className="panel-kicker">SETTLEMENT VIEW</span><h3>Payoff at settlement</h3></div>
                    <div className="legend"><span><i className="legend-line legend-perp" /> Perp only</span><span><i className="legend-line legend-combined" /> Combined</span></div>
                  </div>
                  <PayoffChart series={series} selected={selected} threshold={inputs.thresholdPrice} />
                </div>
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

              <section id="hedge" className="panel hedge-panel">
                <div className="panel-topline"><div><span className="panel-kicker">HEDGE DRAFT</span><h3>Size the adverse side</h3></div><span className="source-badge">{roundLinked ? "Round-linked estimate" : "Scenario estimate"}</span></div>
                {!currentSpotPrice && <p className="hedge-empty">A fresh BTC spot quote is needed to size a hedge from the current price.</p>}
                {currentSpotPrice && inputs.predictionSide !== adverseSide(inputs.direction) && <p className="hedge-empty">A {inputs.direction.toUpperCase()} perp loses when BTC moves {adverseSide(inputs.direction).toUpperCase()}. Select that prediction side to size the offset.</p>}
                {currentSpotPrice && inputs.predictionSide === adverseSide(inputs.direction) && proposal && <>
                  <div className="hedge-topline"><div><span>INDICATIVE STAKE</span><strong>{usd.format(proposal.stakeUsd)}</strong><small>Buy {proposal.side.toUpperCase()} at {usd.format(inputs.predictionPrice)} per contract · about {proposal.contracts.toFixed(2)} contracts</small></div><div className="hedge-target"><span>ADVERSE CLOSE</span><strong>{priceFormat.format(proposal.adverseCloseUsd)}</strong><small>{proposal.adverseMovePercent.toFixed(1)}% move from current Bitstamp spot, crossing the round line</small></div></div>
                  <div className="hedge-comparison"><div><span>Perp change from now</span><strong>{signedUsd(proposal.perpChangeUsd)}</strong></div><span className="comparison-arrow">→</span><div><span>With winning contract</span><strong>{signedUsd(proposal.combinedChangeUsd)}</strong></div></div>
                  <p className="hedge-detail">Winning contract gain {signedUsd(proposal.winningPredictionPnlUsd)} · covers {Math.round(proposal.coveragePercent)}% of this modeled move. Maximum contract loss is the {usd.format(proposal.stakeUsd)} stake.{proposal.cappedByOrderLimit ? " The $250 Forecast order cap leaves part of this move unhedged." : ""}</p>
                  <button className="text-button hedge-apply" type="button" onClick={() => { update("predictionStakeUsd", proposal.stakeUsd); setSelectedPrice(Math.round(proposal.adverseCloseUsd)); setChartView("payoff"); }}>Apply stake to payoff chart ↗</button>
                </>}
                {currentSpotPrice && inputs.predictionSide === adverseSide(inputs.direction) && !proposal && <p className="hedge-empty">Enter a valid position size, opening price, and contract price to size this draft.</p>}
                <div className="hedge-warning"><strong>Settlement timing matters.</strong> The contract pays only after the round resolves. It cannot supply margin to stop the perp from liquidating first.</div>
                {!roundLinked && <p className="hedge-qualification">This is scenario sizing. A round-linked estimate needs a live Forecast quote and an opening Chainlink reference checked for that exact round. It excludes fees and slippage.</p>}
                {roundLinked && <p className="hedge-qualification">The quote is indicative and the opening reference was checked by you. Recheck both before any trade; no order is constructed here.</p>}
              </section>

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
                    <NumberField label="Opening reference price" value={inputs.thresholdPrice} onChange={(value) => { update("thresholdPrice", value); setReferenceNeeded(false); }} prefix="$" min={1} step="100" hint={selectedMarket ? "Use this round's exact Chainlink BTC/USD open, not Bitstamp spot." : "Scenario line; a live round needs its Chainlink opening value."} />
                    <NumberField label="Price per contract" value={inputs.predictionPrice} onChange={(value) => update("predictionPrice", value)} prefix="$" min={0.01} max={0.99} step="0.000001" />
                    <NumberField label="Amount spent" value={inputs.predictionStakeUsd} onChange={(value) => update("predictionStakeUsd", value)} prefix="$" min={0} step="5" />
                  </div>
                  {selectedMarket && <label className="reference-check"><input type="checkbox" checked={referenceConfirmed} disabled={!selectedRoundLive || referenceNeeded} onChange={(event) => setReferenceConfirmed(event.target.checked)} /><span>I checked this opening price for the selected Jupiter round. {referenceNeeded ? "Enter its value above first." : ""}</span></label>}
                  <p className="contract-rule">{inputs.predictionSide.toUpperCase()} pays $1 per contract if BTC closes {inputs.predictionSide === "up" ? "at or above" : "below"} {priceFormat.format(inputs.thresholdPrice)}.</p>
                </div>
              </div>

              <div className={`risk-card ${selected.marginBuffer <= 0 ? "risk-danger" : ""}`}>
                <div className="risk-icon">!</div>
                <div><strong>{selected.marginBuffer <= 0 ? "Scenario maintenance crossed" : "Illustrative margin buffer"}</strong><p>{selected.marginBuffer <= 0 ? "The perp may be liquidated before the prediction contract settles." : `${usd.format(selected.marginBuffer)} above the assumed maintenance requirement.`}</p></div>
              </div>
            </aside>
          </div>
        </section>

        <section id="markets" className="markets-section">
          <div className="section-heading"><div><div className="eyebrow">02 / FORECAST</div><h2>BTC rounds</h2><p>Live sides show a quote when available. Scheduled sides open at the time shown.</p></div></div>
          <div className="panel market-panel">
            <div className="market-panel-heading"><div className="market-source"><span className="market-source-mark">J</span><span><strong>Jupiter Forecast</strong><small>BTC · 15-minute markets</small></span></div><button className="primary-button" onClick={() => { setMarketStatus("loading"); void loadMarkets(); }} disabled={marketStatus === "loading"}>{marketStatus === "loading" ? "Loading…" : "Refresh markets"}<span>↗</span></button></div>
            {(marketStatus === "idle" || (marketStatus === "loading" && markets.length === 0)) && <p className="market-placeholder">Loading BTC rounds…</p>}
            {marketStatus === "error" && <p className="market-error" role="status">{marketError}</p>}
            {marketStatus === "loaded" && markets.length === 0 && <p className="market-placeholder">No live or upcoming BTC rounds were returned. Jupiter schedules these rounds; refresh later.</p>}
            {markets.length > 0 && <div className="market-list">{markets.slice(0, 8).map((market) => <button key={market.marketId} className={`market-row ${selectedMarket?.marketId === market.marketId ? "market-selected" : ""}`} onClick={() => selectMarket(market)}><span className={`market-side ${market.side}`}>{market.side === "up" ? "↑" : "↓"}</span><span className="market-description"><strong>{market.title}</strong><small>{market.state === "live" ? `Closes ${formatTime(market.closeTime)} · ${countdown(market.closeTime, nowSeconds)} left` : `Opens ${formatTime(market.openTime)} · in ${countdown(market.openTime, nowSeconds)}`}</small></span><span className="market-quote">{market.buyPriceUsd === null ? market.state === "live" ? "Quote on select" : "Scheduled" : usd.format(market.buyPriceUsd)}<small>{market.state === "live" ? "LIVE SIDE" : "NOT YET OPEN"}</small></span><span className="row-arrow">↗</span></button>)}</div>}
            {quoteError && <p className="market-error" role="status">{quoteError}</p>}
            {selectedMarket && <p className="market-footnote">{selectedRoundLive ? `${selectedMarket.side.toUpperCase()} side closes in ${countdown(selectedMarket.closeTime, nowSeconds)}.` : `${selectedMarket.side.toUpperCase()} side is scheduled for ${formatTime(selectedMarket.openTime)}.`} Jupiter does not provide a verified opening price in this response. Enter the exact round reference above and mark it checked only after comparing it with Jupiter&apos;s Chainlink reference. Quotes are indicative.</p>}
            {selectedRoundLive && selectedMarket && <button className="text-button" type="button" onClick={() => { void refreshQuote(selectedMarket.marketId); }}>Refresh selected quote ↗</button>}
          </div>
        </section>

        <section id="method" className="method-section"><div><div className="eyebrow">MODEL NOTES</div><h2>What this includes</h2></div><p>The chart combines perpetual P&amp;L with a binary contract payout at settlement. Estimates exclude funding, trading fees, slippage, and liquidation along the price path. Prediction payouts are not treated as perp collateral; maintenance margin is an input, not a live venue value.</p></section>
      </main>
      <footer><span className="brand footer-brand">eventlens<span>.</span></span><p>Built for exploring exposure, not placing orders.</p><span>SOLANA · DEMO</span></footer>
    </div>
  );
}
