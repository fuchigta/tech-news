import * as duckdb from "@duckdb/duckdb-wasm";
import type { StructRowProxy, TypeMap } from "apache-arrow";
import { useEffect, useState } from "react";

export function useQuery<Row extends TypeMap>(
  db: duckdb.AsyncDuckDB | null,
  query: string
) {
  const [result, setResult] = useState<StructRowProxy<Row>[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const runQuery = async (db: duckdb.AsyncDuckDB) => {
      try {
        const conn = await db.connect();
        const res = await conn.query<Row>(query);
        await conn.close();
        setResult(res.toArray());
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err : new Error("Failed to initialize DuckDB")
        );
      }
    };
    if (db) {
      runQuery(db);
    }
  }, [query, db]);

  return {
    result,
    error,
  };
}
