-- 1. Instrument type on signals
CREATE TYPE public.instrument_type AS ENUM ('stock', 'etf');

ALTER TABLE public.signals
  ADD COLUMN instrument_type public.instrument_type NOT NULL DEFAULT 'stock';

UPDATE public.signals SET instrument_type = 'stock' WHERE instrument_type IS NULL;

-- 2. ETF reference table
CREATE TYPE public.etf_category AS ENUM ('sector','country','commodity','broad_market','bond','currency');

CREATE TABLE public.etf_reference (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL UNIQUE,
  name text NOT NULL,
  category public.etf_category NOT NULL,
  theme_keywords text[] NOT NULL DEFAULT '{}',
  leveraged boolean NOT NULL DEFAULT false,
  inverse boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  feed_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.etf_reference TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etf_reference TO authenticated;
GRANT ALL ON public.etf_reference TO service_role;

ALTER TABLE public.etf_reference ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ETF reference"
  ON public.etf_reference FOR SELECT USING (true);

CREATE POLICY "Admins can insert ETF reference"
  ON public.etf_reference FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update ETF reference"
  ON public.etf_reference FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete ETF reference"
  ON public.etf_reference FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_etf_reference_updated_at
  BEFORE UPDATE ON public.etf_reference
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_etf_reference_active ON public.etf_reference (active) WHERE active;

-- 3. Seed set (commodity / geopolitics tilt)
INSERT INTO public.etf_reference (ticker, name, category, theme_keywords, leveraged, inverse) VALUES
-- Commodity
('USO','United States Oil Fund','commodity','{oil,crude,wti,opec,hormuz,refinery,"energy prices","supply disruption"}',false,false),
('BNO','United States Brent Oil Fund','commodity','{brent,oil,crude,opec,"middle east","sea lane"}',false,false),
('UNG','United States Natural Gas Fund','commodity','{"natural gas",lng,pipeline,heating,"gas supply",russia}',false,false),
('GLD','SPDR Gold Shares','commodity','{gold,"safe haven","central bank",inflation,war,"currency debasement"}',false,false),
('SLV','iShares Silver Trust','commodity','{silver,"industrial metal",solar,inflation}',false,false),
('PPLT','abrdn Physical Platinum Shares','commodity','{platinum,"south africa",autocatalyst,mining}',false,false),
('PALL','abrdn Physical Palladium Shares','commodity','{palladium,russia,autocatalyst,"export controls"}',false,false),
('CPER','United States Copper Index Fund','commodity','{copper,chile,peru,"electrification",grid,mining}',false,false),
('DBA','Invesco DB Agriculture Fund','commodity','{agriculture,wheat,corn,soybeans,drought,"food security",fertilizer}',false,false),
('WEAT','Teucrium Wheat Fund','commodity','{wheat,ukraine,"black sea",grain,drought,"food prices"}',false,false),
('CORN','Teucrium Corn Fund','commodity','{corn,ethanol,drought,"grain exports"}',false,false),
('DBC','Invesco DB Commodity Index Tracking Fund','commodity','{commodities,"broad commodity",inflation,"supply shock"}',false,false),
('URA','Global X Uranium ETF','commodity','{uranium,nuclear,"kazakhstan",niger,"enrichment","power supply"}',false,false),
('LIT','Global X Lithium & Battery Tech ETF','commodity','{lithium,batteries,"electric vehicles",chile,australia}',false,false),
('REMX','VanEck Rare Earth & Strategic Metals ETF','commodity','{"rare earths",china,"export controls",magnets,"critical minerals"}',false,false),
('WOOD','iShares Global Timber & Forestry ETF','commodity','{timber,lumber,wildfire,housing,"paper packaging"}',false,false),
-- Sector
('XLE','Energy Select Sector SPDR Fund','sector','{oil,energy,refiners,drillers,opec,"crude prices"}',false,false),
('XOP','SPDR S&P Oil & Gas Exploration & Production ETF','sector','{"oil exploration",shale,drilling,"upstream energy"}',false,false),
('OIH','VanEck Oil Services ETF','sector','{"oil services",drilling,offshore,rigs}',false,false),
('TAN','Invesco Solar ETF','sector','{solar,"renewables",polysilicon,tariffs,"clean energy"}',false,false),
('ICLN','iShares Global Clean Energy ETF','sector','{"clean energy",wind,solar,"energy transition",subsidies}',false,false),
('XME','SPDR S&P Metals & Mining ETF','sector','{mining,steel,copper,"metal prices",tariffs}',false,false),
('SLX','VanEck Steel ETF','sector','{steel,"iron ore",tariffs,"industrial demand"}',false,false),
('BOAT','SonicShares Global Shipping ETF','sector','{shipping,tankers,"red sea","suez canal","freight rates","sea lane"}',false,false),
('SEA','US Global Sea to Sky Cargo ETF','sector','{shipping,cargo,"air freight",logistics,"supply chain"}',false,false),
('IYT','iShares U.S. Transportation ETF','sector','{transport,railroads,trucking,airlines,"fuel costs",logistics}',false,false),
('JETS','U.S. Global Jets ETF','sector','{airlines,"jet fuel",travel,airspace,"flight bans"}',false,false),
('ITA','iShares U.S. Aerospace & Defense ETF','sector','{defense,defence,military,"arms spending",war,missiles}',false,false),
('XAR','SPDR S&P Aerospace & Defense ETF','sector','{defense,aerospace,"defence budget",conflict,munitions}',false,false),
('SMH','VanEck Semiconductor ETF','sector','{semiconductors,chips,taiwan,"export controls",foundry,lithography}',false,false),
('SOXX','iShares Semiconductor ETF','sector','{semiconductors,chips,"chip supply",taiwan,"chip act"}',false,false),
('XLF','Financial Select Sector SPDR Fund','sector','{banks,financials,"interest rates","credit conditions",regulation}',false,false),
('KRE','SPDR S&P Regional Banking ETF','sector','{"regional banks",deposits,"credit stress","commercial real estate"}',false,false),
('XLI','Industrial Select Sector SPDR Fund','sector','{industrials,machinery,manufacturing,"capital goods"}',false,false),
('XLK','Technology Select Sector SPDR Fund','sector','{technology,software,"cloud",hardware}',false,false),
('XLV','Health Care Select Sector SPDR Fund','sector','{healthcare,pharma,"drug pricing",hospitals,pandemic}',false,false),
('XBI','SPDR S&P Biotech ETF','sector','{biotech,vaccines,"clinical trials",fda}',false,false),
('XLP','Consumer Staples Select Sector SPDR Fund','sector','{staples,groceries,"food prices","consumer defensive"}',false,false),
('XLY','Consumer Discretionary Select Sector SPDR Fund','sector','{"consumer discretionary",retail,"consumer spending",autos}',false,false),
('XLU','Utilities Select Sector SPDR Fund','sector','{utilities,"power grid",electricity,"energy prices",blackout}',false,false),
('XLB','Materials Select Sector SPDR Fund','sector','{materials,chemicals,"fertilizer",packaging,"input costs"}',false,false),
('XLRE','Real Estate Select Sector SPDR Fund','sector','{"real estate",reits,"mortgage rates",property}',false,false),
('MOO','VanEck Agribusiness ETF','sector','{agribusiness,fertilizer,potash,"crop inputs","food security"}',false,false),
('HACK','Amplify Cybersecurity ETF','sector','{cybersecurity,"cyber attack",ransomware,hacking,"data breach"}',false,false),
-- Country / region
('EWJ','iShares MSCI Japan ETF','country','{japan,yen,"bank of japan",tokyo}',false,false),
('EWZ','iShares MSCI Brazil ETF','country','{brazil,"iron ore",soybeans,"latin america",real}',false,false),
('EWW','iShares MSCI Mexico ETF','country','{mexico,nearshoring,tariffs,peso,usmca}',false,false),
('EWT','iShares MSCI Taiwan ETF','country','{taiwan,"taiwan strait",semiconductors,china,"invasion risk"}',false,false),
('EWY','iShares MSCI South Korea ETF','country','{"south korea","north korea",chips,shipbuilding,won}',false,false),
('FXI','iShares China Large-Cap ETF','country','{china,beijing,"chinese stimulus",tariffs,yuan}',false,false),
('INDA','iShares MSCI India ETF','country','{india,rupee,"south asia",monsoon}',false,false),
('EWG','iShares MSCI Germany ETF','country','{germany,"euro zone","industrial energy",gas,autos}',false,false),
('EWU','iShares MSCI United Kingdom ETF','country','{"united kingdom",uk,"bank of england",sterling}',false,false),
('EWC','iShares MSCI Canada ETF','country','{canada,"oil sands",pipelines,"canadian dollar"}',false,false),
('EWA','iShares MSCI Australia ETF','country','{australia,"iron ore",lng,"china demand"}',false,false),
('EIS','iShares MSCI Israel ETF','country','{israel,"middle east",gaza,conflict,"defence tech"}',false,false),
('KSA','iShares MSCI Saudi Arabia ETF','country','{"saudi arabia",opec,"gulf states","oil revenue"}',false,false),
('TUR','iShares MSCI Turkey ETF','country','{turkey,lira,bosphorus,"middle east"}',false,false),
('EPOL','iShares MSCI Poland ETF','country','{poland,"eastern europe",ukraine,nato}',false,false),
('EEM','iShares MSCI Emerging Markets ETF','country','{"emerging markets","capital flows","dollar strength"}',false,false),
-- Broad market
('SPY','SPDR S&P 500 ETF Trust','broad_market','{"s&p 500","us equities","broad market"}',false,false),
('QQQ','Invesco QQQ Trust','broad_market','{nasdaq,"large cap tech","growth stocks"}',false,false),
('IWM','iShares Russell 2000 ETF','broad_market','{"small caps","russell 2000","domestic economy"}',false,false),
('VT','Vanguard Total World Stock ETF','broad_market','{"global equities","world market"}',false,false),
('EFA','iShares MSCI EAFE ETF','broad_market','{"developed international",europe,"asia pacific"}',false,false),
-- Bond
('TLT','iShares 20+ Year Treasury Bond ETF','bond','{"long treasuries","interest rates","safe haven",inflation}',false,false),
('IEF','iShares 7-10 Year Treasury Bond ETF','bond','{treasuries,"intermediate rates","bond yields"}',false,false),
('SHY','iShares 1-3 Year Treasury Bond ETF','bond','{"short treasuries","front end rates"}',false,false),
('LQD','iShares iBoxx $ Investment Grade Corporate Bond ETF','bond','{"investment grade","corporate credit",spreads}',false,false),
('HYG','iShares iBoxx $ High Yield Corporate Bond ETF','bond','{"high yield","junk bonds","credit stress"}',false,false),
('TIP','iShares TIPS Bond ETF','bond','{inflation,"real yields",tips}',false,false),
-- Currency
('UUP','Invesco DB US Dollar Index Bullish Fund','currency','{"us dollar",dxy,"safe haven","dollar strength"}',false,false),
('FXE','Invesco CurrencyShares Euro Trust','currency','{euro,ecb,"euro zone"}',false,false),
('FXY','Invesco CurrencyShares Japanese Yen Trust','currency','{yen,"bank of japan","carry trade"}',false,false),
-- Deliberately excluded (leveraged / inverse) — kept for documentation
('SQQQ','ProShares UltraPro Short QQQ','broad_market','{"inverse nasdaq",leveraged}',true,true),
('TQQQ','ProShares UltraPro QQQ','broad_market','{"leveraged nasdaq"}',true,false),
('SH','ProShares Short S&P 500','broad_market','{"inverse s&p"}',false,true),
('SOXL','Direxion Daily Semiconductor Bull 3X Shares','sector','{"leveraged semiconductors"}',true,false),
('GUSH','Direxion Daily S&P Oil & Gas E&P Bull 2X Shares','sector','{"leveraged oil"}',true,false),
('DUST','Direxion Daily Gold Miners Index Bear 2X Shares','commodity','{"inverse gold miners"}',true,true);