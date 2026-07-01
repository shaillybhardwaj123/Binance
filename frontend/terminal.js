// --- Futures Trading Terminal Logic Wrapper ---

let activeSymbol = "BTCUSDT";
let activeInterval = "1m";
let activeSide = "BUY"; // BUY or SELL
let chartObj = null;
let candleSeries = null;
let volumeSeries = null;
let currentKlines = [];

// Order book & recent trades states
let orderBookAsks = [];
let orderBookBids = [];
let recentTrades = [];

// Initialize Terminal View
async function openTerminal() {
    const overlay = document.getElementById("terminal-overlay");
    overlay.innerHTML = ""; // Clear
    
    // Inject terminal stylesheet dynamically
    if (!document.getElementById("terminal-css-link")) {
        const link = document.createElement("link");
        link.id = "terminal-css-link";
        link.rel = "stylesheet";
        link.href = "terminal.css";
        document.head.appendChild(link);
    }
    
    try {
        const res = await fetch("terminal.html");
        const html = await res.ok ? await res.text() : "";
        if (!html) throw new Error("Could not load terminal layout");
        
        overlay.innerHTML = html;
        overlay.classList.add("active");
        
        // Bind UI actions
        setupTerminalUI();
        
        // Initialize TradingView Chart
        initLightweightChart();
        
        // Load initial klines history
        await loadKlineHistory();
        
        // Load asset balances and local database journal logs
        updateTerminalBalances();
        loadTerminalJournal();
        
        // Subscribe to real-time feeds on active WebSocket
        subscribeTerminalWS();
        
    } catch (e) {
        console.error("Error opening terminal overlay:", e);
        alert("Failed to launch terminal overlay viewport");
    }
}

function closeTerminal() {
    const overlay = document.getElementById("terminal-overlay");
    overlay.classList.remove("active");
    
    // Unsubscribe from WebSocket streams
    unsubscribeTerminalWS();
    
    // Clear elements
    overlay.innerHTML = "";
    
    // Destroy chart instances to free memory
    if (chartObj) {
        try { chartObj.remove(); } catch(e) {}
        chartObj = null;
    }
}

// Bind UI actions and forms
function setupTerminalUI() {
    // Return button
    document.getElementById("term-close-btn").addEventListener("click", closeTerminal);
    
    // Timeframe tabs
    const tfBtns = document.querySelectorAll(".t-tf-btn");
    tfBtns.forEach(btn => {
        btn.addEventListener("click", async (e) => {
            tfBtns.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            activeInterval = e.target.getAttribute("data-interval");
            
            // Reload historical candles with new interval
            document.querySelector(".hud-interval").textContent = activeInterval;
            await loadKlineHistory();
        });
    });
    
    // Side tabs (Buy vs Sell)
    const sideBuy = document.getElementById("t-side-buy");
    const sideSell = document.getElementById("t-side-sell");
    const submitBtn = document.getElementById("term-btn-execute");
    
    sideBuy.addEventListener("click", () => {
        sideBuy.classList.add("active");
        sideSell.classList.remove("active");
        activeSide = "BUY";
        submitBtn.className = "term-btn-execute buy";
        submitBtn.textContent = "Buy/Long";
    });
    
    sideSell.addEventListener("click", () => {
        sideSell.classList.add("active");
        sideBuy.classList.remove("active");
        activeSide = "SELL";
        submitBtn.className = "term-btn-execute sell";
        submitBtn.textContent = "Sell/Short";
    });
    
    // Order Type dropdown toggles price fields
    const orderTypeSelect = document.getElementById("term-order-type");
    const priceRow = document.getElementById("t-price-row");
    const stopPriceRow = document.getElementById("t-stop-price-row");
    
    orderTypeSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val === "LIMIT") {
            priceRow.style.display = "flex";
            stopPriceRow.style.display = "none";
        } else if (val === "STOP_LIMIT") {
            priceRow.style.display = "flex";
            stopPriceRow.style.display = "flex";
        } else { // MARKET
            priceRow.style.display = "none";
            stopPriceRow.style.display = "none";
        }
    });
    
    // Quantity slider percentage binding
    const qtySlider = document.getElementById("t-qty-slider");
    const qtyInput = document.getElementById("t-qty-input");
    
    qtySlider.addEventListener("input", (e) => {
        const pct = parseInt(e.target.value);
        calculateSliderQuantity(pct);
    });
    
    // Slider labels click shortcut
    const sliderMarks = document.querySelectorAll(".term-slider-marks span");
    sliderMarks.forEach(span => {
        span.addEventListener("click", () => {
            const val = parseInt(span.getAttribute("data-val"));
            qtySlider.value = val;
            calculateSliderQuantity(val);
        });
    });
    
    // TP/SL toggling checkbox
    const tpslCheck = document.getElementById("t-tpsl-checkbox");
    const tpslFields = document.getElementById("term-tpsl-fields");
    tpslCheck.addEventListener("change", (e) => {
        tpslFields.style.display = e.target.checked ? "flex" : "none";
    });
    
    // Bottom Tab buttons switching
    const tabBtns = document.querySelectorAll(".t-tab-btn");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            tabBtns.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            
            const targetPaneId = e.target.getAttribute("data-tab");
            const panes = document.querySelectorAll(".term-tab-pane");
            panes.forEach(pane => pane.classList.remove("active"));
            document.getElementById(targetPaneId).classList.add("active");
        });
    });
    
    // Order submission binding
    submitBtn.addEventListener("click", executeTerminalOrder);
    
    // Synchronize symbol based on landing page input default
    const symbolField = document.getElementById("symbol-input");
    if (symbolField && symbolField.value.trim()) {
        activeSymbol = symbolField.value.trim().toUpperCase();
    }
    document.getElementById("term-active-symbol").textContent = activeSymbol;
    document.querySelector(".hud-pair").textContent = activeSymbol;
    document.getElementById("t-qty-unit").textContent = activeSymbol.split("USDT")[0];
}

// Calculate Slider Quantity based on USDT asset balance, leverage, and active price
function calculateSliderQuantity(percent) {
    const leverage = parseInt(document.getElementById("term-leverage").value) || 20;
    const balance = parseFloat(document.getElementById("term-asset-avail-bal").textContent) || 0.0;
    const qtyInput = document.getElementById("t-qty-input");
    
    // Resolve current active price fallback
    let price = currentPrice;
    if (!price && currentKlines.length > 0) {
        price = currentKlines[currentKlines.length - 1].close;
    }
    if (!price) price = 67000.0; // Fail-safe fallback
    
    if (percent === 0 || balance <= 0) {
        qtyInput.value = "";
        return;
    }
    
    const usdtAllocation = balance * (percent / 100);
    const leveragedBuyingPower = usdtAllocation * leverage;
    const computedQty = leveragedBuyingPower / price;
    
    // Format quantity cleanly
    qtyInput.value = computedQty.toFixed(activeSymbol === "BTCUSDT" ? 3 : (activeSymbol === "ETHUSDT" ? 2 : 1));
}

// Load balance metrics from global dashboard balances
function updateTerminalBalances() {
    const balanceVal = parseFloat(document.getElementById("wallet-balance")?.textContent.replace(/[$,]/g, "")) || 10000.00;
    
    // Inject across inputs
    document.getElementById("term-asset-wallet-bal").textContent = balanceVal.toFixed(2);
    document.getElementById("term-asset-margin-bal").textContent = balanceVal.toFixed(2);
    document.getElementById("term-asset-avail-bal").textContent = balanceVal.toFixed(2);
    document.getElementById("term-margin-bal-val").textContent = `${balanceVal.toFixed(2)} USDT`;
    
    // Calculate Buying Power
    const leverage = parseInt(document.getElementById("term-leverage").value) || 20;
    let price = currentPrice || 67000.0;
    const maxQty = (balanceVal * leverage) / price;
    
    document.getElementById("term-max-buy-val").textContent = `${maxQty.toFixed(3)} ${activeSymbol.split("USDT")[0]}`;
    document.getElementById("term-max-sell-val").textContent = `${maxQty.toFixed(3)} ${activeSymbol.split("USDT")[0]}`;
}

// Lightweight Candle Chart Setup
function initLightweightChart() {
    const container = document.getElementById("term-chart-container");
    const width = container.clientWidth;
    const height = container.clientHeight || 350;
    
    chartObj = LightweightCharts.createChart(container, {
        width: width,
        height: height,
        layout: {
            backgroundColor: '#0b0e11',
            textColor: '#848e9c',
            fontSize: 11,
            fontFamily: 'Roboto, Inter, sans-serif'
        },
        grid: {
            vertLines: { color: '#1a1f26' },
            horzLines: { color: '#1a1f26' }
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
            borderColor: '#24292e',
        },
        timeScale: {
            borderColor: '#24292e',
            timeVisible: true,
            secondsVisible: false,
        }
    });
    
    candleSeries = chartObj.addCandlestickSeries({
        upColor: '#0ecb81',
        downColor: '#f6465d',
        borderUpColor: '#0ecb81',
        borderDownColor: '#f6465d',
        wickUpColor: '#0ecb81',
        wickDownColor: '#f6465d',
    });
    
    volumeSeries = chartObj.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
            type: 'volume',
        },
        priceScaleId: '', // Same pane overlay
        scaleMargins: {
            top: 0.82,
            bottom: 0,
        },
    });
    
    // Bind crosshair HUD callbacks
    chartObj.subscribeCrosshairMove((param) => {
        if (!param || !param.time || param.point === undefined || !param.seriesPrices.size) {
            // Update to latest candle detail
            if (currentKlines.length > 0) {
                const latest = currentKlines[currentKlines.length - 1];
                updateChartHUD(latest);
            }
            return;
        }
        
        const price = param.seriesPrices.get(candleSeries);
        const volume = param.seriesPrices.get(volumeSeries);
        
        if (price) {
            updateChartHUD({
                open: price.open,
                high: price.high,
                low: price.low,
                close: price.close,
                volume: volume || 0.0
            });
        }
    });

    // Resize Handler
    window.addEventListener("resize", () => {
        if (chartObj && container) {
            chartObj.resize(container.clientWidth, container.clientHeight);
        }
    });
}

function updateChartHUD(candle) {
    document.getElementById("hud-o").textContent = candle.open.toFixed(2);
    document.getElementById("hud-h").textContent = candle.high.toFixed(2);
    document.getElementById("hud-l").textContent = candle.low.toFixed(2);
    document.getElementById("hud-c").textContent = candle.close.toFixed(2);
    
    // Color change
    const isUp = candle.close >= candle.open;
    const hudOhlc = document.querySelector(".hud-ohlc");
    hudOhlc.className = isUp ? "hud-ohlc text-green" : "hud-ohlc text-red";
}

// Fetch historical klines from Binance API directly (CORS is supported)
async function loadKlineHistory() {
    try {
        const symbol = activeSymbol;
        const interval = activeInterval;
        
        const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=200`);
        if (!res.ok) throw new Error("Binance API historical fetch rejected");
        const data = await res.json();
        
        const candleData = [];
        const volumeData = [];
        currentKlines = [];
        
        data.forEach(item => {
            const time = item[0] / 1000;
            const o = parseFloat(item[1]);
            const h = parseFloat(item[2]);
            const l = parseFloat(item[3]);
            const c = parseFloat(item[4]);
            const v = parseFloat(item[5]);
            
            const candle = { time, open: o, high: h, low: l, close: c, volume: v };
            candleData.push(candle);
            currentKlines.push(candle);
            
            volumeData.push({
                time,
                value: v,
                color: c >= o ? 'rgba(14, 203, 129, 0.4)' : 'rgba(246, 70, 93, 0.4)'
            });
        });
        
        candleSeries.setData(candleData);
        volumeSeries.setData(volumeData);
        
        // Calculate Moving Averages and update HUD labels
        calculateMovingAverages(candleData);
        
        if (currentKlines.length > 0) {
            updateChartHUD(currentKlines[currentKlines.length - 1]);
        }
        
    } catch(e) {
        console.error("Error fetching kline history:", e);
    }
}

// Calculate indicators and print to overlay HUD
function calculateMovingAverages(candles) {
    const ma = (period) => {
        if (candles.length < period) return null;
        const vals = [];
        for (let i = 0; i < candles.length; i++) {
            if (i < period - 1) {
                vals.push(null);
                continue;
            }
            let sum = 0.0;
            for (let j = 0; j < period; j++) {
                sum += candles[i - j].close;
            }
            vals.push(sum / period);
        }
        return vals;
    };
    
    const ma7 = ma(7);
    const ma25 = ma(25);
    const ma99 = ma(99);
    
    const getVal = (arr) => arr && arr[arr.length - 1] ? arr[arr.length - 1].toFixed(2) : "---";
    
    document.getElementById("hud-ma7").textContent = getVal(ma7);
    document.getElementById("hud-ma25").textContent = getVal(ma25);
    document.getElementById("hud-ma99").textContent = getVal(ma99);
}

// Send dynamic SUBSCRIBE events to active WebSocket
function subscribeTerminalWS() {
    if (!tickerWs || tickerWs.readyState !== WebSocket.OPEN) return;
    
    // Subscribe to Kline, Depth20 (depth) and Aggregate Trades streams
    const streams = [
        `${activeSymbol.toLowerCase()}@kline_${activeInterval}`,
        `${activeSymbol.toLowerCase()}@depth20@100ms`,
        `${activeSymbol.toLowerCase()}@aggTrade`
    ];
    
    tickerWs.send(JSON.stringify({
        method: "SUBSCRIBE",
        params: streams,
        id: 99
    }));
}

// Clean up dynamic SUBSCRIBE events
function unsubscribeTerminalWS() {
    if (!tickerWs || tickerWs.readyState !== WebSocket.OPEN) return;
    
    const streams = [
        `${activeSymbol.toLowerCase()}@kline_${activeInterval}`,
        `${activeSymbol.toLowerCase()}@depth20@100ms`,
        `${activeSymbol.toLowerCase()}@aggTrade`
    ];
    
    tickerWs.send(JSON.stringify({
        method: "UNSUBSCRIBE",
        params: streams,
        id: 100
    }));
}

// Intercept WS events routed from app.js main thread
function handleTerminalWsMessage(payload) {
    if (!payload || !payload.data) return;
    
    const stream = payload.stream;
    const data = payload.data;
    
    // 1. Process Live Candlestick Ticks
    if (stream.includes("@kline_")) {
        const k = data.k;
        const time = k.t / 1000;
        const o = parseFloat(k.o);
        const h = parseFloat(k.h);
        const l = parseFloat(k.l);
        const c = parseFloat(k.c);
        const v = parseFloat(k.v);
        
        const tick = { time, open: o, high: h, low: l, close: c, volume: v };
        candleSeries.update(tick);
        volumeSeries.update({
            time,
            value: v,
            color: c >= o ? 'rgba(14, 203, 129, 0.4)' : 'rgba(246, 70, 93, 0.4)'
        });
        
        // Update local memory and HUD stats
        if (currentKlines.length > 0) {
            const last = currentKlines[currentKlines.length - 1];
            if (last.time === time) {
                currentKlines[currentKlines.length - 1] = tick;
            } else {
                currentKlines.push(tick);
                if (currentKlines.length > 300) currentKlines.shift();
            }
        }
        
        updateChartHUD(tick);
        
        // Update Stats Ribbon details
        document.getElementById("term-hdr-price").textContent = `$${c.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        document.getElementById("ob-spread-price").textContent = `$${c.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    }
    
    // 2. Process Order Book Depth Listings
    else if (stream.includes("@depth20")) {
        orderBookAsks = data.b; // Asks (bids list on depth JSON is actually returned in raw formats)
        // Wait, standard structure: "a" = asks, "b" = bids
        const asks = data.a.slice(0, 8); // 8 rows ask
        const bids = data.b.slice(0, 8); // 8 rows bid
        
        renderOrderBookLadders(asks, bids);
    }
    
    // 3. Process Live Recent Trades
    else if (stream.includes("@aggTrade")) {
        const trade = {
            price: parseFloat(data.p),
            qty: parseFloat(data.q),
            time: data.T,
            isBuyerMaker: data.m // True means maker is buyer (SELL side execution)
        };
        
        recentTrades.unshift(trade);
        if (recentTrades.length > 25) recentTrades.pop();
        
        renderRecentTrades();
    }
}

// Render Depth book ladders with bar depth graphics
function renderOrderBookLadders(asks, bids) {
    const asksList = document.getElementById("ob-asks-list");
    const bidsList = document.getElementById("ob-bids-list");
    
    if (!asksList || !bidsList) return;
    
    asksList.innerHTML = "";
    bidsList.innerHTML = "";
    
    // Render Asks (descending so high prices are at top)
    let askTotal = 0.0;
    const asksRows = asks.map(item => {
        const price = parseFloat(item[0]);
        const qty = parseFloat(item[1]);
        askTotal += qty;
        return { price, qty, total: askTotal };
    });
    
    // Reversed layout so asks index down to spread
    asksRows.reverse().forEach(row => {
        const pct = Math.min((row.total / askTotal) * 100, 100);
        const div = document.createElement("div");
        div.className = "ob-row";
        div.addEventListener("click", () => populateFormPrice(row.price));
        div.innerHTML = `
            <div class="ob-row-bg" style="width: ${pct}%;"></div>
            <span>${row.price.toFixed(2)}</span>
            <span>${row.qty.toFixed(4)}</span>
            <span>${row.total.toFixed(4)}</span>
        `;
        asksList.appendChild(div);
    });
    
    // Render Bids (descending from spread)
    let bidTotal = 0.0;
    bids.forEach(item => {
        const price = parseFloat(item[0]);
        const qty = parseFloat(item[1]);
        bidTotal += qty;
        
        const pct = Math.min((qty / bidTotal) * 100, 100);
        const div = document.createElement("div");
        div.className = "ob-row";
        div.addEventListener("click", () => populateFormPrice(price));
        div.innerHTML = `
            <div class="ob-row-bg" style="width: ${pct}%;"></div>
            <span>${price.toFixed(2)}</span>
            <span>${qty.toFixed(4)}</span>
            <span>${bidTotal.toFixed(4)}</span>
        `;
        bidsList.appendChild(div);
    });
}

function populateFormPrice(price) {
    const priceInput = document.getElementById("t-price-input");
    if (priceInput) {
        priceInput.value = price;
    }
}

// Render Recent Trades lists
function renderRecentTrades() {
    const list = document.getElementById("rt-trades-list");
    if (!list) return;
    
    list.innerHTML = "";
    recentTrades.forEach(t => {
        const timeStr = new Date(t.time).toLocaleTimeString();
        const sideClass = t.isBuyerMaker ? "sell" : "buy";
        
        const div = document.createElement("div");
        div.className = `rt-row ${sideClass}`;
        div.innerHTML = `
            <span>${t.price.toFixed(2)}</span>
            <span>${t.qty.toFixed(5)}</span>
            <span>${timeStr}</span>
        `;
        list.appendChild(div);
    });
}

// Fetch historical database logs and render bottom tables
async function loadTerminalJournal() {
    try {
        const res = await fetch(`${API_BASE}/api/journal`);
        if (!res.ok) return;
        const journal = await res.json();
        
        // 1. Render Trade History
        const journalList = document.getElementById("term-journal-list");
        journalList.innerHTML = "";
        
        if (journal.length === 0) {
            journalList.innerHTML = `<tr><td colspan="7" class="empty-row">No trade history stored</td></tr>`;
        } else {
            journal.forEach(item => {
                const tr = document.createElement("tr");
                const time = item.timestamp ? new Date(item.timestamp).toLocaleString() : "---";
                const sideClass = item.side === "BUY" ? "text-green" : "text-red";
                
                tr.innerHTML = `
                    <td class="font-mono-col">${time}</td>
                    <td class="font-mono-col">${item.symbol}</td>
                    <td class="${sideClass}">${item.side}</td>
                    <td class="font-mono-col">$${parseFloat(item.avgPrice || item.price).toFixed(2)}</td>
                    <td class="font-mono-col">${item.origQty}</td>
                    <td><span class="badge ${item.status === 'FILLED' ? 'text-green' : 'text-red'}">${item.status}</span></td>
                    <td class="font-mono-col">${item.orderId || '---'}</td>
                `;
                journalList.appendChild(tr);
            });
        }
        
        // 2. Render Order History
        const historyList = document.getElementById("term-history-list");
        historyList.innerHTML = "";
        if (journal.length === 0) {
            historyList.innerHTML = `<tr><td colspan="8" class="empty-row">No orders found</td></tr>`;
        } else {
            journal.forEach(item => {
                const tr = document.createElement("tr");
                const time = item.timestamp ? new Date(item.timestamp).toLocaleString() : "---";
                const sideClass = item.side === "BUY" ? "text-green" : "text-red";
                
                tr.innerHTML = `
                    <td class="font-mono-col">${time}</td>
                    <td class="font-mono-col">${item.symbol}</td>
                    <td class="font-mono-col">${item.type}</td>
                    <td class="${sideClass}">${item.side}</td>
                    <td class="font-mono-col">$${parseFloat(item.price || item.avgPrice || 0).toFixed(2)}</td>
                    <td class="font-mono-col">${item.executedQty || item.origQty}</td>
                    <td class="font-mono-col">${item.origQty}</td>
                    <td><span class="badge ${item.status === 'FILLED' ? 'text-green' : 'text-red'}">${item.status}</span></td>
                `;
                historyList.appendChild(tr);
            });
        }
        
        // 3. Render Positions (Mock current holdings from executions)
        calculateMockPositions(journal);
        
    } catch(e) {
        console.error("Error loading terminal history logs:", e);
    }
}

// Aggregate trade executions to display current mock position holding
function calculateMockPositions(journal) {
    const list = document.getElementById("term-positions-list");
    const countBtn = document.querySelector('[data-tab="tab-positions"]');
    
    if (!list) return;
    list.innerHTML = "";
    
    let netQty = 0.0;
    let totalCost = 0.0;
    
    // Sort oldest first to calculate averages
    const sorted = [...journal].reverse();
    sorted.forEach(order => {
        if (order.status !== "FILLED") return;
        
        const qty = parseFloat(order.origQty);
        const price = parseFloat(order.avgPrice || order.price);
        
        if (order.side === "BUY") {
            netQty += qty;
            totalCost += (qty * price);
        } else {
            netQty -= qty;
            totalCost -= (qty * price);
        }
    });
    
    if (Math.abs(netQty) < 0.0001) {
        list.innerHTML = `<tr><td colspan="9" class="empty-row">No active positions open</td></tr>`;
        countBtn.textContent = "Positions (0)";
        return;
    }
    
    countBtn.textContent = "Positions (1)";
    const entryPrice = Math.abs(totalCost / netQty);
    const side = netQty > 0 ? "LONG" : "SHORT";
    const sideClass = netQty > 0 ? "text-green" : "text-red";
    const markPrice = currentPrice || entryPrice;
    
    const unrealizedPnl = netQty * (markPrice - entryPrice);
    const pnlClass = unrealizedPnl >= 0 ? "text-green" : "text-red";
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td class="font-mono-col"><strong>${activeSymbol}</strong> <span class="badge ${side === 'LONG' ? 'text-green' : 'text-red'}">${side}</span></td>
        <td class="font-mono-col">${Math.abs(netQty).toFixed(3)}</td>
        <td class="font-mono-col">$${entryPrice.toFixed(2)}</td>
        <td class="font-mono-col">$${markPrice.toFixed(2)}</td>
        <td class="font-mono-col">$${(entryPrice * 0.85).toFixed(2)}</td>
        <td class="font-mono-col">0.05%</td>
        <td class="font-mono-col">$${(Math.abs(totalCost) / 20).toFixed(2)}</td>
        <td class="${pnlClass}"><strong>$${unrealizedPnl.toFixed(2)}</strong></td>
        <td>
            <button class="t-date-btn" style="color:var(--term-red); border-color:var(--term-red);" onclick="marketCloseMockPosition(${Math.abs(netQty)})">Market Close</button>
        </td>
    `;
    list.appendChild(tr);
}

// Help market close position instantly
async function marketCloseMockPosition(qty) {
    const side = activeSide === "BUY" ? "SELL" : "BUY"; // Opposite
    try {
        const response = await fetch(`${API_BASE}/api/order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                symbol: activeSymbol,
                side: side,
                type: "MARKET",
                quantity: qty
            })
        });
        
        if (response.ok) {
            alert("Position successfully closed via Market Order!");
            loadTerminalJournal();
        } else {
            const data = await response.json();
            alert("Closure failed: " + (data.detail || "API rejected order."));
        }
    } catch(e) {
        console.error("Error closing position:", e);
    }
}

// Place Order POST request from Terminal
async function executeTerminalOrder() {
    const orderType = document.getElementById("term-order-type").value;
    const qty = parseFloat(document.getElementById("t-qty-input").value);
    const priceVal = parseFloat(document.getElementById("t-price-input").value);
    const stopVal = parseFloat(document.getElementById("t-stop-input").value);
    
    // Check validation client-side
    if (isNaN(qty) || qty <= 0) {
        alert("Please enter a valid order size quantity");
        return;
    }
    if ((orderType === "LIMIT" || orderType === "STOP_LIMIT") && (isNaN(priceVal) || priceVal <= 0)) {
        alert("Please enter a valid price for limit orders");
        return;
    }
    if (orderType === "STOP_LIMIT" && (isNaN(stopVal) || stopVal <= 0)) {
        alert("Please specify a stop activation price");
        return;
    }
    
    const body = {
        symbol: activeSymbol,
        side: activeSide,
        type: orderType,
        quantity: qty
    };
    
    if (orderType === "LIMIT" || orderType === "STOP_LIMIT") {
        body.price = priceVal;
    }
    if (orderType === "STOP_LIMIT") {
        body.stopPrice = stopVal;
    }
    
    // Submit order loading overlay
    const submitBtn = document.getElementById("term-btn-execute");
    const prevText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "SENDING...";
    
    try {
        const response = await fetch(`${API_BASE}/api/order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        
        const data = await response.json();
        
        // Restore button state
        submitBtn.disabled = false;
        submitBtn.textContent = prevText;
        
        if (response.ok) {
            // Trigger confirmation modal (Reuses main dashboard acknowledgement popup)
            displayTerminalResultModal(data, true);
            
            // Clear entry inputs
            document.getElementById("t-qty-input").value = "";
            document.getElementById("t-price-input").value = "";
            document.getElementById("t-stop-input").value = "";
            
            // Reload historical databases
            loadTerminalJournal();
        } else {
            displayTerminalResultModal(data, false);
        }
        
    } catch(e) {
        submitBtn.disabled = false;
        submitBtn.textContent = prevText;
        console.error("Terminal order failed:", e);
        alert("Failed to submit transaction: connection issue");
    }
}

// Display visual modals
function displayTerminalResultModal(order, isSuccess) {
    const modal = document.getElementById("result-modal");
    const title = document.getElementById("modal-title");
    const iconWrapper = document.getElementById("modal-status-icon");
    const status = document.getElementById("modal-status");
    const orderId = document.getElementById("modal-order-id");
    const symbol = document.getElementById("modal-symbol");
    const qty = document.getElementById("modal-qty");
    const price = document.getElementById("modal-price");
    
    if (!modal) return;
    
    if (isSuccess) {
        title.innerHTML = `<i class="fa-solid fa-square-check text-green"></i> Execution Success`;
        iconWrapper.innerHTML = `<i class="fa-solid fa-circle-check text-green" style="font-size: 48px;"></i>`;
        status.className = "detail-val badge text-green";
        status.textContent = order.status || "FILLED";
        orderId.textContent = order.orderId || "MOCK-1928421";
        symbol.textContent = order.symbol;
        qty.textContent = `${order.origQty} ${order.symbol.split("USDT")[0]}`;
        
        const fillPrice = order.avgPrice && parseFloat(order.avgPrice) > 0
            ? parseFloat(order.avgPrice)
            : (order.price ? parseFloat(order.price) : currentPrice || 0.0);
            
        price.textContent = `$${fillPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    } else {
        title.innerHTML = `<i class="fa-solid fa-circle-exclamation text-red"></i> Execution Rejected`;
        iconWrapper.innerHTML = `<i class="fa-solid fa-circle-xmark text-red" style="font-size: 48px;"></i>`;
        status.className = "detail-val badge text-red";
        status.textContent = "REJECTED";
        orderId.textContent = "---";
        symbol.textContent = activeSymbol;
        qty.textContent = "0.00";
        price.textContent = order.detail || "API signature mismatch";
    }
    
    modal.classList.add("active");
}
