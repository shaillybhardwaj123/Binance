import time
import hmac
import hashlib
import urllib.parse
import requests
from bot.logging_config import logger

class BinanceAPIError(Exception):
    """Exception thrown when the Binance API returns a non-200 error code."""
    def __init__(self, code, message):
        self.code = code
        self.message = message
        super().__init__(f"Binance API Error (Code: {code}): {message}")

class BinanceFuturesClient:
    """
    Direct REST API Client for Binance Futures (USDT-M) Testnet.
    Handles signature generation, timestamp synchronization, and detailed logging.
    """
    def __init__(self, api_key: str, api_secret: str, base_url: str = "https://testnet.binancefuture.com"):
        self.api_key = api_key
        self.api_secret = api_secret
        self.base_url = base_url.rstrip('/')
        self.time_offset = 0 # Offset in milliseconds between local and server time
        logger.info("Binance Futures Client initialized. Base URL: %s", self.base_url)

    def sync_server_time(self):
        """
        Synchronizes client time offset with the Binance Server time to prevent
        timestamp errors (e.g. -1021: Timestamp for this request is outside of the recvWindow).
        """
        url = f"{self.base_url}/fapi/v1/time"
        try:
            logger.debug("Syncing time with Binance server...")
            start_time = int(time.time() * 1000)
            response = requests.get(url, timeout=5)
            response.raise_for_status()
            server_time = response.json().get("serverTime")
            end_time = int(time.time() * 1000)
            
            # Estimate network latency (half of roundtrip)
            latency = (end_time - start_time) // 2
            local_time = end_time - latency
            
            self.time_offset = server_time - local_time
            logger.info("Time synced. Server time: %d, Time offset: %d ms, Estimated latency: %d ms", 
                        server_time, self.time_offset, latency)
        except Exception as e:
            logger.warning("Could not sync server time with Binance (%s). Using local system time.", e)
            self.time_offset = 0

    def _get_timestamp(self) -> int:
        """Returns the synchronized millisecond timestamp."""
        return int(time.time() * 1000) + self.time_offset

    def _sign(self, query_string: str) -> str:
        """Generates HMAC-SHA256 signature for signed endpoints."""
        return hmac.new(
            self.api_secret.encode('utf-8'),
            query_string.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

    def _request(self, method: str, path: str, params: dict = None, signed: bool = False) -> dict:
        """
        Executes an HTTP request to the Binance Futures Testnet API.
        Logs the query details and validates response codes.
        """
        if params is None:
            params = {}
        
        # Remove None values
        params = {k: v for k, v in params.items() if v is not None}
        
        url = f"{self.base_url}{path}"
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-MBX-APIKEY": self.api_key
        }

        if signed:
            # Sync server time dynamically if first call or if offset is clear
            params['timestamp'] = self._get_timestamp()
            query_string = urllib.parse.urlencode(params)
            params['signature'] = self._sign(query_string)
            
            # Mask sensitive info for debug logs
            logged_params = params.copy()
            logged_params['signature'] = f"{params['signature'][:8]}...[MASKED]"
        else:
            logged_params = params

        logger.info("Sending API Request: %s %s | Params: %s", method.upper(), path, logged_params)

        try:
            if method.upper() == "GET":
                response = requests.get(url, params=params, headers=headers, timeout=10)
            elif method.upper() == "POST":
                response = requests.post(url, data=params, headers=headers, timeout=10)
            elif method.upper() == "DELETE":
                response = requests.delete(url, params=params, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            # Try parsing JSON first to extract descriptive Binance error codes if present
            try:
                res_json = response.json()
            except ValueError:
                res_json = {}

            # Log raw response code and headers
            logger.info("API Response received: Status %d", response.status_code)
            
            if response.status_code != 200:
                # If error response, throw custom exception
                code = res_json.get("code", response.status_code)
                msg = res_json.get("msg", response.text)
                logger.error("API request failed. Code: %s, Message: %s", code, msg)
                raise BinanceAPIError(code, msg)

            logger.debug("API Response Data: %s", res_json)
            return res_json

        except requests.exceptions.RequestException as e:
            logger.exception("Network connection failed during request to %s: %s", path, e)
            raise ConnectionError(f"Network error contacting Binance Futures Testnet: {e}")

    # --- API ENDPOINTS ---

    def test_connection(self) -> bool:
        """Pings the API to check connection."""
        try:
            self._request("GET", "/fapi/v1/ping")
            return True
        except Exception:
            return False

    def get_ticker_price(self, symbol: str) -> float:
        """Fetches the current mark price of a symbol."""
        data = self._request("GET", "/fapi/v1/ticker/price", {"symbol": symbol})
        return float(data.get("price", 0.0))

    def get_account_balance(self) -> dict:
        """
        Fetches the account balances and returns asset details (focusing on USDT).
        """
        self.sync_server_time() # Ensure time is in sync before signed request
        balances = self._request("GET", "/fapi/v2/balance", signed=True)
        
        # Parse output to find USDT
        usdt_balance = {"asset": "USDT", "balance": 0.0, "availableBalance": 0.0}
        for b in balances:
            if b.get("asset") == "USDT":
                usdt_balance = {
                    "asset": "USDT",
                    "balance": float(b.get("balance", 0.0)),
                    "availableBalance": float(b.get("availableBalance", 0.0)),
                    "crossWalletBalance": float(b.get("crossWalletBalance", 0.0)),
                }
                break
        return usdt_balance

    def place_order(self, symbol: str, side: str, order_type: str, quantity: float, price: float = None, stop_price: float = None) -> dict:
        """
        Places a futures order on Binance.
        Supports MARKET, LIMIT and STOP_LIMIT orders.
        """
        self.sync_server_time()
        
        # Binance Futures expects STOP for STOP_LIMIT orders
        api_order_type = "STOP" if order_type == "STOP_LIMIT" else order_type
        
        params = {
            "symbol": symbol,
            "side": side,
            "type": api_order_type,
            "quantity": str(quantity),
        }

        if order_type in ["LIMIT", "STOP_LIMIT"]:
            params["price"] = str(price)
            # Default time in force to GTC (Good Till Cancelled) for limit/stop-limit orders
            params["timeInForce"] = "GTC"

        if order_type == "STOP_LIMIT":
            params["stopPrice"] = str(stop_price)

        return self._request("POST", "/fapi/v1/order", params, signed=True)

    def get_order_status(self, symbol: str, order_id: int) -> dict:
        """Fetches status of a specific order."""
        self.sync_server_time()
        params = {"symbol": symbol, "orderId": order_id}
        return self._request("GET", "/fapi/v1/order", params, signed=True)

    def get_open_orders(self, symbol: str = None) -> list:
        """Fetches list of active open orders."""
        self.sync_server_time()
        params = {"symbol": symbol} if symbol else {}
        return self._request("GET", "/fapi/v1/openOrders", params, signed=True)

    def cancel_order(self, symbol: str, order_id: int) -> dict:
        """Cancels an active open order."""
        self.sync_server_time()
        params = {"symbol": symbol, "orderId": order_id}
        return self._request("DELETE", "/fapi/v1/order", params, signed=True)
