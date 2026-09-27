"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  type UTCTimestamp,
} from "lightweight-charts";
import type { BtcCandle, BtcQuote } from "@/lib/candles";

type ChartStyle = "candles" | "line";
type Interval = "60" | "300" | "900";

const intervalLabels: Record<Interval, string> = { "60": "1m", "300": "5m", "900": "15m" };
const priceFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

type CandleFeed = { candles: BtcCandle[]; quote: BtcQuote };

async function fetchCandles(interval: Interval): Promise<CandleFeed> {
  const response = await fetch(`/api/candles?granularity=${interval}`, { cache: "no-store" });
  const result = await response.json() as CandleFeed & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "BTC candles unavailable.");
  return result;
}

function TradingChart({ candles, style }: { candles: BtcCandle[]; style: ChartStyle }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || candles.length === 0) return;

    const chart = createChart(container, {
      autoSize: true,
      height: 370,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#858585",
        fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#f0f0f0" },
        horzLines: { color: "#f0f0f0" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#e7e7e7", scaleMargins: { top: 0.08, bottom: 0.24 } },
      timeScale: { borderColor: "#e7e7e7", timeVisible: true, secondsVisible: false, rightOffset: 5 },
      localization: { priceFormatter: (price: number) => priceFormat.format(price) },
    });

    const priceSeries = style === "candles"
      ? chart.addSeries(CandlestickSeries, {
          upColor: "#16a76d", downColor: "#dc5c61", borderVisible: false,
          wickUpColor: "#16a76d", wickDownColor: "#dc5c61",
          priceLineVisible: true, priceLineColor: "#666666",
        })
      : chart.addSeries(LineSeries, {
          color: "#1b1b1b", lineWidth: 2, priceLineVisible: true,
        });

    if (style === "candles") {
      priceSeries.setData(candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        open: candle.open, high: candle.high, low: candle.low, close: candle.close,
      })));
    } else {
      priceSeries.setData(candles.map((candle) => ({ time: candle.time as UTCTimestamp, value: candle.close })));
    }

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volume.setData(candles.map((candle) => ({
      time: candle.time as UTCTimestamp,
      value: candle.volume,
      color: "#d9d9d9",
    })));

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [candles, style]);

  return <div className="trading-chart" ref={containerRef} role="img" aria-label={`BTC spot price ${style === "candles" ? "candlestick" : "line"} chart with volume`} />;
}

export default function BtcMarketChart({ onLivePrice }: { onLivePrice?: (price: number) => void }) {
  const [interval, setIntervalValue] = useState<Interval>("60");
  const [style, setStyle] = useState<ChartStyle>("candles");
  const [candles, setCandles] = useState<BtcCandle[]>([]);
  const [quote, setQuote] = useState<BtcQuote | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const load = () => {
      void fetchCandles(interval).then((feed) => {
        if (!active) return;
        setCandles(feed.candles);
        setQuote(feed.quote);
        onLivePrice?.(feed.quote.price);
        setError("");
        setStatus("ready");
      }).catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "BTC candles unavailable.");
        setStatus("error");
      });
    };
    const kickoff = window.setTimeout(load, 0);
    const refresh = window.setInterval(load, 60_000);
    return () => { active = false; window.clearTimeout(kickoff); window.clearInterval(refresh); };
  }, [interval, retry, onLivePrice]);

  const change = useMemo(() => candles.length > 1
    ? ((candles[candles.length - 1].close / candles[0].open) - 1) * 100
    : null, [candles]);

  return (
    <div className="market-chart-content">
      <div className="price-chart-toolbar">
        <div className="price-chart-identity">
          <span className="bitcoin-mark">₿</span>
          <div><strong>BTC / USD</strong><small>Bitstamp spot · live market data</small></div>
        </div>
        <div className="price-chart-controls">
          <div className="chart-control-group" role="group" aria-label="Candle interval">
            {(Object.keys(intervalLabels) as Interval[]).map((value) => <button key={value} className={interval === value ? "selected" : ""} aria-pressed={interval === value} onClick={() => { setIntervalValue(value); setCandles([]); setStatus("loading"); }}>{intervalLabels[value]}</button>)}
          </div>
          <div className="chart-control-group" role="group" aria-label="Chart style">
            <button className={style === "candles" ? "selected" : ""} aria-pressed={style === "candles"} onClick={() => setStyle("candles")}>Candles</button>
            <button className={style === "line" ? "selected" : ""} aria-pressed={style === "line"} onClick={() => setStyle("line")}>Line</button>
          </div>
        </div>
      </div>

      {quote ? <div className="price-chart-summary"><strong>{priceFormat.format(quote.price)}</strong>{change !== null && <span className={change >= 0 ? "positive" : "negative"}>{change >= 0 ? "+" : ""}{change.toFixed(2)}% <small>in view</small></span>}<span className="chart-time">{status !== "ready" ? "Last available" : quote.kind === "trade" ? "Last trade" : "Latest candle"} {new Date(quote.time * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div> : <div className="price-chart-summary price-chart-loading" role="status">Loading live BTC/USD price…</div>}

      {candles.length > 0 ? <TradingChart candles={candles} style={style} /> : <div className="chart-empty" role="status"><strong>{status === "loading" ? "Loading live candles" : "Live candles unavailable"}</strong><span>{status === "loading" ? "Fetching BTC/USD market data from Bitstamp…" : "Try refreshing the feed in a moment."}</span></div>}
      {status === "ready" && candles.length === 0 && <div className="chart-feed-error" role="status"><span>The live quote loaded, but candle history did not.</span><button onClick={() => { setStatus("loading"); setRetry((value) => value + 1); }}>Retry candles</button></div>}
      {status === "error" && <div className="chart-feed-error" role="status"><span>{error}</span><button onClick={() => { setStatus("loading"); setRetry((value) => value + 1); }}>Retry feed</button></div>}

      <div className="chart-source-note"><span>Bitstamp spot provides context; Forecast settles from Chainlink BTC/USD.</span><a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView Lightweight Charts™ · Copyright (с) 2025 TradingView, Inc.</a></div>
    </div>
  );
}
