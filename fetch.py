
import datetime
import json
from urllib.parse import urlparse, urlunparse
import feedparser


import requests
import math


def remove_query_params(url: str) -> str:
    """URLからクエリパラメータを除去する関数"""
    parsed = urlparse(url)
    clean = parsed._replace(query='', fragment='')
    return urlunparse(clean)


def fetch_bookmark_counts(items: list[dict[str, str]], url_key: str = 'link', batch_size: int = 50) -> list[dict[str, any]]:
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
        return datetime.datetime.now()
    
    return datetime.datetime(*updated[:6])


def to_entries(url: str):
    res = feedparser.parse(url)

    if res.status != 200:
        return {
            'url': url,
            'entries': []
        }

    return {
        'url': url,
        'icon': res.feed.get('icon'),
        'image': res.feed.get('image', {}).get('href'),
        'etag': res.get('etag'),
        'modified': res.get('modifed', get_updated(res.feed).isoformat()),
        'entries': fetch_bookmark_counts([{
            'title': entry.get('title'),
            'author': entry.get('author'),
            'link': remove_query_params(entry.get('link')),
            'tags': [tag.get('term') for tag in entry.get('tags', []) ],
            "updated": get_updated(entry).isoformat()
        } for entry in res.entries])
    }


def print_as_json(data):
    print(json.dumps(data, indent=4, ensure_ascii=False))


def main():
    urls = [
        "https://qiita.com/popular-items/feed",
        "https://dev.classmethod.jp/feed/",
        "https://zenn.dev/feed"
    ]

    print_as_json([to_entries(url) for url in urls])


if __name__ == "__main__":
    main()