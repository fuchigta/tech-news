
import datetime
import json
import feedparser


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
        'entries': [{
            'title': entry.get('title'),
            'author': entry.get('author'),
            'link': entry.get('link'),
            'tags': [tag.get('term') for tag in entry.get('tags', []) ],
            "updated": get_updated(entry).isoformat()
        } for entry in res.entries]
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