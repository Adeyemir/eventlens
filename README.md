# EventLens

EventLens explores a specific trading question: **what happens if a BTC perpetual position and a 15-minute BTC prediction contract settle at the same price?** It puts the two payoffs on one chart and makes the gap between a settlement hedge and actual liquidation risk visible.

Built for the [Solana Perps and Prediction Markets hackathon](https://hackathons.solana.com/hackathons/perps-and-prediction-markets).

## Current state

EventLens is a read-only scenario workbench. The BTC chart shows live Bitstamp spot prices and candles. The market list shows indicative Jupiter Forecast quotes when a Jupiter API key is configured. Perp size, entry, collateral, maintenance rate, prediction stake, and the round's opening reference price are editable assumptions. No wallet is connected and no orders are placed.

## Run locally

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [localhost:3000](http://localhost:3000). The scenario workbench and BTC chart work without a key. To load Jupiter Forecast rounds, create a free key in the [Jupiter Developer Portal](https://developers.jup.ag/portal), set `JUPITER_API_KEY` in `.env.local`, and restart the server. The key stays on the server; `.env.local` is ignored by Git.

## What the numbers mean

| Input | Source today | Role |
| --- | --- | --- |
| BTC spot price and candles | [Bitstamp BTC/USD](https://www.bitstamp.net/api/) | Live market context; never a simulated feed |
| 15-minute UP/DOWN contract quote | [Jupiter Forecast](https://developers.jup.ag/docs/prediction/forecast) | Indicative contract price, not an executable order quote |
| Perp position and margin | Editable scenario | Illustrates exposure; not a wallet position or venue risk calculation |
| Forecast opening BTC price | Manually entered and must be verified for the chosen round | Determines which contract wins at settlement |

Perp P&L is signed BTC size multiplied by the change from entry to closing price. A winning prediction contract pays $1 per contract; a losing one pays $0. The payoff chart adds those results at each hypothetical close. Its margin buffer uses an **assumed** maintenance rate.

Jupiter's BTC Forecast rounds settle against **Chainlink BTC/USD**. Bitstamp spot is a separate feed and can differ from the settlement reference. The model also excludes funding, fees, slippage, and liquidation before settlement. A prediction payout cannot be counted on to keep a perp position open while the round is running.

If either live feed is unavailable, the UI reports that state instead of inventing a price. The example scenario remains usable offline.

## Verify

```bash
npm run lint
npm run test:math
npm run build
```

## Next build milestones

1. Read a real BTC perp position and venue account health from a public wallet address.
2. Bind an active Forecast round to its verified opening reference and closing time.
3. Show a sized hedge proposal with before-and-after outcomes and liquidation timing warnings.
4. Prepare a reproducible demo and hackathon submission. Order execution, if added, will require separate wallet signing and an executable quote.
