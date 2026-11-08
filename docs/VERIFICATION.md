# Publication verification

Checked November 8, 2026 on Windows, using Node.js 24.19.0. This records technical checks on the prepared project, not user research outcomes.

| Check                             | Result                                                                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Clean lockfile installation       | `npm ci` completed                                                                                                                        |
| TypeScript and lint               | Passed                                                                                                                                    |
| Unit and API regressions          | 147 passed                                                                                                                                |
| Production browser regressions    | 116 passed in Microsoft Edge with isolated storage and mocked providers                                                                   |
| Production browser/Electron build | Passed; HTML, lazy chunk dependencies and compiled local server checked                                                                   |
| Native Windows app                | Passed with a hidden window and temporary profile                                                                                         |
| Windows unpacked packaging        | Passed with signing disabled for the verification artifact                                                                                |
| Packaged `app.asar`               | Passed the same native test, including a full process restart                                                                             |
| Packaged file inspection          | 64 entries; no environment files, local archive, source docs or external runtime dependencies                                             |
| Dependency audit                  | `npm audit --audit-level=moderate` reported zero known vulnerabilities after the fix                                                      |
| Portfolio capture                 | Five production screenshots; fictional library and original SVG sample artwork                                                            |
| Publication boundary              | Recognized-secret/private-file scan passed; a negative probe confirmed nested environment files and credential-shaped values are rejected |

The desktop test covers the real preload bridge, theme synchronization, drag/control CSS regions, private per-user key loading over an empty inherited variable, HTTP assets, backup import, lazy navigation and library/theme persistence across reload and full process restart. It uses a synthetic key and mocked provider responses. Native pointer-drag behavior was not manually exercised during this preparation.

The browser suite covers collection browsing/editing, keyboard interactions, backup/restore, recovery, sharing, catalog filters, AI failure/cancellation states, recommendations, statistics, themes, compact layouts and production chunk failures. The final renderer build produced the same asset hashes as the browser-tested build. Later server changes suppressed configuration banners and removed Steam account-ID logging; the unit/API and native checks passed afterward.

## Dependency repair

The packaging dependency tree contained affected minimatch 9/10 releases. A version-scoped npm override moves affected versions to 11.0.5 while preserving older compatible major versions used by other tools. Clean installation, builds and actual Windows packaging passed with this override. [Upstream advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249).

## Privacy and history

The root credential file was removed and the example now contains blank values. Current public-source text was checked against the original configured credential values before their removal; no exact matches were found. Broader recognized-key scans and personal-name/email/path checks were also run. New screenshots were visually inspected and contain only the fictional fixture.

An exact credential match was found in the original Git history. That history remains local and is deliberately excluded from the clean source export. The exposed Twitch credentials still need provider-side replacement. No remote repository was changed and no credentials were rotated on the owner's behalf.

## Limits

Live IGDB, Gemini and Steam account access was not tested after removing personal credentials. Those features require each user's own valid credentials and provider availability. Mocked tests establish application behavior, not current provider access or quota.

The Windows verification used an unpacked build and its archive; a new NSIS installer was not installed. Code signing, automatic updates, cloud sync and public multi-user hosting are outside this delivery. GitHub Actions is configured but has not run on a newly published repository. Full screen-reader, forced-color, zoom and all-state accessibility verification remains open. Secret pattern scanning cannot establish the absence of every possible private value.
