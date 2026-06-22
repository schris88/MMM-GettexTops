/* Magic Mirror
 * Module: MMM-GettexTops
 *
 * By Christian Stengel
 * MIT Licensed.
 */

Module.register("MMM-GettexTops", {
    defaults: {
        updateInterval: 15 * 60 * 1000, // 15 minutes
        maxEntries: 5,
        showAktien: true,
        showEtfs: true,
        title: "Gettex Markt-Tops"
    },

    start: function () {
        Log.info("Starting module: " + this.name);
        this.topsData = null;
        this.loaded = false;
        this.error = null;

        // Request initial data
        this.getData();

        // Setup periodic updates
        const self = this;
        setInterval(function () {
            self.getData();
        }, this.config.updateInterval);
    },

    getData: function () {
        this.sendSocketNotification("GET_GETTEX_DATA", {
            maxEntries: this.config.maxEntries
        });
    },

    socketNotificationReceived: function (notification, payload) {
        if (notification === "GETTEX_DATA_UPDATED") {
            this.topsData = payload;
            this.loaded = true;
            if (payload.success === false) {
                this.error = payload.error || "Scraping failed";
            } else {
                this.error = null;
            }
            this.updateDom();
        }
    },

    getStyles: function () {
        return ["MMM-GettexTops.css"];
    },

    // Shortens and cleans stock/ETF names to fit beautifully on the mirror screen
    cleanName: function (name, isEtf) {
        if (!name) return "";
        let clean = name
            .replace(/UCITS ETF/gi, "ETF")
            .replace(/USD \(Dist\)/gi, "")
            .replace(/USD \(Acc\)/gi, "")
            .replace(/Daily Short/gi, "Short")
            .replace(/Daily Leveraged/gi, "Lev")
            .replace(/Active Shares/gi, "")
            .replace(/Classic Shares/gi, "")
            .replace(/General Artificial Intllgnc/gi, "Gen AI")
            .replace(/Global Technology Leaders/gi, "Global Tech")
            .replace(/Electrfctn Technlgs & Smt Gr/gi, "Smart Grid & Electr.");

        clean = clean.replace(/\s+/g, " ").trim();

        const limit = isEtf ? 50 : 25;
        if (clean.length > limit) {
            return clean.substring(0, limit - 2) + "...";
        }
        return clean;
    },

    createTableElement: function (title, dataList, isEtf) {
        const tableContainer = document.createElement("div");
        tableContainer.className = "gettex-table-container";

        const header = document.createElement("div");
        header.className = "gettex-table-header";
        header.innerText = title;
        tableContainer.appendChild(header);

        if (!dataList || dataList.length === 0) {
            const empty = document.createElement("div");
            empty.className = "gettex-empty";
            empty.innerText = "Keine Daten verfügbar";
            tableContainer.appendChild(empty);
            return tableContainer;
        }

        const table = document.createElement("table");
        table.className = "gettex-table";


        // Data Rows
        dataList.forEach(item => {
            const tr = document.createElement("tr");
            
            // Name cell
            const tdName = document.createElement("td");
            const nameWrapper = document.createElement("div");
            nameWrapper.className = "gettex-name";
            if (isEtf) {
                nameWrapper.className += " multiline";
            }
            nameWrapper.innerText = this.cleanName(item.name, isEtf);
            tdName.appendChild(nameWrapper);
            tr.appendChild(tdName);

            // Change cell
            const tdChange = document.createElement("td");
            tdChange.className = "gettex-change align-right pos";
            tdChange.innerText = item.changePercent;
            tr.appendChild(tdChange);

            table.appendChild(tr);
        });

        tableContainer.appendChild(table);
        return tableContainer;
    },

    getDom: function () {
        const wrapper = document.createElement("div");
        wrapper.className = "gettex-container";

        // Show loading state
        if (!this.loaded) {
            wrapper.innerHTML = "<div class='loading small dimmed'>Lade Gettex Tops...</div>";
            return wrapper;
        }

        // Show error state (if no cached data is available)
        if (this.error && (!this.topsData || !this.topsData.stocks.length)) {
            wrapper.innerHTML = `<div class='error small'>Fehler beim Laden der Gettex Daten: ${this.error}</div>`;
            return wrapper;
        }

        // Main Layout Container
        const tablesWrapper = document.createElement("div");
        tablesWrapper.className = "gettex-tables-wrapper";

        // Render Stocks Table
        if (this.config.showAktien) {
            const stocksTable = this.createTableElement("AKTIEN TOPS", this.topsData.stocks);
            tablesWrapper.appendChild(stocksTable);
        }

        // Render ETFs Table
        if (this.config.showEtfs) {
            const etfsTable = this.createTableElement("ETFS / FONDS TOPS", this.topsData.etfs, true);
            tablesWrapper.appendChild(etfsTable);
        }

        wrapper.appendChild(tablesWrapper);

        return wrapper;
    }
});
