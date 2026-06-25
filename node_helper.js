/* Magic Mirror
 * Node Helper: MMM-GettexTops
 *
 * By Christian Stengel
 * MIT Licensed.
 *
 * Fetches gettex.de Top Stocks & ETFs via direct API endpoints.
 */

const NodeHelper = require("node_helper");

/**
 *
 * @param val
 */
function formatChangePercent (val) {
	const formatted = val.toFixed(2).replace(".", ",");
	return `${(val >= 0 ? "+" : "") + formatted}%`;
}

module.exports = NodeHelper.create({
	start () {
		console.log(`Starting node helper for: ${this.name}`);
		this.cache = null;
		this.isFetching = false;
	},

	socketNotificationReceived (notification, payload) {
		if (notification === "GET_GETTEX_DATA") {
			this.handleDataRequest(payload);
		}
	},

	async handleDataRequest (config) {
		const self = this;

		// Return cached data immediately if fresh
		if (this.cache) {
			this.sendSocketNotification("GETTEX_DATA_UPDATED", this.cache);
		}

		if (this.isFetching) {
			return;
		}

		this.isFetching = true;
		console.log("[MMM-GettexTops] Fetching gettex.de data via direct API...");

		try {
			// 1. Fetch gettex homepage HTML to extract samlRequest
			const pageRes = await fetch("https://www.gettex.de/realtime-kurse/aktien/", {
				headers: {
					"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
				}
			});
			if (!pageRes.ok) {
				throw new Error(`Failed to load gettex.de: ${pageRes.status}`);
			}
			const html = await pageRes.text();

			// Extract samlRequest
			const match = html.match(/const\s+samlRequest\s*=\s*`([\s\S]*?)`;/);
			if (!match) {
				throw new Error("Could not find samlRequest in gettex.de HTML");
			}
			const xml = match[1].trim();
			const base64Saml = Buffer.from(xml).toString("base64");

			// 2. Perform samllogin
			const params = new URLSearchParams();
			params.append("SAMLResponse", base64Saml);

			const loginRes = await fetch("https://lseg-widgets.financial.com/auth/api/v1/sessions/samllogin?fetchToken=true", {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Accept: "application/json",
					"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
				},
				body: params.toString()
			});

			if (!loginRes.ok) {
				throw new Error(`SAML login failed: ${loginRes.status}`);
			}
			const loginData = await loginRes.json();
			if (!loginData.sid) {
				throw new Error("No sid returned from samllogin");
			}

			// 3. Get JWT token
			const tokenRes = await fetch("https://lseg-widgets.financial.com/auth/api/v1/tokens", {
				method: "POST",
				headers: {
					Accept: "application/json",
					sid: loginData.sid,
					"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
				}
			});
			if (!tokenRes.ok) {
				throw new Error(`Token fetch failed: ${tokenRes.status}`);
			}
			const jwtToken = (await tokenRes.text()).trim();

			// 4. Fetch Stocks if enabled
			let stocks = [];
			if (config.showAktien !== false) {
				// Fetch index constituents representing the market tops shown on the gettex page
				const constituentsUrl = "https://lseg-widgets.financial.com/rest/api/index/constituents?ric=.GDAXI90,.MDAXI90,.SDAXI90,.TECDAX90,.STOXX50E90,.RUI&fids=x._DSPLY_NAME,q._PCTCHNG,q._TRDPRC_1,q.RIC,q.ASK,q.HST_CLOSE&exchanges=GTX";
				const findRes = await fetch(constituentsUrl, {
					headers: {
						jwt: jwtToken,
						"x-cache-id": "V0dfR0VUVEVY",
						"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
					}
				});
				if (findRes.ok) {
					const findData = await findRes.json();
					stocks = findData.data.map((item) => {
						const lastStr = item["q._TRDPRC_1"] || "";
						const pctStr = item["q._PCTCHNG"] || "0";
						const pctVal = parseFloat(pctStr.replace(/[+%]/g, "").trim()) || 0;

						return {
							ric: item["q.RIC"] || "",
							name: item["x._DSPLY_NAME"] || "",
							changePercentVal: pctVal,
							changePercent: formatChangePercent(pctVal),
							price: lastStr
						};
					});
					// Sort descending by percentage change value
					stocks.sort((a, b) => b.changePercentVal - a.changePercentVal);

					// De-duplicate: keep only first occurrence of unique RIC and unique normalized name
					const seenRics = new Set();
					const seenNames = new Set();
					const uniqueStocks = [];
					for (const stock of stocks) {
						const normalizedName = stock.name.trim().toLowerCase();
						if (!stock.ric || !stock.name) continue;
						if (seenRics.has(stock.ric) || seenNames.has(normalizedName)) {
							continue;
						}
						seenRics.add(stock.ric);
						seenNames.add(normalizedName);
						uniqueStocks.push(stock);
					}
					stocks = uniqueStocks;
				}
			}

			// 5. Fetch ETFs if enabled
			let etfs = [];
			if (config.showEtfs !== false) {
				// Get top 100 ETFs by percent change
				const findUrl = "https://lseg-widgets.financial.com/rest/api/find/securities?fids=x.RIC&exchanges=GTX&secTypes=FU1&sortFids=_PCTCHNG&sortTypes=N&sortDirs=D&pageSize=100";
				const findRes = await fetch(findUrl, {
					headers: {
						jwt: jwtToken,
						"x-cache-id": "V0dfR0VUVEVY",
						"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
					}
				});
				if (findRes.ok) {
					const findData = await findRes.json();
					const rics = findData.data.map((item) => item["x.RIC"]).filter(Boolean);
					if (rics.length > 0) {
						const quoteUrl = `https://lseg-widgets.financial.com/rest/api/quote/info?rics=${rics.join(",")}&fids=x._DSPLY_NAME,q._PCTCHNG,q._TRDPRC_1,q.RIC,q.ASK,q.HST_CLOSE`;
						const quoteRes = await fetch(quoteUrl, {
							headers: {
								jwt: jwtToken,
								"x-cache-id": "V0dfR0VUVEVY",
								"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
							}
						});
						if (quoteRes.ok) {
							const quoteData = await quoteRes.json();
							etfs = quoteData.data.map((item) => {
								const lastStr = item["q._TRDPRC_1"] || "";
								const pctStr = item["q._PCTCHNG"] || "0";
								const pctVal = parseFloat(pctStr.replace(/[+%]/g, "").trim()) || 0;

								return {
									ric: item["q.RIC"] || "",
									name: item["x._DSPLY_NAME"] || "",
									changePercentVal: pctVal,
									changePercent: formatChangePercent(pctVal),
									price: lastStr
								};
							});
							// Sort descending by percentage change value
							etfs.sort((a, b) => b.changePercentVal - a.changePercentVal);

							// De-duplicate: keep only first occurrence of unique RIC and unique normalized name
							const seenRics = new Set();
							const seenNames = new Set();
							const uniqueEtfs = [];
							for (const etf of etfs) {
								const normalizedName = etf.name.trim().toLowerCase();
								if (!etf.ric || !etf.name) continue;
								if (seenRics.has(etf.ric) || seenNames.has(normalizedName)) {
									continue;
								}
								seenRics.add(etf.ric);
								seenNames.add(normalizedName);
								uniqueEtfs.push(etf);
							}
							etfs = uniqueEtfs;
						}
					}
				}
			}

			const result = {
				stocks: stocks.slice(0, config.maxEntries || 10),
				etfs: etfs.slice(0, config.maxEntries || 10),
				timestamp: new Date().toISOString(),
				success: true
			};

			console.log(`[MMM-GettexTops] Data fetched successfully. Stocks: ${result.stocks.length}, ETFs: ${result.etfs.length}`);
			self.cache = result;
			self.sendSocketNotification("GETTEX_DATA_UPDATED", result);

		} catch (error) {
			console.error("[MMM-GettexTops] Failed to fetch gettex.de data:", error);
			if (self.cache) {
				console.log("[MMM-GettexTops] Serving cached data due to error.");
				self.sendSocketNotification("GETTEX_DATA_UPDATED", self.cache);
			} else {
				self.sendSocketNotification("GETTEX_DATA_UPDATED", {
					stocks: [],
					etfs: [],
					timestamp: new Date().toISOString(),
					success: false,
					error: error.message
				});
			}
		} finally {
			self.isFetching = false;
		}
	}
});
