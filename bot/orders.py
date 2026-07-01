from bot.client import BinanceFuturesClient, BinanceAPIError
from bot.validators import validate_order_inputs, ValidationError
from bot.logging_config import logger

def execute_futures_order(
    client: BinanceFuturesClient,
    symbol: str,
    side: str,
    order_type: str,
    quantity,
    price=None,
    stop_price=None
) -> dict:
    """
    Validates user inputs, executes the order via the Binance API client,
    and returns a formatted result dictionary containing the order details.
    """
    logger.info("Starting order execution: Symbol=%s, Side=%s, Type=%s, Qty=%s, Price=%s, StopPrice=%s",
                symbol, side, order_type, quantity, price, stop_price)

    # 1. Validation
    try:
        validated = validate_order_inputs(
            symbol=symbol,
            side=side,
            order_type=order_type,
            quantity=quantity,
            price=price,
            stop_price=stop_price
        )
    except ValidationError as ve:
        logger.error("Order validation failed: %s", ve)
        return {
            "success": False,
            "error_type": "ValidationError",
            "message": str(ve)
        }

    # 2. Execution
    try:
        # Log request summary
        logger.info("Sending validated order request: %s %s units of %s as %s (Price: %s, Stop: %s)",
                    validated["side"], validated["quantity"], validated["symbol"], validated["type"],
                    validated["price"], stop_price)
        
        response = client.place_order(
            symbol=validated["symbol"],
            side=validated["side"],
            order_type=validated["type"],
            quantity=validated["quantity"],
            price=validated["price"],
            stop_price=stop_price
        )

        # 3. Process Response
        order_id = response.get("orderId")
        status = response.get("status")
        executed_qty = response.get("executedQty", "0")
        avg_price = response.get("avgPrice", "0")
        
        # Fallback if avgPrice is not directly populated by market orders
        if float(avg_price) == 0.0 and len(response.get("fills", [])) > 0:
            total_qty = 0.0
            total_quote = 0.0
            for fill in response["fills"]:
                qty = float(fill.get("qty", 0.0))
                price_val = float(fill.get("price", 0.0))
                total_qty += qty
                total_quote += qty * price_val
            if total_qty > 0:
                avg_price = str(total_quote / total_qty)

        result_summary = {
            "success": True,
            "symbol": response.get("symbol"),
            "orderId": order_id,
            "status": status,
            "side": response.get("side"),
            "type": response.get("type"),
            "origQty": response.get("origQty"),
            "executedQty": executed_qty,
            "avgPrice": avg_price,
            "message": f"Order executed successfully. Status: {status}."
        }
        
        logger.info("Order placed successfully. Response details: OrderId=%s, Status=%s, ExecutedQty=%s, AvgPrice=%s",
                    order_id, status, executed_qty, avg_price)
        return result_summary

    except BinanceAPIError as api_err:
        logger.error("Binance API error placing order: %s", api_err)
        return {
            "success": False,
            "error_type": "BinanceAPIError",
            "code": api_err.code,
            "message": api_err.message
        }
    except ConnectionError as conn_err:
        logger.error("Network failure placing order: %s", conn_err)
        return {
            "success": False,
            "error_type": "ConnectionError",
            "message": str(conn_err)
        }
    except Exception as e:
        logger.exception("Unexpected error placing order: %s", e)
        return {
            "success": False,
            "error_type": "UnexpectedError",
            "message": f"An unexpected error occurred: {e}"
        }
