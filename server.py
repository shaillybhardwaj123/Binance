import os
import time
import random
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from bot.logging_config import setup_logging, logger
from bot.client import BinanceFuturesClient, BinanceAPIError
from bot.orders import execute_futures_order

# Load credentials
load_dotenv()
setup_logging()

api_key = os.getenv("BINANCE_API_KEY")
api_secret = os.getenv("BINANCE_API_SECRET")
base_url = os.getenv("BINANCE_BASE_URL", "https://testnet.binancefuture.com")

demo_mode = False
client = None

# --- Persistent Trade History Database ---
HISTORY_FILE = "logs/trade_history.json"

def load_trade_history() -> list:
    """Loads historical trade logs from the local JSON storage file."""
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error("Failed to parse trade history file: %s", e)
            return []
    return []

def save_trade_history(history: list):
    """Writes the trade log array to local storage."""
    os.makedirs(os.path.dirname(HISTORY_FILE), exist_ok=True)
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2)
    except Exception as e:
        logger.error("Failed to save trade history: %s", e)

def append_to_journal(order_result: dict, original_price: float = None):
    """Strips and appends the transaction result into the historical journal."""
    status = order_result.get("status")
    
    entry = {
        "symbol": order_result.get("symbol"),
        "orderId": order_result.get("orderId"),
        "status": status if status else "FAILED",
        "side": order_result.get("side"),
        "type": order_result.get("type"),
        "origQty": order_result.get("origQty"),
        "executedQty": order_result.get("executedQty", "0"),
        "avgPrice": order_result.get("avgPrice", "0.0") if float(order_result.get("avgPrice", "0.0")) > 0 else str(original_price or 0.0),
        "timestamp": int(time.time() * 1000)
    }
    
    history = load_trade_history()
    history.insert(0, entry) # Prepend to show newest first
    save_trade_history(history[:50]) # Store up to 50 entries

if not api_key or not api_secret:
    logger.warning("API credentials missing from environment. Starting server in DEMO MODE (simulated orders).")
    demo_mode = True
else:
    try:
        client = BinanceFuturesClient(api_key=api_key, api_secret=api_secret, base_url=base_url)
        # Test connection
        if client.test_connection():
            logger.info("Connected successfully to Binance Futures Testnet.")
        else:
            logger.warning("Could not ping Binance Futures Testnet. Running in DEMO MODE.")
            demo_mode = True
    except Exception as e:
        logger.error("Failed to initialize Binance Client: %s. Starting in DEMO MODE.", e)
        demo_mode = True

app = FastAPI(
    title="Binance Futures 3D Trading Bot Backend",
    description="FastAPI backend supporting CLI trading bot operations and the Web Dashboard."
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simulated state for Demo Mode
simulated_balance = 10000.0
simulated_positions = []
simulated_orders = []

class OrderRequest(BaseModel):
    symbol: str = Field(..., example="BTCUSDT")
    side: str = Field(..., example="BUY")
    type: str = Field(..., example="MARKET")
    quantity: float = Field(..., example=0.01)
    price: float = Field(None, example=65000.0)
    stop_price: float = Field(None, alias="stopPrice", example=64800.0)

@app.get("/api/status")
def get_status():
    """Returns the operational status (Real Testnet vs Simulated Demo)."""
    return {
        "status": "online",
        "mode": "DEMO (Simulated)" if demo_mode else "REAL (Binance Futures Testnet)",
        "demo": demo_mode
    }

@app.get("/api/balance")
def get_balance():
    """Fetches the account USDT balance."""
    if demo_mode:
        return {
            "success": True,
            "asset": "USDT",
            "balance": simulated_balance,
            "availableBalance": simulated_balance,
            "crossWalletBalance": simulated_balance
        }
    
    try:
        balance_data = client.get_account_balance()
        return {
            "success": True,
            **balance_data
        }
    except Exception as e:
        logger.exception("Failed to get balance: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

# Keep track of a pseudo-realtime price walk for Demo Mode
mock_prices = {
    "BTCUSDT": 65420.0,
    "ETHUSDT": 3480.0,
    "SOLUSDT": 142.50,
    "BNBUSDT": 575.20
}

@app.get("/api/ticker")
def get_ticker(symbol: str = "BTCUSDT"):
    """Fetches the current price of a symbol."""
    symbol_upper = symbol.strip().upper()
    if demo_mode:
        # Simulate minor price fluctuations
        if symbol_upper not in mock_prices:
            mock_prices[symbol_upper] = 100.0
        
        change_pct = random.uniform(-0.001, 0.001)
        mock_prices[symbol_upper] *= (1 + change_pct)
        return {
            "symbol": symbol_upper,
            "price": mock_prices[symbol_upper]
        }
    
    try:
        price = client.get_ticker_price(symbol_upper)
        return {
            "symbol": symbol_upper,
            "price": price
        }
    except Exception as e:
        logger.exception("Failed to get ticker: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/order")
def place_order(order: OrderRequest):
    """Places a market, limit, or stop-limit order."""
    global simulated_balance
    
    logger.info("Web Dashboard order request received: %s", order.dict())
    
    if demo_mode:
        # Simulate API network delay
        time.sleep(0.4)
        
        symbol = order.symbol.upper()
        # Fetch current price
        curr_price = mock_prices.get(symbol, 100.0)
        # If Limit, use Limit price, otherwise current price
        order_price = order.price if order.type in ["LIMIT", "STOP_LIMIT"] else curr_price
        
        # Calculate cost
        cost = order.quantity * order_price
        
        # Simple margin calculation check
        if order.side == "BUY" and cost > simulated_balance:
            logger.error("Demo Mode execution failed: Insufficient simulated margin.")
            return {
                "success": False,
                "error_type": "BinanceAPIError",
                "code": -2019,
                "message": "Margin is insufficient. (Simulated Demo Error)"
            }
        
        # Adjust simulated balance
        if order.side == "BUY":
            simulated_balance -= cost
        else:
            simulated_balance += cost
            
        order_id = random.randint(10000000, 99999999)
        status = "FILLED" if order.type == "MARKET" else "NEW"
        
        order_result = {
            "success": True,
            "symbol": symbol,
            "orderId": order_id,
            "status": status,
            "side": order.side,
            "type": order.type,
            "origQty": str(order.quantity),
            "executedQty": str(order.quantity) if status == "FILLED" else "0",
            "avgPrice": str(order_price) if status == "FILLED" else "0",
            "message": f"Simulated order placed. Status: {status}."
        }
        
        logger.info("[DEMO] Placed %s %s order. Simulated Balance: $%.2f", order.side, order.type, simulated_balance)
        append_to_journal(order_result, original_price=order_price)
        return order_result

    # Real execution
    result = execute_futures_order(
        client=client,
        symbol=order.symbol,
        side=order.side,
        order_type=order.type,
        quantity=order.quantity,
        price=order.price,
        stop_price=order.stop_price
    )
    
    if result.get("success"):
        append_to_journal(result, original_price=order.price)
        
    return result

@app.get("/api/journal")
def get_journal():
    """Returns the persisted list of order history records from local storage."""
    return load_trade_history()

@app.get("/api/logs")
def get_logs(lines: int = 40):
    """Reads the last N lines of logs/trading_bot.log to display on dashboard."""
    log_file_path = "logs/trading_bot.log"
    if not os.path.exists(log_file_path):
        return {"logs": ["Log file not created yet. Place an order or check setup."]}
    
    try:
        with open(log_file_path, "r", encoding="utf-8") as f:
            all_lines = f.readlines()
            last_lines = [line.strip() for line in all_lines[-lines:]]
            return {"logs": last_lines}
    except Exception as e:
        return {"logs": [f"Error reading logs: {e}"]}

# Resolve frontend absolute path relative to server.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
frontend_dir = os.path.join(BASE_DIR, "frontend")

# Serve frontend static files
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="static")
else:
    logger.error("Frontend static directory 'frontend' not found at: %s", frontend_dir)
