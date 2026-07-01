import re

class ValidationError(Exception):
    """Custom exception thrown when trading bot inputs fail validation checks."""
    pass

def validate_symbol(symbol: str) -> str:
    """
    Validates a trading symbol.
    Should be alphanumeric and uppercase (e.g. BTCUSDT).
    """
    if not symbol or not isinstance(symbol, str):
        raise ValidationError("Symbol must be a non-empty string.")
    
    clean_symbol = symbol.strip().upper()
    # Binance symbols are alphanumeric (e.g., BTCUSDT, 1000LUNCUSDT)
    if not re.match(r"^[A-Z0-9]+$", clean_symbol):
        raise ValidationError(f"Invalid symbol format: '{symbol}'. Must be alphanumeric (e.g. BTCUSDT).")
    
    return clean_symbol

def validate_side(side: str) -> str:
    """
    Validates order side. Must be BUY or SELL.
    """
    if not side or not isinstance(side, str):
        raise ValidationError("Side must be a string ('BUY' or 'SELL').")
    
    clean_side = side.strip().upper()
    if clean_side not in ["BUY", "SELL"]:
        raise ValidationError(f"Invalid side: '{side}'. Must be either 'BUY' or 'SELL'.")
    
    return clean_side

def validate_order_type(order_type: str) -> str:
    """
    Validates order type. Supports MARKET, LIMIT, and STOP_LIMIT.
    """
    if not order_type or not isinstance(order_type, str):
        raise ValidationError("Order type must be a string ('MARKET', 'LIMIT', or 'STOP_LIMIT').")
    
    clean_type = order_type.strip().upper()
    supported_types = ["MARKET", "LIMIT", "STOP_LIMIT"]
    if clean_type not in supported_types:
        raise ValidationError(f"Unsupported order type: '{order_type}'. Supported types: {', '.join(supported_types)}")
    
    return clean_type

def validate_quantity(quantity) -> float:
    """
    Validates quantity. Must be a positive float or int.
    """
    try:
        val = float(quantity)
    except (ValueError, TypeError):
        raise ValidationError(f"Quantity '{quantity}' must be a valid number.")
    
    if val <= 0:
        raise ValidationError(f"Quantity {val} must be strictly greater than 0.")
    
    return val

def validate_price(price, is_required: bool = True) -> float:
    """
    Validates price. Must be a positive float or int.
    """
    if price is None or price == "":
        if is_required:
            raise ValidationError("Price is required for this order type.")
        return 0.0
        
    try:
        val = float(price)
    except (ValueError, TypeError):
        raise ValidationError(f"Price '{price}' must be a valid number.")
    
    if val <= 0:
        raise ValidationError(f"Price {val} must be strictly greater than 0.")
    
    return val

def validate_order_inputs(symbol: str, side: str, order_type: str, quantity, price=None, stop_price=None) -> dict:
    """
    Validates all inputs for placing an order and returns a cleaned dict of parameters.
    """
    validated = {
        "symbol": validate_symbol(symbol),
        "side": validate_side(side),
        "type": validate_order_type(order_type),
        "quantity": validate_quantity(quantity)
    }
    
    # LIMIT orders require price
    if validated["type"] == "LIMIT":
        validated["price"] = validate_price(price, is_required=True)
    # STOP_LIMIT orders require price and stop_price
    elif validated["type"] == "STOP_LIMIT":
        validated["price"] = validate_price(price, is_required=True)
        if stop_price is None or stop_price == "":
            raise ValidationError("Stop price is required for STOP_LIMIT orders.")
        try:
            validated["stopPrice"] = float(stop_price)
        except (ValueError, TypeError):
            raise ValidationError(f"Stop price '{stop_price}' must be a valid number.")
        if validated["stopPrice"] <= 0:
            raise ValidationError(f"Stop price {validated['stopPrice']} must be strictly greater than 0.")
    else:
        # MARKET orders do not require price
        if price is not None and price != "":
            # Log a warning or just ignore
            pass
        validated["price"] = None
        
    return validated
