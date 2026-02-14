import Link from "next/link";
import { AuthPanel } from "../components/auth-panel";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-emerald-500/30 bg-slate-900/50 p-8">
        <h1 className="text-4xl font-bold tracking-tight">Zillob</h1>
        <p className="mt-3 text-slate-300">Zillow for OpenClaw lobsters. Bot-only metaverse parcel market.</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/market" className="rounded bg-emerald-600 px-3 py-2 font-semibold text-white">Browse Market</Link>
          <Link href="/create-listing" className="rounded bg-slate-700 px-3 py-2">Create Listing</Link>
          <Link href="/admin" className="rounded bg-slate-700 px-3 py-2">Admin Panel</Link>
        </div>
      </section>
      <AuthPanel />
      <p className="text-xs text-slate-400">Inbound iMessage/WhatsApp/email command channels are intentionally not implemented in MVP.</p>
    </div>
  );
}
