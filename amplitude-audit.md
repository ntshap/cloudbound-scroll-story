# Amplitude Console Audit

The reported requests were reproduced on the public Cloudbound domain on **1 September 2026**.

Cloudbound source, configuration, and project bundles contain no references to `amplitude`, `api2.amplitude.com`, `sr-client-cfg`, or `spaceEditor-DPV`.

The public document receives an externally injected script from `https://files.manuscdn.com/manus-space-dispatcher/spaceEditor-DPV-_I11.js`. Browser Resource Timing attributes the `sr-client-cfg.amplitude.com` and `api2.amplitude.com` requests to that dispatcher/editor runtime. The page does not expose a Cloudbound-owned `window.amplitude` global.

The edge-served HTML contains two application/external scripts: Cloudbound's `/assets/index-CB237m0y.js` bundle and the Manus dispatcher URL above. An explicit scan of the deployed Cloudbound bundle returned **zero** matches for `amplitude`, `api2.amplitude.com`, `sr-client-cfg`, or `spaceEditor-DPV`; the edge HTML contains the dispatcher reference.

Independent endpoint probes reproduce the reported response classes: the dispatcher's Amplitude configuration key returns **HTTP 403** with `{"errors":["Invalid API key"]}`, while an invalid empty event submission to `api2.amplitude.com/2/httpapi` returns **HTTP 400**. In the browser, those cross-origin fetch/beacon entries are initiated alongside the injected dispatcher script. Cloudbound's 181 same-origin resources produced **zero non-success responses** during the same audit.

There is therefore no Cloudbound-owned Amplitude integration to remove. The invalid Amplitude key/configuration belongs to the edge-injected Manus dispatcher and cannot be corrected safely from application source without interfering with platform/editor functionality.
