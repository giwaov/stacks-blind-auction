# Stacks Blind Auction

A decentralized sealed-bid auction platform built on **Stacks** (Bitcoin L2) using `@stacks/connect` and `@stacks/transactions`.

## Features

- **Sealed-Bid Auctions**: Bids are committed as hashes, then revealed after the commit phase
- **Commit-Reveal Scheme**: Ensures fairness by hiding bid amounts until reveal
- **STX Deposits**: Bidders lock deposits to ensure genuine participation
- **Winner Claims**: Winners claim prizes, losers withdraw deposits

## Tech Stack

- **Smart Contract**: Clarity (Stacks native language)
- **Frontend**: Next.js 14, React 18, TypeScript
- **Wallet Integration**: `@stacks/connect` v7.7.1
- **Transaction Building**: `@stacks/transactions` v6.13.0
- **Styling**: Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+
- Stacks wallet (Hiro Wallet, Xverse, or Leather)
- STX tokens (testnet or mainnet)

### Installation

```bash
cd stacks-blind-auction
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Deploy Contract

1. Install Clarinet: https://github.com/hirosystems/clarinet
2. Deploy to testnet:
```bash
clarinet deployments generate --testnet
clarinet deployments apply --testnet
```

3. Update `CONTRACT_ADDRESS` in `src/context/StacksContext.tsx` with your deployed address.

## Contract Functions

### Write Functions
- `create-auction`: Create a new blind auction
- `submit-sealed-bid`: Submit a hashed bid with deposit
- `reveal-bid`: Reveal your bid during reveal phase
- `claim-prize`: Winner claims the auction item
- `withdraw-deposit`: Non-winners reclaim deposits

### Read Functions
- `get-auction`: Get auction details by ID
- `get-auction-count`: Total number of auctions
- `is-commit-phase`: Check if auction is accepting bids
- `is-reveal-phase`: Check if auction is in reveal phase
- `hash-bid`: Generate bid hash for commitment

## Auction Lifecycle

1. **Creation**: Seller creates auction with item details and duration
2. **Commit Phase**: Bidders submit sealed (hashed) bids with deposits
3. **Reveal Phase**: Bidders reveal their actual bid amounts
4. **Settlement**: Winner claims prize, losers withdraw deposits

## Built For

Stacks Builder Rewards - February 2026

## License

MIT
