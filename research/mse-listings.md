# Research: crawling MSE stock listings

Investigated 30 October 2026 using official MSE pages and direct HTTP requests. This is source evaluation, not a deployed collector or a declaration of data redistribution rights.

## Recommendation

Use **https://open.mse.mn/securities** for the instrument directory. Its full category tables arrive in the HTTP HTML response. A normal HTTP client and HTML parser can extract the stock list without JavaScript execution, authentication, or pagination in the observed response.

Keep listing discovery separate from daily closing-price collection. A directory entry is evidence that the source categorizes a company as listed; it is not evidence that the security traded today or is currently unsuspended.

## Verified directory structure

The approximately 287,391-character UTF-8 HTML response contains these sections:

| HTML section | Meaning | Observed company rows |
| --- | --- | ---: |
| `#stocks #class1` | Equity tier I | 26 |
| `#stocks #class2` | Equity tier II | 39 |
| `#stocks #class3` | Equity tier III | 95 |
| `#stocks #delisted` | Delisted companies | 263 |

The three listed tiers contain **160 distinct source IDs and 160 distinct symbols** in this snapshot. No source IDs overlapped the delisted group. Counts are observations, not permanent constants or an independently reconciled total for the exchange.

The same document also contains bonds, asset-backed securities, funds, and government securities. Do not collect every table row or every `/securities/` link indiscriminately. The symbol and company name each link to the same profile, so naive link collection also produces duplicate records.

Useful selector mapping:

```text
Listed rows:   #stocks #class1 table tr,
               #stocks #class2 table tr,
               #stocks #class3 table tr
Delisted rows: #stocks #delisted table tr
Ticker:        row's second td, a text
Company name:  row's third td, a text
Profile URL:   row's second td, a href
Source ID:     numeric path component of /securities/<id>
Tier:          class1 / class2 / class3 container
```

Header rows contain `th`, not three populated `td` cells. All categories, including hidden tabs, were already in the original HTML. No next-page link or pagination query marker was found. Recheck these assumptions when the markup changes.

Source: [MSE Open securities directory](https://open.mse.mn/securities).

## Identity and optional profile enrichment

Follow URLs discovered in directory rows rather than constructing URLs from symbols or enumerating numeric IDs. A source path ID is a useful source key; do not assume its permanence is contractually guaranteed.

Examples verified by HTTP:

| Symbol | Source ID | Profile |
| --- | --- | --- |
| APU | `90` | https://open.mse.mn/securities/90 |
| KHAN | `563` | https://open.mse.mn/securities/563 |
| TDB | `567` | Discovered in the directory; profile not fetched in this investigation |

The two fetched profiles include ISIN, security type, registration date, and industry information. APU's ISIN is `MN00APU00900`; KHAN's is `MN0KHAN05637`. Extract these from labeled fields, not from their position in a large unrelated details table. Cache profile enrichment; fetching every company profile every day is unnecessary for listing discovery.

Recommended directory record:

```json
{
  "sourceId": "90",
  "symbol": "APU",
  "nameMn": "АПУ ХК",
  "listingTier": 1,
  "listingStatus": "listed",
  "tradingStatus": "unknown",
  "isin": "MN00APU00900",
  "profileUrl": "https://open.mse.mn/securities/90",
  "sourceUrl": "https://open.mse.mn/securities"
}
```

Add collection timestamps and change history in a production collector. Retain both the source ID and ISIN when available, preserve symbol aliases, and keep listing status separate from trading status. A missing company on one failed/partial scrape must not automatically become delisted.

Sources: [APU profile](https://open.mse.mn/securities/90), [KHAN profile](https://open.mse.mn/securities/563).

## Completeness and suspension caveats

[MSE's newer issuer hub](https://new.mse.mn/issuers-hub) displays a headline count of **162** listed companies, while the Open directory's three stock tiers yielded 160. The difference is unresolved. Do not invent the two missing identities, assume the hub is correct, or declare either source complete without reconciliation.

The issuer hub links to [suspended companies](https://new.mse.mn/suspended-companies), but its retrieved static response did not supply a usable suspended-company table. Therefore the listing probe deliberately does not claim which stocks are tradable or suspended. Keep that enrichment as an independent check.

Before relying on complete universe coverage, compare this directory with a current exchange listing report or confirm its scope with MSE. A daily trading report is a useful price cross-check but cannot establish all listings because many stocks may not trade on a particular day.

## Additional discovery: dated prices without browser automation

The fetched profiles contain a `#trade` element with a `data-tab-url` attribute. MSE's own page JavaScript fetches that URL when the trading tab opens. Reading that public HTML fragment directly worked with an ordinary unauthenticated GET:

```text
https://open.mse.mn/securities/90/tab/tradeinfo
https://open.mse.mn/securities/563/tab/tradeinfo
```

The fragment contains an element with ID `chart-data`. Its `data-trading-histories` attribute contains HTML-escaped JSON; an HTML parser decodes the attribute, after which JSON parsing produces records with fields including:

```text
companycode, Symbol, securityType, MDSubOrderBookType,
dates, MDEntryTime, OpeningPrice, ClosingPrice,
PreviousClose, HighPrice, LowPrice, Volume, Turnover, Trades
```

These are verified internal page-fragment routes, **not a documented public API contract**. A separate supported bulk endpoint was not verified.

Direct-HTTP sample results:

| Company | History records | Latest `dates` | Latest dated close |
| --- | ---: | --- | ---: |
| APU | 4,170 | 2026-10-29 | ₮1,056 |
| KHAN | 867 | 2026-10-29 | ₮2,056 |

At the same inspection, the profile headlines displayed ₮1,129 and ₮2,059 respectively. This demonstrates that the headline and latest dated history row can refer to different observations. It does not establish the headline's trade date. Do not assign today's date to an undated headline.

Further observed data-quality issues:

- APU's history was not sorted chronologically; select by validated `dates`, rather than taking the last array element.
- Four APU dates had duplicate rows with matching closing price and volume. Retain provenance, collapse equivalent observations, and flag conflicting duplicates for review.
- Historical APU `Symbol` values included `90`, `90-O-0000`, and `APU-O-0000`, with `companycode=90`. Do not infer company identity solely by stripping a suffix from a historical symbol.
- All sampled chart rows had `MDSubOrderBookType=Regular` and `securityType=CS`. Preserve and validate those fields when extending to other securities or market types.
- The APU fragment contained about 4.18 million decoded characters; KHAN's contained about 0.90 million. It includes substantial history, not just one daily quote. These are decoded response lengths, not measured compressed network transfer sizes.
- The visible date-filter controls hide/show already loaded rows. No server-side date filter or efficient incremental history route was verified.

These findings improve technical price-source feasibility, but do not complete production readiness: source date semantics, source corrections, corporate-action adjustments, universe coverage, CI access, acceptable load, and public redistribution terms still need validation. Use the dated row's session date and preserve `MDEntryTime` separately; historical examples showed those fields can disagree on calendar date.

Sources: [APU trading fragment](https://open.mse.mn/securities/90/tab/tradeinfo), [KHAN trading fragment](https://open.mse.mn/securities/563/tab/tradeinfo), discovered from their profiles. Fragment content was verified with Python HTTP requests; the web reader could not retrieve it.

## Access policy observed

At inspection, [Open's robots file](https://open.mse.mn/robots.txt) returned:

```text
User-agent: *
Disallow:
```

This advertises no disallowed paths for that host. The policy on [the newer host](https://new.mse.mn/robots.txt) differs: it disallows `/api`, `/_next`, `/admin`, and `/login`. Policies are host-specific; do not apply one host's rules to another.

An empty robots disallow is a crawling signal, not an API guarantee or a license to redistribute data. No published rate limit or explicit republication license was verified. Check those terms before publishing mirrored market data. No credentials or access-control bypass were needed for the successful requests.

## Recommended collector design

1. Fetch Open's current robots policy and directory once per daily run. Use an identifiable user agent, timeout, bounded retries, and back off on 429/503 responses.
2. Parse only the explicit stock-tier sections. Check that expected sections exist, IDs and symbols are nonempty, and listed IDs/symbols are unique.
3. Produce separate listed and delisted arrays. Diff against the last good snapshot to identify additions, changed names/symbols, and tier changes. Flag unusual count drops rather than overwriting the directory automatically.
4. Enrich new or changed profiles, plus a periodic refresh, rather than visiting every page each day. Fetch only needed metadata; shareholders, staff, news archives, and PDF attachments are unnecessary for this tracker.
5. Keep the 160-versus-162 discrepancy visible until reconciled. Do not label a listed stock as actively trading without a separate source.
6. Publish validated, versioned `instruments.json` for the static frontend. Keep the prior good file when collection or parsing fails.
7. Investigate a permitted, efficient bulk daily price source before making 160 large history requests every day. The trading fragment is useful for initial history evaluation/backfill, subject to terms and modest request pacing.

A daily directory refresh needs one directory GET plus a robots GET. Profile enrichment is additional. Run collection in GitHub Actions, with the browser reading published JSON on the Pages origin. Browser-to-MSE cross-origin access was not tested and is unnecessary for that architecture.

## Reproducible probe

[mse_listings_probe.py](mse_listings_probe.py) is a standard-library Python research script. It prints JSON and does not write files, enrich profiles, fetch prices, or deploy anything. In live mode it checks the current robots policy before fetching the directory.

```sh
python3 research/mse_listings_probe.py > /tmp/mse-directory.json
```

To repeat parser checks without another network request:

```sh
python3 research/mse_listings_probe.py --html /path/to/saved-securities.html
```

The probe was verified against the directly fetched directory response: 26/39/95 listed-tier rows and 263 delisted rows, with 160 unique listed IDs/symbols. It deliberately has no hardcoded expected company count. Production source monitoring, persistence, retries, reconciliation, and deployment remain future implementation work.
