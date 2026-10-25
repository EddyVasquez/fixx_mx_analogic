import { useEffect, useState } from "react";
import { clock } from "@/core/clock/clock";

export function useClock(): Date {
  const [now, setNow] = useState(clock.now());
  useEffect(() => {
    const id = setInterval(() => setNow(clock.now()), 1000);
    const un = clock.subscribe(setNow);
    return () => { clearInterval(id); un(); };
  }, []);
  return now;
}
