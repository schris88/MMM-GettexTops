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
        maxEntriesEtf: null,
        showAktien: true,
        showEtfs: true,
        showFgi: true,
        showVix: true,
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
        tis.sendSocketNotification("GET_GETTEX_DATA", {
            maxEntries: this.config.maxEntries,
            maxEntriesEtf: this.config.maxEntriesEtf || this.config.maxEntries
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

    translateRating: function (rating) {
        if (!rating) return "";
        const lower = rating.toLowerCase();
        const isGerman = (this.config.language || config.language) === "de";

        if (isGerman) {
            if (lower.includes("extreme fear")) return "Extreme Angst";
            if (lower.includes("fear")) return "Angst";
            if (lower.includes("neutral")) return "Neutral";
            if (lower.includes("extreme greed")) return "Extreme Gier";
            if (lower.includes("greed")) return "Gier";
        } else {
            if (lower.includes("extreme fear")) return "Extreme Fear";
            if (lower.includes("fear")) return "Fear";
            if (lower.includes("neutral")) return "Neutral";
            if (lower.includes("extreme greed")) return "Extreme Greed";
            if (lower.includes("greed")) return "Greed";
        }
        return rating;
    },

    createSentimentElement: function (fgiData, vixData) {
        const sentimentContainer = document.createElement("div");
        sentimentContainer.className = "gettex-sentiment-container";

        const header = document.createElement("div");
        header.className = "gettex-table-header";
        header.innerText = "MARKTSENTIMENT";
        sentimentContainer.appendChild(header);

        const table = document.createElement("table");
        table.className = "gettex-table";

        // 1. Render FGI Row if enabled
        if (this.config.showFgi && fgiData) {
            const tr = document.createElement("tr");

            const tdLabel = document.createElement("td");
            tdLabel.className = "gettex-name";
            tdLabel.innerText = "Fear & Greed Index";
            tr.appendChild(tdLabel);

            const tdValue = document.createElement("td");
            tdValue.className = "gettex-change align-right";

            const score = Math.round(fgiData.score);
            const rating = this.translateRating(fgiData.rating);
            tdValue.innerText = `${score} (${rating})`;

            // Color-code based on score / rating
            const lowerRating = fgiData.rating.toLowerCase();
            if (lowerRating.includes("greed")) {
                tdValue.className += " pos"; // Greed = green
            } else if (lowerRating.includes("fear")) {
                tdValue.className += " neg"; // Fear = red
            }
            tr.appendChild(tdValue);
            table.appendChild(tr);
        }

        // 2. Render VIX Row if enabled
        if (this.config.showVix && vixData) {
            const tr = document.createElement("tr");

            const tdLabel = document.createElement("td");
            tdLabel.className = "gettex-name";
            tdLabel.innerText = "VIX Index (^VIX)";
            tr.appendChild(tdLabel);

            const tdValue = document.createElement("td");
            tdValue.className = "gettex-change align-right";

            const formattedPrice = vixData.price.toFixed(2).replace(".", ",");
            tdValue.innerText = `${formattedPrice}  ${vixData.changePercent}`;

            // Falling VIX (negative change) = Calm market (Green)
            // Rising VIX (positive change) = High fear (Red)
            if (vixData.changePercentVal > 0) {
                tdValue.className += " neg";
            } else if (vixData.changePercentVal < 0) {
                tdValue.className += " pos";
            }
            tr.appendChild(tdValue);
            table.appendChild(tr);
        }

        sentimentContainer.appendChild(table);
        return sentimentContainer;
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

        // Render Sentiment Section
        if ((this.config.showFgi && this.topsData && this.topsData.fgi) || (this.config.showVix && this.topsData && this.topsData.vix)) {
            const sentimentElement = this.createSentimentElement(this.topsData.fgi, this.topsData.vix);
            tablesWrapper.appendChild(sentimentElement);
        }

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
