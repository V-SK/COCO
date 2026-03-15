# Coco Framework

Coco is a TypeScript monorepo for a BNB Chain focused AI agent runtime with tool calling, wallet execution modes, connectors, browser/computer automation, memory persistence, SQL, RAG, alerts, and on-chain automation.

## Packages

- `@coco/core`: runtime, LLM providers, memory, wallet executor, SQLite limit ledger
- `@coco/plugin-price`: Binance price lookup
- `@coco/plugin-scan`: GoPlus contract scanning
- `@coco/plugin-swap`: PancakeSwap quote and execution flow
- `@coco/plugin-wallet`: balance and transfer support
- `@coco/plugin-nfa`: BAP-578 agent identities
- `@coco/plugin-browser`: browser automation
- `@coco/plugin-shell`: shell and filesystem access
- `@coco/plugin-cron`: persistent scheduled tasks
- `@coco/plugin-memory`: persistent memory store
- `@coco/plugin-computeruse`: desktop automation (macOS/Linux)
- `@coco/plugin-vision`: image analysis and OCR
- `@coco/plugin-knowledge`: local document indexing and retrieval
- `@coco/plugin-tts`: text-to-speech generation
- `@coco/plugin-sql`: readonly-first SQL access
- `@coco/plugin-orchestrator`: multi-agent orchestration
- `@coco/plugin-chain-events`: price and chain watchers
- `@coco/plugin-alerts`: alerts and notifications
- `@coco/plugin-dex-agg`: ParaSwap/OpenOcean quote aggregation
- `@coco/plugin-webhook`: webhook delivery
- `@coco/plugin-history`: BscScan/RPC history lookups
- `@coco/plugin-nft`: NFT detail and transfer flows
- `@coco/plugin-news`: RSS and CryptoPanic aggregation with token sentiment
- `@coco/plugin-trust-score`: normalized token trust scoring
- `@coco/plugin-quant-signal`: indicator-driven trade signals and degraded backtests
- `@coco/plugin-auto-trade`: paper/live strategy runs, orders, and positions
- `@coco/plugin-copy-trade`: confirmed-wallet copy trading with trust filters
- `@coco/plugin-whale-alert`: whale movement classification and monitoring
- `@coco/plugin-report`: md/html/pdf report generation
- `@coco/plugin-polymarket`: read-only prediction market discovery
- `@coco/connector-web`: REST and WebSocket connector
- `@coco/connector-telegram`: Telegram runtime bridge
- `@coco/connector-discord`: Discord runtime bridge
- `@coco/connector-twitter`: Twitter/X skeleton connector
- `@coco/cli`: local chat and server entrypoints

## Wallet Modes

- `unsigned`: returns unsigned transactions
- `delegated`: signs and broadcasts through a server-managed delegated wallet
- `session-key`: enforces signer, expiry, permissions, limits, and signs with the configured session key
- `custodial`: signs and broadcasts through a server-managed custodial wallet

Limits are enforced for delegated, custodial, and session-key flows through a SQLite-backed ledger that resets on UTC day boundaries.

## Quick Start

1. Install dependencies: `pnpm install`
2. Copy `.env.example` into `.env` and fill in your LLM and RPC values.
3. Run the CLI chat loop: `pnpm --filter @coco/cli build && node apps/cli/dist/index.js chat`
4. Run the web connector: `node apps/cli/dist/index.js serve`

## Commands

- `pnpm build`
- `pnpm lint`
- `pnpm test`
- `pnpm typecheck`
- `pnpm release:check`

## CI

- GitHub Actions runs `pnpm release:check` for pushes to `main`, pull requests targeting `main`, and manual dispatches. Workflow: [.github/workflows/release-check.yml](/Users/ssv/Documents/New%20project/.github/workflows/release-check.yml)

## Manual Verification

- `GET /health` returns chain ID, wallet mode, and loaded plugins.
- `GET /tools` returns the current tool definitions exposed to the LLM.
- `POST /sessions` returns a session ID for chat state.
- WebSocket `ws://HOST:PORT/ws` accepts `{ "type": "chat", "sessionId": "...", "message": "..." }`.

## Notes

- `wallet.privateKey` is treated as an environment variable name, not the private key value itself.
- `delegated`, `custodial`, and `session-key` modes log audit entries without exposing secrets.
- `plugin-knowledge` prefers `sqlite-vec` and falls back to a local HNSW-like retrieval path when the extension is unavailable.
- `plugin-computeruse` requires extra OS permissions and is limited to `macOS` and `Linux` in this release.
- Phase 3 adds quant trading primitives while keeping execution on BNB Chain and leaving Polymarket in read-only mode.
- `plugin-report` exports PDFs through Puppeteer when a browser binary is available; otherwise it returns a structured availability error.
