# Original content

Recovered on 14 November 2026 from https://right-silver-op8qqgxl.edgeone.dev/.

The catalog preserves the original 78 badge IDs, five categories, Arabic requirements, available English translations, and all 78 scanned pages. Map symbols and Arabic Morse mappings also come from that app. Promise, Law (11 points), Prayer, and Service Signals retain its wording. No missing requirement text was invented; where a translation is unavailable the original text is shown.

`src/catalog.json` holds the structured catalog. `public/badges/` holds the scans, requested only when opened. `src/map-symbols.json` holds the 90 map symbols. `src/program.ts` holds the handbook transcription.

To regenerate the catalog and scans, save the original page as `../original-app.html`, then run `node scripts/extract-original.mjs`. The extractor reads the content declarations, rather than running the original app's authentication or administrator code.

Existing accounts retain their internal `@scout-hub.invalid` login addresses for compatibility. The displayed product name is tas3a / تاسعة.
