import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { SiteShell } from "@/components/site-shell";
import { StockEvaluation } from "@/components/stock-evaluation";
import { RatingLeaderboard } from "@/components/rating-leaderboard";

export const Route = createFileRoute("/evaluate")({
  validateSearch: (s) => z.object({ symbol: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Stock Evaluator — Buy, Hold or Sell model | The Ripple Effect" },
      { name: "description", content: "Score any stock on price, past performance, profitability and outlook for a Buy, Hold or Sell model verdict." },
      { property: "og:title", content: "Stock Evaluator — The Ripple Effect" },
      { property: "og:description", content: "Four-pillar Buy/Hold/Sell scoring for any stock. Educational research only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EvaluatePage,
});

function EvaluatePage() {
  const { symbol } = Route.useSearch();
  const navigate = useNavigate({ from: "/evaluate" });
  const [text, setText] = useState(symbol ?? "");
  return (
    <SiteShell>
      <h1 className="text-2xl font-semibold tracking-tight">Stock Evaluator</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Enter a symbol to score it on current price, past prices, profitability and future outlook.
      </p>
      <form
        className="flex gap-2 mb-5"
        onSubmit={(e) => {
          e.preventDefault();
          const s = text.trim().toUpperCase();
          if (s) navigate({ search: { symbol: s } });
        }}
      >
        <input
          aria-label="Symbol"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. AAPL"
          className="w-48 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm uppercase"
        />
        <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
          Evaluate
        </button>
      </form>
      {symbol ? (
        <>
          <StockEvaluation ticker={symbol} />
          <Link to="/tickers/$symbol" params={{ symbol: symbol.toUpperCase() }} className="text-xs text-primary hover:underline">
            See {symbol.toUpperCase()} events, signals and chart →
          </Link>
        </>
      ) : (
        <p className="text-xs text-muted-foreground mb-4">No symbol yet — pick one below.</p>
      )}
      <div className="mt-6">
        <RatingLeaderboard
          onPick={(s) => {
            setText(s);
            navigate({ search: { symbol: s } });
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </div>
    </SiteShell>
  );
}
