import { Link, useRouterState } from "@tanstack/react-router";
import { RippleLogo } from "./ripple-logo";
import type { ReactNode } from "react";
import { SectorHeat } from "./sector-heat";
import { useLiveEvents } from "@/hooks/use-live-events";
import { OperonBadge } from "./operon-badge";
import { DataRefreshStamp } from "./data-refresh-stamp";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

/** Session-driven sign-in affordance, so a successful login is visible. */
function AccountMenu() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  if (loading) return null;
  if (!user) {
    return (
      <Link
        to="/auth"
        className="text-sm px-3 py-1.5 rounded-md border border-border/70 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        Sign in
      </Link>
    );
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden md:inline text-[11px] text-muted-foreground max-w-[160px] truncate">
        {user.email}
      </span>
      <button
        type="button"
        onClick={signOut}
        className="text-sm px-3 py-1.5 rounded-md border border-border/70 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}

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
  const { events } = useLiveEvents();
  return (
    <div className="min-h-screen flex flex-col bg-background gradient-radial">
      <header className="sticky top-0 z-30 border-b border-border/60 backdrop-blur bg-background/70">
        <div className="mx-auto max-w-7xl px-4 min-h-14 py-1.5 flex items-center justify-between gap-3 flex-wrap">
          <Link to="/" className="flex items-center">
            <RippleLogo />
          </Link>
          <nav className="flex items-center gap-1 flex-wrap">
            <NavLink to="/">Today</NavLink>
            <NavLink to="/setups">Setups</NavLink>
            <NavLink to="/calendar">Calendar</NavLink>
            <NavLink to="/analyze">Analyser</NavLink>

            <NavLink to="/tracker">Tracker</NavLink>
            <NavLink to="/tickers">Tickers</NavLink>
            <NavLink to="/blotter">Blotter</NavLink>

            <NavLink to="/scorecard">Scorecard</NavLink>
            <NavLink to="/analogues">Analogues</NavLink>
            <NavLink to="/playbooks">Playbooks</NavLink>
            <NavLink to="/watchlist">Watchlist</NavLink>
            <NavLink to="/broker">Broker</NavLink>
            <NavLink to="/bridge">Bridge</NavLink>
            <NavLink to="/manual">Manual</NavLink>
          </nav>
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-1.5 flex items-center justify-end gap-3">
          <DataRefreshStamp />
          <AccountMenu />
        </div>
      </header>

      <div className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <main className="min-w-0">{children}</main>
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <SectorHeat events={events} />
          </div>
        </aside>
      </div>

      <footer className="border-t border-border/60 mt-8">
        <div className="mx-auto max-w-7xl px-4 py-5 text-[11px] text-muted-foreground text-center space-y-3">
          <p>
            The Ripple Effect is an <span className="text-foreground">educational research tool</span>,
            not investment advice. Signals shown are hypothetical historical correlations —
            never a recommendation to buy or sell.
          </p>
          <p>
            New here?{" "}
            <Link to="/manual" className="text-primary hover:underline">
              Read the user manual
            </Link>
            .
          </p>
          <p className="opacity-70">Prices are delayed. Past behaviour does not predict future prices.</p>
          <p className="opacity-70">
            Signals reflect mechanical exposure mapping, not predictions. Verify liquidity and
            borrow availability before acting on any short idea.
          </p>
          <div className="pt-1 flex justify-center">
            <OperonBadge />
          </div>
        </div>
      </footer>
    </div>
  );
}
