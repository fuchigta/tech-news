
import datetime
import json
import os
import unicodedata
from urllib.parse import urlparse, urlunparse
import warnings
from bs4 import BeautifulSoup, MarkupResemblesLocatorWarning
import feedparser
import pandas as pd
import requests
import math


warnings.filterwarnings("ignore", category=MarkupResemblesLocatorWarning)


def get_entry_image(entry) -> str:
    if 'media_content' in entry:
        for media in entry['media_content']:
            if 'url' in media:
                return media['url']
    
    if 'media_thumbnail' in entry:
        for media in entry['media_thumbnail']:
            if 'url' in media:
                return media['url']
    
    if 'enclosures' in entry:
        for enclosure in entry['enclosures']:
            if 'type' in enclosure and enclosure['type'].startswith('image/'):
                return enclosure['href']
    
    if 'content' in entry:
        for content in entry['content']:
            if 'value' in content:
                soup = BeautifulSoup(content['value'], 'html.parser')
                for img in soup.find_all('img'):
                    if img.get('src'):
                        return img['src']
    
    if 'description' in entry:
        soup = BeautifulSoup(entry.description, 'html.parser')
        for img in soup.find_all('img'):
            if img.get('src'):
                return img['src']
    
    return None


def is_within(date: datetime.datetime, n: datetime.timedelta) -> bool:
    if date is None:
        return False
    now = datetime.datetime.now()
    return (now - n) <= date <= now


def remove_query_params(url: str) -> str:
    parsed = urlparse(url)
    clean = parsed._replace(query='', fragment='')
    return urlunparse(clean)


def fetch_bookmark_infos(
        items: list[dict[str, str]],
        url_key: str = 'entry_url',
        tags_key: str = 'entry_tags',
        image_url_key: str = 'entry_image_url'
) -> list[dict[str, any]]:
    API_URL = "https://b.hatena.ne.jp/entry/json/"
    
    results = []

    for item in items:
        try:
            response = requests.get(API_URL, params={'url': item[url_key]})
            response.raise_for_status()
            
            info = response.json()
            if info is None:
                copied = item.copy()
                copied['bookmark_count'] = 0
                results.append(copied)
                continue
            
            copied = item.copy()
            copied['bookmark_count'] = info.get('count', 0)
            copied[tags_key] = copied[tags_key] + list(set(
                [unicodedata.normalize('NFKC', tag) for bookmark in info.get('bookmarks', []) for tag in bookmark.get('tags', [])]))
            if copied.get(image_url_key) is None and not info.get('screenshot', '').endswith("noimage.png"):
                copied[image_url_key] = info.get('screenshot')
            results.append(copied)
                
        except Exception as e:
            print(f"Error fetching bookmark counts: {e}")
            copied = item.copy()
            copied['bookmark_count'] = 0
            results.append(copied)
    
    return results


def get_updated(entry: dict[str, any]) -> datetime.datetime:
    updated = entry.get('updated_parsed', entry.get('published_parsed'))
    if updated is None:
        return None
    
    return datetime.datetime(*updated[:6])


def get_updated_isoformat(entry: dict[str, any]) -> str:
    updated = get_updated(entry)
    if updated is None:
        return None
    
    return updated.isoformat()


def to_entries(feed_url: str):
    res = feedparser.parse(feed_url)

    if res.get('status') != 200:
        print(f"parse failed: url={feed_url}, status={res.get('status')}, headers={res.get('headers')}, exception={res.get('bozo_exception')}")
        return {
            'feed_url': feed_url,
            'entries': []
        }

    return {
        'page_url': res.feed.link,
        'feed_url': feed_url,
        'feed_title': res.feed.get('title'),
        'feed_image': res.feed.get('image', {}).get('href'),
        'feed_modified': res.get('modifed', get_updated_isoformat(res.feed)),
        'entries': fetch_bookmark_infos([{
            'entry_title': entry.get('title'),
            'entry_author': entry.get('author'),
            'entry_url': remove_query_params(entry.get('link')),
            'entry_image_url': get_entry_image(entry),
            'entry_tags': [tag.get('term') for tag in entry.get('tags', []) ],
            "entry_updated": get_updated_isoformat(entry)
        } for entry in res.entries if is_within(get_updated(entry), datetime.timedelta(days=7))])
    }


def save_to_parquet(name, data):
    path = os.path.join(os.path.dirname(__file__), "public", name)
    pd.DataFrame(data).to_parquet(path, engine="pyarrow")


def load_from_json(name):
    path = os.path.join(os.path.dirname(__file__), name)
    with open(path, mode='r', encoding="utf-8") as f:
        return json.load(f)


def main():
    save_to_parquet('result.parquet', [to_entries(feed_url) for feed_url in load_from_json('feed.json')])


if __name__ == "__main__":
    main()