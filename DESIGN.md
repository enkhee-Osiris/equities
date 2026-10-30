# Equities interface

The dashboard follows the user's Tax UI reference: an open financial summary above a compact ledger. Its main task is inspecting current holdings, prices, and unrealized gains. The first visit is empty; the example appears only when selected and is explicitly labeled.

## Visual system

- Self-hosted Manrope Variable, with tabular numerals in financial data.
- Cool near-white canvas (`#f8f9fb`), white ledger, ink text (`#232a30`), and dark forest actions (`#285b4c`).
- Positive results use green (`#287255`); negative results use red (`#bd4c4c`). Signs, percentages, and labels carry meaning alongside color.
- Hairline dividers and modest control radii; the summary is an open row rather than nested cards.
- Lucide stroke icons; company badges show text initials rather than invented company logos.
- Main content is at most 1,280 px wide, with 48 px desktop gutters and 17 px narrow-screen gutters.

## Interaction and responsive behavior

Add/edit, import review, and stock details use keyboard-accessible native dialog drawers. Escape dismisses them. Import requires a preview confirmation, and removal requires confirmation. Export offers CSV and lossless JSON. The `/` shortcut focuses search when no form field or dialog is active.

Mobile places gain/loss below the other summary totals. The holdings table retains company, value, and gain/loss, with price dates beneath value; shares and average price remain available in the detail drawer. The directory can scroll within its own container. The page itself must not overflow horizontally.

Price charts represent dated, unadjusted individual-stock prices, not fabricated historical portfolio returns. Missing prices remain unpriced. Old prices retain years and an explicit warning. Motion is limited to drawer/toast entry and active loading; reduced-motion preferences disable it.

## Verification

Desktop and mobile screenshot review and browser smoke tests covered the labeled example, forms, local persistence, import cancellation/errors, export, and partial valuation. The mobile overflow found during review was fixed. No generated raster assets are shipped.
