# MMM-GettexTops

A modern, clean MagicMirror² module that displays the top-performing stocks and ETFs of the day directly from [gettex.de](https://www.gettex.de/).

This module queries the LSEG widgets API directly, avoiding the need for any headless browser automation, making it highly lightweight and fast.

---

## Installation

1. Navigate to your MagicMirror `modules` directory and clone/copy this directory:
   ```bash
   cd ~/MagicMirror/modules/
   git clone https://github.com/schris88/MMM-GettexTops.git
   ```
2. Navigate into the module's folder and run npm install (optional/for consistency):
   ```bash
   cd MMM-GettexTops
   npm install
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

- **Direct API Scraping**: Bypasses browser automation by querying the raw LSEG widgets API directly, resulting in near-instant load times and zero browser overhead.
- **Lightweight Execution**: Negligible CPU and memory footprint, making it ideal for low-resource environments like the Raspberry Pi.
- **Smart Text Shortening**: Cleans up long stock/ETF names (e.g. shortening "UCITS ETF" to "ETF", stripping extra details like "USD (Dist)") so they fit beautifully on MagicMirror screens.
- **Responsive Layout**: Adapts layout automatically and shows positive changes highlighted in green.
