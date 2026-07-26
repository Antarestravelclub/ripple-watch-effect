-- Historical Analogues feature: archetype library of past events + reactions
CREATE TYPE public.event_archetype AS ENUM (
  'armed_conflict','terror_attack','natural_disaster','industrial_accident',
  'regulatory_action','supply_chain_disruption','political_instability',
  'pandemic_health','cyber_attack','commodity_shock'
);
CREATE TYPE public.reaction_direction AS ENUM ('up','down');
CREATE TYPE public.reaction_role AS ENUM (
  'direct_loser','direct_winner','substitute_winner',
  'second_order_winner','second_order_loser'
);

CREATE TABLE public.historical_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  event_date date NOT NULL,
  country text,
  region text,
  archetype public.event_archetype NOT NULL,
  transmission_channel text NOT NULL,
  summary text NOT NULL,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.historical_events TO anon, authenticated;
GRANT ALL ON public.historical_events TO service_role;
ALTER TABLE public.historical_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Historical events are public" ON public.historical_events FOR SELECT USING (true);

CREATE TABLE public.historical_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  historical_event_id uuid NOT NULL REFERENCES public.historical_events(id) ON DELETE CASCADE,
  ticker text NOT NULL,
  company_name text,
  exchange text,
  sector text,
  direction public.reaction_direction NOT NULL,
  role public.reaction_role NOT NULL,
  pct_move numeric NOT NULL,
  window_days integer NOT NULL,
  peak_pct_move numeric,
  reverted boolean NOT NULL DEFAULT false,
  days_to_revert integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX historical_reactions_event_idx ON public.historical_reactions(historical_event_id);
GRANT SELECT ON public.historical_reactions TO anon, authenticated;
GRANT ALL ON public.historical_reactions TO service_role;
ALTER TABLE public.historical_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Historical reactions are public" ON public.historical_reactions FOR SELECT USING (true);

CREATE TABLE public.archetype_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archetype public.event_archetype NOT NULL,
  channel text NOT NULL,
  typical_winners text[] NOT NULL DEFAULT '{}',
  typical_losers text[] NOT NULL DEFAULT '{}',
  typical_magnitude_range text,
  typical_duration text,
  confidence smallint NOT NULL DEFAULT 3 CHECK (confidence BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.archetype_playbooks TO anon, authenticated;
GRANT ALL ON public.archetype_playbooks TO service_role;
ALTER TABLE public.archetype_playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Playbooks are public" ON public.archetype_playbooks FOR SELECT USING (true);

-- ============ SEED: Historical events + reactions ============
WITH ins AS (
  INSERT INTO public.historical_events (title, event_date, country, region, archetype, transmission_channel, summary, source_url) VALUES
  ('Russia invades Ukraine','2022-02-24','Russia/Ukraine','Europe','armed_conflict','Energy prices + defense budgets','Full-scale invasion triggered a sustained European defense re-rating and a sharp but shorter-lived oil spike; Russia-exposed European corporates took heavy write-downs.','https://en.wikipedia.org/wiki/Russian_invasion_of_Ukraine'),
  ('Fukushima nuclear accident','2011-03-11','Japan','Asia','natural_disaster','Regulatory ban risk on nuclear power','Tōhoku earthquake and tsunami triggered a nuclear meltdown; Japanese equities gapped down, uranium miners fell globally, LNG and renewables re-rated higher.','https://en.wikipedia.org/wiki/Fukushima_nuclear_accident'),
  ('Deepwater Horizon oil spill','2010-04-20','United States','Americas','industrial_accident','Single-issuer liability + offshore moratorium','BP rig explosion in the Gulf of Mexico; liability and a drilling moratorium hit offshore names while onshore US shale producers were relative beneficiaries.','https://en.wikipedia.org/wiki/Deepwater_Horizon_oil_spill'),
  ('Hamas attack on Israel','2023-10-07','Israel','Middle East','terror_attack','Defense budgets + oil risk premium','Cross-border attack triggered a first-session pop in US defense primes and a modest oil bid; Israeli equities and shekel weakened; foreign airlines suspending Tel Aviv routes underperformed.','https://en.wikipedia.org/wiki/2023_Hamas-led_attack_on_Israel'),
  ('Boeing 737 MAX-9 door plug blowout','2024-01-05','United States','Americas','regulatory_action','Single-issuer regulatory grounding','Alaska Airlines flight door plug failure led FAA to ground MAX-9s; Boeing and Spirit AeroSystems sold off, Airbus rose on share-shift logic — same shape as the 2019 MAX grounding.','https://en.wikipedia.org/wiki/Alaska_Airlines_Flight_1282'),
  ('Ever Given blocks the Suez Canal','2021-03-23','Egypt','Middle East','supply_chain_disruption','Freight rates + tanker day-rates','Container ship grounded for 6 days; tanker owners and container lines rallied on freight rate expectations, retailers with thin inventory softened.','https://en.wikipedia.org/wiki/2021_Suez_Canal_obstruction'),
  ('Kahramanmaraş earthquake (Turkey)','2023-02-06','Turkey','Europe','natural_disaster','Rebuild demand + insurance liability','Magnitude 7.8 earthquake; Borsa Istanbul halted for five days, cement and construction names rallied on reopening, insurers weakened.','https://en.wikipedia.org/wiki/2023_Turkey%E2%80%93Syria_earthquake'),
  ('Niger military coup','2023-07-26','Niger','Africa','political_instability','Uranium supply concentration','Coup in a top-5 uranium producer; uranium spot and listed uranium proxies bid on supply-risk premium.','https://en.wikipedia.org/wiki/2023_Nigerien_coup_d%27%C3%A9tat'),
  ('Taiwan earthquake (Hualien)','2024-04-03','Taiwan','Asia','natural_disaster','Semiconductor supply / DRAM pricing','Magnitude 7.4 quake near TSMC fabs; TSM dipped briefly, memory names rose on expected DRAM price firming.','https://en.wikipedia.org/wiki/2024_Hualien_earthquake'),
  ('Thailand floods hit HDD supply','2011-10-01','Thailand','Asia','supply_chain_disruption','Substitute producer shift (HDD supply)','Floods inundated Western Digital HDD plants; WDC fell, Seagate rose as relative winner, PC OEMs took margin hits.','https://en.wikipedia.org/wiki/2011_Thailand_floods')
  RETURNING id, title
)
INSERT INTO public.historical_reactions (historical_event_id, ticker, company_name, exchange, sector, direction, role, pct_move, window_days, peak_pct_move, reverted, days_to_revert, notes)
SELECT ins.id, r.ticker, r.company_name, r.exchange, r.sector, r.direction::public.reaction_direction, r.role::public.reaction_role, r.pct_move, r.window_days, r.peak_pct_move, r.reverted, r.days_to_revert, r.notes
FROM ins JOIN (VALUES
  -- Russia invades Ukraine
  ('Russia invades Ukraine','RHM.DE','Rheinmetall AG','XETRA','Industrials','up','direct_winner',100,14,120,false,NULL,'Defense re-rating; move has broadly held.'),
  ('Russia invades Ukraine','BA.L','BAE Systems','LSE','Industrials','up','direct_winner',25,14,30,false,NULL,'European defense budget expectations.'),
  ('Russia invades Ukraine','BZ=F','Brent crude (front-month)','ICE','Energy','up','direct_winner',43,11,43,true,120,'Spot $97→$139 by 7 Mar; faded within ~3 months.'),
  ('Russia invades Ukraine','RNO.PA','Renault SA','Euronext Paris','Consumer Discretionary','down','direct_loser',-50,90,-50,false,NULL,'AvtoVAZ write-down.'),
  ('Russia invades Ukraine','GLE.PA','Société Générale','Euronext Paris','Financials','down','direct_loser',-45,60,-45,false,NULL,'Rosbank exposure and eventual divestment loss.'),
  ('Russia invades Ukraine','LUV','Southwest Airlines','NYSE','Industrials','down','second_order_loser',-12,30,-15,true,180,'Jet fuel pass-through.'),
  -- Fukushima
  ('Fukushima nuclear accident','^N225','Nikkei 225','TSE','Index','down','direct_loser',-16,2,-18,true,180,'Two-session gap down.'),
  ('Fukushima nuclear accident','9501.T','TEPCO','TSE','Utilities','down','direct_loser',-80,21,-90,false,NULL,'Operator of the plant; effectively state-supported afterward.'),
  ('Fukushima nuclear accident','CCJ','Cameco','NYSE','Energy','down','direct_loser',-25,30,-30,true,720,'Uranium miner; sector took years to recover.'),
  ('Fukushima nuclear accident','TAN','Solar ETF','NYSEARCA','Energy','up','substitute_winner',18,60,22,false,NULL,'Nuclear-substitute demand narrative.'),
  ('Fukushima nuclear accident','LNG','Cheniere Energy','NYSE','Energy','up','substitute_winner',15,90,25,false,NULL,'LNG import demand from Japan.'),
  -- Deepwater Horizon
  ('Deepwater Horizon oil spill','BP','BP plc','NYSE','Energy','down','direct_loser',-54,60,-54,true,540,'Liability + dividend suspension.'),
  ('Deepwater Horizon oil spill','RIG','Transocean','NYSE','Energy','down','direct_loser',-45,60,-50,false,NULL,'Rig operator; deepwater moratorium.'),
  ('Deepwater Horizon oil spill','APC','Anadarko Petroleum','NYSE','Energy','down','direct_loser',-40,60,-45,true,365,'Minority stake in Macondo well.'),
  ('Deepwater Horizon oil spill','EOG','EOG Resources','NYSE','Energy','up','substitute_winner',10,120,15,false,NULL,'Onshore US shale relative winner.'),
  -- Hamas attack
  ('Hamas attack on Israel','NOC','Northrop Grumman','NYSE','Industrials','up','direct_winner',11,1,14,true,90,'First-session pop; partially retraced.'),
  ('Hamas attack on Israel','LMT','Lockheed Martin','NYSE','Industrials','up','direct_winner',9,1,12,true,90,'Defense prime re-rating.'),
  ('Hamas attack on Israel','CL=F','WTI crude (front-month)','NYMEX','Energy','up','direct_winner',4,1,6,true,14,'Risk premium.'),
  ('Hamas attack on Israel','TA35.TA','TA-35 Index','TASE','Index','down','direct_loser',-7,5,-8,true,120,'Israeli benchmark.'),
  -- Boeing MAX-9
  ('Boeing 737 MAX-9 door plug blowout','BA','Boeing','NYSE','Industrials','down','direct_loser',-8,1,-20,false,NULL,'Single-session drop on grounding; longer-term overhang.'),
  ('Boeing 737 MAX-9 door plug blowout','SPR','Spirit AeroSystems','NYSE','Industrials','down','direct_loser',-11,1,-30,false,NULL,'Fuselage supplier; eventually reabsorbed by Boeing.'),
  ('Boeing 737 MAX-9 door plug blowout','EADSY','Airbus','OTC','Industrials','up','substitute_winner',3,5,8,false,NULL,'Share-shift logic.'),
  -- Ever Given
  ('Ever Given blocks the Suez Canal','FRO','Frontline','NYSE','Energy','up','direct_winner',7,3,10,true,30,'Tanker day-rate expectations.'),
  ('Ever Given blocks the Suez Canal','EURN','Euronav','NYSE','Energy','up','direct_winner',6,3,8,true,30,'Tanker owner.'),
  ('Ever Given blocks the Suez Canal','DHT','DHT Holdings','NYSE','Energy','up','direct_winner',6,3,8,true,30,'VLCC tanker owner.'),
  ('Ever Given blocks the Suez Canal','BZ=F','Brent crude (front-month)','ICE','Energy','up','second_order_winner',6,1,6,true,7,'Freight-driven bid.'),
  -- Turkey earthquake
  ('Kahramanmaraş earthquake (Turkey)','XU100.IS','BIST 100','Borsa Istanbul','Index','down','direct_loser',-16,3,-16,true,60,'Halted for five sessions after initial fall.'),
  ('Kahramanmaraş earthquake (Turkey)','CIMSA.IS','Çimsa Çimento','Borsa Istanbul','Materials','up','substitute_winner',30,30,45,false,NULL,'Rebuild demand.'),
  ('Kahramanmaraş earthquake (Turkey)','AKCNS.IS','Akçansa Çimento','Borsa Istanbul','Materials','up','substitute_winner',25,30,40,false,NULL,'Cement demand.'),
  ('Kahramanmaraş earthquake (Turkey)','AKGRT.IS','Aksigorta','Borsa Istanbul','Financials','down','direct_loser',-12,30,-18,true,180,'Insurance claims.'),
  -- Niger coup
  ('Niger military coup','YCA.L','Yellow Cake plc','LSE','Energy','up','direct_winner',40,120,55,false,NULL,'Uranium proxy.'),
  ('Niger military coup','CCJ','Cameco','NYSE','Energy','up','substitute_winner',20,120,30,false,NULL,'Non-Niger uranium producer.'),
  ('Niger military coup','URA','Global X Uranium ETF','NYSEARCA','Energy','up','direct_winner',25,120,35,false,NULL,'Uranium equity basket.'),
  -- Taiwan earthquake
  ('Taiwan earthquake (Hualien)','TSM','TSMC','NYSE','Information Technology','down','direct_loser',-1,1,-2,true,3,'Brief dip; fabs resumed quickly.'),
  ('Taiwan earthquake (Hualien)','MU','Micron Technology','NASDAQ','Information Technology','up','substitute_winner',2,3,4,false,NULL,'DRAM pricing firmed.'),
  ('Taiwan earthquake (Hualien)','2408.TW','Nanya Technology','TWSE','Information Technology','up','substitute_winner',3,3,5,false,NULL,'Memory supply expectations.'),
  -- Thailand floods
  ('Thailand floods hit HDD supply','WDC','Western Digital','NASDAQ','Information Technology','down','direct_loser',-40,60,-45,true,270,'Flooded HDD plants.'),
  ('Thailand floods hit HDD supply','STX','Seagate Technology','NASDAQ','Information Technology','up','substitute_winner',30,60,40,false,NULL,'Relative winner; unaffected capacity.'),
  ('Thailand floods hit HDD supply','DELL','Dell','NYSE','Information Technology','down','second_order_loser',-8,90,-12,true,180,'PC OEM margin hit.'),
  ('Thailand floods hit HDD supply','HPQ','HP Inc.','NYSE','Information Technology','down','second_order_loser',-10,90,-14,true,180,'PC OEM margin hit.')
) AS r(evt_title, ticker, company_name, exchange, sector, direction, role, pct_move, window_days, peak_pct_move, reverted, days_to_revert, notes)
ON ins.title = r.evt_title;

-- Archetype playbooks
INSERT INTO public.archetype_playbooks (archetype, channel, typical_winners, typical_losers, typical_magnitude_range, typical_duration, confidence) VALUES
('armed_conflict','Energy prices + defense budgets',ARRAY['Defense primes','Oil majors','LNG exporters'],ARRAY['European airlines','Russia/Ukraine-exposed corporates','EM currencies'],'Defense +20–100% / Oil +20–40%','Defense: persistent. Oil spike: ~1–3 months.',4),
('terror_attack','Defense budgets + oil risk premium',ARRAY['Defense primes','Oil futures'],ARRAY['Local equity index','Tourism / regional airlines'],'Defense +5–15% on session / Oil +2–6%','Days to weeks; often partially retraces.',3),
('natural_disaster','Rebuild demand + regulatory ban risk',ARRAY['Cement / construction','Substitute producers','Reinsurers (later)'],ARRAY['Local utility operator','Insurers (near-term)','Local index'],'Losers −15–80% / Winners +15–45%','Weeks for shock; months for rebuild trade.',3),
('industrial_accident','Single-issuer liability + moratorium',ARRAY['Substitute / onshore producers'],ARRAY['Operator','Contractor / rig owner','Minority partners'],'Loser −30–60% / Winner +5–15%','6–18 months to normalize.',4),
('regulatory_action','Single-issuer regulatory grounding / ban',ARRAY['Competing manufacturer','Substitute product'],ARRAY['Named issuer','Direct suppliers'],'Loser −5–20% first session','Days for shock; overhang for quarters.',4),
('supply_chain_disruption','Freight rates / substitute producer shift',ARRAY['Tanker / container owners','Unaffected substitute producers'],ARRAY['Retailers with thin inventory','Directly affected producers'],'±5–40%','Days to weeks; often reverts.',3),
('political_instability','Commodity supply concentration',ARRAY['Non-region commodity producers','Commodity proxies'],ARRAY['Local equities','Miners with in-country assets'],'Winners +20–55%','Weeks to months.',3),
('pandemic_health','Mobility collapse + healthcare demand',ARRAY['Vaccine / therapeutics','Home-delivery / cloud'],ARRAY['Airlines','Hospitality','Energy demand'],'±30–70%','Months to years.',3),
('cyber_attack','Single-issuer operational disruption',ARRAY['Cybersecurity vendors'],ARRAY['Named issuer','Direct customers'],'Loser −5–25%','Weeks.',3),
('commodity_shock','Input cost pass-through',ARRAY['Upstream producer','Substitute commodity'],ARRAY['Heavy input consumers','Airlines / chemicals'],'±20–60%','1–3 months.',3);