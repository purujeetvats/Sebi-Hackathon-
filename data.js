/* ==========================================================================
   NiveshOS — data.js  (Agent A / logic)
   Real, exchange-listed instruments held in a simulated Account Aggregator /
   NSDL / CDSL / CAMS consolidation. Holdings, quantities and folios are
   illustrative for one demo investor; the *prices and NAVs* are REAL, pulled
   from open data and baked into real-quotes.js (window.REAL_QUOTES), which is
   merged over the fallbacks at the bottom of this file. Rebuild the snapshot
   with `node tools/build-real-data.mjs`. MF NAVs can also refresh live in-app
   via api.mfapi.in (CORS-enabled). Reference date: 2026-07-06.

   Baked ltp/nav below are the last snapshot values, kept as an OFFLINE
   FALLBACK so the app is fully correct even if real-quotes.js is absent.
   Quantities are tuned so the concentration story holds at real prices:
   HDFC Bank ~21% (top issuer), Financials ~40% of market value.
   ========================================================================== */
const NIVESH_DATA = {

  investor: {
    name: "Priya Sharma",
    pan: "ABCPS****K",
    riskProfile: null            // set by the risk quiz at runtime (state)
  },

  /* 4 linked sources across depositories + RTA ------------------------------ */
  accounts: [
    { id: "acc_zer",  broker: "Zerodha",         depository: "NSDL",     type: "Demat & Trading", lastSync: "2026-07-06 09:12" },
    { id: "acc_grw",  broker: "Groww",           depository: "CDSL",     type: "Demat & Trading", lastSync: "2026-07-06 09:12" },
    { id: "acc_hdfc", broker: "HDFC Securities",  depository: "NSDL",     type: "Demat & Trading", lastSync: "2026-07-06 09:11" },
    { id: "acc_cams", broker: "MF Central (CAMS)",depository: "CAMS RTA", type: "MF Folios",       lastSync: "2026-07-06 08:58" }
  ],

  /* ~13 holdings across real NSE securities. HDFCBANK + ICICIBANK duplicated
     across two brokers (dupe-merge demo). Bank-heavy tilt → ~40% financials of
     market value (concentration alert). Two large-cap MFs share 4 of 5 top
     holdings (overlap demo). One AAA corporate bond, one gold ETF, idle cash.
     ltp/nav are REAL last snapshot values (see real-quotes.js merge below).   */
  holdings: [
    // --- Equities (real NSE tickers) -------------------------------------
    { id: "h_hdfc_z", accountId: "acc_zer",  symbol: "HDFCBANK",   name: "HDFC Bank Ltd",         assetClass: "equity", sector: "Financials", qty: 120, avgPrice: 760,  ltp: 829.85, dayChangePct: -1.9 },
    { id: "h_hdfc_h", accountId: "acc_hdfc", symbol: "HDFCBANK",   name: "HDFC Bank Ltd",         assetClass: "equity", sector: "Financials", qty: 70,  avgPrice: 760,  ltp: 829.85, dayChangePct: -1.9 },
    { id: "h_icici_z",accountId: "acc_zer",  symbol: "ICICIBANK",  name: "ICICI Bank Ltd",        assetClass: "equity", sector: "Financials", qty: 40,  avgPrice: 1300, ltp: 1426.9, dayChangePct: -2.0 },
    { id: "h_icici_g",accountId: "acc_grw",  symbol: "ICICIBANK",  name: "ICICI Bank Ltd",        assetClass: "equity", sector: "Financials", qty: 25,  avgPrice: 1300, ltp: 1426.9, dayChangePct: -2.0 },
    { id: "h_rel",    accountId: "acc_zer",  symbol: "RELIANCE",   name: "Reliance Industries",   assetClass: "equity", sector: "Energy",     qty: 40,  avgPrice: 1360, ltp: 1321.3, dayChangePct: -0.8 },
    { id: "h_tcs",    accountId: "acc_grw",  symbol: "TCS",        name: "Tata Consultancy Svcs", assetClass: "equity", sector: "IT",         qty: 10,  avgPrice: 1980, ltp: 2057.6, dayChangePct:  0.2 },
    { id: "h_infy",   accountId: "acc_hdfc", symbol: "INFY",       name: "Infosys Ltd",           assetClass: "equity", sector: "IT",         qty: 25,  avgPrice: 1090, ltp: 1042.2, dayChangePct: -0.2 },
    { id: "h_tmpv",   accountId: "acc_grw",  symbol: "TMPV",       name: "Tata Motors PV Ltd",    assetClass: "equity", sector: "Auto",       qty: 60,  avgPrice: 360,  ltp: 347.05, dayChangePct: -3.8 },
    { id: "h_airtel", accountId: "acc_zer",  symbol: "BHARTIARTL", name: "Bharti Airtel Ltd",     assetClass: "equity", sector: "Telecom",    qty: 18,  avgPrice: 1700, ltp: 1925.7, dayChangePct: -1.2 },

    // --- Mutual funds (real AMFI scheme codes, ~80% overlap) --------------
    { id: "h_axis", accountId: "acc_cams", symbol: "AXISBLUE", schemeCode: 120465, name: "Axis Large Cap Fund — Direct Growth", assetClass: "mf", sector: "Diversified", qty: 1800, avgPrice: 60.0, ltp: 69.51, dayChangePct: -2.0,
      underlying: [
        { symbol: "HDFCBANK",  name: "HDFC Bank",   weight: 9.2 },
        { symbol: "ICICIBANK", name: "ICICI Bank",  weight: 8.1 },
        { symbol: "RELIANCE",  name: "Reliance",    weight: 7.5 },
        { symbol: "INFY",      name: "Infosys",     weight: 6.3 },
        { symbol: "TCS",       name: "TCS",         weight: 5.4 }
      ] },
    { id: "h_mirae", accountId: "acc_cams", symbol: "MIRAELC", schemeCode: 118825, name: "Mirae Asset Large Cap — Direct Growth", assetClass: "mf", sector: "Diversified", qty: 900, avgPrice: 118.0, ltp: 127.95, dayChangePct: -2.0,
      underlying: [
        { symbol: "HDFCBANK",   name: "HDFC Bank",     weight: 8.8 },
        { symbol: "ICICIBANK",  name: "ICICI Bank",    weight: 7.9 },
        { symbol: "RELIANCE",   name: "Reliance",      weight: 7.1 },
        { symbol: "INFY",       name: "Infosys",       weight: 5.8 },
        { symbol: "BHARTIARTL", name: "Bharti Airtel", weight: 4.9 }
      ] },

    // --- Bond / Gold ETF / Cash ------------------------------------------
    { id: "h_tatacap", accountId: "acc_zer",  symbol: "TATACAP81", name: "Tata Capital NCD 8.1% 2029", assetClass: "bond", sector: "Financials",  qty: 50,    avgPrice: 1000, ltp: 1035,   dayChangePct:  0.05 },
    { id: "h_gold",    accountId: "acc_hdfc", symbol: "GOLDBEES",  name: "Nippon India Gold ETF",      assetClass: "etf",  sector: "Commodities", qty: 500,   avgPrice: 95,   ltp: 119.51, dayChangePct:  0.8 },
    { id: "h_cash",    accountId: "acc_zer",  symbol: "CASH",      name: "Idle Cash (settlement)",     assetClass: "cash", sector: "Cash",        qty: 52000, avgPrice: 1,    ltp: 1,      dayChangePct:  0.0 }
  ],

  /* 30 daily portfolio totals (net worth) ending today; last point aligns to
     the live-computed net worth (~₹8.09L). Realistic wobble, last day down. */
  history: [
    { t: "2026-06-07", v: 784000 }, { t: "2026-06-08", v: 786800 }, { t: "2026-06-09", v: 782300 },
    { t: "2026-06-10", v: 790000 }, { t: "2026-06-11", v: 794700 }, { t: "2026-06-12", v: 791400 },
    { t: "2026-06-13", v: 798000 }, { t: "2026-06-14", v: 802700 }, { t: "2026-06-15", v: 799900 },
    { t: "2026-06-16", v: 806300 }, { t: "2026-06-17", v: 810700 }, { t: "2026-06-18", v: 807500 },
    { t: "2026-06-19", v: 813000 }, { t: "2026-06-20", v: 810300 }, { t: "2026-06-21", v: 815600 },
    { t: "2026-06-22", v: 818900 }, { t: "2026-06-23", v: 814400 }, { t: "2026-06-24", v: 810900 },
    { t: "2026-06-25", v: 817100 }, { t: "2026-06-26", v: 821500 }, { t: "2026-06-27", v: 818000 },
    { t: "2026-06-28", v: 813800 }, { t: "2026-06-29", v: 820200 }, { t: "2026-06-30", v: 824700 },
    { t: "2026-07-01", v: 821100 }, { t: "2026-07-02", v: 815900 }, { t: "2026-07-03", v: 822500 },
    { t: "2026-07-04", v: 827100 }, { t: "2026-07-05", v: 820500 }, { t: "2026-07-06", v: 809167 }
  ],

  /* 9 registered catalogue products + 1 unregistered scam (always BLOCKED).
     Real listed REITs/InvITs carry quoteSym → live NSE price via real-quotes.js;
     the index fund carries schemeCode → live AMFI NAV. assetClass + price feed
     the simulated order flow. requiredLesson gates each behind an education
     module.                                                                  */
  products: [
    { id: "p_embassy",  name: "Embassy Office Parks REIT", category: "REIT",            assetClass: "reit",  quoteSym: "EMBASSY",   riskGrade: "B", liquidity: "High", complexity: 2, minInvest: 370,   price: 369.92, yieldOrReturn: "6.8% distribution yield", issuerRating: "AAA",       registered: true,  requiredLesson: "reit",  minTier: "balanced",
      blurb: "Owns Grade-A office parks across Bengaluru, Mumbai, Pune & NCR; pays out rent as quarterly distributions." },
    { id: "p_mindspace",name: "Mindspace Business Parks REIT", category: "REIT",        assetClass: "reit",  quoteSym: "MINDSPACE", riskGrade: "B", liquidity: "High", complexity: 2, minInvest: 345,   price: 345.06, yieldOrReturn: "6.5% distribution yield", issuerRating: "AAA",       registered: true,  requiredLesson: "reit",  minTier: "balanced",
      blurb: "Commercial office REIT sponsored by K Raheja Corp with assets in Mumbai, Hyderabad, Pune & Chennai." },
    { id: "p_powergrid",name: "PowerGrid InvIT",          category: "InvIT",           assetClass: "invit", quoteSym: "PGINVIT",   riskGrade: "B", liquidity: "Medium", complexity: 2, minInvest: 96,  price: 95.96,  yieldOrReturn: "9.5% distribution yield", issuerRating: "AAA",       registered: true,  requiredLesson: "invit", minTier: "balanced",
      blurb: "Holds operational inter-state power transmission lines with long-term regulated cash flows." },
    { id: "p_indigrid", name: "IndiGrid InvIT",           category: "InvIT",           assetClass: "invit", quoteSym: "INDIGRID",  riskGrade: "C", liquidity: "Medium", complexity: 2, minInvest: 140, price: 140.06, yieldOrReturn: "10.2% distribution yield", issuerRating: "AAA",      registered: true,  requiredLesson: "invit", minTier: "balanced",
      blurb: "India's first power-sector InvIT; transmission + a growing renewables portfolio." },
    { id: "p_tatacap",  name: "Tata Capital NCD 8.1% 2029", category: "Corporate Bond",assetClass: "bond",  riskGrade: "A", liquidity: "Medium", complexity: 2, minInvest: 10000, price: 1000, yieldOrReturn: "8.1% annual coupon", issuerRating: "AAA",     registered: true,  requiredLesson: "bonds", minTier: "conservative",
      blurb: "Senior secured NCD from a AAA-rated NBFC; fixed 8.1% coupon, maturity 2029." },
    { id: "p_piramal",  name: "Piramal Capital NCD 9.4% 2028", category: "Corporate Bond", assetClass: "bond", riskGrade: "C", liquidity: "Low", complexity: 2, minInvest: 10000, price: 1000, yieldOrReturn: "9.4% annual coupon", issuerRating: "AA-",  registered: true,  requiredLesson: "bonds", minTier: "balanced",
      blurb: "Higher-yield AA- NCD; more coupon, more credit risk and thinner secondary liquidity." },
    { id: "p_sgb",      name: "Sovereign Gold Bond 2032",  category: "Sovereign Gold Bond", assetClass: "bond", riskGrade: "A", liquidity: "Low", complexity: 1, minInvest: 6200, price: 6200, yieldOrReturn: "2.5% p.a. + gold price", issuerRating: "Sovereign", registered: true, requiredLesson: "sgb", minTier: "conservative",
      blurb: "RBI-issued bond tracking gold; pays 2.5% interest and is tax-free on maturity if held to term." },
    { id: "p_nifty",    name: "UTI Nifty 50 Index Fund — Direct Growth", category: "Index Fund", assetClass: "mf", schemeCode: 120716, riskGrade: "B", liquidity: "High", complexity: 1, minInvest: 500, price: 170.5, yieldOrReturn: "Tracks NIFTY 50", issuerRating: "NA",  registered: true,  requiredLesson: null,    minTier: "conservative",
      blurb: "Low-cost fund mirroring India's 50 largest listed companies — broad, cheap equity exposure." },
    { id: "p_tbill",    name: "91-Day Treasury Bill",     category: "Treasury Bill",   assetClass: "bond",  riskGrade: "A", liquidity: "High", complexity: 1, minInvest: 10000, price: 1000, yieldOrReturn: "6.9% annualised yield", issuerRating: "Sovereign", registered: true,  requiredLesson: null,    minTier: "conservative",
      blurb: "Ultra-short government paper; parking spot for idle cash, effectively zero credit risk." },
    // --- unregistered scam: never passes suitability ----------------------
    { id: "p_scam",     name: "QuickRich Agro Gold Scheme", category: "Unregistered Scheme", assetClass: "scam", riskGrade: "E", liquidity: "Low", complexity: 3, minInvest: 25000, price: 25000, yieldOrReturn: "24% assured returns", issuerRating: "Unrated", registered: false, requiredLesson: null, minTier: "aggressive",
      blurb: "\"Guaranteed 24% assured returns\" from an unregistered agro-gold pool. Not found in any SEBI/exchange registry — classic red flag." }
  ],

  /* 5 education modules, plain-language + analogy-driven, each with a
     3-question quiz. Passing (>=2/3) marks the lesson complete + unlocks the
     matching product category via the suitability engine.                   */
  lessons: [
    { id: "reit", title: "REITs", emoji: "🏢", minutes: 4,
      sections: [
        { h: "What is a REIT?", p: "A Real Estate Investment Trust owns income-producing property — think office parks and malls — and lists on the exchange like a share. Buying one unit makes you a tiny landlord without needing crores for a building." },
        { h: "Where the return comes from", p: "REITs must pay out at least 90% of their rental income to unitholders. So you earn a regular 'distribution' (like rent) plus any rise in the unit price. It behaves part-bond, part-equity." },
        { h: "The risks", p: "If tenants leave or offices sit empty, distributions can fall. Prices also move with interest rates: when rates rise, REIT prices often dip. Liquidity is decent but thinner than large-cap stocks." }
      ],
      quiz: [
        { q: "What does a REIT mainly own?", options: ["Government bonds", "Income-producing real estate", "Foreign currency", "Crypto assets"], answer: 1 },
        { q: "At least how much income must a REIT distribute to unitholders?", options: ["10%", "50%", "90%", "None — it's optional"], answer: 2 },
        { q: "REIT prices tend to fall when…", options: ["Interest rates rise", "Rents rise", "More tenants sign up", "The unit splits"], answer: 0 }
      ] },
    { id: "invit", title: "InvITs", emoji: "🔌", minutes: 4,
      sections: [
        { h: "What is an InvIT?", p: "An Infrastructure Investment Trust is the REIT idea applied to infrastructure — power lines, highways, gas pipelines. You pool money with others to own toll/tariff-earning assets and collect the cash they throw off." },
        { h: "Why the yields look high", p: "Regulated infra assets produce steady, contracted cash flows, so InvITs often distribute 9–11%. But part of that payout is return of capital, not pure profit — the asset slowly depletes, so headline yield overstates true return." },
        { h: "The risks", p: "Cash flows depend on the asset (traffic on a road, uptime of a line) and on regulation. Units can be less liquid, and leverage inside the trust adds interest-rate sensitivity." }
      ],
      quiz: [
        { q: "An InvIT typically owns…", options: ["Shopping malls", "Infrastructure like power lines & highways", "Bank deposits", "Gold bars"], answer: 1 },
        { q: "Why can InvIT distribution yields look unusually high?", options: ["They never pay tax", "Part of the payout is return of capital", "They are risk-free", "They double every year"], answer: 1 },
        { q: "A key driver of an InvIT's cash flow is…", options: ["The cricket season", "Usage of the underlying asset (e.g. traffic)", "The founder's mood", "Gold prices"], answer: 1 }
      ] },
    { id: "bonds", title: "Corporate Bonds", emoji: "📜", minutes: 4,
      sections: [
        { h: "Lending, not owning", p: "A bond is a loan you give to a company. It promises a fixed coupon (interest) on set dates and returns your principal at maturity. Unlike a share, you don't own the business — you're its lender." },
        { h: "Rating = safety grade", p: "Agencies grade credit quality: AAA is safest, then AA, A, and lower. A higher coupon usually means higher risk. A AAA bond at 8% and an AA- bond at 9.4% are not the same bet — the extra 1.4% is the price of extra default risk." },
        { h: "The risks", p: "Credit risk (issuer can't pay), interest-rate risk (existing bonds lose value when rates rise), and liquidity risk (harder to sell mid-term). Match the maturity to when you need the money." }
      ],
      quiz: [
        { q: "Owning a corporate bond makes you the company's…", options: ["Owner", "Lender", "Employee", "Auditor"], answer: 1 },
        { q: "Which rating is the safest?", options: ["AA-", "A", "AAA", "BBB"], answer: 2 },
        { q: "A bond paying a higher coupon usually carries…", options: ["Lower risk", "Higher risk", "No risk", "Guaranteed returns"], answer: 1 }
      ] },
    { id: "sgb", title: "Sovereign Gold Bonds", emoji: "🪙", minutes: 3,
      sections: [
        { h: "Gold without the locker", p: "A Sovereign Gold Bond (SGB) is issued by the RBI and tracks the price of gold — but you hold it in your demat, so there's no making charge, no purity worry, and no storage risk." },
        { h: "You get paid to wait", p: "On top of gold's price movement, SGBs pay 2.5% interest a year on your invested amount. Held to the 8-year maturity, the capital gain from gold is tax-free — an edge physical gold and ETFs don't have." },
        { h: "The trade-offs", p: "Your money is locked for years (early exit only via the exchange, often at a discount) and if gold falls, so does your bond. It's a long-horizon diversifier, not a trading instrument." }
      ],
      quiz: [
        { q: "Who issues Sovereign Gold Bonds?", options: ["SEBI", "The RBI", "Private jewellers", "The stock exchange"], answer: 1 },
        { q: "Besides gold's price, an SGB pays…", options: ["Nothing extra", "2.5% annual interest", "Monthly dividends", "A lottery"], answer: 1 },
        { q: "A key drawback of SGBs is…", options: ["Making charges", "A long lock-in period", "Purity risk", "Storage cost"], answer: 1 }
      ] },
    { id: "diversification", title: "Diversification & Overlap", emoji: "⚖️", minutes: 4,
      sections: [
        { h: "Don't put all eggs in one basket", p: "Diversification spreads money across assets that don't all move together, so one bad bet doesn't sink you. Concentration is the opposite — and it's the single most common retail mistake." },
        { h: "The hidden overlap trap", p: "Owning two large-cap funds feels diversified, but if both hold the same HDFC Bank, ICICI Bank and Reliance, you've simply doubled the same bets. 'Fund overlap' means less real diversification than the number of funds suggests." },
        { h: "Watch your sector tilt", p: "Add up exposure by sector, not just by stock. A portfolio that's ~40% financials — across direct banks and fund holdings — is one interest-rate shock away from a big drawdown, even if it looks spread across many names." }
      ],
      quiz: [
        { q: "Diversification works by combining assets that…", options: ["Always move together", "Don't all move together", "Are all banks", "Are all gold"], answer: 1 },
        { q: "Two large-cap funds holding the same stocks is called…", options: ["Fund overlap", "Arbitrage", "A stock split", "Hedging"], answer: 0 },
        { q: "A portfolio that is ~40% in one sector is mainly exposed to…", options: ["Nothing — it's safe", "Concentration risk", "Guaranteed gains", "Zero volatility"], answer: 1 }
      ] }
  ],

  /* 6-question risk-profiling quiz. Sum of chosen option weights →
     <=10 conservative, 11–17 balanced, >=18 aggressive.                     */
  riskQuiz: [
    { q: "What is your age band?",
      options: [ { t: "Above 55", w: 1 }, { t: "40–55", w: 2 }, { t: "30–40", w: 3 }, { t: "Under 30", w: 4 } ] },
    { q: "When do you expect to need most of this money?",
      options: [ { t: "Within 2 years", w: 1 }, { t: "2–5 years", w: 2 }, { t: "5–10 years", w: 3 }, { t: "10+ years", w: 4 } ] },
    { q: "Your portfolio drops 20% in a month. You…",
      options: [ { t: "Sell everything to stop the bleeding", w: 1 }, { t: "Sell some and wait", w: 2 }, { t: "Do nothing, stay invested", w: 3 }, { t: "Buy more at lower prices", w: 4 } ] },
    { q: "How stable is your income?",
      options: [ { t: "Irregular / dependent on markets", w: 1 }, { t: "Stable but single source", w: 2 }, { t: "Stable with some savings buffer", w: 3 }, { t: "Very stable, large buffer", w: 4 } ] },
    { q: "How would you rate your investing knowledge?",
      options: [ { t: "Beginner", w: 1 }, { t: "Some basics", w: 2 }, { t: "Fairly confident", w: 3 }, { t: "Experienced", w: 4 } ] },
    { q: "What matters most for this portfolio?",
      options: [ { t: "Protecting capital above all", w: 1 }, { t: "Steady income", w: 2 }, { t: "Balanced growth", w: 3 }, { t: "Maximum long-term growth", w: 4 } ] }
  ]
};

/* --------------------------------------------------------------------------
   Merge the REAL market snapshot (real-quotes.js) over the baked fallbacks.
   Prices/NAVs become real; quantities, day-moves and names stay curated so
   the demo narrative and offline mode both stay coherent. No-op if absent.
   -------------------------------------------------------------------------- */
(function applyRealQuotes() {
  var RQ = (typeof window !== "undefined") && window.REAL_QUOTES;
  if (!RQ) return;
  var quotes = RQ.quotes || {}, navs = RQ.navs || {};
  (NIVESH_DATA.holdings || []).forEach(function (h) {
    if (h.schemeCode && navs[h.schemeCode] != null) h.ltp = navs[h.schemeCode].nav;
    else if (quotes[h.symbol] != null) h.ltp = quotes[h.symbol].ltp;
  });
  (NIVESH_DATA.products || []).forEach(function (p) {
    if (p.schemeCode && navs[p.schemeCode] != null) p.price = navs[p.schemeCode].nav;
    else if (p.quoteSym && quotes[p.quoteSym] != null) p.price = quotes[p.quoteSym].ltp;
  });
  NIVESH_DATA.dataSource = { asOf: RQ.asOf, sources: RQ.sources || [], live: true };
})();

/* expose for other scripts / debugging */
if (typeof window !== "undefined") { window.NIVESH_DATA = NIVESH_DATA; }
