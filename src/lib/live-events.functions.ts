// Public server functions for the live news feed.
// Thin wrappers only — helpers live in imported modules.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { mapLiveEvents } from "./live-events-map";
import type { EventSourceRow, LiveEventRow, LiveExposureRow } from "./live-events-map";

const EVENT_COLUMNS =
  "id,headline,summary,why_markets_care,source,source_url,published_at,category,strength,regions,transmission_channel,impact_score,impact_direction,impact_category,impact_reasoning";
const EXPOSURE_COLUMNS =
  "id,live_event_id,ticker,company_name,side,sector,mechanism,confidence,quote_symbol,needs_review";
const SOURCE_COLUMNS = "event_id,source_name,url,pub_date";

/** Health of every configured news source, for the diagnostics view. */
export interface NewsSourceHealth {
  name: string;
  enabled: boolean;
  lastSuccessAt: string | null;
  lastError: string | null;
  staleHours: number | null;
}

export const listLiveEvents = createServerFn({ method: "GET" }).handler(async () => {
  const { publicSupabase } = await import("./supabase-public.server");
  const supabase = publicSupabase();

  const { data: events, error } = await supabase
    .from("live_events")
    .select(EVENT_COLUMNS)
    .eq("archived", false)
    .order("published_at", { ascending: false })
    .limit(60);

  if (error) throw new Error(error.message);

  const ids = ((events ?? []) as Array<{ id: string }>).map((e) => e.id);
  const { data: exposures } = ids.length
    ? await supabase.from("live_event_exposures").select(EXPOSURE_COLUMNS).in("live_event_id", ids)
    : { data: [] as LiveExposureRow[] };
  const { data: sources } = ids.length
    ? await supabase.from("event_sources").select(SOURCE_COLUMNS).in("event_id", ids)
    : { data: [] as EventSourceRow[] };

  const { data: runs } = await supabase
    .from("ingest_runs")
    .select("started_at,finished_at,ok,error,events_created,headlines_seen,stages")
    .order("started_at", { ascending: false })
    .limit(1);

  const { data: feeds } = await supabase
    .from("news_sources")
    .select("name,enabled,last_success_at,last_error")
    .order("name");

  const now = Date.now();
  const sourceHealth: NewsSourceHealth[] = (feeds ?? []).map((f) => ({
    name: f.name,
    enabled: f.enabled,
    lastSuccessAt: f.last_success_at,
    lastError: f.last_error,
    staleHours: f.last_success_at
      ? (now - new Date(f.last_success_at).getTime()) / 3_600_000
      : null,
  }));

  const mapped = mapLiveEvents(
    (events ?? []) as unknown as LiveEventRow[],
    (exposures ?? []) as unknown as LiveExposureRow[],
    (sources ?? []) as unknown as EventSourceRow[],
  );

  return {
    events: mapped.events,
    meta: mapped.meta,
    lastIngest: runs?.[0] ?? null,
    sourceHealth,
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
    const { data: sources } = await supabase
      .from("event_sources")
      .select(SOURCE_COLUMNS)
      .eq("event_id", data.id);

    const mapped = mapLiveEvents(
      [event] as unknown as LiveEventRow[],
      (exposures ?? []) as unknown as LiveExposureRow[],
      (sources ?? []) as unknown as EventSourceRow[],
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
