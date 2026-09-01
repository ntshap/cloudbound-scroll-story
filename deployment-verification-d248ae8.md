# Cloudbound deployment verification

## History-only rewrite

The optimized `d248ae8` tree was preserved exactly in replacement commit `57e39d55548bac90785b8b44a810f63c0203ba37`.

| Check | Verified value |
|---|---|
| Replacement tree | `003c9318c582dc3906186f3ce95d2a3124723e41` |
| Sole parent | `012e09849402564262cb5835f5b3bef02c5265dd` |
| GitHub `main` | `57e39d55548bac90785b8b44a810f63c0203ba37` |
| Deployment checkpoint | `483d4cc6` |
| Live URL | https://cloudscroll-qhnhci2p.manus.space |

## Source and build audit

The approved optimized tree contains **326 media files totaling 66,548,764 bytes**. The largest file is **894,582 bytes**. The inventory is 317 WebP files and nine MP4 files, including five WebP stills and 312 transition frames. There are no old PNG stills.

`src/lib/assetLoading.ts`, `src/lib/FrameSequenceStore.ts`, `src/components/VisualStage.tsx`, `src/data/scenes.ts`, and every file under `public/assets/` were verified unchanged from the approved tree. No Managed File Storage, presigned URL, `materialize-assets.mjs`, managed-assets Vite plugin, or `serveManagedVideo` reference exists.

Six Vitest tests passed, TypeScript validation passed, and the production build passed. The build contains all 317 WebP files. MP4s remain committed under `public/assets/` and are served from those disk files through the generic range-aware server path so the platform static edge cannot discard Range headers.

## Live HTTP audit

| Audit | Result |
|---|---|
| Canonical assets | **326/326 HTTP 200** |
| Content types | **326/326 correct** (`image/webp` or `video/mp4`) |
| Asset redirects | **0** |
| Transport | **HTTP/2** |
| MP4 byte ranges | **9/9 HTTP 206** |
| `Content-Range` | **9/9 valid** |
| Range payload | **1,024/1,024 requested bytes** for every probe |

## Scroll-transition audit

Every transition rendered on canvas and advanced and reversed without freezing:

| Transition | Forward and reverse samples |
|---|---|
| 1 | `28 → 62 → 28` |
| 2 | `15 → 56 → 15` |
| 3 | `3 → 43 → 3` |
| 4 | `4 → 37 → 4` |

The loader reached ready state, no Cloudbound-owned frame failures were observed, and the final chapter counter rendered as `05 — 05`.
