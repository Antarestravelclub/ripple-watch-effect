// Public server functions for the live news feed.
// Thin wrappers only — helpers live in imported modules.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { mapLiveEvents } from "./live-events-map";
import type { LiveEventRow, LiveExposureRow } from "./live-events-map";

const EVENT_COLUMNS =
  "id,headline,summary,why_markets_care,source,source_url,published_at,category,strength,regions,transmission_channel";
const EXPOSURE_COLUMNS =
  "id,live_event_id,ticker,company_name,side,sector,mechanism,confidence,quote_symbol,needs_review";

export const listLiveEvents = createServerFn({ method: "GET" }).handler(async () => {
  const { publicSupabase } = await import("./supabase-public.server");
  const supabase = publicSupabase();

  const { data: events, error } = await supabase
    .from("live_events")
    .select(EVENT_COLUMNS)
    .order("published_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);

  const ids = ((events ?? []) as Array<{ id: string }>).map((e) => e.id);
  const { data: exposures } = ids.length
    ? await supabase.from("live_event_exposures").select(EXPOSURE_COLUMNS).in("live_event_id", ids)
    : { data: [] as LiveExposureRow[] };

  const { data: runs } = await supabase
    .from("ingest_runs")
    .select("started_at,finished_at,ok,error,events_created,headlines_seen")
    .order("started_at", { ascending: false })
    .limit(1);

  const mapped = mapLiveEvents(
    (events ?? []) as unknown as LiveEventRow[],
    (exposures ?? []) as unknown as LiveExposureRow[],
  );

  return {
    events: mapped.events,
    meta: mapped.meta,
    lastIngest: runs?.[0] ?? null,
  };
});

export const getLiveEvent = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { publicSupabase } = await import("./supabase-public.server");
    const supabase = publicSupabase();

    const { data: event } = await supabase
      .from("live_events")
      .select(EVENT_COLUMNS)
      .eq("id", data.id)
      .maybeSingle();
    if (!event) return { event: null, meta: null };

    const { data: exposures } = await supabase
      .from("live_event_exposures")
      .select(EXPOSURE_COLUMNS)
      .eq("live_event_id", data.id);

    const mapped = mapLiveEvents(
      [event] as unknown as LiveEventRow[],
      (exposures ?? []) as unknown as LiveExposureRow[],
    );
    return {
      event: mapped.events[0] ?? null,
      meta: mapped.meta[data.id] ?? null,
    };
  });

/** Manual refresh trigger used by the UI's "refresh now" control. */
export const refreshNewsFeed = createServerFn({ method: "POST" }).handler(async () => {
  const { runNewsIngest } = await import("./news-ingest.server");
  const r = await runNewsIngest();
  return {
    ok: r.ok,
    eventsCreated: r.eventsCreated,
    headlinesSeen: r.headlinesSeen,
    signalsCreated: r.signalsCreated,
    error: r.error,
  };
});
