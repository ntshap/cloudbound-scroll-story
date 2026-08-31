# Cloudbound Delivery Verification

Measured on **31 August 2026** against [https://cloudscroll-qhnhci2p.manus.space](https://cloudscroll-qhnhci2p.manus.space).

## Before the delivery change

| Measurement | Result |
|---|---|
| Ordered full scroll-through | 312 frame requests; 312 HTTP 200 responses |
| Aggressive rapid-scroll pass | 219 attempts: 214 HTTP 200 and five browser-cancelled status-0 attempts |
| Exact cancelled attempts | `02-hall-to-workshop/frame_000011.webp`, `frame_000013.webp`, `frame_000014.webp`, `frame_000015.webp`, and `frame_000016.webp`; each subsequently completed with HTTP 200 |
| HTTP 404 / 429 / 503 / timeout responses | None observed in the ordered browser pass |
| Canonical frame path | HTTP 307 redirect to a signed managed-storage URL |
| Canonical-path cache | `Cache-Control: public, max-age=14400` |
| Final object transport | HTTP/2, HTTP 200, one-year cache |
| Browser Resource Timing bytes | Zero exposed because the redirected cross-origin objects did not provide timing access |
| Exact unchanged frame payload | 340,303,442 bytes across 312 WebP frames |
| Largest sequence | `03-workshop-to-garden`: 78 frames, 97,995,034 bytes |

## After the hybrid direct-delivery change

| Measurement | Result |
|---|---|
| Hard-reload full scroll-through | 312 unique frame requests; 312 HTTP 200 responses |
| Per-sequence frame count | 78 / 78 / 78 / 78 |
| Protocol | HTTP/2 for all 312 frame requests |
| Canonical frame redirects | Zero |
| Retry requests | Zero required during the final pass |
| Element/resource failures | Zero |
| Playback verification | Canvas active at every sampled transition, reverse scrubbing confirmed, final counter `05 — 05` |
| Direct PNG/WebP audit | All 317 URLs: HTTP 200, HTTP/2, zero redirects, no `Content-Encoding`, static-CDN mode |
| PNG/WebP cache | Platform-normalized `Cache-Control: max-age=7776000` (90 days) |
| MP4 range audit | All nine URLs: HTTP 206 for `Range: bytes=0-1023`, valid `Content-Range`, HTTP/2, zero redirects, no `Content-Encoding` |
| MP4 cache | `Cache-Control: public, max-age=31536000` |
| Exact unchanged frame payload | 340,303,442 bytes across 312 WebP frames |

The source archive remains byte-identical and contains **326 files**: five still PNGs, five idle MP4s, four fallback MP4s, and 312 transition WebP frames. No media was renamed, re-encoded, downscaled, thinned, or substituted.

The application now performs three bounded attempts with backoff for retryable failures, does not retry terminal 404 responses beyond that bound, re-queues only missing frames on later sequence entry, and notifies the renderer as frames arrive even when a caller joins an already-running load.

> The platform’s direct static edge normalizes PNG/WebP cache headers to a long-lived 90-day policy and omits the `immutable` token. The application requests one-year immutable caching, but the observed public response is the platform-normalized header reported above.
