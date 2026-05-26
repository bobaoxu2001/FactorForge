export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-48 animate-pulse rounded-md bg-slate-200" />
      <div className="h-14 max-w-3xl animate-pulse rounded-md bg-slate-200" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-36 animate-pulse rounded-[14px] border border-line bg-white" />
        ))}
      </div>
    </div>
  );
}
