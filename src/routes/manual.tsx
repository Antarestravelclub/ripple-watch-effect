import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { useEffect, type ReactNode } from "react";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/manual")({
  head: () => ({
    meta: [
      { title: "User Manual — The Ripple Effect" },
      {
        name: "description",
        content:
          "How The Ripple Effect works, page by page: event ingestion, exposure mapping, conviction scoring, stops and targets, the scorecard, and a daily routine for getting the most out of it.",
      },
      { property: "og:title", content: "User Manual — The Ripple Effect" },
      {
        property: "og:description",
        content:
          "A full walkthrough of every page, how signals are built and evaluated, and the habits that make the tool most useful.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManualPage,
});

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg font-semibold tracking-tight mb-2">{title}</h2>
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-4">
      <h3 className="text-sm font-semibold text-foreground mb-1.5">{title}</h3>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  );
}

function Term({ children }: { children: ReactNode }) {
  return <span className="text-foreground font-medium">{children}</span>;
}

const CONTENTS = [
  ["what-it-is", "What this tool is (and is not)"],
  ["how-it-works", "How the engine works, end to end"],
  ["pages", "Every tab, explained"],
  ["reading-a-signal", "How to read a signal card"],
  ["conviction", "Conviction, sizing, stops and targets"],
  ["scorecard", "The honest number: alpha vs the index"],
  ["routine", "A daily routine that works"],
  ["success", "Getting the most out of it"],
  ["pitfalls", "Common mistakes"],
  ["glossary", "Glossary"],
  ["faq", "Troubleshooting & FAQ"],
] as const;

function ManualPage() {
  useEffect(() => {
    document.body.classList.add("manual-print");
    return () => document.body.classList.remove("manual-print");
  }, []);

  return (
    <SiteShell>
      <article className="max-w-3xl print-doc">
        <header className="mb-6">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              User Manual
            </h1>
            <button
              type="button"
              onClick={() => window.print()}
              className="no-print shrink-0 inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-card/60 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
              title="Print or save this manual as a PDF"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save as PDF
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Everything the app does, why it does it, and how to use it well.
            Written to be read once from top to bottom, then dipped into.
          </p>
        </header>

        <nav className="rounded-xl border border-border/70 bg-card/60 p-4 mb-8">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Contents
          </div>
          <ol className="grid gap-1 sm:grid-cols-2 text-sm">
            {CONTENTS.map(([id, label], i) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  {i + 1}. {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10">
          <Section id="what-it-is" title="1. What this tool is (and is not)">
            <p>
              The Ripple Effect watches world news and answers one question:{" "}
              <Term>
                when something happens, which listed companies are mechanically
                touched by it, and in which direction?
              </Term>{" "}
              A refinery fire changes fuel spreads. A port closure changes
              shipping rates. A rate decision changes bank margins. Those links
              are physical and contractual, not opinions.
            </p>
            <p>
              It is a <Term>research and awareness tool</Term>. It does not
              predict prices, it does not tell you to buy or sell anything, and
              nothing in it is investment advice. Every idea it produces is
              tracked on paper only — there is no broker connection, and no
              screen in the app can switch a signal to live trading.
            </p>
            <p>
              The value is in the discipline: every idea is written down before
              the outcome is known, with a level that would prove it wrong, and
              then scored honestly against simply holding the index.
            </p>
          </Section>

          <Section id="how-it-works" title="2. How the engine works, end to end">
            <p>Six stages run continuously in the background:</p>
            <ol className="space-y-2 list-decimal pl-5">
              <li>
                <Term>Ingest.</Term> Every 15 minutes the app pulls fresh
                financial news headlines. Duplicates and thin items are dropped.
              </li>
              <li>
                <Term>Interpret.</Term> Each surviving headline is read and
                turned into a structured event: a category, the regions
                involved, why markets care, a ripple strength (Low / Medium /
                High), and the transmission channel — the actual mechanism
                through which the news reaches company earnings.
              </li>
              <li>
                <Term>Map exposure.</Term> The event is mapped to named tickers
                on two sides: <Term>tailwind</Term> (mechanically helped) and{" "}
                <Term>headwind</Term> (mechanically hurt), each with a written
                mechanism. Foreign names are mapped to liquid US-listed lines
                where one exists, so a price actually exists to track.
              </li>
              <li>
                <Term>Score and size.</Term> Each exposure becomes a signal with
                a conviction score out of 100, a stop, a target, a written
                kill-condition, and a suggested position size as a percentage of
                your paper account's starting balance, which you set on the
                Blotter (default $1,000). If the risk-based size falls below the
                symbol's minimum tradable lot, the trade is flagged{" "}
                <Term>undersized at this balance</Term> — it is never rounded up
                silently. You are shown the minimum lot, what it actually risks
                as a percentage of your balance, and you choose to take it at the
                minimum or skip it.
              </li>
              <li>
                <Term>Price.</Term> One batched price request per run covers
                every open ticker plus the benchmark, and stores the result in a
                single shared price table. Every part of the app reads that one
                table, so nothing shows a different number than anything else.
              </li>
              <li>
                <Term>Evaluate.</Term> Every 15 minutes on weekdays, each open
                signal is checked against the day's high and low: target hit,
                stop hit, kill-condition triggered, or time expired. Each
                resolution is logged with prices and a reason — nothing changes
                state silently.
              </li>
            </ol>
            <p>
              Prices are <Term>delayed</Term>, not real-time streaming quotes.
              Treat every number as "roughly now", never as an executable price.
            </p>
          </Section>

          <Section id="pages" title="3. Every tab, explained">
            <p>
              The tabs across the top run left to right in the order you would
              normally use them: read the news, shortlist, check context, record
              trades, then judge results. Each card below covers one tab.
            </p>
            <div className="grid gap-3">
              <Card title="Today — the live feed">
                <p>
                  The home tab. Ripples ordered by strength, then freshness.
                  Anything under 48 hours old sits in the main list; older items
                  collapse into "Older ripples". The status line at the top shows
                  when news last refreshed, with <Term>Refresh now</Term> to pull
                  headlines immediately.
                </p>
                <p>
                  <Term>Market moves</Term> groups the biggest movers under the
                  event that flagged them, so you always see the cause next to
                  the effect. <Term>Feed status</Term> hides the technical
                  price-feed readout and opens itself when a price update fails.
                  The search box filters the feed to a single ticker, and the
                  region chips narrow to the US, EU, Canada, Australia, Japan or
                  China. Clicking a ripple opens its own event page with the full
                  reasoning, both exposure lists and the historical analogues for
                  that kind of event.
                </p>
              </Card>

              <Card title="Setups — ranked swing scenarios">
                <p>
                  The same signals, ranked 0–100 on freshness, event strength
                  and how much of the expected move is still uncaptured. Each
                  setup shows an entry zone, target, invalidation level, risk /
                  reward and an expected timeframe. Ideas where most of the move
                  has already happened are flagged{" "}
                  <Term>priced-in</Term> — that warning is the most useful thing
                  on the page. Use this tab to shortlist; use Today to understand
                  why.
                </p>
              </Card>

              <Card title="Calendar — scheduled catalysts">
                <p>
                  Known dates ahead: central bank meetings, elections, OPEC,
                  major data releases, grouped by date and region. Use it to
                  avoid opening an idea the day before something scheduled can
                  overrule it, and to see which of this week's ripples has a
                  known follow-up event coming.
                </p>
              </Card>

              <Card title="Analyser — paste your own article">
                <p>
                  Paste any article, note or transcript and the same exposure
                  logic runs on it, returning positive and negative exposures
                  with a written mechanism for each. Use it for stories the news
                  feed missed, or to test whether a story you already believe in
                  actually has a mechanical path to company earnings. Results are
                  for reading only — they are not added to the tracked signal
                  set.
                </p>
              </Card>

              <Card title="Tracker — every signal in one table">
                <p>
                  Sortable list of all signals with direction, conviction,
                  status, move since flagging and days open, filterable to open
                  or closed and to your watchlist names. This is where you audit
                  the engine rather than browse it. A live chart panel covers the
                  highest-conviction open names, and any row opens the signal's
                  own page: levels, conviction breakdown, price history since
                  flagging, and the log of every evaluation that touched it.
                </p>
              </Card>

              <Card title="Tickers — the conflict resolver">
                <p>
                  The same company can be helped by one event and hurt by
                  another. This tab rolls every open signal up per ticker into a
                  net stance: <Term>Long</Term>, <Term>Short</Term> or{" "}
                  <Term>Conflicted</Term>. Check it before taking any single
                  idea seriously — a conflicted name means the app is telling
                  you the story is genuinely two-sided.
                </p>
                <p>
                  There is also a search box for any symbol, listed or not
                  flagged by an event. A symbol page shows the current delayed
                  quote, a chart, every event and signal that has ever touched
                  the name, and a <Term>Paper trade</Term> button. Symbols appear
                  as clickable links everywhere in the app, so you can always get
                  from a headline to a single company in one click.
                </p>
              </Card>

              <Card title="Blotter — signals as you actually traded them">
                <p>
                  Sign-in required. Press <Term>Paper trade</Term> on any open
                  signal and the form arrives pre-filled with the signal's own
                  entry, stop, target and risk-based size; change anything you
                  like and the trade is tagged as overridden so the statistics
                  can show whether your tweaks help or hurt. Open trades show
                  unrealised P&amp;L, distance to stop and target in percent and
                  in R, and time in trade. Stops and targets close automatically
                  at the level itself — never at a flattering price — and nothing
                  is ever closed while the price feed is stale. The Scorecard
                  measures signals as issued; the Blotter measures them as
                  traded. Everything stays paper: there is no live execution
                  anywhere in this app.
                </p>
                <p>
                  You can also trade a symbol that has no signal: press{" "}
                  <Term>New paper trade</Term> on the Blotter, or{" "}
                  <Term>Paper trade [symbol]</Term> on any symbol page. Type the
                  symbol, pick long or short, and the form suggests an entry from
                  the latest stored price plus a stop at 1.5× ATR(14), a target at
                  2.0× ATR(14) and a size risking 0.5% of the paper notional. These
                  free-form trades exit on stop, target or your own manual close.
                  The <Term>Stats</Term> tab keeps them apart from signal-based
                  trades, so signal quality stays measurable — switch between{" "}
                  <Term>From signal</Term>, <Term>Manual</Term> and{" "}
                  <Term>All trades</Term> there.
                </p>
                <p>
                  <Term>Starting balance</Term> sets the size of the paper
                  account — default $1,000 — plus your risk per trade and maximum
                  position share. Every suggested size, every percentage and the
                  equity curve are calculated from it, so changing it rescales
                  the whole account view. Below the trade tables,{" "}
                  <Term>Accumulated results</Term> totals the same filtered set
                  of trades you are looking at: realised, unrealised and combined
                  P&amp;L in money and percent, current equity, counts and win
                  rate, average win, average loss, average R and expectancy, best
                  and worst trade, and — if a demo account is mirroring — the
                  slippage between paper and demo fills. Small samples are
                  labelled with <Term>n = X</Term> so you don't read too much
                  into six trades.
                </p>
              </Card>

              <Card title="Scorecard — did any of this work?">
                <p>
                  Paper P/L, win rate, average R, target hits, invalidations,
                  median time to resolution and the headline number: cumulative
                  alpha versus the index. Broken down by event category and
                  conviction band so you can see which kinds of news earn their
                  place. It also shows when evaluation last ran, and lets you
                  view alpha using exactly-priced entries only or all entries
                  including backfilled ones. This tab measures the engine, not
                  your trading — the Blotter does that.
                </p>
              </Card>

              <Card title="Funds as well as companies">
                <p>
                  Some events land on a whole sector, country or commodity
                  rather than one company — a shipping lane closure, an export
                  ban, a rate decision. For those the engine can also raise a
                  signal on an exchange-traded fund, marked with a small{" "}
                  <Term>ETF</Term> tag next to the symbol on the Tracker, the
                  Blotter and your Watchlist. Fund signals go through exactly the
                  same volatility-based stop, target, conviction score and sizing
                  as a company signal, and every list with an instrument filter
                  can be narrowed to stocks only or funds only. The Scorecard
                  shows a stocks-versus-funds split so you can see which route
                  actually earns its keep.
                </p>
                <p>
                  Leveraged and inverse funds are deliberately never suggested.
                  They reset daily, so holding one for several days decays away
                  from the move you were expecting and our stop-and-target model
                  no longer describes them. A bearish view is expressed as a
                  short signal on the plain fund instead.
                </p>
              </Card>

              <Card title="Analogues — what happened last time">
                <p>
                  A library of canonical past events with what actually happened
                  to specific stocks: the role each name played, the size of the
                  move, the time window it took, and whether the move later
                  reverted. Filter by archetype to find the closest match to
                  today's news, and open a case to read the full reaction list.
                </p>
              </Card>

              <Card title="Playbooks — the generalised pattern">
                <p>
                  The same history rolled up per event archetype: typical
                  winners, typical losers, usual magnitude, usual duration and
                  how often the move reverted. Read the playbook for an archetype
                  before trusting today's version of it — it is also where the
                  historical component of the conviction score comes from.
                </p>
              </Card>

              <Card title="Watchlist — your own names">
                <p>
                  Track the tickers you care about, with delayed quotes
                  alongside. Anything on the list is flagged when an event
                  touches it, and the Tracker can be filtered down to watchlist
                  names only.
                </p>
              </Card>

              <Card title="Broker — mirroring to a demo account">
                <p>
                  Sign-in required. This tab can hand qualifying signals to your
                  MetaTrader 5 <Term>demo</Term> account so you can watch them
                  play out on a real platform. Nothing here can touch a funded
                  account: every order is stamped demo, the database refuses any
                  other value, and the helper program exits if the terminal is
                  not a demo login. Mirroring is off until you switch it on, and
                  there is a kill switch that stops everything immediately.
                </p>
                <p>
                  It shows only your own bridge activity: demo account mode,
                  balance, equity, last report, queued instructions and fills.
                  The broker symbol list is shared setup data so share names such
                  as <span className="font-mono">AAPL.US</span> match the right
                  company. Only signals scoring 55 or higher with a size, a stop
                  and a target are ever queued, and each produces at most one
                  opening and one closing order for your account. Paper remains
                  the system of record; the demo account is a mirror, not the
                  truth.
                </p>
              </Card>

              <Card title="Bridge — the six-step setup guide">
                <p>
                  Sign-in required. The numbered, expandable guide that gets
                  MetaTrader 5 talking to the site: why the site never holds your
                  broker login, which bridge to use, the install steps with copy
                  buttons, the site address to allow in MT5, your own private
                  bridge key (masked, with reveal, copy and regenerate) and the
                  demo account number you save once.
                </p>
                <p>
                  Both downloads on this page are already filled in for you — the
                  helper program and a matching config file with your address,
                  your key and your account number. The last panel shows live
                  connection status: green Online, amber Stale or red Offline,
                  DEMO or LIVE, broker server, masked account, balance, equity
                  and last update. MetaTrader 5 has no web connection, so the
                  helper must run on Windows beside a logged-in terminal; on a
                  Mac use a Windows trading VPS, Parallels or VMware, or a spare
                  Windows PC. Keys are per person — regenerating rejects the old
                  one immediately, and nobody can see anyone else's.
                </p>
              </Card>

              <Card title="Manual — this page">
                <p>
                  The full walkthrough, readable top to bottom, with{" "}
                  <Term>Print / Save as PDF</Term> at the top right if you would
                  rather keep it offline.
                </p>
              </Card>

              <Card title="Always on screen">
                <p>
                  <Term>Sector pressure</Term> sits in the side panel on most
                  pages: net directional pressure per sector, drawn as bars
                  spreading out from the centre — right for net tailwind, left
                  for net headwind — so a sector with heavy pressure both ways
                  reads as balanced rather than busy. It is hidden on the Blotter
                  so the trade tables get the full width.
                </p>
                <p>
                  <Term>Sign in</Term> is only needed for the Blotter, Broker and
                  Bridge. Everything else — the feed, setups, tracker, scorecard,
                  history — is readable without an account.
                </p>
              </Card>
            </div>
          </Section>


          <Section id="reading-a-signal" title="4. How to read a signal card">
            <p>Read a card in this order — it is the fastest route to a judgement:</p>
            <ol className="space-y-2 list-decimal pl-5">
              <li>
                <Term>Mechanism first.</Term> If the written mechanism does not
                make sense to you in one sentence, stop. No score rescues a link
                you cannot explain.
              </li>
              <li>
                <Term>Age.</Term> Under 24 hours is where the tool is most
                useful. Past 72 hours, assume the market has read the news too.
              </li>
              <li>
                <Term>Move since flagging.</Term> If most of the expected move
                has already happened, the opportunity was yesterday. That is
                what the priced-in warning means.
              </li>
              <li>
                <Term>Direction and conflicts.</Term> Check the ticker's net
                stance. A conflicted name is a reason to wait, not a reason to
                pick a side.
              </li>
              <li>
                <Term>Levels.</Term> The stop, target and kill-condition tell
                you what would prove the idea wrong. An idea with no such level
                is not an idea.
              </li>
            </ol>
          </Section>

          <Section id="conviction" title="5. Conviction, sizing, stops and targets">
            <p>
              <Term>Conviction (0–100)</Term> is a transparent rubric, not a
              black box, and the breakdown is shown on the card:
            </p>
            <ul className="space-y-1 list-disc pl-5">
              <li>up to 35 points — event severity / strength</li>
              <li>
                up to 30 points — directness: is the company named or the
                sector primary, or is it a second-order ripple?
              </li>
              <li>
                up to 25 points — historical analogue hit rate for this
                archetype and direction
              </li>
              <li>
                up to 10 points — freshness, decaying from full at under 24
                hours to zero at 72 hours
              </li>
            </ul>
            <p>
              Signals scoring under 55 are still recorded and tracked — so the
              scorecard can learn from them — but they are flagged{" "}
              <Term>below threshold</Term> and sized at zero.
            </p>
            <p>
              <Term>Stops and targets are volatility-scaled</Term>, not fixed
              percentages. Each uses ATR(14), the ticker's average daily range:
              a stop 1.5× ATR against the idea, a target 2.0× ATR in favour. A
              quiet utility and a volatile miner therefore get very different
              distances, which is the point. If a ticker has fewer than 15 daily
              bars of history, the signal is rejected outright rather than
              guessed.
            </p>
            <p>
              <Term>Sizing follows risk, not conviction alone.</Term> Position
              size is set so a stop-out costs 0.5% of the paper portfolio,
              capped at 5% of notional, then scaled by conviction: full size at
              80+, three-quarters at 65–79, half at 55–64, zero below 55.
            </p>
            <p>
              <Term>Kill conditions</Term> are checked automatically: a maximum
              days-open time stop, a close beyond a thesis-breaking level, and
              the linked event being superseded or archived.
            </p>
          </Section>

          <Section id="scorecard" title="6. The honest number: alpha vs the index">
            <p>
              Making money in a rising market proves nothing. For every closed
              signal, the app records the benchmark's price at entry and at
              exit, then compares the signal's return with the index's return
              over the identical window. The difference is <Term>alpha</Term>,
              and it is the headline stat.
            </p>
            <p>
              Alpha is broken down by event category and by conviction band, so
              you can see which kinds of events actually earn their place and
              which are noise. If cumulative alpha turns negative, the page says
              so plainly: the strategy is underperforming simply holding the
              index.
            </p>
            <p>
              Entry prices captured at the moment of flagging are labelled{" "}
              <Term>exact</Term>; older ones reconstructed from daily closes are
              labelled <Term>backfilled</Term>. Use the exact-only view when you
              want the cleanest read.
            </p>
          </Section>

          <Section id="routine" title="7. A daily routine that works">
            <ol className="space-y-2 list-decimal pl-5">
              <li>
                <Term>Morning, before the open.</Term> Open{" "}
                <Link to="/" className="text-primary hover:underline">
                  Today
                </Link>{" "}
                and read only the fresh ripples. Ignore anything in "Older
                ripples" unless it is still developing.
              </li>
              <li>
                <Term>Check the calendar.</Term> Note anything scheduled today
                that could overrule a fresh idea.
              </li>
              <li>
                <Term>Shortlist from Setups.</Term> Take the top few, drop
                everything flagged priced-in, and drop anything whose mechanism
                you cannot restate in your own words.
              </li>
              <li>
                <Term>Resolve conflicts.</Term> Run each survivor through
                Tickers. Discard conflicted names.
              </li>
              <li>
                <Term>Read the analogue.</Term> Check the playbook for that
                archetype: typical magnitude, typical duration, and how often it
                reverted.
              </li>
              <li>
                <Term>Write down the levels.</Term> Entry zone, stop, target,
                kill condition, and the size the app suggests. Before the
                outcome, not after.
              </li>
              <li>
                <Term>End of week.</Term> Open the Scorecard. Look only at
                alpha, and at which categories and conviction bands produced it.
                Let that change what you shortlist next week.
              </li>
            </ol>
          </Section>

          <Section id="success" title="8. Getting the most out of it">
            <ul className="space-y-2 list-disc pl-5">
              <li>
                <Term>Trade the mechanism, not the headline.</Term> The
                headline is the trigger; the mechanism is the reason. If you
                cannot name who pays more or earns more, there is no idea.
              </li>
              <li>
                <Term>Freshness is the whole edge.</Term> The tool exists to
                shorten the gap between news and understanding. A three-day-old
                ripple has no gap left.
              </li>
              <li>
                <Term>Prefer high conviction, but respect the sizing.</Term>{" "}
                Below-threshold signals are there for learning, not for
                acting.
              </li>
              <li>
                <Term>Second-order beats obvious.</Term> The named victim is
                usually already moved. The substitute supplier, the alternative
                route, the competing input often is not.
              </li>
              <li>
                <Term>Let the scorecard prune you.</Term> After a few dozen
                closed signals, category alpha tells you which event types you
                should stop looking at.
              </li>
              <li>
                <Term>Check liquidity and borrow yourself.</Term> The app maps
                exposure; it does not verify that a name is tradeable or
                shortable in size.
              </li>
              <li>
                <Term>Use the Analyser for your own reading.</Term> Your best
                edge is a story the feed has not categorised yet.
              </li>
            </ul>
          </Section>

          <Section id="pitfalls" title="9. Common mistakes">
            <ul className="space-y-2 list-disc pl-5">
              <li>
                Treating a signal as a recommendation. It is a mapped exposure
                with a tracked outcome — nothing more.
              </li>
              <li>
                Chasing a big "move since flagging" number. A large favourable
                move means the opportunity has already been taken, not that the
                idea is stronger.
              </li>
              <li>
                Ignoring the conflict flag and picking the side you already
                liked.
              </li>
              <li>
                Reading delayed prices as executable prices, especially outside
                US market hours.
              </li>
              <li>
                Judging performance by win rate. A high win rate with negative
                alpha means the index did the work.
              </li>
              <li>
                Moving a stop after the fact. The evaluation engine will not; you
                should not either.
              </li>
            </ul>
          </Section>

          <Section id="glossary" title="10. Glossary">
            <dl className="space-y-2">
              {[
                ["Ripple", "A world event that reaches company earnings through an identifiable mechanism."],
                ["Ripple strength", "How much market relevance the event carries: Low, Medium or High."],
                ["Transmission channel", "The route from event to earnings — input costs, freight rates, rate margins, supply substitution and so on."],
                ["Tailwind / headwind", "Mechanically helped / mechanically hurt by the event."],
                ["Signal", "One ticker plus one direction, arising from one event, with levels attached."],
                ["Conviction score", "0–100 rubric of severity, directness, historical hit rate and freshness."],
                ["ATR(14)", "Average true range over 14 days — the ticker's typical daily range, used to scale stops and targets."],
                ["Stop", "Level 1.5× ATR against the idea; crossing it closes the signal as stopped."],
                ["Target", "Level 2.0× ATR in favour; reaching it closes the signal as a hit."],
                ["Invalidation / kill condition", "A written, machine-checked condition that ends the idea regardless of price drift."],
                ["R", "Reward measured in units of the risked distance from entry to stop."],
                ["Alpha", "Signal return minus the index return over the identical holding window."],
                ["Priced-in", "More than 60% of the expected move has already happened."],
                ["Conflicted ticker", "Open signals point both long and short on the same name."],
                ["Paper mode", "All positions are hypothetical; no broker is connected anywhere in the app."],
              ].map(([term, def]) => (
                <div key={term}>
                  <dt className="text-foreground font-medium">{term}</dt>
                  <dd>{def}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section id="faq" title="11. Troubleshooting & FAQ">
            <div className="space-y-3">
              <div>
                <p className="text-foreground font-medium">
                  The feed looks old — nothing new for hours.
                </p>
                <p>
                  Press <Term>Refresh now</Term> on Today. If the status line
                  reports an error, news interpretation is temporarily
                  unavailable and the next scheduled run will retry.
                </p>
              </div>
              <div>
                <p className="text-foreground font-medium">
                  Market moves is empty or says no price received.
                </p>
                <p>
                  Open <Term>Feed status</Term> in that panel. It shows the
                  source, the last fetch time, how many symbols were priced and
                  the exact error if the provider refused the request — which is
                  a different problem from the market being closed.
                </p>
              </div>
              <div>
                <p className="text-foreground font-medium">
                  A ticker shows no price at all.
                </p>
                <p>
                  It is likely private, unlisted, or a foreign line with no
                  liquid US-listed equivalent. Those are shown for context but
                  cannot be tracked.
                </p>
              </div>
              <div>
                <p className="text-foreground font-medium">
                  Why does the same company appear on both sides?
                </p>
                <p>
                  Because two different events genuinely pull it in opposite
                  directions. Tickers shows the net stance; conflicted means
                  wait.
                </p>
              </div>
              <div>
                <p className="text-foreground font-medium">
                  Can I connect a broker or go live?
                </p>
                <p>
                  No. Everything is paper by design, and no screen in the app
                  can change that.
                </p>
              </div>
            </div>
          </Section>

          <div className="rounded-xl border border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
            <p>
              <span className="text-foreground font-medium">Reminder.</span> The
              Ripple Effect is an educational research tool. It maps mechanical
              exposure and tracks hypothetical outcomes. It does not predict
              prices and it is not investment advice. Verify liquidity and
              borrow availability before acting on any short idea.
            </p>
          </div>
        </div>
      </article>
    </SiteShell>
  );
}
