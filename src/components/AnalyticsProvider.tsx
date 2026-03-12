"use client";

import { useEffect } from "react";
import { initAnalytics, track } from "@/lib/analytics";

export default function AnalyticsProvider() {
  useEffect(() => {
    initAnalytics();
    track("page_view");
  }, []);

  return null;
}
