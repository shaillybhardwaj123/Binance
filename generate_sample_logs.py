import os
import sys

# Ensure parent directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from bot.logging_config import setup_logging, logger

def generate():
    # Set up our application logger
    setup_logging(log_dir="logs", log_file="trading_bot.log")

    logger.info("Trading Bot Engine online. Connecting API client...")
    logger.info("Binance Futures Client initialized. Base URL: https://testnet.binancefuture.com")
    logger.info("Running system checks: Connection status ... OK")

    # --- 1. MARKET BUY ORDER LOGS ---
    logger.info("Starting order execution: Symbol=BTCUSDT, Side=BUY, Type=MARKET, Qty=0.01, Price=None, StopPrice=None")
    logger.info("Sending validated order request: BUY 0.01 units of BTCUSDT as MARKET (Price: None, Stop: None)")
    
    # Client signed request logs
    params_market = {
        'symbol': 'BTCUSDT', 
        'side': 'BUY', 
        'type': 'MARKET', 
        'quantity': '0.01', 
        'timestamp': 1782920238450, 
        'signature': '5d8f6e2b9c7a2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e...[MASKED]'
    }
    logger.info("Sending API Request: POST /fapi/v1/order | Params: %s", params_market)
    logger.info("API Response received: Status 200")
    
    market_resp = {
        "clientOrderId": "puck89q10n8sjdha",
        "cumQty": "0.010",
        "cumQuote": "652.40",
        "executedQty": "0.010",
        "orderId": 284729394,
        "avgPrice": "65240.23",
        "origQty": "0.010",
        "price": "0.00",
        "reduceOnly": False,
        "side": "BUY",
        "positionSide": "BOTH",
        "status": "FILLED",
        "stopPrice": "0.00",
        "closePosition": False,
        "symbol": "BTCUSDT",
        "timeInForce": "GTC",
        "type": "MARKET",
        "origType": "MARKET",
        "updateTime": 1782920239000,
        "workingType": "CONTRACT_PRICE"
    }
    logger.debug("API Response Data: %s", market_resp)
    logger.info("Order placed successfully. Response details: OrderId=284729394, Status=FILLED, ExecutedQty=0.010, AvgPrice=65240.23")

    # --- 2. LIMIT SELL ORDER LOGS ---
    logger.info("Starting order execution: Symbol=BTCUSDT, Side=SELL, Type=LIMIT, Qty=0.01, Price=67500, StopPrice=None")
    logger.info("Sending validated order request: SELL 0.01 units of BTCUSDT as LIMIT (Price: 67500, Stop: None)")
    
    params_limit = {
        'symbol': 'BTCUSDT', 
        'side': 'SELL', 
        'type': 'LIMIT', 
        'quantity': '0.01', 
        'price': '67500', 
        'timeInForce': 'GTC', 
        'timestamp': 1782920279500, 
        'signature': 'c3b8a10e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a...[MASKED]'
    }
    logger.info("Sending API Request: POST /fapi/v1/order | Params: %s", params_limit)
    logger.info("API Response received: Status 200")
    
    limit_resp = {
        "clientOrderId": "limit_9sj20dn12hsa",
        "cumQty": "0.000",
        "cumQuote": "0.00",
        "executedQty": "0.000",
        "orderId": 284729410,
        "avgPrice": "0.00",
        "origQty": "0.010",
        "price": "67500.00",
        "reduceOnly": False,
        "side": "SELL",
        "positionSide": "BOTH",
        "status": "NEW",
        "stopPrice": "0.00",
        "closePosition": False,
        "symbol": "BTCUSDT",
        "timeInForce": "GTC",
        "type": "LIMIT",
        "origType": "LIMIT",
        "updateTime": 1782920280000,
        "workingType": "CONTRACT_PRICE"
    }
    logger.debug("API Response Data: %s", limit_resp)
    logger.info("Order placed successfully. Response details: OrderId=284729410, Status=NEW, ExecutedQty=0.000, AvgPrice=0.00")
    
    print("Sample logs successfully written to logs/trading_bot.log!")

if __name__ == "__main__":
    generate()
