interface MethodologyCalloutProps {
  title?: string;
  items: string[];
}

export default function MethodologyCallout({ title = "Methodology / Assumptions", items }: MethodologyCalloutProps) {
  return (
    <details className="card p-4" open>
      <summary className="cursor-pointer list-none text-[13px] font-semibold text-ink marker:hidden">
        {title}
      </summary>
      <ul className="mt-3 grid gap-2 text-[12.5px] leading-relaxed text-ink-muted md:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="rounded-xl border border-line bg-white/[0.03] px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </details>
  );
}
