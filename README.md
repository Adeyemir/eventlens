# EventLens

**A read-only BTC perp and prediction hedge workbench for Solana.**

EventLens answers one practical question: if a BTC perpetual position moves against you, how much could a short-lived BTC prediction contract offset **at settlement**? It shows the payoff alongside the risk that the perp liquidates before the prediction pays. Built for the [Solana Perps and Prediction Markets hackathon](https://hackathons.solana.com/hackathons/perps-and-prediction-markets).

**Live demo:** [eventlens-nu.vercel.app](https://eventlens-nu.vercel.app)

**Video walkthrough:** [Watch the 82-second demo](https://eventlens-nu.vercel.app/eventlens-demo.mp4)

## Try it locally

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [localhost:3000](http://localhost:3000). The BTC chart and scenario controls work without a key. To load Forecast rounds, create a free key in the [Jupiter Developer Portal](https://developers.jup.ag/portal), put it in `.env.local` as `JUPITER_API_KEY`, and restart the server. Position import supports Solana mainnet and devnet; `SOLANA_RPC_URL` and `DEVNET_RPC_URL` can override their public RPC endpoints. API keys stay server-side, and `.env.local` is ignored by Git.

For the verified devnet demo, select **Devnet**, enter wallet `6qErjjbUwpvQmLyNknk3ZR58b64NvJaHM3b52WJrDkap` and subaccount `0`, then import its long `0.0001 BTC-PERP` position.

## What works

1. **Read a real position.** Select devnet or mainnet, then enter a public Solana wallet address and Velocity subaccount number. EventLens reads its BTC-PERP size, side, entry, oracle price, unrealized P&L, funding P&L, account collateral, maintenance requirement, and health from Velocity's onchain SDK. No signature or private key is requested. The imported size, side, and entry become editable scenario inputs.
2. **Inspect BTC and Forecast.** The chart uses live [Bitstamp BTC/USD](https://www.bitstamp.net/api/) spot trades and candles. [Jupiter Forecast](https://developers.jup.ag/docs/prediction/forecast) supplies scheduled and live 15-minute BTC UP/DOWN rounds; a live side is queried for an indicative contract quote when selected. A missing feed stays missing in the UI.
3. **Size an offset.** The hedge panel chooses DOWN for a long perp or UP for a short one. It models an adverse close at least 3% from current spot that crosses the round's opening line, then sizes a $5–$250 stake against that price move. It shows the perp change alone, the change with a winning contract, and the maximum contract loss.

The opening BTC reference must be entered and checked by the user for the **specific** Forecast round. Jupiter's public response currently used here does not provide a verified opening value. EventLens labels the result as scenario sizing until a live quote and user-checked reference are present. It never substitutes Bitstamp spot for Jupiter's [Chainlink BTC/USD settlement source](https://data.chain.link/streams/btc-usd).

## Model boundaries

- The payoff chart uses `signed BTC size × (close − entry)` for perp P&L and `stake / contract price × payout − stake` for the binary contract. UP wins at or above the round's opening price; DOWN wins below it.
- The hedge stake aims to offset the **incremental price move from current Bitstamp spot** at one adverse close. A winning contract pays `stake × (1 / price − 1)`; the draft stake is `loss × price / (1 − price)`, bounded by Jupiter Forecast's $5–$250 Prediction API order range.
- The imported Velocity health and collateral apply to the **whole subaccount**. The separate scenario margin buffer uses a user-entered maintenance rate and is not Velocity's liquidation calculation.
- Funding, fees, slippage, changing quotes, and liquidation along the price path are not included in settlement payoff estimates. A prediction payout cannot serve as perp collateral before settlement.
- This app constructs and submits **no orders**. Quotes in the market view are indicative, not executable prices for a selected stake.

## Project map

| Path | Purpose |
| --- | --- |
| `src/app/api/candles` | Bitstamp spot ticker and OHLC feed |
| `src/app/api/markets` | Server-side Jupiter Forecast discovery and market detail |
| `src/app/api/position` | Read-only Velocity devnet and mainnet position lookup |
| `src/lib/scenario.ts` | Settlement payoff and illustrative margin |
| `src/lib/hedge.ts` | Adverse-side sizing |

## Verify

```bash
npm run lint
npm run test:math
npm run build
```
