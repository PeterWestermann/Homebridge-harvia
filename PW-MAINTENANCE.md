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

The PW version sits one patch line ahead of the currently integrated upstream stable line and uses a prerelease suffix.

Example:
- upstream: `0.2.0`
- PW: `0.2.1-pw.1`

This prevents Homebridge UI from offering the already-integrated `0.2.0` as an update, while a later stable `0.2.1` still sorts above `0.2.1-pw.1` and therefore becomes visible for review.

## Rollback

Keep a Homebridge backup and the previously working plugin tarball before installing a new PW build. Do not delete cached accessories during an update unless a separate migration plan explicitly requires it.


## Scoped npm package

The maintained package identifier is:

`@peterwestermann/homebridge-harvia`

The Homebridge platform identifier remains `HarviaSauna`.

Homebridge supports resolving cached dynamic-platform accessories after a plugin identifier changes by matching the active dynamic platform name. This allows a controlled migration from `homebridge-harvia` to the scoped package without intentionally regenerating existing accessories.

The first npm publication must be created interactively. Afterwards, npm Trusted Publishing is used with GitHub Actions OIDC and no long-lived npm write token.
