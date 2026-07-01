// --- API Endpoints Configuration ---
const API_BASE = ""; // Relative path to current host

// --- DOM Element Selectors ---
const statusIndicator = document.getElementById("connection-status");
const balanceValue = document.getElementById("balance-value");
const balanceProgress = document.getElementById("balance-progress");
const symbolInput = document.getElementById("symbol");
const quantityInput = document.getElementById("quantity");
const qtySuffix = document.getElementById("qty-suffix");
const priceGroup = document.getElementById("price-group");
const priceInput = document.getElementById("price");
const stopPriceGroup = document.getElementById("stop-price-group");
const stopPriceInput = document.getElementById("stop-price");
const orderForm = document.getElementById("order-form");
const btnSubmitOrder = document.getElementById("btn-submit-order");
const activeSymbolText = document.getElementById("ticker-active-symbol");
const activePriceText = document.getElementById("ticker-active-price");
const activeChangeText = document.getElementById("ticker-active-change");
const logTerminal = document.getElementById("log-terminal");
const btnClearLogs = document.getElementById("btn-clear-logs");
const journalList = document.getElementById("journal-list");
const journalCount = document.getElementById("journal-count");

// Modal Elements
const resultModal = document.getElementById("result-modal");
const modalTitle = document.getElementById("modal-title");
const modalStatusIcon = document.getElementById("modal-status-icon");
const modalStatus = document.getElementById("modal-status");
const modalOrderId = document.getElementById("modal-order-id");
const modalSymbol = document.getElementById("modal-symbol");
const modalQty = document.getElementById("modal-qty");
const modalPrice = document.getElementById("modal-price");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalOkBtn = document.getElementById("modal-ok-btn");

// Ribbon Elements
const btcPrice = document.getElementById("ribbon-btc-price");
const btcChange = document.getElementById("ribbon-btc-change");
const ethPrice = document.getElementById("ribbon-eth-price");
const ethChange = document.getElementById("ribbon-eth-change");
const solPrice = document.getElementById("ribbon-sol-price");
const solChange = document.getElementById("ribbon-sol-change");

// --- Application State ---
let currentMode = "DEMO";
let lastPrices = { BTCUSDT: 0.0, ETHUSDT: 0.0, SOLUSDT: 0.0 };
let currentPrice = 0.0;
let lastLogTimestamp = "";
let tradeJournal = [];
let tickerWs = null;

// --- Three.js 3D Graphics Setup ---
let scene, camera, renderer;
let coin, gridHelper, ambientLight, pointLight, directionLight;
let shockwaves = [];
let particles = [];
const particleCount = 120;
let particleGeometry, particleMaterial, particlePoints;
let coinSpinSpeed = 0.01;
let mouseX = 0, mouseY = 0;
let targetRotationX = 0, targetRotationY = 0;

function init3D() {
    const container = document.getElementById("canvas-container");
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene & Camera Setup
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05060f, 0.08);

    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.set(0, 2.5, 6);
    camera.lookAt(0, 0, 0);

    // 2. Renderer Setup
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("canvas3d"), antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 3. Grid Helper (Glowing Neon Cyber Highway)
    gridHelper = new THREE.GridHelper(30, 30, 0x00ffd5, 0x1d143c);
    gridHelper.position.y = -1.2;
    scene.add(gridHelper);

    // 4. Custom 3D Metallic Coin (Binance/USD-M Token Representation)
    const coinGeometry = new THREE.CylinderGeometry(1.2, 1.2, 0.16, 40);
    // Gold/Cyan Metallic Material
    const coinMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ffd5,
        metalness: 0.9,
        roughness: 0.15,
        flatShading: false,
        bumpScale: 0.05
    });
    coin = new THREE.Mesh(coinGeometry, coinMaterial);
    coin.rotation.x = Math.PI / 6; // Angle tilt for better visual view
    coin.rotation.z = Math.PI / 12;
    scene.add(coin);

    // Inner detail ring for coin
    const ringGeo = new THREE.RingGeometry(0.8, 1.0, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const innerRing = new THREE.Mesh(ringGeo, ringMat);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.09;
    coin.add(innerRing);

    // 5. Light Sources
    ambientLight = new THREE.AmbientLight(0x0a103c, 1.5);
    scene.add(ambientLight);

    pointLight = new THREE.PointLight(0x00ffd5, 2, 15);
    pointLight.position.set(2, 3, 2);
    scene.add(pointLight);

    directionLight = new THREE.DirectionalLight(0xff007f, 1);
    directionLight.position.set(-3, 3, -1);
    scene.add(directionLight);

    // 6. Particle Engine (Floaters around the coin representing transaction flow)
    particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds = [];
    const particleColors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        // Distribute coordinates in a cylinder volume
        const angle = Math.random() * Math.PI * 2;
        const radius = 1.0 + Math.random() * 2.5;
        const x = Math.cos(angle) * radius;
        const y = -1.2 + Math.random() * 4.0;
        const z = Math.sin(angle) * radius;

        particlePositions[i * 3] = x;
        particlePositions[i * 3 + 1] = y;
        particlePositions[i * 3 + 2] = z;

        // Save vertical velocities and base speed
        particleSpeeds.push({
            y: 0.005 + Math.random() * 0.015,
            x: (Math.random() - 0.5) * 0.002,
            z: (Math.random() - 0.5) * 0.002,
            baseY: y
        });

        // Default Cyan colors
        particleColors[i * 3] = 0.0;
        particleColors[i * 3 + 1] = 0.8;
        particleColors[i * 3 + 2] = 1.0;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    // Particle texture using canvas circle
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 16;
    pCanvas.height = 16;
    const ctx = pCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);
    const pTexture = new THREE.CanvasTexture(pCanvas);

    particleMaterial = new THREE.PointsMaterial({
        size: 0.15,
        map: pTexture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        depthWrite: false
    });

    particlePoints = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particlePoints);

    // Save speeds array for reference in render loop
    particles = particleSpeeds;

    // 7. Input Interaction Listeners
    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        const normX = ((e.clientX - rect.left) / width) * 2 - 1;
        const normY = -((e.clientY - rect.top) / height) * 2 + 1;
        targetRotationY = normX * 0.4;
        targetRotationX = normY * 0.2;
    });

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    const container = document.getElementById("canvas-container");
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// Spawns a transaction blast animation (burst of color particles upward or downward)
function trigger3DTransactionBlast(side) {
    const isBuy = side === "BUY";
    const blastColor = isBuy ? new THREE.Color(0x00ff66) : new THREE.Color(0xff2d55);
    
    // 1. Acceleration of coin spin
    coinSpinSpeed = 0.25;
    
    // 2. Pulse lights
    pointLight.color = blastColor;
    pointLight.intensity = 5;

    // 3. Shockwave ring geometry
    const swGeo = new THREE.RingGeometry(0.1, 0.2, 32);
    const swMat = new THREE.MeshBasicMaterial({
        color: isBuy ? 0x00ff66 : 0xff2d55,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
    });
    const swMesh = new THREE.Mesh(swGeo, swMat);
    swMesh.rotation.x = Math.PI / 2;
    swMesh.position.y = 0.0;
    scene.add(swMesh);
    shockwaves.push({ mesh: swMesh, scale: 1.0, speed: 0.15, maxScale: 15 });

    // 4. Color the particles dynamically
    const colors = particleGeometry.attributes.color.array;
    const pos = particleGeometry.attributes.position.array;
    
    for (let i = 0; i < particleCount; i++) {
        // Reset positions to center
        pos[i * 3] = (Math.random() - 0.5) * 0.5;
        pos[i * 3 + 1] = 0.0;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 0.5;

        // Directional force
        particles[i].y = isBuy ? (0.05 + Math.random() * 0.1) : -(0.05 + Math.random() * 0.1);
        particles[i].x = (Math.random() - 0.5) * 0.05;
        particles[i].z = (Math.random() - 0.5) * 0.05;

        // Set color
        colors[i * 3] = blastColor.r;
        colors[i * 3 + 1] = blastColor.g;
        colors[i * 3 + 2] = blastColor.b;
    }
    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.color.needsUpdate = true;
}

// 3D Render Loop
function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.001;

    // 1. Slow decay spin speed back to normal
    coinSpinSpeed += (0.01 - coinSpinSpeed) * 0.05;
    coin.rotation.y += coinSpinSpeed;
    
    // Float coin up/down
    coin.position.y = Math.sin(time * 1.5) * 0.15;
    
    // Decelerate light intensities
    pointLight.intensity += (2.0 - pointLight.intensity) * 0.05;
    if (pointLight.intensity < 2.1) {
        pointLight.color.setHex(0x00ffd5);
    }

    // 2. Smoothly rotate grid based on mouse coordinates
    gridHelper.rotation.y += (targetRotationY - gridHelper.rotation.y) * 0.05;
    gridHelper.rotation.x += (targetRotationX - gridHelper.rotation.x) * 0.05;
    coin.rotation.y += (targetRotationY * 0.5 - coin.rotation.y) * 0.01;

    // 3. Scroll Grid Highway Lines
    const positionAttribute = gridHelper.geometry.attributes.position;
    // (Three.js grid helper is static but we can animate its scale or rotation to feel alive)
    
    // 4. Update shockwaves
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.scale += sw.speed;
        sw.mesh.scale.set(sw.scale, sw.scale, 1);
        sw.mesh.material.opacity = 1.0 - (sw.scale / sw.maxScale);
        
        // Remove completed shockwaves
        if (sw.scale >= sw.maxScale) {
            scene.remove(sw.mesh);
            sw.mesh.geometry.dispose();
            sw.mesh.material.dispose();
            shockwaves.splice(i, 1);
        }
    }

    // 5. Update particles positions
    const pos = particleGeometry.attributes.position.array;
    const colors = particleGeometry.attributes.color.array;

    for (let i = 0; i < particleCount; i++) {
        // Update positions with velocities
        pos[i * 3] += particles[i].x;
        pos[i * 3 + 1] += particles[i].y;
        pos[i * 3 + 2] += particles[i].z;

        // Apply friction to blast velocities so they return to normal drifting
        particles[i].x *= 0.96;
        particles[i].y = particles[i].y * 0.96 + (particles[i].y > 0 ? 0.005 : -0.005) * 0.04;
        particles[i].z *= 0.96;

        // Reset particle if out of bounds
        if (pos[i * 3 + 1] > 3.5 || pos[i * 3 + 1] < -2.5) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 1.0 + Math.random() * 2.5;
            pos[i * 3] = Math.cos(angle) * radius;
            pos[i * 3 + 1] = pos[i * 3 + 1] > 0 ? -1.2 : 2.5;
            pos[i * 3 + 2] = Math.sin(angle) * radius;
            
            // Return to drift velocity
            particles[i].y = 0.005 + Math.random() * 0.015;
            particles[i].x = (Math.random() - 0.5) * 0.002;
            particles[i].z = (Math.random() - 0.5) * 0.002;

            // Decay colors back to standard neon cyan
            colors[i * 3] = 0.0;
            colors[i * 3 + 1] = 0.8;
            colors[i * 3 + 2] = 1.0;
        }
    }
    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.color.needsUpdate = true;

    renderer.render(scene, camera);
}

// --- Application Logic and GUI Integrations ---

// Clear console log lines
btnClearLogs.addEventListener("click", () => {
    logTerminal.innerHTML = '<div class="terminal-line system">[SYSTEM] Console cleared. Listening...</div>';
});

// Apppend log lines to visual terminal with styling class
function appendLogToConsole(line) {
    if (!line) return;
    
    const div = document.createElement("div");
    div.className = "terminal-line";
    
    // Determine category styles
    if (line.includes("ERROR") || line.includes("failed") || line.includes("FAILED")) {
        div.classList.add("error");
    } else if (line.includes("successfully") || line.includes("SUCCESS") || line.includes("placed")) {
        div.classList.add("success");
    } else if (line.includes("API Request") || line.includes("Response")) {
        div.classList.add("request");
    } else {
        div.classList.add("system");
    }
    
    div.textContent = line;
    logTerminal.appendChild(div);
    
    // Keep scroll at bottom
    logTerminal.scrollTop = logTerminal.scrollHeight;
}

// Poll local logs file from FastAPI server
async function fetchLogs() {
    try {
        const res = await fetch(`${API_BASE}/api/logs?lines=30`);
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.logs && data.logs.length > 0) {
            // Find lines that aren't printed yet based on text
            const currentPrinted = Array.from(logTerminal.children).map(c => c.textContent);
            
            data.logs.forEach(line => {
                if (!currentPrinted.includes(line)) {
                    appendLogToConsole(line);
                }
            });
        }
    } catch (e) {
        console.error("Error fetching engine logs:", e);
    }
}

// Check status of API connection (Demo simulated mode or real Binance integration)
async function checkStatus() {
    try {
        const res = await fetch(`${API_BASE}/api/status`);
        const data = await res.json();
        
        currentMode = data.demo ? "DEMO" : "REAL";
        
        statusIndicator.className = `status-indicator ${data.demo ? 'demo' : 'real'}`;
        statusIndicator.querySelector(".status-text").textContent = data.mode;
        
        appendLogToConsole(`[SYSTEM] Client Engine initialized in ${data.mode} mode.`);
    } catch (e) {
        statusIndicator.className = "status-indicator";
        statusIndicator.querySelector(".status-text").textContent = "OFFLINE";
        appendLogToConsole("[ERROR] Engine Server offline. Ensure uvicorn server.py is running!");
    }
}

// Refresh balance amount details
async function fetchBalance() {
    try {
        const res = await fetch(`${API_BASE}/api/balance`);
        const data = await res.json();
        if (data.success) {
            const val = parseFloat(data.balance);
            balanceValue.innerHTML = `$${val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span class="currency">USDT</span>`;
            
            // Update HUD progress visual (10k reference max)
            const pct = Math.min((val / 10000) * 100, 100);
            balanceProgress.style.width = `${pct}%`;
        }
    } catch (e) {
        console.error("Error fetching balance:", e);
    }
}

// Establish real-time WebSocket ticker updates for major pairs (BTCUSDT, ETHUSDT, SOLUSDT)
function connectTickerWebSocket() {
    if (tickerWs) {
        try { tickerWs.close(); } catch(e) {}
    }
    
    // Connect to multi-stream combined market tickers
    const wsUrl = "wss://fstream.binance.com/stream?streams=btcusdt@ticker/ethusdt@ticker/solusdt@ticker";
    tickerWs = new WebSocket(wsUrl);
    
    tickerWs.onmessage = (event) => {
        try {
            const payload = JSON.parse(event.data);
            
            // Forward messages to terminal if overlay is active
            if (typeof handleTerminalWsMessage === "function" && document.getElementById("terminal-overlay").classList.contains("active")) {
                handleTerminalWsMessage(payload);
            }
            
            const data = payload.data;
            if (!data) return;
            
            // Only process ribbon updates if stream is a ticker stream
            if (payload.stream && payload.stream.includes("@ticker")) {
                const symbol = data.s; // e.g. "BTCUSDT"
                const price = parseFloat(data.c); // Last price
                const changePercent = parseFloat(data.P); // Price change percent
                
                // 1. Update Top Ribbon Elements
                const ribbonSymbol = symbol.split("USDT")[0].toLowerCase();
                const pElem = document.getElementById(`ribbon-${ribbonSymbol}-price`);
                const cElem = document.getElementById(`ribbon-${ribbonSymbol}-change`);
                
                if (pElem && price) {
                    const prev = lastPrices[symbol] || price;
                    pElem.textContent = `$${price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                    
                    if (price > prev) {
                        cElem.className = "ribbon-change text-green";
                        cElem.textContent = `+${changePercent.toFixed(2)}%`;
                    } else if (price < prev) {
                        cElem.className = "ribbon-change text-red";
                        cElem.textContent = `${changePercent.toFixed(2)}%`;
                    }
                    lastPrices[symbol] = price;
                }
                
                // 2. Update Central Ticker HUD if active symbol matches
                const activeSym = symbolInput.value.trim().toUpperCase() || "BTCUSDT";
                if (symbol === activeSym) {
                    activeSymbolText.textContent = symbol;
                    
                    if (currentPrice > 0) {
                        if (price > currentPrice) {
                            activePriceText.className = "ticker-price-glowing text-green";
                            activeChangeText.className = "t-val text-green";
                            activeChangeText.innerHTML = `<i class="fa-solid fa-arrow-trend-up"></i> ${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(4)}%`;
                        } else if (price < currentPrice) {
                            activePriceText.className = "ticker-price-glowing text-red";
                            activeChangeText.className = "t-val text-red";
                            activeChangeText.innerHTML = `<i class="fa-solid fa-arrow-trend-down"></i> ${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(4)}%`;
                        }
                    } else {
                        activePriceText.className = "ticker-price-glowing";
                        activeChangeText.className = changePercent >= 0 ? "t-val text-green" : "t-val text-red";
                        activeChangeText.innerHTML = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(4)}%`;
                    }
                    
                    currentPrice = price;
                    activePriceText.textContent = `$${price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                }
            }
        } catch (e) {
            console.error("Error parsing ticker stream data:", e);
        }
    };
    
    tickerWs.onerror = (err) => {
        console.error("WebSocket Ticker Error:", err);
    };
    
    tickerWs.onclose = () => {
        console.log("WebSocket Ticker disconnected. Reconnecting in 5 seconds...");
        setTimeout(connectTickerWebSocket, 5000);
    };
}

// Fallback pricing function for custom non-standard symbols typed in input
async function fetchTicker() {
    const symbol = symbolInput.value.trim().toUpperCase() || "BTCUSDT";
    activeSymbolText.textContent = symbol;
    
    // WebSockets handles the main three. Only fetch other symbols
    if (["BTCUSDT", "ETHUSDT", "SOLUSDT"].includes(symbol)) {
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/api/ticker?symbol=${symbol}`);
        const data = await res.json();
        const price = parseFloat(data.price);
        
        if (price) {
            if (currentPrice > 0) {
                if (price > currentPrice) {
                    activePriceText.className = "ticker-price-glowing text-green";
                    activeChangeText.className = "t-val text-green";
                    activeChangeText.innerHTML = `<i class="fa-solid fa-arrow-trend-up"></i> +${((price - currentPrice) / currentPrice * 100).toFixed(4)}%`;
                } else if (price < currentPrice) {
                    activePriceText.className = "ticker-price-glowing text-red";
                    activeChangeText.className = "t-val text-red";
                    activeChangeText.innerHTML = `<i class="fa-solid fa-arrow-trend-down"></i> -${((currentPrice - price) / currentPrice * 100).toFixed(4)}%`;
                }
            } else {
                activePriceText.className = "ticker-price-glowing";
                activeChangeText.className = "t-val";
                activeChangeText.textContent = "0.00%";
            }
            
            currentPrice = price;
            activePriceText.textContent = `$${price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        }
    } catch (e) {
        console.error("Error fetching custom standard ticker:", e);
    }
}

// Load historical trades database from server
async function loadJournalHistory() {
    try {
        const res = await fetch(`${API_BASE}/api/journal`);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
            tradeJournal = data;
            journalCount.textContent = `${tradeJournal.length} orders`;
            renderJournal();
        }
    } catch (e) {
        console.error("Error loading trade journal database history:", e);
    }
}

// Add Order to visual journal history log
function addOrderToJournal(order) {
    tradeJournal.unshift(order);
    
    // Limit log display to last 50
    if (tradeJournal.length > 50) {
        tradeJournal.pop();
    }
    
    journalCount.textContent = `${tradeJournal.length} orders`;
    renderJournal();
}

function renderJournal() {
    if (tradeJournal.length === 0) {
        journalList.innerHTML = `
            <div class="journal-empty">
                <i class="fa-solid fa-folder-open"></i>
                <p>No executions in database</p>
            </div>`;
        return;
    }
    
    journalList.innerHTML = "";
    tradeJournal.forEach(order => {
        const card = document.createElement("div");
        card.className = "journal-card";
        
        const sideClass = order.side === "BUY" ? "long" : "short";
        const sideText = order.side === "BUY" ? "LONG" : "SHORT";
        const statusClass = order.status.toLowerCase();
        
        const dateObj = order.timestamp ? new Date(order.timestamp) : new Date();
        const timeStr = dateObj.toLocaleTimeString();
        
        const priceStr = order.avgPrice && parseFloat(order.avgPrice) > 0 
            ? `$${parseFloat(order.avgPrice).toLocaleString(undefined, {maximumFractionDigits: 4})}`
            : (order.price ? `$${parseFloat(order.price).toLocaleString(undefined, {maximumFractionDigits: 4})}` : "MARKET");
            
        card.innerHTML = `
            <div class="jc-row">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="jc-side-badge ${sideClass}">${sideText}</span>
                    <span class="jc-symbol">${order.symbol}</span>
                </div>
                <span class="jc-time">${timeStr}</span>
            </div>
            <div class="jc-row" style="margin-top: 4px;">
                <div class="jc-info">Qty: <span>${order.origQty}</span></div>
                <div class="jc-info">Price: <span>${priceStr}</span></div>
                <span class="jc-status ${statusClass}">${order.status}</span>
            </div>
        `;
        
        journalList.appendChild(card);
    });
}

// Form Submit Handler
orderForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Gather details
    const symbol = symbolInput.value.trim().toUpperCase();
    const side = document.querySelector('input[name="side"]:checked').value;
    const type = document.querySelector('input[name="order-type"]:checked').value;
    const quantity = parseFloat(quantityInput.value);
    const price = priceInput.value ? parseFloat(priceInput.value) : null;
    const stopPrice = stopPriceInput.value ? parseFloat(stopPriceInput.value) : null;

    // Loading UX
    btnSubmitOrder.disabled = true;
    btnSubmitOrder.querySelector(".btn-content").textContent = "PROCESSING...";
    
    appendLogToConsole(`[SYSTEM] Client requested ${side} ${type} on ${symbol}...`);

    try {
        const response = await fetch(`${API_BASE}/api/order`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                symbol,
                side,
                type,
                quantity,
                price,
                stopPrice
            })
        });
        
        const result = await response.json();
        
        // Restore button state
        btnSubmitOrder.disabled = false;
        btnSubmitOrder.querySelector(".btn-content").textContent = "EXECUTE ORDER";

        // Handle Modal Response Layout
        if (result.success) {
            // Trigger beautiful visual effects
            trigger3DTransactionBlast(side);
            
            // Setup Success Modal
            modalTitle.textContent = "ORDER PLACED";
            modalTitle.style.color = "var(--green)";
            modalStatusIcon.innerHTML = `<i class="fa-solid fa-circle-check text-green"></i>`;
            modalStatus.textContent = result.status;
            modalStatus.className = "detail-val badge";
            modalOrderId.textContent = result.orderId;
            modalSymbol.textContent = result.symbol;
            modalQty.textContent = `${result.executedQty} / ${result.origQty} units`;
            
            const avgP = parseFloat(result.avgPrice);
            modalPrice.textContent = avgP > 0 ? `$${avgP.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4})}` : "PENDING LIMIT";
            
            // Open modal popup
            resultModal.style.display = "flex";
            
            // Add order entry
            addOrderToJournal({
                symbol: result.symbol,
                side: result.side,
                status: result.status,
                origQty: result.origQty,
                avgPrice: result.avgPrice,
                price: price
            });
            
            // Refresh indicators
            fetchBalance();
        } else {
            // Setup Failure Modal
            modalTitle.textContent = "ORDER FAILED";
            modalTitle.style.color = "var(--red)";
            modalStatusIcon.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-red"></i>`;
            modalStatus.textContent = "REJECTED";
            modalStatus.className = "detail-val badge text-red";
            modalOrderId.textContent = result.code || "N/A";
            modalSymbol.textContent = symbol;
            modalQty.textContent = `${quantity} units`;
            modalPrice.textContent = result.message || "Unknown error";
            
            resultModal.style.display = "flex";
            
            addOrderToJournal({
                symbol,
                side,
                status: "FAILED",
                origQty: quantity,
                price: price
            });
        }
    } catch (e) {
        btnSubmitOrder.disabled = false;
        btnSubmitOrder.querySelector(".btn-content").textContent = "EXECUTE ORDER";
        
        appendLogToConsole(`[ERROR] Connection failed: ${e}`);
        
        // Show offline modal
        modalTitle.textContent = "CONNECTION ERROR";
        modalTitle.style.color = "var(--red)";
        modalStatusIcon.innerHTML = `<i class="fa-solid fa-wifi text-red"></i>`;
        modalStatus.textContent = "OFFLINE";
        modalStatus.className = "detail-val badge text-red";
        modalOrderId.textContent = "NET_ERR";
        modalSymbol.textContent = symbol;
        modalQty.textContent = `${quantity} units`;
        modalPrice.textContent = "Failed to communicate with FastAPI trading server.";
        
        resultModal.style.display = "flex";
    }
    
    // Pull logs immediately to show results in panel
    setTimeout(fetchLogs, 500);
});

// Modal close triggers
modalCloseBtn.addEventListener("click", () => resultModal.style.display = "none");
modalOkBtn.addEventListener("click", () => resultModal.style.display = "none");
window.addEventListener("click", (e) => {
    if (e.target === resultModal) resultModal.style.display = "none";
});

// Watch Order Type toggle updates to hide/show price inputs
document.querySelectorAll('input[name="order-type"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val === "MARKET") {
            priceGroup.style.display = "none";
            priceInput.required = false;
            stopPriceGroup.style.display = "none";
            stopPriceInput.required = false;
        } else if (val === "LIMIT") {
            priceGroup.style.display = "flex";
            priceInput.required = true;
            stopPriceGroup.style.display = "none";
            stopPriceInput.required = false;
        } else if (val === "STOP_LIMIT") {
            priceGroup.style.display = "flex";
            priceInput.required = true;
            stopPriceGroup.style.display = "flex";
            stopPriceInput.required = true;
        }
    });
});

// Watch Shortcut tokens clicking
document.querySelectorAll(".shortcut").forEach(btn => {
    btn.addEventListener("click", (e) => {
        document.querySelectorAll(".shortcut").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
        
        const sym = e.target.textContent;
        symbolInput.value = sym;
        
        // Update quantity suffix
        const asset = sym.split("USDT")[0];
        qtySuffix.textContent = asset;
        
        currentPrice = 0.0; // Reset ticker transitions
        fetchTicker();
    });
});

symbolInput.addEventListener("input", (e) => {
    const sym = e.target.value.trim().toUpperCase();
    if (sym.endsWith("USDT")) {
        const asset = sym.split("USDT")[0];
        qtySuffix.textContent = asset || "BTC";
    } else {
        qtySuffix.textContent = "QTY";
    }
});

// --- Boot Routine ---
window.addEventListener("DOMContentLoaded", () => {
    // 0. Bind open terminal button
    const openTermBtn = document.getElementById("btn-open-terminal");
    if (openTermBtn) {
        openTermBtn.addEventListener("click", () => {
            if (typeof openTerminal === "function") {
                openTerminal();
            }
        });
    }

    // 1. Init Graphics
    init3D();
    animate();
    
    // 2. Load API states
    checkStatus().then(() => {
        fetchBalance();
        connectTickerWebSocket(); // Connect real-time ticker stream
        loadJournalHistory();     // Load trades from persistent history database
        fetchLogs();
    });

    // 3. Setup Loops
    setInterval(fetchTicker, 3000); // Fallback custom ticker updates check
    setInterval(fetchLogs, 1500);   // Poll terminal engine logs
    setInterval(fetchBalance, 10000); // Poll balances slower
});
