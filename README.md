# MMM-GettexTops

A modern, clean MagicMirror² module that scrapes and displays the top-performing stocks and ETFs of the day directly from [gettex.de](https://www.gettex.de/).

Since Gettex uses dynamic client-side rendering (ag-Grid), this module runs a headless Playwright Chromium instance in the background to scrape the data accurately and reliably.

---

## Installation

1. Navigate to your MagicMirror `modules` directory and clone/copy this directory:
   ```bash
   cd ~/MagicMirror/modules/
   # (If cloning) git clone https://github.com/christianstengel/MMM-GettexTops.git
   ```
2. Navigate into the module's folder and install the dependencies (Playwright):
   ```bash
   cd MMM-GettexTops
   npm install
   ```
3. Install the headless Chromium browser binary required by Playwright:
   ```bash
   npx playwright install chromium
   ```

---

## Configuration Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `updateInterval` | `Number` | `900000` (15m) | How often to scrape gettex.de and update data (in milliseconds). |
| `maxEntries` | `Number` | `5` | Maximum number of top stocks/ETFs to display in each table. |
| `showAktien` | `Boolean` | `true` | Show the "AKTIEN TOPS" (Top Stocks) table. |
| `showEtfs` | `Boolean` | `true` | Show the "ETFS / FONDS TOPS" (Top ETFs/Funds) table. |

---

## Configuration Example

Add the module to your `config/config.js` file:

```javascript
{
    module: "MMM-GettexTops",
    position: "top_right", // Suitable positions: top_left, top_right, bottom_left, bottom_right
    config: {
        updateInterval: 15 * 60 * 1000, // Update every 15 minutes
        maxEntries: 5,
        showAktien: true,
        showEtfs: true
    }
}
```

---

## Features

- **Automated Cookie Consent Bypass**: Handles the cookie agreement prompt on the website automatically.
- **Header-driven Scraper Control**: Ensures only one scrape instance runs at a time to prevent high CPU load on systems like the Raspberry Pi.
- **Smart Text Shortening**: Cleans up long stock/ETF names (e.g. shortening "UCITS ETF" to "ETF", stripping extra details like "USD (Dist)") so they fit beautifully on MagicMirror screens.
- **Responsive Layout**: Adapts layout automatically and shows positive changes highlighted in green.
