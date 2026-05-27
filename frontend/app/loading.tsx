export default function GlobalLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA]" role="status" aria-label="Loading">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-[#003087] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-600">Loading…</p>
      </div>
    </div>
  );
}
