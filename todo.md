# Cloudbound File Storage Completion

- [x] Upload the verified archive contents to deterministic managed-storage keys and identify their browser-serving base URL as `/manus-storage/assets/`.
- [x] Confirm the archive contains exactly 326 files: 5 stills, 5 idles, and four transition folders with one fallback video and 78 consecutively numbered WebP frames each.
- [x] Preserve every original filename and encoding; do not rewrite `/assets/...` paths if managed storage serves that base.
- [x] Remove checkpoint-blocking duplicate local/build media only after confirming the managed copy is usable.
- [x] Rebuild and visually verify the loader, hero, frame-scrub transitions, chapter counter, and final scene.
- [x] Save the final checkpoint and report the verified count, serving base URL, and publishing URL/instructions.
- [x] Replace `vite.config.ts` with the exact requested `dist/public` output configuration and change nothing else.
- [x] Confirm the production build emits `dist/public/index.html` and bundled assets.
- [x] Save a corrected publish-ready checkpoint for redeployment.
- [x] Allow the Manus preview hostname in Vite while preserving `build.outDir: 'dist/public'`.
- [x] Emit `dist/index.js` for the platform production startup without changing the Cloudbound experience.
- [x] Verify preview access, `dist/public` upload output, and the production server on port 3000.
- [x] Save a corrected checkpoint for automatic redeployment.
