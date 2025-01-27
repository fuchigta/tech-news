import type { AsyncDuckDB } from "@duckdb/duckdb-wasm";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@radix-ui/react-popover";
import { addDays, format } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Outlet, useOutletContext } from "react-router";
import { ModeToggle } from "~/components/mode-toggle";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { useDuckDB } from "~/hooks/use-duck-db";
import { useQuery } from "~/hooks/use-query";
import { cn } from "~/lib/utils";

import * as duckdb from "@duckdb/duckdb-wasm";
import eh_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import mvp_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdb_wasm_eh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import duckdb_wasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import type { Route } from "./+types/dashboard";

interface DashboardContext {
  db: AsyncDuckDB;
  from?: Date;
  to?: Date;
}

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdb_wasm,
    mainWorker: mvp_worker,
  },
  eh: {
    mainModule: duckdb_wasm_eh,
    mainWorker: eh_worker,
  },
};

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const path = window.location.pathname;
  let basename = origin;
  if (path !== "/") {
    basename = origin + path;
  }

  const res = {
    path: `${basename}/result.parquet`,
  };

  return res;
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { db } = useDuckDB();
  const { result: loaded } = useQuery(
    db,
    `
    CREATE TABLE IF NOT EXISTS result AS SELECT * FROM '${loaderData.path}';
  `
  );

  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -1),
    to: new Date(),
  });

  return (
    <div className="mx-6">
      <header className="flex flex-row justify-end items-center mb-6">
        <div className="grid gap-2 mr-2 bg-card">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-[300px] justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "yyyy年MM月dd日", { locale: ja })} -{" "}
                      {format(date.to, "yyyy年MM月dd日", { locale: ja })}
                    </>
                  ) : (
                    format(date.from, "yyyy年MM月dd日", { locale: ja })
                  )
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0 bg-popover border"
              align="start"
            >
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={1}
                disabled={{
                  after: new Date(),
                }}
                locale={ja}
                formatters={{
                  formatCaption: (date, options) => {
                    return format(date, "yyyy年MM月", {
                      locale: options?.locale,
                    });
                  },
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <ModeToggle />
      </header>
      <main>
        {db && loaded ? (
          <Outlet
            context={
              { db, from: date?.from, to: date?.to } satisfies DashboardContext
            }
          />
        ) : (
          <>Loading...</>
        )}
      </main>
    </div>
  );
}

export function useDashboardContext() {
  return useOutletContext<DashboardContext>();
}
