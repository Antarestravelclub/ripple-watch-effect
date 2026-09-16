import { Link, useRouterState } from "@tanstack/react-router";
import { RippleLogo } from "./ripple-logo";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
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
        "text-[13px] px-2 py-1 rounded-md transition-colors shrink-0 whitespace-nowrap " +
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [hidden, setHidden] = useState(false);
  // Blotter needs the full page width for its trade tables.
  const showSidebar = !pathname.startsWith("/blotter");

  // Slide the header out of the way when scrolling down; bring it back on scroll up.
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 80) setHidden(false);
      else if (y > lastY + 4) setHidden(true);
      else if (y < lastY - 4) setHidden(false);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background gradient-radial">
      <header
        className={
          "sticky top-0 z-30 px-3 pt-3 transition-all duration-200 " +
          (hidden ? "-translate-y-[130%] opacity-0 pointer-events-none" : "")
        }
      >
        <div className="mx-auto max-w-7xl rounded-2xl border border-border/60 backdrop-blur-md bg-background/75 shadow-lg shadow-black/25">
          <div className="px-3 py-1.5 flex items-center gap-2 flex-wrap">
            <Link to="/" className="flex items-center shrink-0">
              <RippleLogo />
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden sm:block"><DataRefreshStamp /></span>
              <AccountMenu />
            </div>
            <nav className="order-last w-full flex items-center gap-0.5 flex-nowrap overflow-x-auto min-w-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <NavLink to="/">Today</NavLink>
              <NavLink to="/setups">Setups</NavLink>
              <NavLink to="/calendar">Calendar</NavLink>
              <NavLink to="/analyze">Analyser</NavLink>

              <NavLink to="/tracker">Tracker</NavLink>
              <NavLink to="/tickers">Tickers</NavLink>
              <NavLink to="/blotter">Trade Log</NavLink>

              <NavLink to="/scorecard">Scorecard</NavLink>
              <NavLink to="/analogues">Analogues</NavLink>
              <NavLink to="/playbooks">Playbooks</NavLink>
              <NavLink to="/watchlist">Watchlist</NavLink>
              <NavLink to="/broker">Broker</NavLink>
              <NavLink to="/bridge">Bridge</NavLink>
              <NavLink to="/manual">Manual</NavLink>
            </nav>
          </div>
        </div>
      </header>

      <div
        className={
          "flex-1 mx-auto w-full max-w-7xl px-4 py-6 grid gap-6 " +
          (showSidebar ? "grid-cols-1 lg:grid-cols-[1fr_280px]" : "grid-cols-1")
        }
      >
        <main className="min-w-0">{children}</main>
        {showSidebar && (
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <SectorHeat events={events} />
            </div>
          </aside>
        )}
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
