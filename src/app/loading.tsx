export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-48 animate-pulse rounded-md bg-white/[0.08]" />
      <div className="h-14 max-w-3xl animate-pulse rounded-xl bg-white/[0.06]" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="card h-36 animate-pulse bg-white/[0.035]" />
        ))}
      </div>
    </div>
  );
}
