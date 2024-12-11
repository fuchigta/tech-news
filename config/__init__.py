from .constants import Config, APIConfig, FeedConfig, StorageConfig, LogConfig
from .logger import setup_logger

config = Config.from_env()
logger = setup_logger(config.log)

__all__ = ['config', 'logger', 'APIConfig', 'FeedConfig', 'StorageConfig', 'LogConfig']