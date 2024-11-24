import * as duckdb from "@duckdb/duckdb-wasm";
import { Int32, List, Struct, StructRowProxy, Utf8 } from "apache-arrow";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { format } from "@formkit/tempo";
import { Badge } from "./ui/badge";
import { BookMarked, Clock, UserPen } from "lucide-react";


export function News({ db }: { db: duckdb.AsyncDuckDB }) {
  const query = `
    with ranking as (
      select
        row_number() over (
          partition by feed_title
          order by
            entry_updated desc,
            bookmark_count desc
        ) as rank,
        e.*
      from (
        select
          feed_title,
          page_url,
          feed_url,
          feed_image,
          unnest(entries, recursive := true)
        from
          result
      ) as e
    )
    select
      feed_title,
      page_url,
      feed_url,
      feed_image,
      cast(feed_bookmark_count as integer) as feed_bookmark_count,
      array_agg({
        entry_title: entry_title,
        entry_url: entry_url,
        entry_image_url: entry_image_url,
        entry_updated: entry_updated,
        entry_author: entry_author,
        entry_tags: entry_tags,
        bookmark_count: cast(bookmark_count as integer)
      } order by
        rank
      ) as entries
    from (
      select
        sum(bookmark_count) over (
          partition by feed_title
        ) as feed_bookmark_count,
        *
      from
        ranking
      where
        rank <= 10
    ) as ranking
    group by
      feed_title,
      page_url,
      feed_url,
      feed_image,
      feed_bookmark_count
    order by
      feed_bookmark_count desc,
      max(entry_updated) desc
    ;
  `;
  type queryType = {
    ['feed_title']: Utf8
    ['page_url']: Utf8
    ['feed_url']: Utf8
    ['feed_image']: Utf8
    ['feed_bookmark_count']: Int32
    ['entries']: List<Struct<{
      ['entry_title']: Utf8,
      ['entry_url']: Utf8,
      ['entry_image_url']: Utf8,
      ['entry_updated']: Utf8,
      ['entry_author']: Utf8,
      ['entry_tags']: List<Utf8>,
      ['bookmark_count']: Int32,
    }>>
  }
  const [result, setResult] = useState<StructRowProxy<queryType>[] | null>(null);

  useEffect(() => {
    const loadResult = async () => {
      const conn = await db.connect();
      const results = await conn.query<queryType>(query);
      setResult(results.toArray());
      await conn.close();
    };
    loadResult();
  }, [db, query]);

  const renderFeedHeader = (feed: StructRowProxy<queryType>) => (
    <CardHeader className="text-left">
      <CardTitle>{feed.feed_title}</CardTitle>
      <CardDescription><a href={feed.page_url} target="_blank">{feed.page_url}</a></CardDescription>
      <CardDescription>
        <a
          href={`https://feedly.com/i/subscription/feed${encodeURIComponent('/' + feed.feed_url)}`}
          target='blank'
        >
          <img
            src='https://s1.feedly.com/legacy/feedly-follow-rectangle-flat-small_2x.png'
            alt='follow us in feedly'
            width='66'
            height='20'
          />
        </a>
      </CardDescription>
      {
        feed.feed_bookmark_count ?
          <CardDescription className="flex items-center">
            <Badge variant={"destructive"} className="px-1 py-0.25 rounded-sm"><BookMarked className="mr-0.5 w-4" />{feed.feed_bookmark_count} bookmarks</Badge>
          </CardDescription>
          : <></>
      }
    </CardHeader>
  )

  return (
    <Card className="flex flex-col justify-center">
      <CardHeader className="text-left">
        <CardTitle>人気のRSSエントリ</CardTitle>
      </CardHeader>
      <CardContent className="grow grid grid-cols-1 gap-4">
        {
          result ? (
            <>
              {
                result.map((feed) => (
                  <Card key={feed.feed_url}>
                    {
                      feed.feed_image ?
                        <CardHeader className="flex flex-row">
                          <img src={feed.feed_image} className="max-w-40 self-center" />
                          {
                            renderFeedHeader(feed)
                          }
                        </CardHeader> : renderFeedHeader(feed)
                    }
                    <CardContent className={`grid grid-cols-5 gap-2`}>
                      {
                        feed.entries.toArray().map((entry) => (
                          <Card
                            key={entry.entry_url}
                            className="cursor-pointer flex flex-col"
                            onClick={() => {
                              const w = window.open(entry.entry_url, '_blank', 'noopener,noreferrer')
                              if (w) {
                                w.opener = null
                              }
                            }}>
                            <CardHeader className="text-left">
                              <CardTitle className="text-sm">{entry.entry_title}</CardTitle>
                              <CardDescription className="flex items-center">
                                <Clock className="mr-0.5 w-4" />
                                {
                                  format({
                                    date: entry.entry_updated,
                                    format: {
                                      date: "long",
                                      time: "short"
                                    },
                                    locale: "ja",
                                    tz: "Asia/Tokyo"
                                  })
                                }
                              </CardDescription>
                              {
                                entry.entry_author ?
                                  <CardDescription className="flex items-center">
                                    <UserPen className="mr-0.5 w-4" />{entry.entry_author}
                                  </CardDescription>
                                  : <></>
                              }
                              {
                                entry.bookmark_count ?
                                  <CardDescription className="flex items-center">
                                    <Badge variant={"destructive"} className="px-1 py-0.25 rounded-sm">
                                      <BookMarked className="mr-0.5 w-4" />{entry.bookmark_count} bookmarks
                                    </Badge>
                                  </CardDescription>
                                  : <></>
                              }
                              {
                                entry.entry_tags.length ?
                                  <CardDescription>
                                    <>
                                      {
                                        (entry.entry_tags.toArray() as unknown as Array<string>).map((tag) => (
                                          <Badge key={tag} variant="secondary" className="mr-1 mb-1 text-xs px-1.5 rounded-sm">{tag.toString()}</Badge>)
                                        )
                                      }
                                    </>
                                  </CardDescription>
                                  : <></>
                              }
                            </CardHeader>
                            <CardContent className="grow flex flex-col justify-start">
                              {
                                entry.entry_image_url ? (
                                  <img
                                    src={entry.entry_image_url}
                                    alt="画像"
                                    className="max-w-fit"
                                    onError={(e: any) => e.target.style.display = 'none'} />
                                ) : (
                                  <></>
                                )
                              }
                            </CardContent>
                          </Card>
                        ))
                      }
                    </CardContent>
                  </Card>
                ))
              }
            </>
          ) : (
            <p>Loading...</p>
          )
        }
      </CardContent>
    </Card >
  );
}