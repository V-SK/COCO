# Market Page Redesign Spec

## Data Sources (FREE, no API key)

### GeckoTerminal — trending list + token info
```
GET https://api.geckoterminal.com/api/v2/networks/{chain}/trending_pools?page=1
```
Returns 20 pools: price, market_cap_usd, fdv_usd, volume_usd (h1/h6/h24), price_change_percentage (h1/h6/h24), transactions (buys/sells/buyers/sellers for m5/h1/h24), pool_created_at, reserve_in_usd, base_token address via relationships.

Token info (logo): `GET /api/v2/networks/bsc/tokens/{address}` → image_url, name, symbol

Search: `GET /api/v2/search/pools?query={text}&network=bsc`

Chain param: `bsc`, `eth`, `solana`, `base`

### GoPlus — security + holders
```
GET https://api.gopluslabs.io/api/v1/token_security/{chainId}?contract_addresses={addr}
```
Returns: holder_count, is_honeypot, buy_tax, sell_tax, is_open_source. ChainId: 56=BSC, 1=ETH.

Lazy-load GoPlus; don't block list render.

## Layout: Two Views (hash routing)

### View 1: Market List (MarketPage.tsx — modify existing)
Keep existing BTC/ETH TradingView mini charts + stat cards at top.

Below that ADD:
1. **Search bar** — "🔍 搜索合约地址 / 代币名称". Address input → fetch GeckoTerminal → go to detail. Text → search pools.
2. **Chain filter pills** — [BSC●] [ETH] [SOL] [BASE]. Smooth active state transition.
3. **Sort tabs** with sliding underline — [🔥热门] [📈涨幅] [💰市值] [🆕最新]
4. **Meme token list** — compact rows:
   - Token avatar (GeckoTerminal image_url, fallback: colored circle + first letter)
   - Name + symbol + age badge (grey pill "20d"/"15h" from pool_created_at)
   - 24h Volume + tx count (buys+sells)
   - Market cap + 1h% (green ▲ / red ▼)
   
Click row → navigate to detail view (slide-in from right).

Replace DexScreener-based hook with new `useTrendingPools.ts` using GeckoTerminal.

### View 2: Token Detail (NEW TokenDetailPage.tsx)
**Full-screen view, NOT bottom sheet.** Slides in from right like iOS push nav.

Top to bottom:
1. **Header**: ← Back | Token avatar + name | `0xab..cd` 📋 copy
2. **Price display**: Large "$0.0125" + "+2.95%" green/red
3. **Metrics row** (horizontal scroll cards): 市值, 池子(liquidity), 持有者(GoPlus), 24h量, 安全状态(GoPlus honeypot check)
4. **Chart**: DexScreener iframe `https://dexscreener.com/bsc/{address}?embed=1&theme=dark&trades=0&info=0` — width:100%, flex:1, min-h:400px
5. **Bottom bar** (fixed): [📋 复制合约] + [💬 去交易] (navigate to chat tab)

## Animations (IMPORTANT — boss requirement)
- Token rows: staggered fade-in-up with delay
- Page transition: slide from right (detail) / slide out right (back)
- Loading: skeleton shimmer (not spinner)
- Chain/sort switch: crossfade list
- Copy: "✓ 已复制" toast, fade in/out
- Metrics cards: momentum scroll
- Tab underline: smooth sliding indicator

## Files to create
- `apps/web/src/hooks/useTrendingPools.ts` — GeckoTerminal fetch + 60s cache
- `apps/web/src/components/market/TokenDetailPage.tsx` — full-screen detail

## Files to modify
- `apps/web/src/components/market/MarketPage.tsx` — add search + chain + sort + meme list below existing BTC/ETH section
- `apps/web/src/components/market/MemeTokenList.tsx` (if exists from prior commit, refactor to use GeckoTerminal data)
- `apps/web/src/components/market/ChainFilter.tsx` (if exists, keep)
- `apps/web/src/components/market/SortTabs.tsx` (if exists, keep)

## Files to delete/replace
- KlineSheet.tsx — no longer needed (replaced by TokenDetailPage)
- Any DexScreener-based trending hook from prior commit

## Style
- Dark theme, black bg, consistent with app
- BNB gold #F0B90B for selected states
- Green #34D399 positive, Red #F87171 negative
- Chinese labels everywhere
- Mobile-first, max-w-2xl desktop

## After done
```bash
cd /tmp/coco-code && git add -A && git commit -m "feat: GMGN-style market + full-screen token detail"
git push origin main
cd apps/web && npx vercel --prod --yes -t oiqnV3r0ctVLCifgy38ymPSP
```
