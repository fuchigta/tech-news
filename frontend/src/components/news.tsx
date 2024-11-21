import * as duckdb from "@duckdb/duckdb-wasm";
import { StructRowProxy } from "apache-arrow";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

export function News({ db }: { db: duckdb.AsyncDuckDB }) {
  const query = `
    with ranking as (
      select
        row_number() over (
          partition by feed_title
          order by
            bookmark_count desc,
            entry_updated desc
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
        bookmark_count: cast(bookmark_count as integer)
      }) as entries
    from
      ranking
    where
      rank <= 3
    group by
      feed_title,
      page_url,
      feed_image,
      feed_bookmark_count
    order by
      feed_bookmark_count desc
    ;
  `;
  const [result, setResult] = useState<StructRowProxy<any>[] | null>(null);

  useEffect(() => {
    const doit = async () => {
      const conn = await db.connect();
      const results = await conn.query(query);
      const resultRows: StructRowProxy<any>[] = results
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
                result.map((row, i) => (
                  <Card key={i}>
                    <CardHeader className="text-left">
                      <CardTitle>{row.feed_title}</CardTitle>
                      <CardDescription><a href={row.page_url} target="_blank">{row.page_url}</a></CardDescription>
                      {
                        row.feed_bookmark_count ?
                          <CardDescription>{row.feed_bookmark_count} bookmarks</CardDescription>
                          : <></>
                      }
                    </CardHeader>
                    <CardContent className="grid grid-cols-3 gap-4">
                      <>
                        {
                          // <p>{console.log(row.entries), row.entries}</p>
                          Array.from(row.entries).map((entry: any, j) => (console.log(entry),
                            <Card key={`${i}-${j}`} className="cursor-pointer flex flex-col justify-between" onClick={() => {
                              const w = window.open(entry.entry_image_url, '_blank', 'noopener,noreferrer')
                              if (w) {
                                w.opener = null
                              }
                            }}>
                              <CardHeader className="text-left">
                                <CardTitle>{j + 1}. {entry.entry_title}</CardTitle>
                                {
                                  entry.bookmark_count ?
                                    <CardDescription>{entry.bookmark_count} bookmarks</CardDescription>
                                    : <></>
                                }
                              </CardHeader>
                              <CardContent className="grow flex flex-col justify-start">
                                {
                                  entry.entry_image_url ? (
                                    <img src={entry.entry_image_url} className="object-cover h-auto w-full" />
                                  ) : (
                                    <></>
                                  )
                                }
                              </CardContent>
                            </Card>
                          ))
                        }
                      </>
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
    </Card>
  );
}