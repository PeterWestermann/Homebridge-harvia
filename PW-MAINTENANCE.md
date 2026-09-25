# PW maintenance model

This fork is maintained as a thin delta on top of:

- Upstream: https://github.com/jos3phburns-afk/Homebridge-harvia
- Upstream branch: `main`
- PW branch: `main`

## Functional PW delta

1. Dedicated HomeKit Temperature Sensor accessory.
2. Stable accessory UUID suffix: `-temperature`.
3. `enableTemperatureSensor` configuration option, default `true`.
4. Current temperature is sourced from `HarviaDevice.currentTemp`.
5. Updates use the existing `DeviceStateSubscriber` path, so WebSocket updates remain primary and polling remains fallback.

No threshold, debounce, or automation logic is embedded in the plugin. HomeKit / Apple Shortcuts own that policy.

## Automatic upstream update and release flow

`.github/workflows/upstream-sync.yml` checks `jos3phburns-afk/Homebridge-harvia:main` every day and can also be started manually.

When new upstream commits are detected, the workflow automatically:

1. merges upstream into a dedicated `automation/upstream-sync-...` branch;
2. automatically resolves only the expected `package.json` identity/version conflict by taking the upstream dependency/script baseline and then restoring the PW package identity;
3. stops safely if any other merge conflict remains;
4. computes the next stable PW version;
5. verifies that the PW temperature-sensor delta is still present;
6. installs dependencies without creating a package lock, builds TypeScript, syntax-checks generated JavaScript and performs an npm package dry-run;
7. creates an audit pull request;
8. explicitly dispatches the independent CI workflow on Node.js 22 and 24 and waits for it to pass;
9. merges the PR with a merge commit so upstream ancestry is preserved;
10. explicitly dispatches the npm publish workflow and waits for successful publication;
11. confirms that the new scoped version is visible from the npm registry.

The npm publication uses Trusted Publishing / GitHub Actions OIDC. No long-lived npm write token is required.

The workflow also self-heals a missed publication: on every run it checks whether the current `main` version exists on npm. If not, it dispatches the publish workflow again before processing further upstream changes.

## Safety gates

Automatic publication happens only after repository-level checks pass. The automated gates include:

- PW package identity: `@peterwestermann/homebridge-harvia`;
- dedicated `TemperatureSensorAccessory`;
- `enableTemperatureSensor` configuration;
- stable temperature-accessory identity;
- TypeScript build;
- generated JavaScript syntax validation;
- npm package dry-run;
- independent CI on Node.js 22 and 24;
- publish-time PW verification and build.

Unexpected merge conflicts are never auto-resolved. They leave the current npm release untouched and require review.

GitHub Actions cannot perform a real MyHarvia/HomeKit runtime test against the private CL-Orion installation. Therefore publication means "CI-validated and package-published", not "already installed on the sauna". Homebridge remains the installation gate and will offer the new npm version as an update.

## Version policy

The scoped package `@peterwestermann/homebridge-harvia` uses stable semantic versions.

Initial PW scoped release:

- integrated upstream baseline: `0.2.0`
- PW scoped package: `0.2.1`

For every successfully integrated upstream change, the automation chooses a new version that is strictly higher than the previous PW version. If upstream advances its own major/minor/patch line, the PW version follows that line and adds one patch level for the maintained PW variant. Otherwise the existing PW patch number is incremented.

Examples:

- PW `0.2.1`, upstream remains `0.2.0` with new commits -> PW `0.2.2`
- PW `0.2.2`, upstream becomes `0.3.0` -> PW `0.3.1`
- PW `0.3.1`, upstream becomes `1.0.0` -> PW `1.0.1`

Because Homebridge checks updates for the installed npm package name, every successfully published higher stable version is offered as an update for the installed scoped package.

## Rollback

Keep a Homebridge backup and the previously working plugin tarball before installing a new PW build. Do not delete cached accessories during an update unless a separate migration plan explicitly requires it.

Automatic upstream integration publishes a new npm package but does not automatically install it on CL-Orion. This keeps the running sauna installation rollback-capable and avoids an unattended production restart.

## Scoped npm package

The maintained package identifier is:

`@peterwestermann/homebridge-harvia`

The Homebridge platform identifier remains `HarviaSauna`.

Homebridge supports resolving cached dynamic-platform accessories after a plugin identifier changes by matching the active dynamic platform name. This allowed the controlled migration from `homebridge-harvia` to the scoped package without intentionally regenerating existing accessories.
