# EventLens demo runbook

## Before recording

1. Run `npm ci`, set `JUPITER_API_KEY` in `.env.local`, and start the app with `npm run dev`.
2. Confirm that the BTC chart shows a recent Bitstamp timestamp. If it does not, wait for the feed rather than using a fake price.
3. Have a public wallet address with an open Velocity BTC-PERP position ready, or use the editable scenario and state clearly that it is hypothetical. Do not expose a private key or seed phrase.
4. Refresh Forecast rounds. If no side is live, show the next scheduled round and describe the pricing and opening-reference gate. Do not present a scheduled side as tradable.

## Current devnet position

Select **Devnet** in the position import form, enter wallet `6qErjjbUwpvQmLyNknk3ZR58b64NvJaHM3b52WJrDkap` and subaccount `0`, then choose **Import position**. This account holds a long `0.0001 BTC-PERP` position. The import endpoint returned the position successfully on September 28, 2026. Run `node scripts/devnet-inspect.mjs` to check its current state before recording.

The local signing key is in ignored `.local/devnet-demo-keypair.json`; show only the public wallet address. The script wallet is separate from a browser wallet. Devnet SOL funds the Velocity demo; Jupiter Forecast order execution uses mainnet USDC and requires a separate live test.

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
