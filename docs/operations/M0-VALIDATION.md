# M0 foundation validation

This records a development scaffold, not completed M0 or a packaged release.

| Check | Result |
|---|---|
| .NET host Release build | Passed locally with SDK 10.0.404; zero warnings/errors |
| TypeScript renderer check | Passed |
| Renderer/Monaco worker bundle | Passed |
| Node protocol/client tests | 6 passed: fragmented Unicode/coalesced frames, invalid lengths/JSON, invalid host reply, host exit, timeout and missing executable |
| Real .NET host integration | 2 passed: concurrent correlation/EOF shutdown and oversized-frame rejection |
| Production dependency audit | Zero vulnerabilities after pinning the patched DOMPurify override to 3.4.17 |
| Desktop smoke | Not passed in this restricted Linux session: headless Electron startup timed out with unavailable system bus/socket environment |
| Windows desktop and installer | Not run; explicit acceptance gate remains open |
| Self-contained host distribution | Not implemented; development launch uses the installed .NET runtime |
| CI required-check enforcement | New backend/frontend definitions added; observed run names and branch rules must still be verified |

The desktop smoke command has a 15-second watchdog and exits on timeout. Do not disable renderer sandboxing or web security to make a launch check pass. Repeat the smoke on a supported desktop session, then verify Windows packaging before completing M0.

Dependencies are exactly pinned with an npm lockfile. Monaco 0.57.0 pins an older DOMPurify; the root override selects the patched 3.4.17 release. Revisit this override when upgrading Monaco. No user script runs in this foundation.

Backend/frontend jobs run for PRs; main retains the inexpensive repository foundation check to avoid duplicate full builds after merges. Superseded CI runs are cancelled. No scheduled, publishing or OS matrix jobs are enabled.
