// Conviction score v1 — a transparent rubric, not a model.
// Pure and client-safe so the score can be re-explained on the signal card.

export const CONVICTION_THRESHOLD = 55;

export interface ConvictionInput {
  /** Ripple magnitude of the driving event. */
  strength: "Low" | "Medium" | "High";
  /** Exposure confidence from the extraction step. */
  confidence: "Low" | "Medium" | "High";
  /** True when the ticker or company is named in the event text (direct exposure). */
  named: boolean;
  /** Share of comparable past events where this ticker moved the signal's way (0–1), or null. */
  analogueHitRate: number | null;
  /** Age of the driving event in hours at signal creation. */
  eventAgeHours: number;
}

export interface ConvictionBreakdown {
  severity: number;
  directness: number;
  analogues: number;
  freshness: number;
  total: number;
  analogueHitRate: number | null;
  analoguesEstimated: boolean;
}

export const CONVICTION_MAX = {
  severity: 35,
  directness: 30,
  analogues: 25,
  freshness: 10,
} as const;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function scoreConviction(input: ConvictionInput): ConvictionBreakdown {
  // Event severity — up to 35.
  const severity = input.strength === "High" ? 35 : input.strength === "Medium" ? 22 : 10;

  // Directness of exposure — up to 30. Confidence carries most of it; being
  // named in the event text is what separates a direct hit from a ripple.
  const byConfidence =
    input.confidence === "High" ? 22 : input.confidence === "Medium" ? 14 : 6;
  const directness = clamp(byConfidence + (input.named ? 8 : 0), 0, 30);

  // Historical analogue hit rate — up to 25. No comparable history scores a
  // neutral 10 rather than zero, so unusual events aren't unfairly punished.
  const analoguesEstimated = input.analogueHitRate == null;
  const analogues = analoguesEstimated
    ? 10
    : Math.round(clamp(input.analogueHitRate!, 0, 1) * 25);

  // Freshness — 10 points under 24h, decaying to 0 at 72h.
  const h = Math.max(0, input.eventAgeHours);
  const freshness =
    h <= 24 ? 10 : h >= 72 ? 0 : +(10 * (1 - (h - 24) / 48)).toFixed(1);

  const total = Math.round(
    clamp(severity + directness + analogues + freshness, 0, 100),
  );
  return {
    severity,
    directness,
    analogues,
    freshness,
    total,
    analogueHitRate: input.analogueHitRate,
    analoguesEstimated,
  };
}

export type ConvictionBand = "high" | "medium" | "low" | "below";

export function convictionBand(score: number | null | undefined): ConvictionBand {
  if (score == null) return "below";
  if (score >= 80) return "high";
  if (score >= 65) return "medium";
  if (score >= CONVICTION_THRESHOLD) return "low";
  return "below";
}

export const BAND_LABEL: Record<ConvictionBand, string> = {
  high: "80+",
  medium: "65–79",
  low: "55–64",
  below: "Below threshold",
};
