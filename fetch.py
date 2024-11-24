
import datetime
import json
import os
from urllib.parse import urlparse, urlunparse
import warnings
from bs4 import BeautifulSoup, MarkupResemblesLocatorWarning
import feedparser
import requests
import math


warnings.filterwarnings("ignore", category=MarkupResemblesLocatorWarning)


def get_entry_image(entry) -> str:
    """
    feedparserのentryオブジェクトから画像URLを抽出する
    
    Args:
        entry: feedparserのentryオブジェクト
    
    Returns:
        str: 見つかった画像URL
    """
    # 1. メディアコンテンツをチェック
    if 'media_content' in entry:
        for media in entry['media_content']:
            if 'url' in media:
                return media['url']
    
    # 2. メディアサムネイルをチェック
    if 'media_thumbnail' in entry:
        for media in entry['media_thumbnail']:
            if 'url' in media:
                return media['url']
    
    # 3. エンクロージャーをチェック
    if 'enclosures' in entry:
        for enclosure in entry['enclosures']:
            if 'type' in enclosure and enclosure['type'].startswith('image/'):
                return enclosure['href']
    
    # 4. コンテンツ内のimg要素を解析
    if 'content' in entry:
        for content in entry['content']:
            if 'value' in content:
                soup = BeautifulSoup(content['value'], 'html.parser')
                for img in soup.find_all('img'):
                    if img.get('src'):
                        return img['src']
    
    # 5. descriptionからimg要素を解析
    if 'description' in entry:
        soup = BeautifulSoup(entry.description, 'html.parser')
        for img in soup.find_all('img'):
            if img.get('src'):
                return img['src']
    
    return None


def is_within(date: datetime.datetime, n: datetime.timedelta) -> bool:
    """
    指定された日付が範囲内かどうかを判定する
    
    Args:
        date: チェックする日付（datetime型）
        n: チェックする範囲（timedelta型）
    
    Returns:
        範囲内の場合True、そうでない場合False
    """
    if date is None:
        return False
    now = datetime.datetime.now()
    return (now - n) <= date <= now


def remove_query_params(url: str) -> str:
    """URLからクエリパラメータを除去する関数"""
    parsed = urlparse(url)
    clean = parsed._replace(query='', fragment='')
    return urlunparse(clean)


def fetch_bookmark_counts(items: list[dict[str, str]], url_key: str = 'entry_url', batch_size: int = 50) -> list[dict[str, any]]:
    """
    URLのリストに対してはてなブックマーク数を取得し、元のデータに追加する関数
    
    Args:
        items: idとurlを含む辞書のリスト
        batch_size: 1回のAPIリクエストで取得するURL数（最大50）
    
    Returns:
        bookmark_countを追加した辞書のリスト
    """
    # APIのベースURL
    API_URL = "https://bookmark.hatenaapis.com/count/entries"
    
    # 結果を格納するリスト
    results = []
    
    # バッチ数を計算
    batch_count = math.ceil(len(items) / batch_size)
    
    # バッチごとに処理
    for i in range(batch_count):
        start_idx = i * batch_size
        end_idx = min((i + 1) * batch_size, len(items))
        batch_items = items[start_idx:end_idx]
        
        # URLパラメータの構築
        params = []
        for item in batch_items:
            params.append(('url', item[url_key]))
        
        try:
            # APIリクエスト実行
            response = requests.get(API_URL, params=params)
            response.raise_for_status()
            
            # レスポンスのJSONを取得
            bookmark_counts = response.json()
            
            # 結果をマージ
            for item in batch_items:
                item_with_count = item.copy()
                item_with_count['bookmark_count'] = bookmark_counts.get(item[url_key], 0)
                results.append(item_with_count)
                
        except requests.RequestException as e:
            print(f"Error fetching bookmark counts: {e}")
            # エラー時は bookmark_count を 0 として追加
            for item in batch_items:
                item_with_count = item.copy()
                item_with_count['bookmark_count'] = 0
                results.append(item_with_count)
    
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
        'entries': fetch_bookmark_counts([{
            'entry_title': entry.get('title'),
            'entry_author': entry.get('author'),
            'entry_url': remove_query_params(entry.get('link')),
            'entry_image_url': get_entry_image(entry),
            'entry_tags': [tag.get('term') for tag in entry.get('tags', []) ],
            "entry_updated": get_updated_isoformat(entry)
        } for entry in res.entries if is_within(get_updated(entry), datetime.timedelta(days=7))])
    }


def save_to_json(name, data):
    path = os.path.join(os.path.dirname(__file__), "frontend", "public", name)
    with open(path, mode='w', encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)


def load_from_json(name):
    path = os.path.join(os.path.dirname(__file__), name)
    with open(path, mode='r', encoding="utf-8") as f:
        return json.load(f)


def main():
    save_to_json('result.json', [to_entries(feed_url) for feed_url in load_from_json('feed.json')])


if __name__ == "__main__":
    main()