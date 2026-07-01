# 🌌 Binance Futures 3D Interactive Terminal

<div align="center">

```text
    ██████╗ ██╗███╗   ██╗ █████╗ ███╗   ██╗ ██████╗███████╗
    ██╔══██╗██║████╗  ██║██╔══██╗████╗  ██║██╔════╝██╔════╝
    ██████╔╝██║██╔██╗ ██║███████║██╔██╗ ██║██║     █████╗  
    ██╔══██╗██║██║╚██╗██║██╔══██║██║╚██╗██║██║     ██╔══╝  
    ██████╔╝██║██║ ╚████║██║  ██║██║ ╚████║╚██████╗███████╗
    ╚══════╝ ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝╚══════╝
      🌌 QUANT FUTURE TERMINAL — MULTI-DIMENSIONAL WEBGL VIEWPORT 🌌
```

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-00ffd5.svg?style=for-the-badge&logo=python&logoColor=05060f)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.95+-00ffd5.svg?style=for-the-badge&logo=fastapi&logoColor=05060f)](https://fastapi.tiangolo.com)
[![Three.js](https://img.shields.io/badge/Three.js-r128-00ffd5.svg?style=for-the-badge&logo=three.js&logoColor=05060f)](https://threejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-00ffd5.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)



A high-performance command-line client and interactive WebGL dashboard for placing orders on **Binance Futures (USDT-M) Testnet**. Built using modular Python, FastAPI, and responsive 3D particle physics.

> [!IMPORTANT]
> **Core Deliverable (CLI Trading Client)**: The primary evaluated interface is located in [cli.py](file:///c:/Users/hp/OneDrive/Desktop/Trading%20Bot/cli.py). To place testnet futures orders instantly, run:
> ```bash
> python cli.py --symbol BTCUSDT --side BUY --type MARKET --quantity 0.01
> ```

</div>

---

## 💡 What is "Binance"?
The word **Binance** is a portmanteau (blend) of **Binary** and **Finance**:
* **Binary**: Represents the digital, computational foundation of cryptocurrency, cryptography, and blockchain (binary numbers: 1s and 0s).
* **Finance**: Represents the global systems of exchange, investment, capital, and asset trading.

Together, the brand name signifies the **union of computer technology and global asset trading**—forming the conceptual bedrock of this interactive terminal dashboard.

---

## 🛠️ Tech Stack

<div align="center">
  <img src="https://skillicons.dev/icons?i=html,css,js,threejs,python,fastapi,git,github" />
</div>

<br/>

| Layer | Technology |
| :--- | :--- |
| **Frontend UI** | Vanilla HTML5, Custom Glassmorphic CSS3, Javascript (ES6), FontAwesome Icons |
| **3D Rendering** | Three.js (WebGL viewport, orbital camera, animated floating currency coin, green/red particle streams) |
| **Real-Time Data** | Direct WebSockets (`wss://fstream.binance.com`) for live mark prices and 24h percentage updates |
| **Backend API** | Python 3.8+, FastAPI, Uvicorn (ASGI server) |
| **Exchange Client** | Custom Requests wrapper, HMAC-SHA256 request signing, automatic time offset synchronization |
| **Data Database** | Persistent local JSON Trade History log (`logs/trade_history.json`) |
| **Input Validation** | Pre-request regex matching and value validation rules (`bot/validators.py`) |
| **Auditing & Logs** | Double-channel rotating file handler + visual terminal outputs (`logs/trading_bot.log`) |

---

## 📝 Assumptions & Design Choices
* **Default Time In Force (TIF)**: All Limit and Stop-Limit orders default to `GTC` (Good 'Til Cancelled) to align with standard quantitative execution practices.
* **Quantity Precision**: Client and backend expect order sizes to follow the symbol's specific asset precision limits (e.g. 3 decimal places for BTC, 2 for ETH, 1 for SOL) to prevent API filtering errors.
* **Stop-Limit Order Type Translation**: Binance Futures API expects the order type parameter `"type": "STOP"` for a stop-limit execution (providing both `price` and `stopPrice`), rather than `"STOP_LIMIT"`. The API client automatically translates the client's `"STOP_LIMIT"` choice to `"STOP"` for API compatibility.
* **Demo-Mode Fallback**: When API credentials (`BINANCE_API_KEY` or `BINANCE_API_SECRET`) are missing or empty in `.env`, the system automatically shifts into **Demo Mode**, serving mock tickers, simulated orders, and a starting balance of $10,000.00 USDT.
* **Order Journal Persistence**: Historical transactions are stored locally in a lightweight JSON database file (`logs/trade_history.json`).

---

## 🌟 Visual Features

### 🌌 Central 3D Canvas
The center of the dashboard houses a high-fidelity **WebGL canvas** built with **Three.js**:
* **Glow-Grid Highway**: A glowing grid scrolling dynamically into the screen, visualizing blockchain transaction pipelines. You can drag and orbit the camera angle.
* **3D Token Mesh**: A floating, highly metallic golden/cyan digital coin model spinning in the center of the grid, pulsing to market activities.
* **Reactive Particle Streams**:
  - Placing a **LONG (BUY)** order triggers an expanding green shockwave and shoots a stream of **neon green particles** flying upwards.
  - Placing a **SHORT (SELL)** order triggers a pink shockwave and streams **neon red particles** descending downwards.
  - The coin spins rapidly during transaction execution before decaying back to normal speeds.

### 🎛️ Terminal Console & Journal
* **Engine Logs Console**: A virtual terminal screen scrolling in real time, tailing and color-coding your local FastAPI `logs/trading_bot.log` messages (blue for systems, green for success, red for errors).
* **Trade Journal**: Keeps track of recent orders, positions, status badges, and quantities. **This is dynamically persisted via our local database engine and reloads automatically upon page refresh.**

---

## 🛠️ Internal Mechanics & Security

* **Real-Time WebSocket Feed**: Employs a direct, browser-side connection to the Binance public combined streams (`wss://fstream.binance.com/stream?streams=btcusdt@ticker/ethusdt@ticker/solusdt@ticker`). Updates active price readouts and ribbon trends in real time with sub-second latency, avoiding HTTP server loads and request limit blocks.
* **Persistent Trade Database**: Stores all executed orders (both real and simulated) in `logs/trade_history.json`. Exposes the `/api/journal` endpoint to reload and synchronize order history dynamically.
* **HMAC-SHA256 Signing**: Translates user order parameters into query inputs, hashes them with the local secret key, and sends them via requests headers `X-MBX-APIKEY`.
* **Server Time Synchronization**: Compares local machine clock offset against `/fapi/v1/time` and dynamically updates timestamp query parameters in milliseconds, resolving the common Binance `-1021 Out of Sync` error.
* **Validation Middleware**: Symbol checks (`BTCUSDT` alphanumeric constraints), type restrictions, numeric ranges, and required conditions (e.g., LIMIT price requirement) are validated in Python prior to placing requests.
* **Zero-Setup Demo Mode**: If API credentials are not found in `.env`, the FastAPI server automatically enables a fully simulated **Demo Mode** with mock tickers and a mock $10,000 USDT balance, making UI testing instant and frictionless.

---

## 📁 Repository Structure

```text
trading_bot/
│
├── bot/                  # Modular Trading Bot Core
│   ├── __init__.py       # Package init
│   ├── client.py         # Custom REST API client & HMAC-SHA256 signing
│   ├── orders.py         # Top-level order placements & response routing
│   ├── validators.py     # Parameter validation rules & formatting
│   └── logging_config.py # Double-channel (console + file) logging setup
│
├── frontend/             # 3D Dashboard Client
│   ├── index.html        # Glassmorphism terminal markup
│   ├── style.css         # Futuristic glows, fonts, & transitions CSS
│   └── app.js            # Three.js render loops & API endpoint links
│
├── logs/                 # Auto-generated logger directory
│   └── trading_bot.log   # Detailed execution and audit trail
│
├── cli.py                # Command Line Interface (argparse)
├── server.py             # FastAPI REST Server
├── requirements.txt      # Project library list
├── .env.example          # API credentials template
└── README.md             # Developer documentation
```

---

## ⚙️ Installation & Setup

### 1. Initialize Virtual Environment
Clone the repository, enter the folder, and run:
```powershell
# Create venv using Windows Python Launcher
py -m venv venv

# Activate Virtual Environment (PowerShell)
.\venv\Scripts\Activate.ps1

# Install Dependencies
pip install -r requirements.txt
```

### 2. Configure Credentials
Generate keys from [Binance Futures Testnet](https://testnet.binancefuture.com). Rename the template config file:
```powershell
copy .env.example .env
```
Populate `.env` with your keys:
```env
BINANCE_API_KEY=your_testnet_key_here
BINANCE_API_SECRET=your_testnet_secret_here
```
*(If no keys are provided, the application will run in simulated **Demo Mode**).*

---

## 💻 Running CLI Orders

Activate your virtual environment and run command-line orders with `cli.py`.

### 🔍 Ping Connection Status
```bash
python cli.py --test-connection
```

### 📈 Place a MARKET BUY Order
```bash
python cli.py --symbol BTCUSDT --side BUY --type MARKET --quantity 0.01
```

### 📉 Place a LIMIT SELL Order
```bash
python cli.py --symbol ETHUSDT --side SELL --type LIMIT --quantity 0.5 --price 3500
```

### 🛡️ Place a STOP_LIMIT Order (Bonus)
```bash
python cli.py --symbol SOLUSDT --side BUY --type STOP_LIMIT --quantity 1.0 --price 152 --stop-price 150
```

---

## 🌐 Launching the 3D Web UI

To start the local web application server:
```powershell
uvicorn server:app --reload
```
Once started, navigate to:
👉 **[http://localhost:8000](http://localhost:8000)**

### 💡 Visual Walkthrough
1. **Interactive Orbit**: Click and drag on the center WebGL area to pan and rotate the grid space.
2. **Order Forms**: Type symbol shortcuts, toggle LONG/SHORT sides, select MARKET/LIMIT, and click **EXECUTE ORDER**.
3. **Execution Popups**: Placing an order triggers a custom modal popup with details (Order ID, executed quantity, average fill price) with neon success/failure highlights.
4. **Log Terminal**: The Engine Console periodically syncs with `logs/trading_bot.log` to tail raw transactions directly in your browser.

---

## 🧪 Running Unit Tests

To run the entire test suite (including validation checks and API client mocking):
```powershell
python -m unittest discover -s tests
```

---

## 🐳 Docker Deployment

Alternatively, you can build and spin up the complete uvicorn server and visual interface inside a Docker container:

```bash
# Build and start container in detached mode
docker compose up -d
```
Once initialized, navigate to:
👉 **[http://localhost:8000](http://localhost:8000)**

Logs will continue to synchronize locally into your `./logs` directory via Docker volumes.
