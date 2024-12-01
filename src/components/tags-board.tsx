import * as duckdb from "@duckdb/duckdb-wasm";
import { Int32, List, Struct, StructRowProxy, Utf8 } from "apache-arrow";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "./ui/chart";
import { Label, Pie, PieChart } from "recharts";
import { format } from "date-fns";
import { Input } from "./ui/input";
import { Label as InputLabel } from "./ui/label";


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

  // TODO フィードごとの内訳をホバーで表示する

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