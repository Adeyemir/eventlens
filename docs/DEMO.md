# EventLens demo runbook

## Before recording

1. Run `npm ci`, set `JUPITER_API_KEY` in `.env.local`, and start the app with `npm run dev`.
2. Confirm that the BTC chart shows a recent Bitstamp timestamp. If it does not, wait for the feed rather than using a fake price.
3. Have a public wallet address with an open Velocity BTC-PERP position ready, or use the editable scenario and state clearly that it is hypothetical. Do not expose a private key or seed phrase.
4. Refresh Forecast rounds. If no side is live, show the next scheduled round and describe the pricing and opening-reference gate. Do not present a scheduled side as tradable.

## 90-second walkthrough

| Time | Action | Point to make |
| --- | --- | --- |
| 0–15s | Show BTC candles and current spot timestamp. | Market context is live and sourced. |
| 15–35s | Import a Velocity BTC-PERP position by public address. | Position and venue health come from onchain data; this read needs no signature. |
| 35–55s | Open the hedge draft and compare the perp move with the winning-contract outcome. | One sized adverse-side offset, with the premium and maximum loss visible. |
| 55–75s | Select a live Forecast side if available, or show a scheduled side. | A live quote and the exact Chainlink round opening reference are prerequisites for a round-linked estimate. |
| 75–90s | Point to the timing warning and model notes. | A settlement payout cannot rescue a perp that liquidates first. |

## What to verify after the recording

- The imported position values match Velocity's account view at approximately the same time.
- The Forecast side and close time match Jupiter's market view.
- Any opening reference shown was checked for that exact round.
- The demo never suggests that an indicative quote is a guaranteed execution price.
