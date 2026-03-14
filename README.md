# Coco Framework

Coco is a TypeScript monorepo for a BNB Chain focused AI agent runtime with tool calling, wallet execution modes, plugins, a web connector, and a CLI.

## Packages

- `@coco/core`: runtime, LLM providers, memory, wallet executor, SQLite limit ledger
- `@coco/plugin-price`: Binance price lookup
- `@coco/plugin-scan`: GoPlus contract scanning
- `@coco/plugin-swap`: PancakeSwap quote and execution flow
- `@coco/plugin-wallet`: balance and transfer support
- `@coco/connector-web`: REST and WebSocket connector
- `@coco/cli`: local chat and server entrypoints

## Wallet Modes

- `unsigned`: returns unsigned transactions
- `delegated`: signs and broadcasts through a server-managed delegated wallet
- `session-key`: validates config and limits, then returns `not_implemented`
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

## Manual Verification

- `GET /health` returns chain ID, wallet mode, and loaded plugins.
- `GET /tools` returns the current tool definitions exposed to the LLM.
- `POST /sessions` returns a session ID for chat state.
- WebSocket `ws://HOST:PORT/ws` accepts `{ "type": "chat", "sessionId": "...", "message": "..." }`.

## Notes

- `wallet.privateKey` is treated as an environment variable name, not the private key value itself.
- `delegated` and `custodial` modes log audit entries without exposing secrets.
- `session-key` is scaffolded and intentionally does not broadcast transactions yet.
