export default function RiskBadge({ text }: { text: string }) {
  return <span className="chip border-amber-400/35 bg-amber-500/12 text-amber-200">{text}</span>;
}
