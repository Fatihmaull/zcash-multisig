import Link from "next/link";
import { KeyRound, ArrowLeft, Users, Send, CheckCircle2 } from "lucide-react";

export default async function VaultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/vaults"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Vaults
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
            Dev Treasury
          </h1>
          <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">ID: {id}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={`/vaults/${id}/ceremony`}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-surface-hover)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
          >
            <KeyRound className="w-4 h-4 text-amber-500" />
            <span>Simulate Key Ceremony</span>
          </Link>
          <Link
            href="/approvals"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Propose Transfer</span>
          </Link>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs">
          <span className="text-xs text-[var(--text-muted)]">Shielded Balance Available</span>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)] mt-1">
            14.50000000 <span className="text-xs text-[var(--zcash-gold)]">TAZ</span>
          </div>
          {/* Placeholder figure. Real balances require note scanning against a
              Zcash node — roadmap task P1-B1. Kept here because composing a
              spend needs the context; must not ship unlabelled. */}
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Simulated — note scanning not yet connected</p>
        </div>

        <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs">
          <span className="text-xs text-[var(--text-muted)]">Spend Policy</span>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">
            2 <span className="text-sm font-normal text-[var(--text-muted)]">of</span> 3 Signers
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">Requires 2 approvals per transaction</p>
        </div>

        <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs">
          <span className="text-xs text-[var(--text-muted)]">Key Custody</span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">Zero Custody</div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">Keys held exclusively on client devices</p>
        </div>
      </div>

      {/* Key Holders List */}
      <div className="p-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--zcash-gold)]" />
            <span>Key Holders &amp; Devices</span>
          </h2>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Zero Keys on Server</span>
          </span>
        </div>

        <div className="divide-y divide-[var(--border-subtle)] text-xs">
          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">Alice</div>
              <div className="text-xs text-[var(--text-muted)]">Role: Lead Treasurer • Device #1</div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-medium font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 self-start sm:self-auto">
              CONNECTED
            </span>
          </div>

          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">Bob</div>
              <div className="text-xs text-[var(--text-muted)]">Role: Finance Director • Device #2</div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-medium font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 self-start sm:self-auto">
              CONNECTED
            </span>
          </div>

          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-[var(--text-secondary)]">Carol</div>
              <div className="text-xs text-[var(--text-muted)]">Role: Standby Signer • Device #3</div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-medium font-mono bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-default)] self-start sm:self-auto">
              STANDBY
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
