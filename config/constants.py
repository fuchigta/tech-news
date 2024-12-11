from dataclasses import dataclass
from typing import Optional
import os
from pathlib import Path

@dataclass
class APIConfig:
    HATENA_API_URL: str = "https://b.hatena.ne.jp/entry/json/"
    REQUEST_TIMEOUT: int = 10
    MAX_RETRIES: int = 3
    BACKOFF_FACTOR: float = 0.5

@dataclass
class FeedConfig:
    ENTRY_EXPIRY_DAYS: int = 30
    MAX_ENTRIES_PER_FEED: int = 100
    FEED_REFRESH_INTERVAL: int = 3600  # 1時間
    DEFAULT_TAGS: list[str] = None

    def __post_init__(self):
        if self.DEFAULT_TAGS is None:
            self.DEFAULT_TAGS = []

@dataclass
class StorageConfig:
    BASE_DIR: Path = Path(__file__).parent.parent
    PUBLIC_DIR: Path = BASE_DIR / "public"
    FEED_CONFIG_FILE: str = "feed.json"
    OUTPUT_FILE: str = "result.parquet"
    CACHE_DIR: Optional[Path] = BASE_DIR / "cache"

@dataclass
class LogConfig:
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    LOG_FILE: Optional[str] = None

@dataclass
class Config:
    api: APIConfig
    feed: FeedConfig
    storage: StorageConfig
    log: LogConfig
    
    @classmethod
    def from_env(cls) -> 'Config':
        """環境変数から設定を読み込む"""
        api_config = APIConfig(
            HATENA_API_URL=os.getenv('HATENA_API_URL', APIConfig.HATENA_API_URL),
            REQUEST_TIMEOUT=int(os.getenv('REQUEST_TIMEOUT', APIConfig.REQUEST_TIMEOUT)),
            MAX_RETRIES=int(os.getenv('MAX_RETRIES', APIConfig.MAX_RETRIES)),
            BACKOFF_FACTOR=float(os.getenv('BACKOFF_FACTOR', APIConfig.BACKOFF_FACTOR))
        )
        
        feed_config = FeedConfig(
            ENTRY_EXPIRY_DAYS=int(os.getenv('ENTRY_EXPIRY_DAYS', FeedConfig.ENTRY_EXPIRY_DAYS)),
            MAX_ENTRIES_PER_FEED=int(os.getenv('MAX_ENTRIES_PER_FEED', FeedConfig.MAX_ENTRIES_PER_FEED)),
            FEED_REFRESH_INTERVAL=int(os.getenv('FEED_REFRESH_INTERVAL', FeedConfig.FEED_REFRESH_INTERVAL))
        )
        
        storage_config = StorageConfig(
            PUBLIC_DIR=Path(os.getenv('PUBLIC_DIR', str(StorageConfig.PUBLIC_DIR))),
            FEED_CONFIG_FILE=os.getenv('FEED_CONFIG_FILE', StorageConfig.FEED_CONFIG_FILE),
            OUTPUT_FILE=os.getenv('OUTPUT_FILE', StorageConfig.OUTPUT_FILE),
            CACHE_DIR=Path(os.getenv('CACHE_DIR', str(StorageConfig.CACHE_DIR))) if os.getenv('CACHE_DIR') else None
        )
        
        log_config = LogConfig(
            LOG_LEVEL=os.getenv('LOG_LEVEL', LogConfig.LOG_LEVEL),
            LOG_FORMAT=os.getenv('LOG_FORMAT', LogConfig.LOG_FORMAT),
            LOG_FILE=os.getenv('LOG_FILE', LogConfig.LOG_FILE)
        )
        
        return cls(api=api_config, feed=feed_config, storage=storage_config, log=log_config)