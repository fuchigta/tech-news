import * as duckdb from "@duckdb/duckdb-wasm";
import { Int32, List, Struct, StructRowProxy, Utf8 } from "apache-arrow";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { BookMarked, Clock, UserPen } from "lucide-react";
import { format } from "date-fns";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { CopyToClipboardButton } from "./copy-to-clipboard-button";


enum OrderBy {
  EntryUpdated = "EntryUpdated",
  BookmarkCount = "BookmarkCount"
}


export function EntriesBoard({ db, from, to }: { db: duckdb.AsyncDuckDB, from?: Date, to?: Date }) {
  const [orderBy, setOrderBy] = useState<OrderBy>(OrderBy.BookmarkCount)
  const [rankN, setRankN] = useState<number>(3)
  const [minBookmarkCount, setMinBookmarkCount] = useState<number>(1)

  const query = `
    with ranking as (
      select
        row_number() over (
          partition by feed_title
          order by
            ${orderBy == OrderBy.EntryUpdated ? `
                entry_updated desc,
                bookmark_count desc,
                entry_url
            ` : `
                bookmark_count desc,
                entry_updated desc,
                entry_url
            `}
        ) as rank,
        e.*
      from (
        select
          distinct on (entry_url)
          *
        from (
          select
            feed_title,
            page_url,
            feed_url,
            feed_image,
            unnest(entries, recursive := true)
          from
            result
        )
        order by
          feed_title
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
        bookmark_count >= ${minBookmarkCount}
        ${rankN ? `
          and rank <= ${rankN}
        ` : ""}
        ${from ?
      to ? `and cast(entry_updated as date) between cast('${format(from, "yyyy-MM-dd")}' as date) and cast('${format(to, "yyyy-MM-dd")}' as date)`
        : `and cast(entry_updated as date) >= cast('${format(from, "yyyy-MM-dd")}' as date)`
      : ""
    }
    ) as ranking
    group by
      feed_title,
      page_url,
      feed_url,
      feed_image,
      feed_bookmark_count
    order by
      ${orderBy == OrderBy.EntryUpdated ? `
          max(entry_updated) desc,
          feed_bookmark_count desc
      ` : `
          feed_bookmark_count desc,
          max(entry_updated) desc
      `}
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
            <Badge variant={"destructive"} className="px-1 py-0.25 rounded-sm">
              <BookMarked className="mr-0.5 w-4" />Total {feed.feed_bookmark_count} bookmarks
            </Badge>
          </CardDescription>
          : <></>
      }
    </CardHeader>
  )

  return (
    <Card className="flex flex-col justify-center">
      <CardHeader className="text-left">
        <CardTitle>人気エントリ</CardTitle>
        <div>
          <Label htmlFor="orderBy">並び順</Label>
          <Select onValueChange={(value) => {
            setOrderBy(value as OrderBy)
          }} defaultValue={orderBy}>
            <SelectTrigger id="orderBy" className="w-[160px]">
              <SelectValue placeholder="Order By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={OrderBy.EntryUpdated}>更新日順</SelectItem>
              <SelectItem value={OrderBy.BookmarkCount}>ブックマーク数順</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="rankN">フィードごとの表示エントリ数</Label>
          <Input id="rankN" type="number" className="w-16" value={rankN.toString()} onChange={(e) => {
            if (isNaN(e.target.valueAsNumber)) {
              return
            }

            if (e.target.valueAsNumber < 0) {
              setRankN(0);
              return;
            }

            setRankN(e.target.valueAsNumber)
          }} />
        </div>
        <div>
          <Label htmlFor="minBookmarkCount">ブックマーク数がN件以上を表示</Label>
          <Input id="minBookmarkCount" type="number" className="w-16" value={minBookmarkCount.toString()} onChange={(e) => {
            if (isNaN(e.target.valueAsNumber)) {
              return
            }

            if (e.target.valueAsNumber < 0) {
              setMinBookmarkCount(0);
              return;
            }

            setMinBookmarkCount(e.target.valueAsNumber)
          }} />
        </div>
      </CardHeader>
      <CardContent className="grow grid grid-cols-1 gap-2 md:gap-4">
        {
          result ? (
            <>
              {
                result.map((feed) => (
                  <Card key={feed.feed_url}>
                    {
                      feed.feed_image ?
                        <CardHeader className="flex flex-col md:flex-row">
                          <img src={feed.feed_image} className="max-w-40 self-center" onError={(e: any) => e.target.style.display = 'none'} />
                          {
                            renderFeedHeader(feed)
                          }
                        </CardHeader> : renderFeedHeader(feed)
                    }
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
                      {
                        feed.entries.toArray().map((entry) => (
                          <Card
                            key={entry.entry_url}
                            className="cursor-pointer flex flex-col hover:bg-muted/50"
                          >
                            <CardHeader className="text-left" onClick={() => {
                              const w = window.open(entry.entry_url, '_blank', 'noopener,noreferrer')
                              if (w) {
                                w.opener = null
                              }
                            }}>
                              <CardTitle className="text-sm">{entry.entry_title}</CardTitle>
                              <CardDescription className="flex items-center">
                                <Clock className="mr-0.5 w-4" />
                                {
                                  format(
                                    entry.entry_updated,
                                    "yyyy年MM月dd日 HH時mm分"
                                  )
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
                            {entry.entry_image_url ?
                              <CardContent className="grow flex flex-col justify-start" onClick={() => {
                                const w = window.open(entry.entry_url, '_blank', 'noopener,noreferrer')
                                if (w) {
                                  w.opener = null
                                }
                              }} >
                                <img
                                  src={entry.entry_image_url}
                                  alt="画像"
                                  className="max-w-fit"
                                  onError={(e: any) => e.target.style.display = 'none'} />
                              </CardContent>
                              : <></>
                            }
                            <CardFooter>
                              <a
                                href={`https://b.hatena.ne.jp/entry/${String(entry.entry_url).replace('https://', 's/').replace('http://', '')}`}
                                target="_blank"
                                title="このエントリをはてなブックマークに追加"
                              >
                                <img
                                  src="https://b.st-hatena.com/images/v4/public/entry-button/button-only@2x.png"
                                  alt="このエントリをはてなブックマークに追加"
                                  width="25" height="25"
                                  className="transition duration-150 ease-in-out" />
                              </a>
                              <CopyToClipboardButton className="w-[25px] h-[25px] ml-2 p-0 rounded-sm" title="このエントリをマークダウン形式でクリップボードにコピー" onClick={() => {
                                window.navigator.clipboard.writeText(
                                  `[${entry.entry_title}](${entry.entry_url}) (**${entry.bookmark_count}** bookmarks)${entry.entry_image_url ? `\n![image](${entry.entry_image_url})` : ""}\nタグ：${Array.from(entry.entry_tags).map(tag => `「[${tag}](https://b.hatena.ne.jp/q/${tag})」`).join("")}`
                                )
                              }} />
                            </CardFooter>
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