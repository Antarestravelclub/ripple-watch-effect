// Scheduled world events calendar. Static schedule of recurring, market-relevant
// global events. Dates are the officially announced or conventional dates.

import type { RegionCode } from "./ripple-regions";

export type CalendarCategory =
  | "Central Bank"
  | "Data Release"
  | "Commodity"
  | "Politics"
  | "Earnings"
  | "Summit";

export interface WorldEvent {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  title: string;
  region: RegionCode;
  category: CalendarCategory;
  why: string;
  watch: string[]; // tickers / proxies commonly reacting
}

export const CALENDAR_CATEGORIES: CalendarCategory[] = [
  "Central Bank",
  "Data Release",
  "Commodity",
  "Politics",
  "Earnings",
  "Summit",
];

export const WORLD_EVENTS: WorldEvent[] = [
  {
    id: "cal-001",
    date: "2026-08-04",
    title: "RBA cash rate decision",
    region: "AU",
    category: "Central Bank",
    why: "Sets the tone for AUD, Australian banks and rate-sensitive housing exposure.",
    watch: ["EWA", "BHP", "RIO"],
  },
  {
    id: "cal-002",
    date: "2026-08-06",
    title: "US CPI release",
    region: "US",
    category: "Data Release",
    why: "Primary input to the Fed path; repricing hits duration-sensitive equities first.",
    watch: ["TLT", "XLF", "QQQ"],
  },
  {
    id: "cal-003",
    date: "2026-08-11",
    title: "OPEC+ monthly monitoring committee",
    region: "GLOBAL",
    category: "Commodity",
    why: "Quota guidance moves crude, which flows through energy, refiners and airlines.",
    watch: ["XOM", "CVX", "DAL"],
  },
  {
    id: "cal-004",
    date: "2026-08-13",
    title: "China industrial production & retail sales",
    region: "CN",
    category: "Data Release",
    why: "Chinese demand impulse drives industrial metals and luxury exporters.",
    watch: ["FCX", "RIO", "BHP"],
  },
  {
    id: "cal-005",
    date: "2026-08-18",
    title: "Bank of Japan policy statement",
    region: "JP",
    category: "Central Bank",
    why: "Yen path and yield-curve policy affect global carry trades and Japanese exporters.",
    watch: ["EWJ", "TM", "SONY"],
  },
  {
    id: "cal-006",
    date: "2026-08-20",
    title: "Bank of Canada rate decision",
    region: "CA",
    category: "Central Bank",
    why: "Drives CAD, Canadian banks and housing-linked credit exposure.",
    watch: ["EWC", "RY", "TD"],
  },
  {
    id: "cal-007",
    date: "2026-08-27",
    title: "Jackson Hole symposium",
    region: "US",
    category: "Summit",
    why: "Policy signalling venue; historically a volatility catalyst across risk assets.",
    watch: ["SPY", "TLT", "GLD"],
  },
  {
    id: "cal-008",
    date: "2026-09-03",
    title: "ECB Governing Council decision",
    region: "EU",
    category: "Central Bank",
    why: "Euro-area rate path reprices European banks, real estate and exporters.",
    watch: ["SAP", "DB", "VNA"],
  },
  {
    id: "cal-009",
    date: "2026-09-16",
    title: "FOMC decision & dot plot",
    region: "US",
    category: "Central Bank",
    why: "Rate path expectations reset valuations for banks, REITs and long-duration tech.",
    watch: ["JPM", "O", "NVDA"],
  },
  {
    id: "cal-010",
    date: "2026-09-22",
    title: "UN General Assembly high-level week",
    region: "GLOBAL",
    category: "Politics",
    why: "Sanctions, conflict and climate policy headlines cluster around the session.",
    watch: ["LMT", "RTX", "XOM"],
  },
  {
    id: "cal-011",
    date: "2026-10-01",
    title: "OPEC+ ministerial meeting",
    region: "GLOBAL",
    category: "Commodity",
    why: "Production decisions are the single largest scheduled crude catalyst.",
    watch: ["OXY", "SLB", "UAL"],
  },
  {
    id: "cal-012",
    date: "2026-10-14",
    title: "US big-bank Q3 earnings kick-off",
    region: "US",
    category: "Earnings",
    why: "Credit quality and net interest margin commentary sets the tone for financials.",
    watch: ["JPM", "BAC", "WFC"],
  },
  {
    id: "cal-013",
    date: "2026-10-20",
    title: "China Q3 GDP",
    region: "CN",
    category: "Data Release",
    why: "Confirms or breaks the demand narrative for commodities and shipping.",
    watch: ["FCX", "BHP", "LVMH"],
  },
  {
    id: "cal-014",
    date: "2026-11-03",
    title: "US midterm-cycle state elections",
    region: "US",
    category: "Politics",
    why: "Policy expectations shift for energy, healthcare and defence spending.",
    watch: ["LMT", "UNH", "XOM"],
  },
  {
    id: "cal-015",
    date: "2026-11-09",
    title: "COP climate summit opens",
    region: "GLOBAL",
    category: "Summit",
    why: "Emissions policy signalling affects utilities, renewables and heavy industry.",
    watch: ["NEE", "FSLR", "VMC"],
  },
  {
    id: "cal-016",
    date: "2026-12-09",
    title: "EU Council summit",
    region: "EU",
    category: "Politics",
    why: "Fiscal, energy and trade decisions ripple into European industrials.",
    watch: ["SAP", "BNP", "VNA"],
  },
];

export function eventsInMonth(list: WorldEvent[], year: number, month: number) {
  return list.filter((e) => {
    const d = new Date(e.date + "T00:00:00Z");
    return d.getUTCFullYear() === year && d.getUTCMonth() === month;
  });
}
