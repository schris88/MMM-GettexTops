# Gettex / LSEG Widgets API Reference Guide

This document describes the direct REST API endpoints used by the `gettex.de` website widgets (powered by LSEG/financial.com). It can be used as a reference to fetch live quotes, lookup stock symbol RICs, and retrieve historical daily or intraday charts.

---

## 1. Authentication Flow

To query the LSEG API, you must authenticate by obtaining a SAML request from gettex.de and exchanging it for a JWT token.

### Step 1: Extract SAML Response
Fetch the gettex.de stocks homepage and extract the `samlRequest` XML template from the HTML:
* **URL**: `https://www.gettex.de/realtime-kurse/aktien/`
* **Extraction**: Match the regex `/const\s+samlRequest\s*=\s*`([\s\S]*?)`;/`
* **Base64 Encoding**: Convert the XML template to a Base64 string.

### Step 2: SAML Login
Post the Base64 SAML response to the session endpoint:
* **URL**: `POST https://lseg-widgets.financial.com/auth/api/v1/sessions/samllogin?fetchToken=true`
* **Content-Type**: `application/x-www-form-urlencoded`
* **Payload**: `SAMLResponse=<Base64_SAML>`
* **Response**: Returns a JSON object containing a session ID (`sid`).

### Step 3: Fetch JWT Token
Get the final API JWT token using the session ID:
* **URL**: `POST https://lseg-widgets.financial.com/auth/api/v1/tokens`
* **Headers**:
  * `sid`: `<Session_ID>`
* **Response**: Raw text string representing the JWT token.

> [!NOTE]
> All data requests must include the JWT token in the `jwt` header, and the widget identifier in the `x-cache-id` header:
> * `jwt`: `<JWT_Token>`
> * `x-cache-id`: `V0dfR0VUVEVY` (Base64 for `WG_GETTEX`)

---

## 2. Searching and Resolving Symbols (RICs)

Gettex handles international stocks using Reuters Instrument Codes (RICs) with a `.GTX` suffix (e.g. `TSLA.GTX`). You can resolve a company ticker or ISIN using the find endpoint.

### Find Security by ISIN
* **URL**: `https://lseg-widgets.financial.com/rest/api/find/securities?fids=x.RIC,x._DSPLY_NAME&exchanges=GTX&search=<ISIN>&searchFor=ISIN`
* **Example**: For Tesla (ISIN: `US88160R1014`):
  `https://lseg-widgets.financial.com/rest/api/find/securities?fids=x.RIC,x._DSPLY_NAME&exchanges=GTX&search=US88160R1014&searchFor=ISIN`

---

## 3. Realtime & Live Quotes

To fetch live price and percentage changes, use the quote endpoint.

### Fetch Quotes for multiple RICs
* **URL**: `https://lseg-widgets.financial.com/rest/api/quote/info?rics=<ric1>,<ric2>&fids=x._DSPLY_NAME,q._PCTCHNG,q._TRDPRC_1,q.RIC,q.BID,q.ASK,q.HST_CLOSE`
* **Key FIDs**:
  * `x._DSPLY_NAME`: Display Name
  * `q._PCTCHNG`: Percentage change since yesterday's close
  * `q._TRDPRC_1`: Last traded price
  * `q.BID` / `q.ASK`: Current Bid/Ask quote prices
  * `q.HST_CLOSE`: Yesterday's close price

> [!TIP]
> For low-volume international stocks, the last traded price (`_TRDPRC_1`) may be stale. The website widget often calculates the percentage change dynamically based on the current `ASK` price vs `HST_CLOSE`.

---

## 4. Market Tops & Index Constituents

Instead of fetching all stocks, Gettex displays market leaders using index constituents.

* **URL**: `https://lseg-widgets.financial.com/rest/api/index/constituents?ric=.GDAXI90,.MDAXI90,.SDAXI90,.TECDAX90,.STOXX50E90,.RUI&fids=x._DSPLY_NAME,q._PCTCHNG,q._TRDPRC_1,q.RIC&exchanges=GTX`
* **Indices queried**: DAX (`.GDAXI90`), MDAX (`.MDAXI90`), SDAX (`.SDAXI90`), TecDAX (`.TECDAX90`), Euro Stoxx 50 (`.STOXX50E90`), and US Russell 1000 (`.RUI`).

---

## 5. Historical & Chart Data

Gettex widgets query historical candlestick bars or intraday chart series.

### Daily Historical Data (OHLC)
* **URL**: `https://lseg-widgets.financial.com/rest/api/timeseries/historical?ric=<RIC>&fids=_DATE_END,CLOSE_PRC,OPEN_PRC,HIGH_1,LOW_1&samples=DAILY&toDate=<toDate>&fromDate=<fromDate>`
* **Key FIDs** (Case-sensitive):
  * `_DATE_END`: Date of the candlestick
  * `CLOSE_PRC`: Closing price
  * `OPEN_PRC`: Opening price
  * `HIGH_1`: Daily high price
  * `LOW_1`: Daily low price
* **Example**:
  `https://lseg-widgets.financial.com/rest/api/timeseries/historical?ric=TSLA.GTX&fids=_DATE_END,CLOSE_PRC,OPEN_PRC,HIGH_1,LOW_1&samples=DAILY&toDate=2026-06-25T23:59:59&fromDate=2026-06-18T00:00:00`

### Intraday Chart Data
* **URL**: `https://lseg-widgets.financial.com/rest/api/timeseries/intraday?ric=<RIC>&fids=TIME,CLOSE,OPEN,HIGH,LOW&interval=<interval_minutes>&toDate=<toDate>&fromDate=<fromDate>`
* **Key FIDs** (Case-sensitive):
  * `TIME`: Unix timestamp
  * `CLOSE`, `OPEN`, `HIGH`, `LOW`, `VOLUME`
* **Example** (5-minute bars):
  `https://lseg-widgets.financial.com/rest/api/timeseries/intraday?ric=ALVG.GTX&fids=TIME,CLOSE,OPEN,HIGH,LOW&interval=5&toDate=2026-06-25T09:15:00&fromDate=2026-06-25T08:00:00`
