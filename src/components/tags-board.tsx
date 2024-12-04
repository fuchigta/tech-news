import * as duckdb from "@duckdb/duckdb-wasm";
import { Int32, List, Struct, StructRowProxy, Utf8 } from "apache-arrow";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "./ui/chart";
import { Label, Pie, PieChart } from "recharts";
import { format } from "date-fns";
import { Input } from "./ui/input";
import { Label as InputLabel } from "./ui/label";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "./ui/drawer";
import { BookMarked, Clock, UserPen } from "lucide-react";
import { CopyToClipboardButton } from "./copy-to-clipboard-button";


type TagEntries = {
  tag: string
  entries: {
    feed_title: String
    entry_title: string
    entry_url: string
    entry_updated: string
    entry_author: string
    entry_image_url: string
    bookmark_count: number
  }[]
}


export function TagsBoard({ db, from, to }: { db: duckdb.AsyncDuckDB, from?: Date, to?: Date }) {
  const [minTagged, setminTagged] = useState<number>(1)

  const query = `
    with e as (
      select
        *,
        unnest(entries, recursive := true)
      from
        result
    )
    select
      entry_tag,
      cast(entry_tag_count as integer) as entry_tag_count,
      array_agg(
        distinct {
          feed_title: feed_title,
          feed_tag_count: cast(feed_tag_count as integer)
        } order by feed_tag_count desc
      ) as feeds,
      array_agg(
        {
          feed_title: feed_title,
          entry_title: entry_title,
          entry_url: entry_url,
          entry_updated: entry_updated,
          entry_author: entry_author,
          entry_image_url: entry_image_url,
          bookmark_count: bookmark_count
        } order by entry_tag_rank
      ) as entries
    from (
      select
        count(entry_title) over (partition by entry_tag) as entry_tag_count,
        count(entry_title) over (partition by entry_tag, feed_title) as feed_tag_count,
        row_number() over (
          partition by entry_tag
          order by
            bookmark_count desc,
            entry_updated desc
          ) as entry_tag_rank,
        *
      from (
        select
          unnest(e.entry_tags) as entry_tag,
          feed_title,
          entry_title,
          entry_url,
          entry_updated,
          entry_author,
          entry_image_url,
          bookmark_count
        from
          e
        where
          entry_tags <> '[]'
          ${from ?
      to ? `and cast(entry_updated as date) between cast('${format(from, "yyyy-MM-dd")}' as date) and cast('${format(to, "yyyy-MM-dd")}' as date)`
        : `and cast(entry_updated as date) >= cast('${format(from, "yyyy-MM-dd")}' as date)`
      : ""}
      ) as t
    ) as tt
    group by
      entry_tag,
      entry_tag_count,
    having
      count(distinct feed_title) > ${minTagged}
    order by
      count(distinct feed_title) desc,
      entry_tag_count desc
  `;
  type queryType = {
    ['entry_tag']: Utf8
    ['entry_tag_count']: Int32
    ['feeds']: List<Struct<{
      ['feed_title']: Utf8,
      ['feed_tag_count']: Int32
    }>>
    ['entries']: List<Struct<{
      ['feed_title']: Utf8,
      ['entry_title']: Utf8,
      ['entry_url']: Utf8
      ['entry_updated']: Utf8
      ['entry_author']: Utf8,
      ['entry_image_url']: Utf8
      ['bookmark_count']: Int32
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

  const [open, setOpen] = useState(false);
  const [tagEntries, setTagEntries] = useState<TagEntries | null>(null);

  return (
    <Card className="flex flex-col justify-center">
      <CardHeader className="text-left">
        <CardTitle>人気タグ</CardTitle>
        <div>
          <InputLabel htmlFor="minTagged">タグ付けされたエントリを含むフィード数がN件以上</InputLabel>
          <Input id="minTagged" type="number" className="w-16" value={minTagged.toString()} onChange={(e) => {
            if (isNaN(e.target.valueAsNumber)) {
              return
            }

            if (e.target.valueAsNumber < 0) {
              setminTagged(0);
              return;
            }
            setminTagged(e.target.valueAsNumber)
          }} />
        </div>
      </CardHeader>
      <CardContent className="grow grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
        {
          result ? (
            <>
              {
                result.map((tag) => (
                  <Card key={tag.entry_tag} className="flex flex-col" >
                    <CardHeader>
                      <CardTitle><Badge variant="secondary" className="text-lg">{tag.entry_tag}</Badge></CardTitle>
                    </CardHeader>
                    <CardContent className="grow flex items-center">
                      <ChartContainer
                        config={{
                          ...tag.feeds.toArray().reduce((prev, cur, i) => ({
                            ...prev,
                            [cur.feed_title]: {
                              label: cur.feed_title,
                              color: `hsl(var(--chart-${i + 1}))`
                            }
                          }), {
                            feed_tag_count: {
                              label: 'Count'
                            },
                          })
                        }}
                        className="w-full h-80"
                      >
                        <PieChart>
                          <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                          />
                          <ChartLegend
                            content={<ChartLegendContent className="flex-wrap" />}
                            verticalAlign="bottom" />
                          <Pie
                            data={tag.feeds.toArray().map((f, i) => ({ ...f, fill: `hsl(var(--chart-${i + 1}))` }))}
                            dataKey="feed_tag_count"
                            nameKey="feed_title"
                            innerRadius={60}
                            strokeWidth={5}
                            onClick={(data) => {
                              const entries = tag.entries.toArray().filter(e => e.feed_title == data.feed_title);
                              setTagEntries({ tag: tag.entry_tag, entries })
                              setOpen(true)
                            }}
                          >
                            <Label
                              content={({ viewBox }) => {
                                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                  return (
                                    <text
                                      x={viewBox.cx}
                                      y={viewBox.cy}
                                      textAnchor="middle"
                                      dominantBaseline="middle"
                                    >
                                      <tspan
                                        x={viewBox.cx}
                                        y={viewBox.cy}
                                        className="fill-foreground text-3xl font-bold"
                                      >
                                        {tag.entry_tag_count}
                                      </tspan>
                                      <tspan
                                        x={viewBox.cx}
                                        y={(viewBox.cy || 0) + 24}
                                        className="fill-muted-foreground"
                                      >
                                        エントリ
                                      </tspan>
                                    </text>
                                  )
                                }
                              }}
                            />
                          </Pie>
                        </PieChart>
                      </ChartContainer>
                      <Drawer open={open} onOpenChange={setOpen} modal={false}>
                        <DrawerTrigger />
                        <DrawerContent>
                          <DrawerHeader>
                            <DrawerTitle><Badge variant="secondary" className="text-lg">{tagEntries?.tag}</Badge></DrawerTitle>
                            <DrawerDescription>{tagEntries?.entries[0].feed_title}</DrawerDescription>
                          </DrawerHeader>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 px-4 pb-4">
                            {tagEntries?.entries.map(entry => (
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
                                      className="max-h-[200px] w-auto object-contain"
                                      onError={(e: any) => e.target.style.display = 'none'} />
                                  </CardContent>
                                  : <></>
                                }
                                <CardFooter>
                                  <a
                                    href={`https://b.hatena.ne.jp/entry/${entry.entry_url.replace('https://', 's/').replace('http://', '')}`}
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
                                      `[${entry.entry_title}](${entry.entry_url}) (**${entry.bookmark_count}** bookmarks)${entry.entry_image_url ? `\n![image](${entry.entry_image_url})` : ""}`
                                    )
                                  }} />
                                </CardFooter>
                              </Card>
                            ))}
                          </div>
                        </DrawerContent>
                      </Drawer>
                    </CardContent>
                  </Card>
                ))
              }
            </>
          ) : (
            <p>Loading...</p>
          )
        }
      </CardContent >
    </Card >
  );
}