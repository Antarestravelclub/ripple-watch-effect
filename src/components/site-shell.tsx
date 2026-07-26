import { Link, useRouterState } from "@tanstack/react-router";
import { RippleLogo } from "./ripple-logo";
import type { ReactNode } from "react";
import { SectorHeat } from "./sector-heat";
import { EVENTS } from "@/lib/ripple-data";

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === to || (to !== "/" && pathname.startsWith(to));
  return (
    <Link
      to={to}
      className={
        "text-sm px-3 py-1.5 rounded-md transition-colors " +
        (active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-accent")
      }
    >
      {children}
    </Link>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background gradient-radial">
      <header className="sticky top-0 z-30 border-b border-border/60 backdrop-blur bg-background/70">
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <RippleLogo />
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/">Today</NavLink>
            <NavLink to="/watchlist">Watchlist</NavLink>
          </nav>
        </div>
      </header>

      <div className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <main className="min-w-0">{children}</main>
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <SectorHeat events={EVENTS} />
          </div>
        </aside>
      </div>

      <footer className="border-t border-border/60 mt-8">
        <div className="mx-auto max-w-7xl px-4 py-5 text-xs text-muted-foreground text-center">
          The Ripple Effect provides educational information about market
          exposure, not investment advice or price predictions.
        </div>
      </footer>
    </div>
  );
}
