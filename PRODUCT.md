# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React, TypeScript, and Vite, implemented from the accepted project plan. GitHub Actions collects and publishes market data; GitHub Pages hosts the static application. Portfolio math uses decimal.js and files use CSV or versioned JSON.

## Users

The owner wants to understand profit or loss on their stocks. Other visitors can use their own imported holdings on the public website.

## Product Purpose

Show stock portfolio value and profit/loss using prices collected daily from the Mongolian Stock Exchange.

## Operating Context

The code and website will be public. Visitors import and export holdings files. Portfolio data lives in the browser, with no application database. The owner is comfortable publishing their own holdings; this does not authorize publishing visitors' portfolios.

## Capabilities and Constraints

- Required: MSE stock prices collected every day, holdings-based profit/loss, import, export, browser persistence, public project, GitHub Pages hosting.
- The user authorized implementation after reviewing the plan and MSE source research.
- Implemented first-release scope: current holdings and unrealized gains, browser-local persistence, import/export, market directory, dated stock history, and a labeled example portfolio. Transaction-ledger support is future work.
- Planning assumptions: MNT currency; “margin” means investment profit/loss rather than leveraged trading.
- The initial interface is English with Mongolian company names and MNT amounts. Project name: Equities. Application code: MIT. No real owner holdings are published.
- Remaining source limitations: Open lists 160 companies while the newer hub reports 162; some histories fail validation or are very old. MSE redistribution terms remain to be verified separately from technical crawling access.

## Brand Commitments

The user supplied https://tax-ui.brianlovin.com/ as a reference and explicitly distinguished this product's investment purpose from that site's tax purpose. The delivered visual system is documented in DESIGN.md.

## Evidence on Hand

The workspace began empty. PLAN.md contains dated research, official source links, proposed calculations, and delivery milestones. Follow-up source research and a read-only directory probe are in research/mse-listings.md and research/mse_listings_probe.py. A full live collection produced 160 listed entries and 154 validated dated quotes. Complete listing reconciliation and source licensing remain unresolved; missing or old prices are visible in the product. No actual holdings have been provided. Do not invent the owner's holdings or present synthetic data as real.

## Product Principles

- Make portfolio value and profit/loss easy to inspect.
- Preserve browser-local import/export as a core workflow.
- Make price dates and incomplete valuations visible.
- Keep public project data distinct from visitors' holdings.
- Use the simplest architecture compatible with GitHub Pages and daily collection.
