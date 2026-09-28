# Submission draft

## Name

EventLens

## One-line description

Read-only risk workbench that pairs a Solana BTC perp with a short-lived BTC prediction contract and shows the settlement hedge alongside liquidation timing risk.

## Problem

A trader holding a BTC perp may buy a prediction contract on the opposite move, but the two positions have different mechanics. The contract settles at the end of its round; the perp can liquidate earlier. Looking at the markets separately hides that difference.

## What we built

EventLens reads a BTC-PERP position and subaccount health from Velocity, shows live BTC spot candles from Bitstamp, discovers Jupiter Forecast BTC rounds, and sizes an adverse-side contract stake for a specified close. The interface compares the incremental perp loss with the modeled winning-contract payoff and states the premium at risk. A live Forecast estimate is gated on a current quote and a round-specific, user-checked Chainlink opening reference.

## Solana integration

- Velocity SDK: read-only onchain perp positions and account risk.
- Jupiter Prediction API: Forecast round discovery and indicative market pricing.
- Solana RPC: account and oracle data used by the Velocity SDK.

## Honest scope

EventLens does not execute trades, quote a stake-specific order, or independently retrieve Jupiter's exact opening Chainlink price. Settlement projections exclude fees, slippage, funding, and intraround liquidation. Venue health is displayed separately from the simplified scenario margin model.

## Demo

Live app: [eventlens-nu.vercel.app](https://eventlens-nu.vercel.app)

Video walkthrough: [eventlens-nu.vercel.app/eventlens-demo.mp4](https://eventlens-nu.vercel.app/eventlens-demo.mp4)

The video imports a verified long `0.0001 BTC-PERP` position from Velocity devnet using public wallet `6qErjjbUwpvQmLyNknk3ZR58b64NvJaHM3b52WJrDkap`, subaccount `0`. It then changes the size to `0.005 BTC` as a clearly labeled what-if scenario to demonstrate hedge sizing. Follow [DEMO.md](DEMO.md) for the walkthrough.
