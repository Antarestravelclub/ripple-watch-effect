// Server-only RSS reader. Deliberately dependency-free: the feeds we consume
// are simple RSS 2.0 documents, and a failing feed must never abort a run.

export interface RssItem {
  title: string;
  description: string;
  link: string | null;
  guid: string | null;
  pubDate: string | null;
}

export interface RssFetchResult {
  ok: boolean;
  items: RssItem[];
  error: string | null;
}

function decode(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]!) : null;
}

export function parseRss(xml: string): RssItem[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  const out: RssItem[] = [];
  for (const block of blocks) {
    const title = tag(block, "title");
    if (!title) continue;
    const pub = tag(block, "pubDate");
    let iso: string | null = null;
    if (pub) {
      const t = Date.parse(pub);
      if (!Number.isNaN(t)) iso = new Date(t).toISOString();
    }
    out.push({
      title,
      description: tag(block, "description") ?? "",
      link: tag(block, "link"),
      guid: tag(block, "guid"),
      pubDate: iso,
    });
  }
  return out;
}

export async function fetchRss(url: string): Promise<RssFetchResult> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "RippleEffect/1.0 (+news ingestion)" },
    });
    if (!res.ok) return { ok: false, items: [], error: `HTTP ${res.status}` };
    const xml = await res.text();
    const items = parseRss(xml);
    if (items.length === 0) return { ok: false, items: [], error: "No items in feed" };
    return { ok: true, items, error: null };
  } catch (e) {
    return {
      ok: false,
      items: [],
      error: e instanceof Error ? e.message : "unreachable",
    };
  }
}
