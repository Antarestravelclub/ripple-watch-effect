# Market Ripple Tracker

Great name. Here’s a prompt you can paste straight into Lovable — it builds the exposure-mapping version we discussed, structured so Lovable gives you a working shell you can wire real data into later:



Build a web app called “The Ripple Effect” — a market awareness tool that maps daily world events to the stocks and sectors they mechanically affect. It does NOT predict prices or give investment advice; it shows exposure and historical context.

Design: Dark, modern financial dashboard feel. Deep navy background, subtle ripple/concentric-circle motif in the branding. Clean sans-serif type. Accent colors: teal for positive exposure, amber for negative. Fully responsive.

Pages & features:

Today’s Ripples (home): A feed of event cards, newest first. Each card shows: headline, event category badge (Geopolitical, Central Bank, Commodity, Regulation, Tech, Weather/Disaster), a one-line “why markets care” summary, and a ripple strength indicator (Low / Medium / High market relevance).

Event detail view: Clicking a card expands it to show an “Exposure Map” — two columns: “Likely Tailwind” and “Likely Headwind,” each listing affected sectors with 2–4 example tickers and a one-sentence mechanism (e.g., “Oil supply disruption → refiners’ input costs rise”). Below that, a “Historical Echoes” section listing 2–3 similar past events with what sectors did in the following 1, 5, and 30 days.

My Watchlist: Users can add tickers. The feed then flags any event whose exposure map touches a watchlist ticker with a “Ripples your holdings” badge. Store watchlist in app state for now.

Sector Heat panel (sidebar): A simple grid of ~11 GICS sectors, colored by how many of today’s events touch each one.

Data: Use realistic placeholder/mock data for now (8–10 sample events with full exposure maps), structured in a clean JSON format so a real news API and market data API can replace it later. Keep the data layer in its own module.

Footer disclaimer on every page: “The Ripple Effect provides educational information about market exposure, not investment advice or price predictions.”



Two tips for working in Lovable: build this first prompt as-is before asking for changes (it iterates better on a working base), and when you’re ready for real data, ask it to integrate a news API via Supabase edge functions so your API keys stay server-side. 

Let’s make this app with a modern look to it, easy function, ability, and clarity when you’re looking for the stocks that will be used

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ripple-watch-effect.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ebd71dcb-9e52-4ab6-96ed-ef03d879e94e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
