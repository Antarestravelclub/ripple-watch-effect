// Client-safe helpers for the materiality (impact) score.
import type { ImpactDirection, RippleEvent } from "./ripple-data";

export const MOVERS_WINDOW_HOURS = 24;
export const MOVERS_MIN_SCORE = 40;

/** Colour band for a score badge: hot / warm / neutral. */
export function impactTone(score: number): string {
  if (score >= 80) return "border-headwind/50 bg-headwind/15 text-headwind";
  if (score >= 60) return "border-amber-400/50 bg-amber-400/10 text-amber-400";
  return "border-border/60 bg-background/60 text-muted-foreground";
}

export function impactLabel(score: number): string {
  if (score >= 80) return "Moves whole markets";
  if (score >= 60) return "Moves sectors";
  return "Moves single names";
}

export function directionLabel(dir: ImpactDirection | null | undefined): string {
  switch (dir) {
    case "risk_on":
      return "Risk on";
    case "risk_off":
      return "Risk off";
    case "sector_specific":
      return "Sector specific";
    case "mixed":
      return "Mixed";
    default:
      return "Unscored";
  }
}

export function categoryLabel(raw: string | null | undefined): string {
  if (!raw) return "Other";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The 10 highest-impact events from the rolling window. Never padded. */
export function topMovers(events: RippleEvent[], limit = 10): RippleEvent[] {
  const cutoff = Date.now() - MOVERS_WINDOW_HOURS * 3_600_000;
  return events
    .filter(
      (e) =>
        (e.impactScore ?? 0) >= MOVERS_MIN_SCORE &&
        new Date(e.publishedAt).getTime() >= cutoff,
    )
    .sort(
      (a, b) =>
        (b.impactScore ?? 0) - (a.impactScore ?? 0) ||
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    .slice(0, limit);
}

/** All tickers an event touches, tailwinds first. */
export function eventTickers(event: RippleEvent, limit = 8): string[] {
  const out: string[] = [];
  for (const grp of [...event.tailwinds, ...event.headwinds]) {
    for (const t of grp.tickers) if (!out.includes(t)) out.push(t);
  }
  return out.slice(0, limit);
}
