import { useEffect, useState } from 'react'
import './App.css'
import { initDuckDB } from './lib/init-duckdb';
import * as duckdb from "@duckdb/duckdb-wasm";
import { ThemeProvider } from './components/theme-provider';
import { Card, CardContent, CardHeader } from './components/ui/card';
import { ModeToggle } from './components/mode-toggle';
import { News } from './components/news';

function App() {
  const [initialized, setInitialized] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [db, setDB] = useState<duckdb.AsyncDuckDB | null>(null);

  const origin = window.location.origin;
  const path = window.location.pathname;
  let basename = origin;
  if (path !== "/") {
    basename = origin + path;
  }

  const loadQuery = `
    CREATE TABLE IF NOT EXISTS result AS SELECT * FROM '${basename}/result.json';
  `;

  useEffect(() => {
    const initialize = async () => {
      await initDuckDB(setDB);
      setInitialized(true);
    }
    if (!initialized) {
      initialize()
    }
  }, [initialized]);

  useEffect(() => {
    const loadDuckDB = async (db: duckdb.AsyncDuckDB) => {
      const conn = await db.connect();
      await conn.query(loadQuery);
      await conn.close();
      setLoaded(true);
    };
    if (db) {
      loadDuckDB(db);
    }
  }, [loadQuery, db]);

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <Card className="w-full h-full">
        <CardHeader className='items-end'>
          <ModeToggle />
        </CardHeader>
        <CardContent className='grid grid-cols-1 gap-4'>
          {db && loaded ? (
            <News db={db} />
          ) : (
            <p>Loading...</p>
          )}
        </CardContent>
      </Card>
    </ThemeProvider>
  )
}

export default App
