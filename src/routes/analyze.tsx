import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ClipboardPaste, Sparkles } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { TickerChip } from "@/components/ticker-chip";
import { analyzeArticle, type ArticleImpact } from "@/lib/article-analysis.functions";

export const Route = createFileRoute("/analyze")({
  head: () => ({
    meta: [
      { title: "Article Analyser — The Ripple Effect" },
      {
        name: "description",
        content:
          "Paste any news article and see which listed stocks are most positively and negatively exposed, with the mechanism behind each.",
      },
      { property: "og:title", content: "Article Analyser — The Ripple Effect" },
      {
        property: "og:description",
        content:
          "Paste an article, get an exposure map of positively and negatively affected tickers. Educational research only.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyzePage,
});

function AnalyzePage() {
  const [text, setText] = useState("");
  const run = useServerFn(analyzeArticle);
  const mut = useMutation({
    mutationFn: (t: string) => run({ data: { text: t } }),
  });

  const tooShort = text.trim().length < 80;

  return (
    <SiteShell>
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Article Analyser
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste an article of importance to today's activity. We map it to the
          listed companies most exposed — positively and negatively — and explain
          the mechanism.
        </p>
      </div>

      <div className="rounded-xl border border-border/70 bg-card/60 p-4">
        <label htmlFor="article" className="text-xs text-muted-foreground">
          Article text
        </label>
        <textarea
          id="article"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 20000))}
          rows={10}
          placeholder="Paste the full article text here…"
          className="mt-2 w-full rounded-lg border border-border/70 bg-background/50 p-3 text-sm outline-none focus:border-primary/60 transition-colors resize-y"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground">
            {text.trim().length.toLocaleString()} / 20,000 characters
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                try {
                  const clip = await navigator.clipboard.readText();
                  if (clip) setText(clip.slice(0, 20000));
                } catch {
                  /* clipboard permission denied — user can paste manually */
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              Paste
            </button>
            <button
              disabled={tooShort || mut.isPending}
              onClick={() => mut.mutate(text)}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {mut.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              Map exposure
            </button>
          </div>
        </div>
        {tooShort && text.length > 0 && (
          <p className="mt-2 text-[11px] text-headwind">
            Paste at least 80 characters of article text.
          </p>
        )}
        {mut.isError && (
          <p className="mt-2 text-[11px] text-headwind">
            Could not analyse that article: {(mut.error as Error).message}
          </p>
        )}
      </div>

      {mut.data && <ImpactResult impact={mut.data} />}

      <p className="mt-5 text-[11px] text-muted-foreground/80">
        Exposure mapping is an educational research output, not a prediction and
        not investment advice.
      </p>
    </SiteShell>
  );
}

function ImpactResult({ impact }: { impact: ArticleImpact }) {
  return (
    <div className="mt-5 space-y-4">
      <section className="rounded-xl border border-border/70 bg-card/60 p-4">
        <h2 className="text-base font-semibold tracking-tight">
          {impact.headline}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{impact.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <Tag>{impact.category}</Tag>
          <Tag>Strength: {impact.strength}</Tag>
          <Tag>Channel: {impact.transmissionChannel}</Tag>
          {impact.regions.map((r) => (
            <Tag key={r}>{r}</Tag>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ExposureList
          title="Positively exposed"
          tone="tailwind"
          rows={impact.positive}
        />
        <ExposureList
          title="Negatively exposed"
          tone="headwind"
          rows={impact.negative}
        />
      </div>

      {impact.caveats && (
        <p className="text-[11px] text-muted-foreground rounded-lg border border-border/60 bg-card/40 p-3">
          <span className="text-foreground">Caveats: </span>
          {impact.caveats}
        </p>
      )}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 rounded-md border border-border bg-background/40 text-muted-foreground">
      {children}
    </span>
  );
}

function ExposureList({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: "tailwind" | "headwind";
  rows: ArticleImpact["positive"];
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-4">
      <h3
        className={
          "text-sm font-semibold mb-3 " +
          (tone === "tailwind" ? "text-tailwind" : "text-headwind")
        }
      >
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No clearly exposed names identified.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.ticker + r.company} className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <TickerChip ticker={r.ticker} tone={tone} />
                <span className="text-xs text-foreground">{r.company}</span>
                <span className="text-[11px] text-muted-foreground">
                  {r.sector} · {r.confidence} confidence
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{r.mechanism}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
