import logging
from .constants import LogConfig

def setup_logger(config: LogConfig) -> logging.Logger:
    """ロガーの設定"""
    logger = logging.getLogger('tech-news')
    logger.setLevel(getattr(logging, config.LOG_LEVEL))
    
    formatter = logging.Formatter(config.LOG_FORMAT)
    
    # コンソールハンドラーの設定
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # ファイルハンドラーの設定（設定されている場合）
    if config.LOG_FILE:
        file_handler = logging.FileHandler(config.LOG_FILE)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger