// Client-safe normalization helpers shared by ingestion and dedupe.

const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","for","to","in","on","at","by","with",
  "from","as","is","are","was","were","be","been","its","it","this","that",
  "after","over","amid","says","say","said","new","up","down","how","what",
  "why","will","would","could","than","then","into","about","more","most",
]);

/** Strip tracking params + trailing slash so the same story matches across feeds. */
export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    u.search = "";
    u.hash = "";
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.host.replace(/^www\./, "")}${path}`.toLowerCase();
  } catch {
    return trimmed.split("?")[0]!.toLowerCase();
  }
}

/** Lowercase, drop punctuation and stopwords — the fuzzy-match comparison key. */
export function normalizeTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .join(" ")
    .trim()
    .slice(0, 240);
}
