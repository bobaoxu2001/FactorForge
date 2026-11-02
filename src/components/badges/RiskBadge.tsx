export default function RiskBadge({ text }: { text: string }) {
  return <span className="chip border-amber-600/35 bg-amber-500/12 text-amber-700">{text}</span>;
}
