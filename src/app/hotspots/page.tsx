import { Activity, BrainCircuit, Database, Radar, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import CatalystMonitorCard from "@/components/hotspots/CatalystMonitorCard";
import HotspotThemeCard from "@/components/hotspots/HotspotThemeCard";
import ResearchAgentStatus from "@/components/hotspots/ResearchAgentStatus";
import ConfidenceMeter from "@/components/hotspots/ConfidenceMeter";
import { sentimentAccent } from "@/components/hotspots/hotspotStyles";
import MethodologyCallout from "@/components/research/MethodologyCallout";
import { getResearchDataset } from "@/lib/research";
import { formatImpact } from "@/lib/agents/scenarioForecast";

export const revalidate = 60 * 60;

export default async function HotspotsPage() {
  const { hotspots } = await getResearchDataset();
  const { themes, featured, regime, dataSource, disclaimer } = hotspots;
  const trending = themes.filter((t) => t.id !== featured.id);
  const topTheme = themes[0];
  const riskOn = themes.filter((t) => t.sentiment === "risk-on").length;
  const riskOff = themes.filter((t) => t.sentiment === "risk-off").length;

  return (
    <div className="space-y-8">
      <HotspotHero
        topTheme={topTheme}
        featuredTitle={featured.title}
        engine={dataSource.engine}
        generatedAt={dataSource.generatedAt}
        newsConnected={dataSource.newsConnected}
        regimeLabel={regime.label}
        stressScore={regime.stressScore}
        themeCount={themes.length}
        riskOn={riskOn}
        riskOff={riskOff}
      />

      {/* Hotspot Overview strip */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Overview icon={Sparkles} label="Active themes" value={String(themes.length)} sub={`${riskOn} risk-on · ${riskOff} under pressure`} />
        <Overview icon={TrendingUp} label="Top signal" value={topTheme.title.split(" / ")[0]} sub={`${topTheme.signalStrength}/100 signal strength`} />
        <Overview icon={Activity} label="Market regime" value={regime.label} sub={`Stress score ${regime.stressScore}/100`} />
        <Overview icon={Radar} label="News feed" value={dataSource.newsConnected ? "Connected" : "Not connected"} sub="Configured catalyst templates" />
      </section>

      {/* Featured SpaceX / Space Economy catalyst monitor */}
      <CatalystMonitorCard theme={featured} />

      {/* Trending Themes */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <div className="section-label">Trending Themes</div>
            <p className="mt-1 text-[12.5px] text-ink-muted">Ranked by live signal strength derived from in-universe proxies and the market regime.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {trending.map((theme) => (
            <HotspotThemeCard key={theme.id} theme={theme} />
          ))}
        </div>
      </section>

      {/* Catalyst Watchlist */}
      <section>
        <div className="mb-3">
          <div className="section-label">Catalyst Watchlist</div>
          <p className="mt-1 text-[12.5px] text-ink-muted">Each theme&rsquo;s lead catalyst, current read, and estimated proxy-basket scenario span.</p>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead className="border-b border-line text-[11px] uppercase tracking-wider text-ink-soft">
              <tr>
                <th className="px-4 py-3 text-left">Theme</th>
                <th className="px-4 py-3 text-left">Read</th>
                <th className="px-4 py-3 text-left">Lead catalyst</th>
                <th className="px-4 py-3 text-right">Signal</th>
                <th className="px-4 py-3 text-right">Confidence</th>
                <th className="px-4 py-3 text-right">Scenario span</th>
              </tr>
            </thead>
            <tbody className="divide-soft">
              {themes.map((theme) => {
                const accent = sentimentAccent(theme.sentiment);
                const bull = theme.scenario.legs.find((l) => l.case === "bull");
                const bear = theme.scenario.legs.find((l) => l.case === "bear");
                return (
                  <tr key={theme.id} className="table-row">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{theme.title}</div>
                      <div className="text-[11px] text-ink-soft">{theme.sectorTags.slice(0, 3).join(" · ")}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-[12px] ${accent.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
                        {theme.sentimentLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{theme.catalysts[0]?.label ?? "—"}</td>
                    <td className="num px-4 py-3 text-right text-ink">{theme.signalStrength}</td>
                    <td className="num px-4 py-3 text-right text-ink">{theme.scenario.confidence}</td>
                    <td className="num px-4 py-3 text-right text-ink-muted">
                      {bear ? formatImpact(bear.impactLow) : "—"} … {bull ? formatImpact(bull.impactHigh) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* AI Research Notes */}
      <section>
        <div className="mb-3">
          <div className="section-label">AI Research Notes</div>
          <p className="mt-1 text-[12.5px] text-ink-muted">Template-generated notes from the deterministic catalyst engine — no live LLM/news call.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {themes.slice(0, 3).map((theme) => (
            <div key={theme.id} className="card p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-white">{theme.title}</span>
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-soft">Template memo</span>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">{theme.researchNote}</p>
              <div className="mt-3">
                <ConfidenceMeter score={theme.scenario.confidence} size="sm" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Research Agent Status */}
      <ResearchAgentStatus report={hotspots} />

      <MethodologyCallout
        items={[
          "Themes, catalysts, and proxy baskets come from configured templates in src/lib/agents/catalystMapper.ts — not live news.",
          "Signal strength is computed from in-universe proxy factor reads (momentum, breadth, volatility) and the live market-stress regime.",
          "Scenario impact ranges are estimates for the public-market proxy basket, modulated by the current regime — not price predictions for any name or private company.",
          "Out-of-universe proxies are labeled reference-only and carry no live factor read; connect a live news/search API for production.",
        ]}
      />

      <div className="rounded-2xl border border-line bg-white/[0.02] p-4 text-[12px] leading-relaxed text-ink-soft">
        {disclaimer}
      </div>
    </div>
  );
}

function Overview({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="stat-tile">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
        <Icon className="h-3.5 w-3.5 text-cyan-200/80" />
        {label}
      </div>
      <div className="mt-2 truncate text-[17px] font-semibold tracking-tight text-white" title={value}>{value}</div>
      <div className="mt-0.5 text-[11px] text-ink-soft">{sub}</div>
    </div>
  );
}

function HotspotHero({
  topTheme,
  featuredTitle,
  engine,
  generatedAt,
  newsConnected,
  regimeLabel,
  stressScore,
  themeCount,
  riskOn,
  riskOff,
}: {
  topTheme: Awaited<ReturnType<typeof getResearchDataset>>["hotspots"]["themes"][number];
  featuredTitle: string;
  engine: string;
  generatedAt: string;
  newsConnected: boolean;
  regimeLabel: string;
  stressScore: number;
  themeCount: number;
  riskOn: number;
  riskOff: number;
}) {
  const generated = new Date(generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  return (
    <section className="hero-shell p-6 md:p-8">
      <div className="relative grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-stretch">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
            <BrainCircuit className="h-3.5 w-3.5" />
            L7 Market Hotspot Intelligence
          </div>
          <h1 className="mt-4 max-w-4xl text-[38px] font-semibold leading-[1] tracking-[-0.04em] text-white md:text-[58px]">
            Catalyst themes mapped into auditable public-market proxy baskets.
          </h1>
          <p className="mt-5 max-w-2xl text-[14.5px] leading-7 text-ink-muted">
            FactorForge detects configured market themes, scores their proxy baskets against the live market regime, and renders bull/base/bear scenario ranges for research review.
          </p>
          <p className="mt-3 max-w-2xl text-[12.5px] leading-relaxed text-ink-soft">
            SpaceX is treated as a private-market catalyst only. The app never presents it as a public tradable stock, and scenario ranges are proxy-basket estimates rather than price predictions.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <HeroMini icon={Sparkles} label="Themes" value={String(themeCount)} detail={`${riskOn} risk-on · ${riskOff} stressed`} />
            <HeroMini icon={TrendingUp} label="Top signal" value={topTheme.title.split(" / ")[0]} detail={`${topTheme.signalStrength}/100 strength`} />
            <HeroMini icon={Activity} label="Regime" value={regimeLabel} detail={`Stress ${stressScore}/100`} />
            <HeroMini icon={Database} label="News API" value={newsConnected ? "Live" : "Template"} detail={engine} />
          </div>
        </div>

        <div className="hero-showcase relative overflow-hidden p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft">Flagship catalyst monitor</div>
              <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-white">{featuredTitle}</h2>
            </div>
            <span className="chip border-amber-300/35 bg-amber-400/10 text-amber-100">Private-market catalyst</span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {topTheme.scenario.legs.map((leg) => (
              <div key={leg.case} className="rounded-2xl border border-line bg-white/[0.035] p-3">
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{leg.case}</div>
                <div className="num mt-2 text-[18px] font-semibold text-white">{Math.round(leg.probability * 100)}%</div>
                <div className="mt-1 text-[11px] leading-relaxed text-ink-soft">{leg.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.055] p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
              <p className="text-[12.5px] leading-relaxed text-ink-muted">
                <span className="font-medium text-white">Research-only guardrail. </span>
                No investment advice, no direct orders, no price-certainty claims, and no private-company trading claim.
              </p>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-[11.5px] text-ink-soft">
            <span>{engine}</span>
            <span className="num">{generated}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroMini({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
        <Icon className="h-3.5 w-3.5 text-cyan-200/80" />
        {label}
      </div>
      <div className="mt-2 truncate text-[17px] font-semibold tracking-tight text-white" title={value}>{value}</div>
      <div className="mt-0.5 text-[11px] text-ink-soft">{detail}</div>
    </div>
  );
}
