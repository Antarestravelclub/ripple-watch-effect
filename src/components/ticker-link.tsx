import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Clickable stock symbol → the symbol's data page.
 * Rendered as a button (not an anchor) because symbols frequently appear
 * inside cards that are themselves links, and nested anchors are invalid.
 */
export function TickerLink({
  symbol,
  className = "",
  title,
  children,
}: {
  symbol: string;
  className?: string;
  title?: string;
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigate({ to: "/tickers/$symbol", params: { symbol: symbol.toUpperCase() } });
      }}
      title={title ?? `View ${symbol.toUpperCase()} data`}
      className={"hover:text-primary hover:underline transition-colors " + className}
    >
      {children ?? symbol.toUpperCase()}
    </button>
  );
}
