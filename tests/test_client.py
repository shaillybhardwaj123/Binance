import unittest
from unittest.mock import patch, MagicMock
import requests
from bot.client import BinanceFuturesClient, BinanceAPIError

class TestBinanceFuturesClient(unittest.TestCase):

    def setUp(self):
        # Initialize client with mock keys
        self.client = BinanceFuturesClient(
            api_key="mock_api_key",
            api_secret="mock_api_secret"
        )

    @patch("bot.client.requests.get")
    def test_test_connection_success(self, mock_get):
        # Mock successful ping response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}
        mock_get.return_value = mock_response
        
        self.assertTrue(self.client.test_connection())
        mock_get.assert_called_once()

    @patch("bot.client.requests.get")
    def test_test_connection_failure(self, mock_get):
        # Mock failed ping response
        mock_response = MagicMock()
        mock_response.status_code = 502
        mock_response.json.return_value = {"code": -1000, "msg": "Bad Gateway"}
        mock_get.return_value = mock_response
        
        self.assertFalse(self.client.test_connection())

    @patch("bot.client.requests.post")
    @patch("bot.client.BinanceFuturesClient.sync_server_time")
    def test_place_order_limit_gtc(self, mock_sync, mock_post):
        # Mock time sync and successful limit order submission
        mock_sync.return_value = None
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "orderId": 12345,
            "symbol": "BTCUSDT",
            "status": "NEW",
            "origQty": "0.01"
        }
        mock_post.return_value = mock_response

        res = self.client.place_order(
            symbol="BTCUSDT",
            side="BUY",
            order_type="LIMIT",
            quantity=0.01,
            price=60000.0
        )
        
        self.assertEqual(res["orderId"], 12345)
        # Verify that timeInForce is added and parameters are strings
        called_args, called_kwargs = mock_post.call_args
        sent_data = called_kwargs["data"]
        self.assertEqual(sent_data["type"], "LIMIT")
        self.assertEqual(sent_data["price"], "60000.0")
        self.assertEqual(sent_data["timeInForce"], "GTC")

    @patch("bot.client.requests.post")
    @patch("bot.client.BinanceFuturesClient.sync_server_time")
    def test_place_order_stop_limit_mapping(self, mock_sync, mock_post):
        # Verify STOP_LIMIT maps to STOP in API call
        mock_sync.return_value = None
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}
        mock_post.return_value = mock_response

        self.client.place_order(
            symbol="BTCUSDT",
            side="SELL",
            order_type="STOP_LIMIT",
            quantity=0.5,
            price=3000.0,
            stop_price=3100.0
        )
        
        called_args, called_kwargs = mock_post.call_args
        sent_data = called_kwargs["data"]
        self.assertEqual(sent_data["type"], "STOP")  # Crucial: verify mapped type is STOP
        self.assertEqual(sent_data["price"], "3000.0")
        self.assertEqual(sent_data["stopPrice"], "3100.0")

    @patch("bot.client.requests.get")
    def test_binance_api_error_parsing(self, mock_get):
        # Verify that BinanceAPIError is raised with proper message and code
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {
            "code": -2010,
            "msg": "Account has insufficient balance for requested action."
        }
        mock_get.return_value = mock_response
        
        with self.assertRaises(BinanceAPIError) as ctx:
            self.client.get_ticker_price("BTCUSDT")
            
        self.assertEqual(ctx.exception.code, -2010)
        self.assertIn("insufficient balance", ctx.exception.message)

    @patch("bot.client.requests.get")
    def test_network_connection_error(self, mock_get):
        # Mock requests exception (e.g. timeout) to raise ConnectionError
        mock_get.side_effect = requests.exceptions.Timeout("Connection timed out")
        
        with self.assertRaises(ConnectionError):
            self.client.get_ticker_price("BTCUSDT")

if __name__ == "__main__":
    unittest.main()
