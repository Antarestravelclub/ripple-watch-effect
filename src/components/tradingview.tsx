import { useEffect, useRef, useState } from "react";

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
  const json = JSON.stringify(config);

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
    <div ref={ref}>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="text-sm font-semibold tracking-tight">{label}</h2>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Display only · not used by the engine
        </span>
      </div>
      {failed ? (
        <p className="text-xs text-muted-foreground">Chart unavailable.</p>
      ) : (
        <div
          className="tradingview-widget-container"
          ref={holder}
          style={{ height }}
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
