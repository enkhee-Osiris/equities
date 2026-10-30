# Equities

A browser-local portfolio tracker for Mongolian stocks. See purchase cost, current market value, and unrealized profit/loss using dated closing prices from the Mongolian Stock Exchange. Import/export CSV or JSON, edit holdings, explore the stock directory, and inspect individual price histories.

Holdings stay in localStorage on your device. There is no application server, account, analytics service, or holdings database. The example portfolio has illustrative quantities and purchase prices, clearly labeled; its market prices come from MSE. Editing the example stays in a labeled sandbox and never replaces the personal portfolio. No actual owner portfolio is included.

## Run locally

Requires Node.js 22.12+.

```sh
npm ci
npm run dev
```

```sh
npm test                  # Financial calculations, import/export, source parsers, failure recovery
npm run build            # Typecheck and production bundle
npm run preview          # Preview production output
npm run test:e2e          # Browser smoke tests (install Chromium first)
```

For browser tests run `npx playwright install chromium`. An installed Chrome can be used locally with `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`.

## Portfolio files

CSV columns:

```csv
symbol,quantity,averagePurchasePriceMnt,purchaseFeesMnt
APU,100,1000,100
KHAN,50,1700,0
```

Average purchase price excludes the separately entered total purchase fees. Use plain decimals without thousands separators. Imports show a preview and replace the personal portfolio only after confirmation. JSON backups preserve identifiers and use `{ "schemaVersion": 1, "holdings": [...] }`. CSV export includes an optional `id` column. Unknown tickers stay visible and unpriced.

Back up holdings with Export → JSON. Browser-local storage is not encrypted or synced between devices; clearing site data can remove it. Apps under the same GitHub Pages origin can access that origin's browser storage, so only host trusted scripts on that origin.

## Calculation

```text
purchase cost = shares × average purchase price + purchase fees
market value = shares × dated closing price
unrealized gain/loss = market value − purchase cost
return % = gain/loss ÷ corresponding purchase cost × 100
```

Decimal arithmetic is used throughout financial calculations. A zero purchase cost has no defined return percentage. Unpriced positions are excluded from both market value and the cost used for gain/loss, while total purchase cost still includes them. Old prices retain their actual dates and are flagged. Dividends, realized sales, tax, and future selling fees are not calculated.

## Market collection

```sh
npm run collect                         # All listed stocks, respecting robots and request pacing
npm run collect -- --symbols APU,KHAN    # Bounded refresh; merges with the prior good snapshot
```

The collector checks `open.mse.mn/robots.txt`, parses the stock tiers in `https://open.mse.mn/securities`, and reads dated histories from the public trading-tab fragments linked by company profiles. It uses session dates, not undated headline prices. Exact duplicates are collapsed; conflicting histories, invalid dates, or invalid prices are rejected. Requests are paced, with at most two in flight and bounded retries.

`public/market/latest.json` includes directory, quotes, source metadata, collection time, and partial-coverage failures. `public/market/history/<sourceId>.json` contains up to 400 valid sessions per stock. On isolated source failures a previous valid quote may be carried forward with its original date. A directory drop over 10%, quote failure rate over 20%, or coverage below 50% aborts publication and preserves the last snapshot. Git history on `market-data` archives successful daily snapshots.

The initial live collection on 30 October 2026 found 160 listed stocks and 154 validated prices. GOV, ITLS, and TCK failed historical-data validation; DUS, MTZ, and EUD had no regular equity history. Some inactive stocks have very old prices. The newer MSE issuer hub's 162-company headline remains unreconciled with the 160 directory entries. Listed status does not establish that trading is unsuspended.

These HTML fragments are not a documented API contract. Check MSE's current terms before redistributing or commercially using market data; robots permission is not a redistribution license. Market data is attributed to MSE and excluded from the application code's MIT license. Detailed findings: [research/mse-listings.md](research/mse-listings.md).

## GitHub Pages

1. Create a public repository and push this project to `main`.
2. In Settings → Pages, choose **GitHub Actions** as the publishing source.
3. The **Collect and publish** workflow builds and deploys on pushes. It collects new MSE data daily at **18:17 Asia/Ulaanbaatar (10:17 UTC)**, then explicitly builds/deploys in that same run.
4. Run it manually with `refresh=true` to collect again, or `false` to redeploy existing data.

The workflow restores the last `market-data` snapshot before collection. Validated updates are committed to that data branch using a separate Git index, preserving the application checkout. A failed collection leaves the previous deployment in place. PR checks are read-only and cannot publish. No personal access token is needed; Actions uses the scoped repository token.

Build URLs automatically use `/<repository>/` for project sites and `/` for a `*.github.io` repository. For local production-prefix testing, use `BASE_PATH=/equities/ npm run build`. A custom domain requires changing the workflow's `BASE_PATH` to `/`.

GitHub schedules can be delayed or dropped and may be disabled after 60 days of repository inactivity. No exact delivery time is guaranteed. View Actions logs if dates stop advancing. The normal collector refreshes the available history window; a full audited historical backfill and corporate-action adjustment are not implemented.

## Contribute

Use a focused branch/PR, run `npm test`, `npm run build`, and the browser smoke tests for UI changes. Keep financial math in `src/lib/portfolio.ts`, source parsing in `scripts/mse-source.mjs`, and collectors separate from browser code. Add synthetic, minimal fixtures when fixing source-format or calculation bugs. Do not commit personal holdings, credentials, or downloaded raw source pages.

## License

Application source code is MIT licensed. MSE data, third-party fonts, and other dependencies retain their own rights and licenses. See [LICENSE](LICENSE) and MSE's applicable data terms.
