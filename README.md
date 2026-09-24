# homebridge-harvia

Homebridge plugin for Harvia Sauna (Xenio WiFi) via the MyHarvia cloud API.

> **PW maintained variant:** tracks the upstream project and adds a dedicated HomeKit temperature sensor so the sauna's current temperature can be used cleanly in HomeKit automations and Apple Shortcuts.

Ported from the [Home Assistant integration](https://github.com/RubenHarms/ha-harvia-xenio-wifi) by Ruben Harms.

**Tested with:** Harvia Xenio WiFi (CX001WIFI) and Harvia Cilindro PC90XE. Should work with any controller compatible with the MyHarvia app.

---

## Requirements

- Node.js ≥ 18
- Homebridge ≥ 1.6.0
- Harvia Xenio WiFi module (CX001WIFI)
- MyHarvia app account

---

## Installation

### Via Homebridge UI (recommended)
1. Go to the **Plugins** tab in Homebridge UI
2. Search for `@peterwestermann/homebridge-harvia`
3. Click **Install**

### Via terminal
```bash
sudo npm install -g @peterwestermann/homebridge-harvia
```

---

## Configuration

Add to your `config.json` under `platforms`, or configure via the Homebridge UI settings form:
```json
{
  "platform": "HarviaSauna",
  "name": "Harvia Sauna",
  "username": "your@myharvia.email",
  "password": "yourpassword",
  "pollingInterval": 60,
  "enableThermostat": true,
  "enableTemperatureSensor": true,
  "enableLight": true,
  "enableFan": true,
  "enableSteamer": false,
  "enableDoorSensor": true
}
```

| Field | Required | Default | Description |
|---|---|---|---|
| `username` | ✅ | — | MyHarvia app email address |
| `password` | ✅ | — | MyHarvia app password |
| `pollingInterval` | ❌ | `60` | Seconds between fallback polls (min 30) |
| `enableThermostat` | ❌ | `true` | Expose heater as HomeKit HeaterCooler |
| `enableTemperatureSensor` | ❌ | `true` | Expose current sauna temperature as a dedicated HomeKit Temperature Sensor for automations and Shortcuts |
| `enableLight` | ❌ | `true` | Expose light as HomeKit Switch |
| `enableFan` | ❌ | `true` | Expose fan as HomeKit Switch |
| `enableSteamer` | ❌ | `false` | Expose steamer as HomeKit Switch |
| `enableDoorSensor` | ❌ | `false` | Expose door safety circuit as Contact Sensor |

---

## Exposed Accessories

| Accessory | HomeKit Type | Enabled by default |
|---|---|---|
| Thermostat | HeaterCooler | ✅ |
| Temperature | Temperature Sensor | ✅ |
| Power | Switch | ✅ Always on |
| Light | Switch | ✅ |
| Fan | Switch | ✅ |
| Steamer | Switch | ❌ |
| Door Sensor | Contact Sensor | ✅ |

The **Power** switch is always enabled as it is the core function of the plugin.
All others can be toggled via the Homebridge UI settings or `config.json`.

---

## How It Works

1. **Endpoint discovery** — fetches AppSync URLs at startup from `prod.myharvia-cloud.net` rather than hardcoding them, so the plugin survives backend changes
2. **Authentication** — Cognito SRP auth using the same user pool as the MyHarvia mobile app
3. **Real-time updates** — 4 AppSync WebSocket subscriptions (device state + sensor data × org receiver + user receiver)
4. **Polling fallback** — HTTP polling every `pollingInterval` seconds if WebSocket drops
5. **Token refresh** — automatic Cognito token renewal before expiry

---

## Known Limitations

- Uses the **unofficial, undocumented** MyHarvia API — may break if Harvia changes their backend
- Steamer control is disabled by default — enable only if your heater supports it
- Temperature is always in °C from the API — HomeKit converts to your region's units automatically

---

## Troubleshooting

**Accessories show "No Response"**
Check Homebridge logs for authentication or WebSocket errors. Restart Homebridge — the plugin reconnects automatically.

**Wrong device names**
The plugin uses the display name from your MyHarvia account. If names are showing as UUIDs, check that your sauna has a name set in the MyHarvia app.

**Authentication failed**
Verify credentials match the MyHarvia app login, not the Harvia website.

---

## Credits

API reverse-engineering by [Ruben Harms](https://github.com/RubenHarms/ha-harvia-xenio-wifi).

This plugin is not affiliated with or endorsed by Harvia.

---

## PW maintenance model

This fork intentionally keeps the upstream Harvia implementation as intact as possible.

The PW delta is limited to:
- a dedicated HomeKit `TemperatureSensor` accessory;
- the `enableTemperatureSensor` configuration flag;
- CI checks that verify the PW delta is still present after upstream merges;
- an upstream-sync workflow that proposes upstream changes through a pull request instead of applying them silently.

Versioning rule:
- integrated upstream baseline `0.2.0` -> initial scoped PW release `0.2.1`;
- later PW releases use normal stable semantic versions;
- upstream changes are detected and reviewed independently by the upstream-sync workflow.

The dedicated sensor uses the same live `device.currentTemp` value already populated by the plugin's WebSocket subscriptions and polling fallback.


---

## PW scoped package

The maintained PW release is published as `@peterwestermann/homebridge-harvia`.

The Homebridge platform name remains `HarviaSauna`. Homebridge can therefore migrate cached dynamic-platform accessories from the previous plugin identifier to the scoped plugin identifier during startup.

For migration from the unscoped plugin:
1. Create a Homebridge backup.
2. Install `@peterwestermann/homebridge-harvia`.
3. Remove the old `homebridge-harvia` package without clearing cached accessories.
4. Restart Homebridge once.
5. Verify all existing Harvia accessories and the dedicated temperature sensor before deleting any rollback package.
