import { useQuery } from "~/hooks/use-query";
import { Int32, List, Struct, Utf8 } from "apache-arrow";
import { format } from "date-fns";
import { useState } from "react";
import { Label, Pie, PieChart } from "recharts";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTrigger } from "~/components/ui/drawer";
import { Input } from "~/components/ui/input";
import { Label as InputLabel } from "~/components/ui/label";
import { ScrollArea } from "~/components/ui/scroll-area";
import { useDashboardContext } from "~/routes/dashboard";
import type { Route } from "./+types/tags";


export function meta({ }: Route.MetaArgs) {
  return [
    { title: "人気のタグ" },
  ];
}

export default function TagsBoard() {
  const { db, from, to } = useDashboardContext();
  const [minTagged, setminTagged] = useState<number>(1)
  const [excludeTags, setExcludeTags] = useState<string>("あとで読む *あとで読む 未分類")

  const query = `
    with e as (
      select
        distinct on (entry_url)
        *
      from (
        select
          *,
          unnest(entries, recursive := true)
        from
          result
      )
      order by
        feed_url
    )
    select
      entry_tag,
      cast(entry_tag_count as integer) as entry_tag_count,
      array_agg(
        distinct {
          feed_title: feed_title,
          page_url: page_url,
          feed_url: feed_url,
          feed_image: feed_image,
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
          bookmark_count: cast(bookmark_count as integer)
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
          page_url,
          feed_url,
          feed_image,
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
    ${excludeTags.trim() ? `
    where
      entry_tag not in (${excludeTags.split(/[\s,]+/).map(e => e.trim()).filter(e => e.length).map(e => `'${e}'`).join(',')})
    `: ""}
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
      ['page_url']: Utf8,
      ['feed_url']: Utf8,
      ['feed_image']: Utf8,
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
  const { result } = useQuery<queryType>(db, query);

  return (
    <Card className="flex flex-col justify-center h-full w-full">
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
        <div>
          <InputLabel htmlFor="excludeTags">除外するタグ</InputLabel>
          <Input id="excludeTags" type="text" className="w-full" value={excludeTags} onChange={(e) => {
            setExcludeTags(e.target.value.trim())
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
                      <Drawer data-vaul-no-drag={true}>
                        <DrawerTrigger>
                          <CardTitle className="flex items-start">
                            <Badge variant="secondary" className="text-lg hover:bg-muted/50">{tag.entry_tag}</Badge>
                          </CardTitle>
                        </DrawerTrigger>
                        <DrawerContent data-vaul-no-drag={true} className="[&>*:first-child]:hidden">
                          <DrawerHeader>
                            <DrawerClose>
                              <Button variant="outline" className="w-full">Close</Button>
                            </DrawerClose>
                          </DrawerHeader>
                          <ScrollArea className="h-[300px]">
                            <div className="w-full grid grid-cols-1 gap-2 md:gap-4">
                              {
                                tag.feeds.toArray().map(f => (
                                  <Card key={f.feed_url}>
                                    <div className="flex flex-col md:flex-row items-center">
                                      {
                                        f.feed_image ? (
                                          <CardHeader>
                                            <img
                                              src={f.feed_image}
                                              className="h-[40px] w-auto max-w-fit"
                                              onError={(e: any) => e.target.style.display = 'none'} />
                                          </CardHeader>
                                        ) : <></>
                                      }
                                      <CardHeader>
                                        <CardTitle>{f.feed_title}</CardTitle>
                                      </CardHeader>
                                    </div>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
                                      {
                                        tag.entries.toArray().filter(e => e.feed_title == f.feed_title).map((e) => (
                                          <Card key={e.entry_url} className="flex flex-col md:flex-row hover:bg-muted/50 cursor-pointer" onClick={() => {
                                            const w = window.open(e.entry_url, '_blank', 'noopener,noreferrer')
                                            if (w) {
                                              w.opener = null
                                            }
                                          }}>
                                            {e.entry_image_url ? (
                                              <CardHeader>
                                                <img
                                                  src={e.entry_image_url}
                                                  className="h-[40px] w-auto max-w-fit"
                                                  onError={(e: any) => e.target.style.display = 'none'} />
                                              </CardHeader>
                                            ) : <></>}
                                            <CardHeader>
                                              <CardTitle>{e.entry_title}</CardTitle>
                                            </CardHeader>
                                          </Card>
                                        ))
                                      }
                                    </CardContent>
                                  </Card>
                                ))
                              }
                            </div>
                          </ScrollArea>
                        </DrawerContent>
                      </Drawer>
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
                        className="w-full h-auto"
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