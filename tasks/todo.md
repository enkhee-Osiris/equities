# Project work

## Planning — 30 October 2026

- [x] Inspect the existing workspace and applicable instructions.
- [x] Inspect the reference site's information structure.
- [x] Capture the user's browser-local import/export requirement and willingness to share their own holdings.
- [x] Research official MSE pages and GitHub Pages/Actions constraints.
- [x] Define proposed first-release scope, calculations, data flow, failure behavior, and milestones in PLAN.md.
- [x] Record confirmed product facts and open decisions in PRODUCT.md.
- [x] Review the plan for source uncertainty, partial price coverage, privacy, and deployment sequencing.

## Implementation — future work

- [ ] Verify a permitted MSE collection source and public republication terms.
- [x] Implement the accepted React/TypeScript current-holdings plan with a labeled synthetic example.
- [x] Build the current-holdings editor, valuation, import/export, and persistence.
- [x] Build and verify the collector, validation, bounded manual refresh, and 400-session history collection. Full audited historical backfill remains future work.
- [x] Configure daily Actions collection at 18:17 Asia/Ulaanbaatar and explicit Pages deployment.
- [x] Verify 53 calculation/parser cases and five browser smoke flows, including mobile overflow, persistence, import/export, and partial valuation.
- [ ] Prepare public-project documentation and publish to the intended repository and Pages URL.

## Review

Planning is complete. The source milestone is deliberately unresolved: an official public market page was found, but a complete unattended price feed and redistribution rights were not verified. The plan separates that dependency from UI work and does not claim automatic collection is already working. No application or deployment has been implemented.

## Follow-up MSE listing research — 30 October 2026

- [x] Verify the Open directory can be fetched as populated static HTML.
- [x] Extract listed tiers separately from delisted stocks and other asset classes.
- [x] Check ID/symbol uniqueness and profile metadata on a small sample.
- [x] Inspect host-specific robots policies and public profile trading-tab routes.
- [x] Verify a read-only directory probe against the fetched HTML.
- [x] Document count discrepancies, dated-price observations, payload sizes, and source limitations.
- [ ] Reconcile Open's 160 listed entries with the newer issuer hub's 162-company headline.
- [ ] Verify production data terms, CI access, suspension status, and an efficient daily closing-price collection path.

## Implementation verification

- Full live collection: 160 listed stocks, 154 valid quotes, no fabricated prices.
- Production build and TypeScript pass; 40 portfolio tests, 13 collector/parser tests, and five browser tests pass.
- Isolated Git data-branch tests passed, preserving the source checkout and staged changes.
- Desktop/mobile render reviewed; mobile overflow fixed and source price dates retained.
- Public repository created at https://github.com/enkhee-Osiris/equities; Pages deployment verification is in progress.

## Publishing authorization

GitHub accepted the public repository and application source. Uploading Actions YAML was denied because the current OAuth token lacks `workflow` scope. Templates are preserved in deployment/workflows and GitHub device authorization was requested. A manual gh-pages deployment is being verified so the site can be used independently of that permission.
