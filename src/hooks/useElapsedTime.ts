"use client";

import { useState, useEffect } from "react";

export function useElapsedTime(
  startTime: string | undefined,
  endTime: string | undefined,
): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) {
      setElapsed(0);
      return;
    }

    const start = new Date(startTime).getTime();

    if (endTime) {
      setElapsed(Math.round((new Date(endTime).getTime() - start) / 1000));
      return;
    }

    // Live timer
    const update = () => {
      setElapsed(Math.round((Date.now() - start) / 1000));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startTime, endTime]);

  return elapsed;
}
