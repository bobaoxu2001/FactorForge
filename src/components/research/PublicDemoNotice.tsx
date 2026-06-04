export default function PublicDemoNotice() {
  return (
    <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.055] px-4 py-3 text-[12.5px] leading-relaxed text-emerald-50/90">
      <span className="font-semibold text-emerald-100">Public demo mode:</span>{" "}
      research software only, no financial advice, no broker connection, no live trading. Data is either real market data or explicitly labeled fallback/demo data.
    </div>
  );
}
