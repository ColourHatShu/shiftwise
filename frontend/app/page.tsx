import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ShiftWise – Compliance Management for Healthcare Staffing",
  description:
    "ShiftWise helps UK healthcare staffing agencies manage worker compliance documents, track expiry dates, and stay audit-ready.",
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-white text-sm">
            SW
          </div>
          <span className="text-xl font-bold tracking-tight">ShiftWise</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/sign-in"
            className="text-slate-300 hover:text-white transition-colors text-sm"
          >
            Sign in
          </a>
          <a
            href="/sign-up"
            className="bg-blue-600 hover:bg-blue-500 transition-colors text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            Get started
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-28 max-w-5xl mx-auto">
        <span className="inline-block bg-blue-900/50 border border-blue-700 text-blue-300 text-xs font-semibold px-3 py-1 rounded-full mb-6 tracking-wide uppercase">
          Built for UK Healthcare Staffing
        </span>
        <h1 className="text-5xl sm:text-6xl font-extrabold leading-tight mb-6 tracking-tight">
          Compliance Management,{" "}
          <span className="text-blue-400">Simplified.</span>
        </h1>
        <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mb-10 leading-relaxed">
          ShiftWise keeps your agency audit-ready. Track worker documents, get
          expiry alerts before they lapse, and manage every compliance record in
          one place.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <a
            href="/sign-up"
            className="bg-blue-600 hover:bg-blue-500 transition-all text-white font-semibold px-8 py-3 rounded-xl text-base shadow-lg shadow-blue-900/40"
          >
            Start free trial
          </a>
          <a
            href="#features"
            className="border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transition-all px-8 py-3 rounded-xl text-base"
          >
            See how it works
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 pb-28">
        <h2 className="text-3xl font-bold text-center mb-12">
          Everything your agency needs
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 hover:border-blue-700/50 transition-all"
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 text-center py-8 text-slate-500 text-sm">
        © {new Date().getFullYear()} ShiftWise. Built for UK healthcare staffing agencies.
      </footer>
    </main>
  );
}

const features = [
  {
    icon: "📋",
    title: "Document Tracking",
    desc: "Upload and manage DBS checks, Right to Work, training certificates, and more for every worker.",
  },
  {
    icon: "⏰",
    title: "Expiry Alerts",
    desc: "Automatic notifications before documents expire so you never get caught out during an audit.",
  },
  {
    icon: "🏢",
    title: "Multi-Agency",
    desc: "Each agency has its own isolated workspace. Manage any number of agencies from one platform.",
  },
  {
    icon: "🔒",
    title: "Secure Storage",
    desc: "Documents are stored securely on Cloudflare R2 with access controls and audit trails.",
  },
  {
    icon: "📊",
    title: "Compliance Reports",
    desc: "Generate instant compliance reports showing document status across your entire workforce.",
  },
  {
    icon: "📝",
    title: "Audit Logs",
    desc: "Every action is logged — who uploaded, approved, or rejected a document and when.",
  },
];
