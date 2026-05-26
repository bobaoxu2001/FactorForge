export default function RiskBadge({ text }: { text: string }) {
  return <span className="chip border-amber-200 bg-amber-50 text-amber-700">{text}</span>;
}
