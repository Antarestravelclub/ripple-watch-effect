import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

/**
 * Sealed TradingView embed panes — display only.
 * Nothing in the engine reads prices from these widgets; the engine's only
 * price source is the latest_prices table.
 */

type WidgetKind = "advanced-chart" | "market-overview";

const SCRIPT_SRC: Record<WidgetKind, string> = {
  "advanced-chart": "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js",
  "market-overview":
    "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js",
};

function useVisible<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, visible };
}

const SIZE_OPTIONS = [
  { label: "S", height: 320 },
  { label: "M", height: 420 },
  { label: "L", height: 600 },
];

function Embed({
  kind,
  config,
  height,
  label,
}: {
  kind: WidgetKind;
  config: Record<string, unknown>;
  height: number;
  label: string;
}) {
  const { ref, visible } = useVisible<HTMLDivElement>();
  const holder = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [sizeIdx, setSizeIdx] = useState(() =>
    Math.max(
      0,
      SIZE_OPTIONS.findIndex((s) => s.height === height),
    ),
  );
  const [expanded, setExpanded] = useState(false);
  const chartHeight = SIZE_OPTIONS[sizeIdx]!.height;
  // The overview widget sizes itself from its config, so its height lives in
  // the JSON and changes remount it; the advanced chart autosizes with CSS.
  const json = JSON.stringify(
    kind === "market-overview"
      ? { ...config, height: expanded ? 900 : chartHeight }
      : config,
  );

  useEffect(() => {
    if (!visible || !holder.current) return;
    const host = holder.current;
    host.innerHTML = "";
    const inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    host.appendChild(inner);

    const script = document.createElement("script");
    script.src = SCRIPT_SRC[kind];
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = json;
    script.onerror = () => setFailed(true);
    host.appendChild(script);

    // If the widget never renders (blocked, offline), collapse gracefully.
    const timer = setTimeout(() => {
      if (!host.querySelector("iframe")) setFailed(true);
    }, 8000);

    return () => {
      clearTimeout(timer);
      host.innerHTML = "";
    };
  }, [visible, kind, json]);

  return (
    <div
      ref={ref}
      className={expanded ? "fixed inset-0 z-50 bg-background p-3 sm:p-4" : ""}
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-sm font-semibold tracking-tight">{label}</h2>
        <div className="flex items-center gap-1">
          {!expanded &&
            SIZE_OPTIONS.map((s, i) => (
              <button
                key={s.label}
                onClick={() => setSizeIdx(i)}
                aria-label={"Chart height " + s.label}
                title={"Chart height " + s.label}
                className={
                  "rounded border px-1.5 py-0.5 text-[10px] font-medium " +
                  (i === sizeIdx
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border/60 text-muted-foreground hover:text-foreground")
                }
              >
                {s.label}
              </button>
            ))}
          <button
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? "Collapse chart" : "Expand chart"}
            title={expanded ? "Collapse chart" : "Expand chart"}
            className="rounded border border-border/60 p-1 text-muted-foreground hover:text-foreground"
          >
            {expanded ? (
              <Minimize2 className="w-3 h-3" />
            ) : (
              <Maximize2 className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>
      {!expanded && (
        <p className="mb-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
          Display only · not used by the engine
        </p>
      )}
      {failed ? (
        <p className="text-xs text-muted-foreground">Chart unavailable.</p>
      ) : (
        <div
          className="tradingview-widget-container"
          ref={holder}
          style={{
            height: expanded ? "calc(100vh - 5.5rem)" : chartHeight,
          }}
          aria-label={label}
        />
      )}
    </div>
  );
}

/** Advanced chart for one symbol. */
export function TradingViewChart({ symbol }: { symbol: string }) {
  if (!symbol) return null;
  return (
    <Embed
      kind="advanced-chart"
      label="Live chart — TradingView"
      height={420}
      config={{
        autosize: true,
        symbol,
        interval: "D",
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "en",
        allow_symbol_change: false,
        support_host: "https://www.tradingview.com",
      }}
    />
  );
}

/** Compact market overview / watchlist for many symbols. */
export function TradingViewWatchlist({ symbols }: { symbols: string[] }) {
  const list = symbols.slice(0, 20);
  if (list.length === 0) return null;
  return (
    <Embed
      kind="market-overview"
      label="Live chart — TradingView"
      height={420}
      config={{
        colorTheme: "dark",
        dateRange: "1D",
        showChart: false,
        locale: "en",
        isTransparent: true,
        showSymbolLogo: true,
        width: "100%",
        height: 420,
        support_host: "https://www.tradingview.com",
        tabs: [
          {
            title: "Open signals",
            symbols: list.map((s) => ({ s })),
          },
        ],
      }}
    />
  );
}
