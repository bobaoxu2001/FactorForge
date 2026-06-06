/**
 * Plain-language glossary.
 *
 * The platform is dense with quant jargon (Sharpe, drawdown, N_eff, factor
 * attribution…). This dictionary is the single source of truth for explaining
 * those terms to a colleague who only *sort of* knows stocks. The same entries
 * drive the inline <Term> tooltip and the /learn ("Stocks 101") page, so a
 * definition is written once and reused everywhere.
 *
 * Writing rules:
 *  - `plain`: one sentence, no jargon, an interested non-expert can follow it.
 *  - `why`:   optional — why a beginner should care / how to read the number.
 *  - `example`: optional — a concrete, friendly illustration.
 */

export type GlossaryCategory =
  | "Basics"
  | "Returns & Risk"
  | "Strategy"
  | "Diversification"
  | "Data";

export type GlossaryLevel = "starter" | "intermediate";

export interface GlossaryEntry {
  /** Stable key used by <Term term="sharpe" />. lowercase, no spaces. */
  id: string;
  /** Human-readable term, e.g. "Sharpe ratio". */
  term: string;
  /** Other spellings/labels that should resolve to this entry. */
  aliases?: string[];
  category: GlossaryCategory;
  level: GlossaryLevel;
  /** One plain-English sentence. */
  plain: string;
  /** Optional: why it matters / how to read it. */
  why?: string;
  /** Optional: a concrete friendly example. */
  example?: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  // ---- Basics -------------------------------------------------------------
  {
    id: "stock",
    term: "Stock",
    aliases: ["share", "equity", "shares"],
    category: "Basics",
    level: "starter",
    plain: "A tiny slice of ownership in a company that you can buy and sell.",
    why: "If the company does well over time, the slice tends to be worth more; if it does badly, less.",
    example: "Owning 1 share of Apple means you own a (very small) piece of Apple.",
  },
  {
    id: "ticker",
    term: "Ticker symbol",
    aliases: ["ticker", "symbol"],
    category: "Basics",
    level: "starter",
    plain: "The short code that stands for a company on the stock market.",
    example: "AAPL = Apple, MSFT = Microsoft, NVDA = NVIDIA.",
  },
  {
    id: "ohlcv",
    term: "OHLCV",
    aliases: ["ohlc", "daily bar", "candle"],
    category: "Data",
    level: "intermediate",
    plain: "The five numbers that summarise one day of trading: Open, High, Low, Close price, and Volume (how many shares changed hands).",
    why: "Almost everything on this platform is computed from these daily numbers — nothing is made up.",
  },
  {
    id: "benchmark",
    term: "Benchmark",
    aliases: ["spy", "qqq", "index"],
    category: "Basics",
    level: "starter",
    plain: "A standard yardstick you compare a strategy against — usually the whole market.",
    why: "Beating a benchmark matters more than just making money: making 8% is only good if simply holding the market would have made less.",
    example: "SPY tracks the 500 biggest US companies, so it's a common 'the market' yardstick.",
  },
  {
    id: "etf",
    term: "ETF",
    aliases: ["exchange-traded fund"],
    category: "Basics",
    level: "starter",
    plain: "A single thing you can buy that holds a whole basket of stocks at once.",
    example: "Buy SPY and you effectively own a slice of 500 companies in one go.",
  },

  // ---- Returns & Risk -----------------------------------------------------
  {
    id: "return",
    term: "Return",
    aliases: ["total return", "returns"],
    category: "Returns & Risk",
    level: "starter",
    plain: "How much you gained or lost, as a percentage of what you put in.",
    example: "Put in $100, end with $112 → a +12% return.",
  },
  {
    id: "annualized",
    term: "Annualized return",
    aliases: ["annualised return", "annual return", "per year"],
    category: "Returns & Risk",
    level: "intermediate",
    plain: "A multi-year result rephrased as 'about this much per year', so different time spans are comparable.",
    why: "A +50% gain over 5 years isn't as good as +50% in one year — annualizing makes that obvious.",
  },
  {
    id: "drawdown",
    term: "Max drawdown",
    aliases: ["drawdown", "max dd", "maxdrawdown"],
    category: "Returns & Risk",
    level: "starter",
    plain: "The worst peak-to-bottom drop along the way — how much you'd have been down at the scariest moment.",
    why: "Two strategies can end at the same place, but the one that fell -40% in the middle is far harder to actually hold through.",
    example: "Account goes $100 → $130 → $98 → recovers. The drawdown is from $130 down to $98, about -25%.",
  },
  {
    id: "volatility",
    term: "Volatility",
    aliases: ["vol", "realized volatility", "std dev"],
    category: "Returns & Risk",
    level: "intermediate",
    plain: "How bumpy the ride is — how much the price jumps around day to day.",
    why: "Higher volatility means bigger swings in both directions, so the same average return feels riskier.",
  },
  {
    id: "sharpe",
    term: "Sharpe ratio",
    aliases: ["sharpe"],
    category: "Returns & Risk",
    level: "intermediate",
    plain: "Reward for the bumpiness: how much return you earned per unit of risk taken.",
    why: "Higher is better. Roughly: under 1 is so-so, above 1 is good, above 2 is excellent. It rewards smooth gains over wild ones.",
    example: "Two strategies both return 10%, but the calmer one has the higher Sharpe — and is usually the better bet.",
  },
  {
    id: "winrate",
    term: "Win rate",
    aliases: ["win rate", "hit rate"],
    category: "Returns & Risk",
    level: "starter",
    plain: "The share of trades that ended in a profit.",
    why: "On its own it can mislead — a 40%-win strategy can still win overall if the wins are bigger than the losses.",
  },
  {
    id: "profitfactor",
    term: "Profit factor",
    aliases: ["profit factor"],
    category: "Returns & Risk",
    level: "intermediate",
    plain: "Total money made on winning trades divided by total money lost on losing ones.",
    why: "Above 1 means the wins outweigh the losses. The bigger, the better.",
  },

  // ---- Strategy -----------------------------------------------------------
  {
    id: "backtest",
    term: "Backtest",
    aliases: ["back-test", "backtesting"],
    category: "Strategy",
    level: "starter",
    plain: "A dry run of a trading rule on past data to see how it would have done — no real money involved.",
    why: "It's evidence, not a promise: doing well in the past does not imply the future.",
  },
  {
    id: "strategy",
    term: "Strategy",
    aliases: ["trading strategy", "rule"],
    category: "Strategy",
    level: "starter",
    plain: "A fixed set of rules for when to buy and when to sell, applied the same way every time.",
    why: "Fixed rules remove emotion and let you test whether the idea actually works.",
  },
  {
    id: "momentum",
    term: "Momentum",
    category: "Strategy",
    level: "intermediate",
    plain: "The idea that stocks already going up tend to keep going up for a while.",
    example: "A momentum rule buys recent winners rather than bargain-hunting losers.",
  },
  {
    id: "meanreversion",
    term: "Mean reversion",
    aliases: ["mean-reversion", "pullback"],
    category: "Strategy",
    level: "intermediate",
    plain: "The opposite idea: after an unusual move, prices often snap back toward their average.",
    example: "A pullback rule buys a strong stock that dipped, betting it bounces back.",
  },
  {
    id: "slippage",
    term: "Slippage",
    category: "Strategy",
    level: "intermediate",
    plain: "The small gap between the price you hoped to trade at and the price you actually got.",
    why: "Ignoring it makes a backtest look better than real life. This platform deliberately subtracts it.",
  },
  {
    id: "papertrading",
    term: "Paper trading",
    aliases: ["paper trade", "paper observation", "simulated"],
    category: "Strategy",
    level: "starter",
    plain: "Practicing with pretend money to watch how a strategy behaves live, without risking anything.",
    why: "It's the safe step between a backtest and ever using real money. This platform never places real orders.",
  },
  {
    id: "walkforward",
    term: "Walk-forward test",
    aliases: ["walk forward", "out-of-sample", "in-sample"],
    category: "Strategy",
    level: "intermediate",
    plain: "Tune the rule on an earlier slice of history, then test it on a later slice it has never seen.",
    why: "It's the honest test for 'did this rule really work, or was it just fit to old data?'",
  },
  {
    id: "overfitting",
    term: "Overfitting",
    aliases: ["overfit", "curve fitting"],
    category: "Strategy",
    level: "intermediate",
    plain: "Tuning a rule so perfectly to the past that it memorises old luck instead of learning something real.",
    why: "Overfit strategies look amazing in a backtest and then fall apart on new data.",
  },

  // ---- Diversification ----------------------------------------------------
  {
    id: "portfolio",
    term: "Portfolio",
    category: "Diversification",
    level: "starter",
    plain: "The collection of everything you hold, taken together as one combined bet.",
  },
  {
    id: "diversification",
    term: "Diversification",
    aliases: ["diversified", "diversify"],
    category: "Diversification",
    level: "starter",
    plain: "Not putting all your eggs in one basket — spreading bets so one bad outcome doesn't sink everything.",
    why: "The catch: things that look different can still move together, so they don't actually spread the risk.",
  },
  {
    id: "correlation",
    term: "Correlation",
    aliases: ["correlated", "pearson"],
    category: "Diversification",
    level: "intermediate",
    plain: "A score from -1 to +1 for how much two things move together.",
    why: "Near +1 = they rise and fall as one (little diversification); near 0 = unrelated; below 0 = they tend to zig when the other zags.",
  },
  {
    id: "neff",
    term: "Effective number of bets (N_eff)",
    aliases: ["n_eff", "neff", "effective bets", "independent bets", "concentration"],
    category: "Diversification",
    level: "intermediate",
    plain: "How many genuinely different bets you really have, after accounting for overlap.",
    why: "Four strategies that all secretly bet on tech might only be ~1.5 real bets. This number reveals 'four bets, or one bet wearing four hats?'.",
    example: "4 strategies but N_eff ≈ 1.5 → far less diversified than it looks.",
  },
  {
    id: "sector",
    term: "Sector",
    aliases: ["sectors", "gics"],
    category: "Diversification",
    level: "starter",
    plain: "The industry group a company belongs to, like Technology, Energy, or Health Care.",
    why: "Spreading across sectors is real diversification; owning ten tech names is not.",
  },

  // ---- Data / AI ----------------------------------------------------------
  {
    id: "factor",
    term: "Factor",
    aliases: ["factors", "factor attribution"],
    category: "Data",
    level: "intermediate",
    plain: "A common driver behind many stocks' returns — like 'is it a momentum name?' or 'is it low-volatility?'.",
    why: "Factor attribution asks: is this strategy real skill, or just riding a well-known driver anyone could buy?",
  },
  {
    id: "fallback",
    term: "Fallback / demo data",
    aliases: ["fallback", "demo data", "synthetic"],
    category: "Data",
    level: "starter",
    plain: "Stand-in fake data used only when real market data can't be fetched.",
    why: "It keeps the demo working, but the platform always labels it clearly so it's never mistaken for real results.",
  },
];

const BY_KEY: Record<string, GlossaryEntry> = (() => {
  const map: Record<string, GlossaryEntry> = {};
  for (const entry of GLOSSARY) {
    map[entry.id.toLowerCase()] = entry;
    map[entry.term.toLowerCase()] = entry;
    for (const alias of entry.aliases ?? []) map[alias.toLowerCase()] = entry;
  }
  return map;
})();

/** Resolve a term id, display term, or alias to its entry (case-insensitive). */
export function lookupTerm(key: string): GlossaryEntry | undefined {
  return BY_KEY[key.trim().toLowerCase()];
}

export const GLOSSARY_CATEGORIES: GlossaryCategory[] = [
  "Basics",
  "Returns & Risk",
  "Strategy",
  "Diversification",
  "Data",
];

export function glossaryByCategory(): Array<{ category: GlossaryCategory; entries: GlossaryEntry[] }> {
  return GLOSSARY_CATEGORIES.map((category) => ({
    category,
    entries: GLOSSARY.filter((entry) => entry.category === category),
  })).filter((group) => group.entries.length > 0);
}
