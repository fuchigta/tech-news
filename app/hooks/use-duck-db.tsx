import { useEffect, useState } from "react";
import * as duckdb from "@duckdb/duckdb-wasm";
import duckdb_wasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvp_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdb_wasm_eh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import eh_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";

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

export function useDuckDB() {
    const [db, setDB] = useState<duckdb.AsyncDuckDB | null>(null);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const initDB = async () => {
            try {
                const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
                const worker = new Worker(bundle.mainWorker!);
                const logger = new duckdb.ConsoleLogger();
                const db = new duckdb.AsyncDuckDB(logger, worker);
                await db.instantiate(bundle.mainModule);
                setDB(db);
            } catch (err) {
                console.error(err);
                setError(err instanceof Error ? err : new Error('Failed to initialize DuckDB'));
            }
        };

        initDB();
    }, []);

    return {
        db,
        error
    };
}