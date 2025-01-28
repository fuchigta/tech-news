import datetime
from io import BytesIO
import json
from typing import TypedDict
import unicodedata
from urllib.parse import urlparse, urlunparse
import warnings
from bs4 import BeautifulSoup, MarkupResemblesLocatorWarning
import feedparser
import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from config import config, logger

warnings.filterwarnings("ignore", category=MarkupResemblesLocatorWarning)


def create_session() -> requests.Session:
    """リトライ機能付きのセッションを作成"""
    session = requests.Session()
    retry_strategy = Retry(
        total=config.api.MAX_RETRIES,
        backoff_factor=config.api.BACKOFF_FACTOR,
        status_forcelist=[429, 500, 502, 503, 504],
    )
    session.headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


def get_entry_image(entry) -> str:
    if "media_content" in entry:
        for media in entry["media_content"]:
            if "url" in media:
                return media["url"]

    if "media_thumbnail" in entry:
        for media in entry["media_thumbnail"]:
            if "url" in media:
                return media["url"]

    if "enclosures" in entry:
        for enclosure in entry["enclosures"]:
            if "type" in enclosure and enclosure["type"].startswith("image/"):
                return enclosure["href"]

    if "content" in entry:
        for content in entry["content"]:
            if "value" in content:
                soup = BeautifulSoup(content["value"], "html.parser")
                for img in soup.find_all("img"):
                    if img.get("src"):
                        return img["src"]

    if "description" in entry:
        soup = BeautifulSoup(entry.description, "html.parser")
        for img in soup.find_all("img"):
            if img.get("src"):
                return img["src"]

    return None


def is_within(date: datetime.datetime, n: datetime.timedelta) -> bool:
    if date is None:
        return False
    now = datetime.datetime.now()
    return (now - n) <= date <= now


def remove_query_params(url: str) -> str:
    parsed = urlparse(url)
    clean = parsed._replace(query="", fragment="")
    return urlunparse(clean)


def normalize(s: str) -> str:
    return unicodedata.normalize("NFKC", s)


def fetch_bookmark_infos(
    items: list[dict[str, str]],
    url_key: str = "entry_url",
    tags_key: str = "entry_tags",
    image_url_key: str = "entry_image_url",
) -> list[dict[str, any]]:
    results = []
    session = create_session()

    for item in items:
        try:
            response = session.get(
                config.api.HATENA_API_URL,
                params={"url": item[url_key]},
                timeout=config.api.REQUEST_TIMEOUT,
            )
            response.raise_for_status()

            info = response.json()
            if info is None:
                copied = item.copy()
                copied["bookmark_count"] = 0
                results.append(copied)
                logger.debug(f"No bookmark information for URL: {item[url_key]}")
                continue

            copied = item.copy()
            copied["bookmark_count"] = info.get("count", 0)
            copied[tags_key] = set(
                copied[tags_key]
                + [
                    normalize(tag.lower())
                    for bookmark in info.get("bookmarks", [])
                    for tag in bookmark.get("tags", [])
                ]
            )
            if copied.get(image_url_key) is None and not info.get(
                "screenshot", ""
            ).endswith("noimage.png"):
                copied[image_url_key] = info.get("screenshot")
            results.append(copied)
            logger.debug(f"Successfully fetched bookmark info for URL: {item[url_key]}")

        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching bookmark info for {item[url_key]}: {str(e)}")
            copied = item.copy()
            copied["bookmark_count"] = 0
            results.append(copied)

    return results


def get_updated(
    entry: dict[str, any], default_date: datetime.datetime = None
) -> datetime.datetime:
    updated = entry.get("updated_parsed", entry.get("published_parsed"))
    if updated is None:
        return default_date

    return datetime.datetime(*updated[:6])


def get_updated_isoformat(
    entry: dict[str, any], default_date: datetime.datetime = None
) -> str:
    updated = get_updated(entry, default_date)
    if updated is None:
        return None

    return updated.isoformat()


class FeedInfo(TypedDict):
    url: str
    tags: list[str]


def is_tags_matched(entry: dict, tags: list[str]) -> bool:
    if len(tags) == 0:
        return True

    entry_tags = [
        entry_tag.get("term")
        for entry_tag in entry.get("tags", [])
        if entry_tag.get("term") is not None
    ]

    if len(entry_tags) == 0:
        return True

    return not set(entry_tags).isdisjoint(set(tags))


def to_entries(feed_info: FeedInfo, session: requests.Session):
    try:
        response = session.get(
            feed_info["url"],
            allow_redirects=True,
            timeout=config.api.REQUEST_TIMEOUT,
        )

        if response.status_code != 200:
            logger.error(
                f"HTTP get failed: url={feed_info['url']}, "
                f"status={response.status_code}, "
                f"headers={response.headers} "
            )
            return {"feed_url": feed_info["url"], "entries": []}

        res = feedparser.parse(BytesIO(response.content))

        feed_updated = get_updated(res.feed)
        expiry_delta = datetime.timedelta(days=config.feed.ENTRY_EXPIRY_DAYS)

        entries = [
            entry
            for entry in res.entries[: config.feed.MAX_ENTRIES_PER_FEED]
            if len(entry.get("link", "")) > 0
            and is_within(get_updated(entry, feed_updated), expiry_delta)
            and is_tags_matched(entry, feed_info.get("tags", []))
        ]

        logger.info(f"Fetched {len(entries)} entries from {feed_info['url']}")

        return {
            "page_url": res.feed.link,
            "feed_url": feed_info["url"],
            "feed_title": res.feed.get("title"),
            "feed_image": res.feed.get("image", {}).get("href"),
            "feed_modified": res.get("modifed", get_updated_isoformat(res.feed)),
            "entries": fetch_bookmark_infos(
                [
                    {
                        "entry_title": entry.get("title"),
                        "entry_author": entry.get("author"),
                        "entry_url": remove_query_params(entry.get("link")),
                        "entry_image_url": get_entry_image(entry),
                        "entry_tags": [
                            normalize(tag.get("term").lower())
                            for tag in entry.get("tags", [])
                            if tag.get("term") is not None
                        ],
                        "entry_updated": get_updated_isoformat(entry, feed_updated),
                    }
                    for entry in entries
                ]
            ),
        }
    except Exception as e:
        logger.error(f"Error: url={feed_info['url']}, error={e}")
        return {"feed_url": feed_info["url"], "entries": []}


def save_to_parquet(name: str, data: list):
    path = config.storage.PUBLIC_DIR / name
    logger.info(f"Saving data to {path}")
    pd.DataFrame(data).to_parquet(path, engine="pyarrow")


def load_from_json(name: str):
    path = config.storage.BASE_DIR / name
    logger.info(f"Loading feed configuration from {path}")
    with open(path, mode="r", encoding="utf-8") as f:
        return json.load(f)


def main():
    try:
        feed_infos = load_from_json(config.storage.FEED_CONFIG_FILE)
        session = create_session()
        results = [to_entries(feed_info, session) for feed_info in feed_infos]
        save_to_parquet(config.storage.OUTPUT_FILE, results)
        logger.info("Feed update completed successfully")
    except Exception as e:
        logger.error(f"Error in main process: {str(e)}", exc_info=True)


if __name__ == "__main__":
    main()
