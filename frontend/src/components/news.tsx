import * as duckdb from "@duckdb/duckdb-wasm";
import { Int32, List, Struct, StructRowProxy, Utf8 } from "apache-arrow";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";


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
        sum(bookmark_count) over (
          partition by feed_title
        ) as feed_bookmark_count,
        e.*
      from (
        SELECT
          feed_title,
          page_url,
          feed_image,
          unnest(entries, recursive := true)
        from
          result
      ) as e
    )
    select
      feed_title,
      page_url,
      feed_image,
      cast(feed_bookmark_count as integer) as feed_bookmark_count,
      array_agg({
        rank: cast(rank as integer),
        entry_title: entry_title,
        entry_url: entry_url,
        entry_image_url: entry_image_url,
        entry_updated: entry_updated,
        bookmark_count: cast(bookmark_count as integer)
      }) as entries
    from
      ranking
    where
      rank <= 10
    group by
      feed_title,
      page_url,
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
    ['feed_image']: Utf8
    ['feed_bookmark_count']: Int32
    ['entries']: List<Struct<{
      ['rank']: Int32,
      ['entry_title']: Utf8,
      ['entry_url']: Utf8,
      ['entry_image_url']: Utf8,
      ['entry_updated']: Utf8,
      ['bookmark_count']: Int32,
    }>>
  }
  const [result, setResult] = useState<StructRowProxy<queryType>[] | null>(null);

  useEffect(() => {
    const doit = async () => {
      const conn = await db.connect();
      const results = await conn.query<queryType>(query);
      const resultRows: StructRowProxy<queryType>[] = results
        .toArray();
      setResult(resultRows);
      await conn.close();
    };
    doit();
  }, [db, query]);

  return (
    <Card className="flex flex-col justify-center">
      <CardHeader className="text-left">
        <CardTitle>News</CardTitle>
      </CardHeader>
      <CardContent className="grow grid grid-cols-1 gap-4">
        {
          result ? (
            <>
              {
                result.map((feed, i) => (
                  <Card key={i}>
                    <CardHeader className="text-left">
                      <CardTitle>{feed.feed_title}</CardTitle>
                      <CardDescription><a href={feed.page_url} target="_blank">{feed.page_url}</a></CardDescription>
                      {
                        feed.feed_bookmark_count ?
                          <CardDescription>{feed.feed_bookmark_count} bookmarks</CardDescription>
                          : <></>
                      }
                    </CardHeader>
                    <CardContent className="grid grid-cols-5 gap-2">
                      {
                        feed.entries.toArray().map((entry, j) => (
                          <Card key={`${i}-${j}`} className="row-span-1 cursor-pointer flex flex-col justify-between" onClick={() => {
                            const w = window.open(entry.entry_url, '_blank', 'noopener,noreferrer')
                            if (w) {
                              w.opener = null
                            }
                          }}>
                            <CardHeader className="text-left">
                              <CardTitle>{entry.entry_title}</CardTitle>
                              <CardDescription>{entry.entry_updated}</CardDescription>
                              {
                                entry.bookmark_count ?
                                  <CardDescription>
                                    <a href={`https://b.hatena.ne.jp/entrylist?url=${entry.entry_url}`}>
                                      <img src={`https://b.hatena.ne.jp/bc/de/${entry.entry_url}`} alt="はてなブックマーク数" title="はてなブックマーク数" />
                                    </a>
                                  </CardDescription>
                                  : <></>
                              }
                            </CardHeader>
                            <CardContent className="grow flex flex-col justify-start">
                              {
                                entry.entry_image_url ? (
                                  <img src={entry.entry_image_url} className="object-cover h-auto w-full" alt="画像" onError={(e: any) => e.target.style.display = 'none'} />
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