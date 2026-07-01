import unittest
from bot.validators import (
    validate_symbol,
    validate_side,
    validate_order_type,
    validate_quantity,
    validate_price,
    validate_order_inputs,
    ValidationError
)

class TestValidators(unittest.TestCase):

    def test_validate_symbol(self):
        # Valid symbols
        self.assertEqual(validate_symbol("btcusdt"), "BTCUSDT")
        self.assertEqual(validate_symbol("  ethusdt  "), "ETHUSDT")
        self.assertEqual(validate_symbol("1000luncusdt"), "1000LUNCUSDT")
        
        # Invalid symbols
        with self.assertRaises(ValidationError):
            validate_symbol("")
        with self.assertRaises(ValidationError):
            validate_symbol("BTC-USDT")  # special chars not allowed

    def test_validate_side(self):
        # Valid sides
        self.assertEqual(validate_side("buy"), "BUY")
        self.assertEqual(validate_side("  SELL  "), "SELL")
        
        # Invalid sides
        with self.assertRaises(ValidationError):
            validate_side("HOLD")
        with self.assertRaises(ValidationError):
            validate_side(None)

    def test_validate_order_type(self):
        # Valid order types
        self.assertEqual(validate_order_type("market"), "MARKET")
        self.assertEqual(validate_order_type("limit"), "LIMIT")
        self.assertEqual(validate_order_type("stop_limit"), "STOP_LIMIT")
        
        # Invalid order types
        with self.assertRaises(ValidationError):
            validate_order_type("STOP_LOSS")

    def test_validate_quantity(self):
        # Valid quantities
        self.assertEqual(validate_quantity("0.05"), 0.05)
        self.assertEqual(validate_quantity(1.5), 1.5)
        
        # Invalid quantities
        with self.assertRaises(ValidationError):
            validate_quantity("-0.01")
        with self.assertRaises(ValidationError):
            validate_quantity("abc")

    def test_validate_price(self):
        # Valid prices
        self.assertEqual(validate_price("65000"), 65000.0)
        self.assertEqual(validate_price(142.50, is_required=True), 142.50)
        
        # Optional price when not required (Market)
        self.assertEqual(validate_price(None, is_required=False), 0.0)
        
        # Invalid prices
        with self.assertRaises(ValidationError):
            validate_price(None, is_required=True)
        with self.assertRaises(ValidationError):
            validate_price("-100")

    def test_validate_order_inputs_market(self):
        # Market order inputs should ignore price checks
        result = validate_order_inputs(
            symbol="BTCUSDT",
            side="BUY",
            order_type="MARKET",
            quantity="0.02"
        )
        self.assertEqual(result["symbol"], "BTCUSDT")
        self.assertEqual(result["side"], "BUY")
        self.assertEqual(result["type"], "MARKET")
        self.assertEqual(result["quantity"], 0.02)
        self.assertIsNone(result["price"])

    def test_validate_order_inputs_limit_missing_price(self):
        # Limit order requires a valid price
        with self.assertRaises(ValidationError):
            validate_order_inputs(
                symbol="BTCUSDT",
                side="SELL",
                order_type="LIMIT",
                quantity="0.02",
                price=None
            )

if __name__ == "__main__":
    unittest.main()
