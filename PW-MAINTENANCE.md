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

## Upstream updates

`.github/workflows/upstream-sync.yml` checks upstream and creates a pull request when new upstream commits can be merged cleanly.

The sync is deliberately not auto-merged. A passing TypeScript build proves build compatibility, not real Harvia/HomeKit runtime compatibility.

After an upstream merge:
1. CI must pass on Node.js 22 and 24.
2. The PW integrity check must pass.
3. Review upstream behavioural changes.
4. Merge the sync PR.
5. Increment the PW version according to the release policy.
6. Build a release package.
7. Install on Homebridge with backup and rollback available.
8. Verify Power, thermostat, light/fan/door as applicable, current temperature, and temperature-triggered HomeKit automation.

## Version policy

The scoped package `@peterwestermann/homebridge-harvia` uses its own stable semantic-version line.

Initial PW scoped release:
- integrated upstream baseline: `0.2.0`
- PW scoped package: `0.2.1`

Because Homebridge checks updates for the installed npm package name, the scoped package no longer needs a `-pw` prerelease suffix. New upstream changes are detected by the upstream-sync workflow, reviewed, merged, and then released as a new stable PW package version.

## Rollback

Keep a Homebridge backup and the previously working plugin tarball before installing a new PW build. Do not delete cached accessories during an update unless a separate migration plan explicitly requires it.


## Scoped npm package

The maintained package identifier is:

`@peterwestermann/homebridge-harvia`

The Homebridge platform identifier remains `HarviaSauna`.

Homebridge supports resolving cached dynamic-platform accessories after a plugin identifier changes by matching the active dynamic platform name. This allows a controlled migration from `homebridge-harvia` to the scoped package without intentionally regenerating existing accessories.

The first npm publication must be created interactively. Afterwards, npm Trusted Publishing is used with GitHub Actions OIDC and no long-lived npm write token.
