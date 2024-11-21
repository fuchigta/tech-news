import * as duckdb from "@duckdb/duckdb-wasm";
import { StructRowProxy } from "apache-arrow";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

export function News({ db }: { db: duckdb.AsyncDuckDB }) {
  const query = `
    SELECT e.feed_title, e.page_url, e.entries from entries as e;
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
      <CardHeader>
        <CardTitle>News</CardTitle>
        <CardDescription>show all entries</CardDescription>
      </CardHeader>
      <CardContent className="grow">
        {
          result ? (
            <>
            {
              result.map((row, i) => (
                <Card key={i}>
                  <CardHeader>
                    <CardTitle><a href={row.page_url} target="_blank">{row.feed_title}</a></CardTitle>
                  </CardHeader>
                  <CardContent>
                    <>
                    {
                      // <p>{console.log(row.entries), row.entries}</p>
                      Array.from(row.entries).map((entry, j) => (
                        <Card key={`${i}-${j}`}>
                          <CardHeader>
                            <CardTitle><a href={entry.entry_url} target="_blank">{entry.entry_title}</a></CardTitle>
                          </CardHeader>
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