import os
import logging
from logging.handlers import RotatingFileHandler

def setup_logging(log_dir="logs", log_file="trading_bot.log", level=logging.INFO):
    """
    Configures logging for the trading bot.
    Logs will be written to both the console and a rotating log file in `log_dir`.
    """
    # Ensure log directory exists
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, log_file)

    # Base logger configuration
    logger = logging.getLogger("trading_bot")
    logger.setLevel(level)

    # Clear existing handlers to prevent double logs if initialized multiple times
    if logger.hasHandlers():
        logger.handlers.clear()

    # Formatter for log messages
    # Human-readable format with precise time and module name
    formatter = logging.Formatter(
        "[%(asctime)s] %(levelname)-8s [%(name)s:%(filename)s:%(lineno)d] - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # 1. Console Handler for visual feedback
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # 2. Rotating File Handler to preserve file size (max 5MB, up to 3 backups)
    file_handler = RotatingFileHandler(
        log_path, 
        maxBytes=5 * 1024 * 1024, 
        backupCount=3,
        encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    logger.info("Logging initialized successfully. Logs are saved to: %s", os.path.abspath(log_path))
    return logger

# Create a default logger instance
logger = logging.getLogger("trading_bot")
