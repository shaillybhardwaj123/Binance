#!/usr/bin/env python3
import os
import sys
import argparse
from dotenv import load_dotenv

# Add current directory to path just in case
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from bot.logging_config import setup_logging, logger
from bot.client import BinanceFuturesClient
from bot.orders import execute_futures_order

def main():
    # Setup logging to console and file
    setup_logging()

    # Load environment variables
    load_dotenv()
    
    api_key = os.getenv("BINANCE_API_KEY")
    api_secret = os.getenv("BINANCE_API_SECRET")
    
    # Optional testnet URL override
    base_url = os.getenv("BINANCE_BASE_URL", "https://testnet.binancefuture.com")

    # Command Line Interface arguments parser
    parser = argparse.ArgumentParser(
        description="Binance Futures Testnet (USDT-M) Trading Bot CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples of usage:
  Market BUY Order:
    python cli.py --symbol BTCUSDT --side BUY --type MARKET --quantity 0.01
    
  Limit SELL Order:
    python cli.py --symbol BTCUSDT --side SELL --type LIMIT --quantity 0.01 --price 65000
    
  Stop-Limit BUY Order (Bonus):
    python cli.py --symbol BTCUSDT --side BUY --type STOP_LIMIT --quantity 0.01 --price 66000 --stop-price 65900
        """
    )
    
    parser.add_init_req = True
    parser.add_argument("-s", "--symbol", required=True, help="Trading pair symbol (e.g. BTCUSDT)")
    parser.add_argument("-d", "--side", required=True, choices=["BUY", "SELL"], help="Order side (BUY/SELL)")
    parser.add_argument("-t", "--type", required=True, choices=["MARKET", "LIMIT", "STOP_LIMIT"], help="Order type")
    parser.add_argument("-q", "--quantity", required=True, help="Order quantity (number of assets)")
    parser.add_argument("-p", "--price", default=None, help="Target price (required for LIMIT and STOP_LIMIT)")
    parser.add_argument("--stop-price", default=None, help="Stop trigger price (required for STOP_LIMIT)")
    parser.add_argument("--test-connection", action="store_true", help="Ping the Binance Testnet API and check connection status")

    args = parser.parse_args()

    # Verify credentials exist
    if not api_key or not api_secret:
        print("\n[ERROR] Missing API configuration details.")
        print("Please ensure you have configured 'BINANCE_API_KEY' and 'BINANCE_API_SECRET'")
        print("in your '.env' file in the root of the project.\n")
        sys.exit(1)

    # Initialize client
    client = BinanceFuturesClient(api_key=api_key, api_secret=api_secret, base_url=base_url)

    # Handle connection test flag
    if args.test_connection:
        print("Testing connection to Binance Futures Testnet...")
        success = client.test_connection()
        if success:
            print("[SUCCESS] Connection successful!")
            sys.exit(0)
        else:
            print("[FAILURE] Failed to connect. Check internet connection and API keys.")
            sys.exit(1)

    # Print Order Request Summary
    print("\n" + "="*50)
    print("                ORDER REQUEST SUMMARY")
    print("="*50)
    print(f"  Symbol:     {args.symbol.upper()}")
    print(f"  Side:       {args.side.upper()}")
    print(f"  Type:       {args.type.upper()}")
    print(f"  Quantity:   {args.quantity}")
    if args.price:
        print(f"  Price:      {args.price}")
    if args.stop_price:
        print(f"  Stop Price: {args.stop_price}")
    print("="*50)
    print("Connecting to Binance Testnet & placing order...\n")

    # Run order execution
    result = execute_futures_order(
        client=client,
        symbol=args.symbol,
        side=args.side,
        order_type=args.type,
        quantity=args.quantity,
        price=args.price,
        stop_price=args.stop_price
    )

    # Print Order Response details
    print("="*50)
    print("                ORDER RESPONSE DETAILS")
    print("="*50)
    if result["success"]:
        print(f"  Result:      SUCCESS \u2705")
        print(f"  Symbol:      {result.get('symbol')}")
        print(f"  Order ID:    {result.get('orderId')}")
        print(f"  Status:      {result.get('status')}")
        print(f"  Side:        {result.get('side')}")
        print(f"  Type:        {result.get('type')}")
        print(f"  Orig Qty:    {result.get('origQty')}")
        print(f"  Exec Qty:    {result.get('executedQty')}")
        print(f"  Avg Price:   {result.get('avgPrice')}")
        print(f"  Message:     {result.get('message')}")
    else:
        print(f"  Result:      FAILED \u274C")
        print(f"  Error Type:  {result.get('error_type')}")
        if "code" in result:
            print(f"  API Code:    {result.get('code')}")
        print(f"  Message:     {result.get('message')}")
    print("="*50 + "\n")

    # Exit with code based on success
    sys.exit(0 if result["success"] else 1)

if __name__ == "__main__":
    main()
