import { addDays, format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { DateRange } from 'react-day-picker';
import './App.css';
import { EntriesBoard } from './components/entries-board';
import { ModeToggle } from './components/mode-toggle';
import { TagsBoard } from './components/tags-board';
import { ThemeProvider } from './components/theme-provider';
import { Button } from './components/ui/button';
import { Calendar } from './components/ui/calendar';
import { Card, CardContent, CardHeader } from './components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from './components/ui/popover';
import { useDuckDB } from './hooks/use-duck-db';
import { useQuery } from './hooks/use-query';
import { cn } from './lib/utils';

function App() {
  const origin = window.location.origin;
  const path = window.location.pathname;
  let basename = origin;
  if (path !== "/") {
    basename = origin + path;
  }

  const query = `
    CREATE TABLE IF NOT EXISTS result AS SELECT * FROM '${basename}/result.parquet';
  `;

  const { db } = useDuckDB();
  const {
    result: loaded
  } = useQuery(db, query);

  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -1),
    to: new Date()
  })

  // TODO サイドバーでページ切り替えできるようにする

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <Card className="w-full h-full">
        <CardHeader className='flex flex-row justify-between'>
          <div className={"grid gap-2"}>
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
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={1}
                  disabled={{
                    after: new Date()
                  }}
                  locale={ja}
                  formatters={{
                    formatCaption: (date, options) => {
                      return format(date, "yyyy年MM月", { locale: options?.locale });
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
          <ModeToggle />
        </CardHeader>
        <CardContent className='grid grid-cols-1 gap-2 md:gap-4'>
          {db && loaded ? (
            <>
              <EntriesBoard db={db} from={date?.from} to={date?.to} />
              <TagsBoard db={db} from={date?.from} to={date?.to} />
            </>
          ) : (
            <p>Loading...</p>
          )}
        </CardContent>
      </Card>
    </ThemeProvider>
  )
}

export default App
