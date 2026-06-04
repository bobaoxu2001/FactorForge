export default function AiTransparencyNote() {
  return (
    <section className="card p-4">
      <div className="section-label">AI transparency</div>
      <div className="mt-3 grid gap-2 text-[12.5px] leading-relaxed text-ink-muted md:grid-cols-2">
        <p><span className="font-semibold text-ink">Template memo</span> means no live LLM key is configured or the LLM call failed safely.</p>
        <p><span className="font-semibold text-ink">LLM memo</span> means prose is generated from deterministic backtest/factor payloads.</p>
        <p>Numbers always come from the research engine, not from the language model.</p>
        <p>Research software only. No financial advice.</p>
      </div>
    </section>
  );
}
