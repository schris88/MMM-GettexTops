/* Magic Mirror
 * Node Helper: MMM-GettexTops
 *
 * By Christian Stengel
 * MIT Licensed.
 *
 * Scrapes gettex.de for Top Stocks & ETFs using Playwright Chromium.
 */

const NodeHelper = require("node_helper");
const { chromium } = require("playwright");

module.exports = NodeHelper.create({
    start: function () {
        console.log("Starting node helper for: " + this.name);
        this.cache = null;
        this.isFetching = false;
    },

    socketNotificationReceived: function (notification, payload) {
        if (notification === "GET_GETTEX_DATA") {
            this.handleDataRequest(payload);
        }
    },

    handleDataRequest: async function (config) {
        const self = this;
        
        // If we have cached data, return it immediately to keep the UI responsive
        if (this.cache) {
            this.sendSocketNotification("GETTEX_DATA_UPDATED", this.cache);
        }

        // If currently fetching, do not trigger parallel scraper runs to save CPU
        if (this.isFetching) {
            return;
        }

        this.isFetching = true;
        console.log(`[MMM-GettexTops] Starting gettex.de scraping run...`);
        
        let browser = null;
        try {
            browser = await chromium.launch({ headless: true });
            const page = await browser.newPage();
            
            // Navigate to gettex.de homepage
            await page.goto("https://www.gettex.de/", { waitUntil: "domcontentloaded", timeout: 45000 });
            
            // 1. Accept Cookie Consent if visible
            const cookieButton = page.locator('button:has-text("Akzeptieren"), button:has-text("Einverstanden"), button:has-text("Zustimmen"), [id*="cookie"] button').first();
            if (await cookieButton.isVisible()) {
                console.log("[MMM-GettexTops] Clicking cookie consent...");
                await cookieButton.click();
                await page.waitForTimeout(1500);
            }

            // Wait for grid widgets to load initially
            await page.waitForTimeout(4000);

            // Scraper function evaluated inside browser context
            const scrapeActiveTab = async (tabName) => {
                return await page.evaluate((name) => {
                    const activePane = document.querySelector('.tab-pane.active');
                    if (!activePane) return null;

                    // Locate the TOPS column (usually col-lg-4) containing <h4>TOPS</h4>
                    const cols = Array.from(activePane.querySelectorAll('.col-sm-12, .col-md-6, .col-lg-4'));
                    let topsCol = null;
                    for (const col of cols) {
                        const h4 = col.querySelector('h4');
                        if (h4 && h4.textContent.trim().toUpperCase() === 'TOPS') {
                            topsCol = col;
                            break;
                        }
                    }

                    if (!topsCol) return null;

                    // Extract all ag-grid rows
                    const rows = Array.from(topsCol.querySelectorAll('.ag-row'));
                    return rows.map(row => {
                        const cells = Array.from(row.querySelectorAll('.ag-cell'));
                        // Format: [Name, Diff %, Price]
                        return {
                            name: cells[0] ? cells[0].textContent.trim() : "",
                            changePercent: cells[1] ? cells[1].textContent.trim() : "",
                            price: cells[2] ? cells[2].textContent.trim() : ""
                        };
                    }).filter(item => item.name);
                }, tabName);
            };

            // 2. Scrape Aktien (selected by default on page load)
            console.log("[MMM-GettexTops] Scraping AKTIEN TOPS...");
            const stocks = await scrapeActiveTab("AKTIEN") || [];

            // 3. Click ETFS/FONDS tab and scrape ETFs
            let etfs = [];
            const etfTab = page.locator('a:has-text("ETFS/FONDS")').first();
            if (await etfTab.isVisible()) {
                console.log("[MMM-GettexTops] Clicking ETFS/FONDS tab...");
                await etfTab.click();
                await page.waitForTimeout(3000);
                etfs = await scrapeActiveTab("ETFS/FONDS") || [];
            } else {
                console.warn("[MMM-GettexTops] ETFS/FONDS tab not found/visible.");
            }

            // Compile results
            const result = {
                stocks: stocks.slice(0, config.maxEntries || 10),
                etfs: etfs.slice(0, config.maxEntries || 10),
                timestamp: new Date().toISOString(),
                success: true
            };

            console.log(`[MMM-GettexTops] Scrape completed. Found ${result.stocks.length} Stocks and ${result.etfs.length} ETFs.`);
            
            // Cache results
            self.cache = result;
            self.sendSocketNotification("GETTEX_DATA_UPDATED", result);

        } catch (error) {
            console.error("[MMM-GettexTops] Scraping failed:", error);
            
            // Fallback: Notify frontend of error (optional use of cached data)
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
            if (browser) {
                await browser.close();
            }
            this.isFetching = false;
        }
    }
});
