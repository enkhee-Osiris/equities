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
- [x] Prepare public-project documentation and publish the source and website.
- [ ] Activate daily GitHub Actions after the account grants workflow scope; run a full collection on GitHub-hosted CI.

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
- Public repository created at https://github.com/enkhee-Osiris/equities; Pages deployed successfully at https://enkhee-osiris.github.io/equities/.

## Publishing authorization

GitHub accepted the public repository and application source. Uploading Actions YAML was denied because the current OAuth token lacks `workflow` scope. Templates are preserved in deployment/workflows and GitHub device authorization was requested. The manual gh-pages deployment succeeded. The live site, market JSON, and stock-history view passed a production browser smoke check. Daily Actions activation remains pending workflow-scope authorization.

Final verification: 53 domain/parser tests + five browser tests passed. Production repository-prefix check and deployed-site check passed. The finish reviewer scored all material fixes resolved, and design documentation and machine-readable tokens were recorded.
