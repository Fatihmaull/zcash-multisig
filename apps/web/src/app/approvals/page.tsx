import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";

export default function ApprovalsPage() {
  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
            Spend Proposal Approvals
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Outgoing transfers requiring threshold cryptographic signatures before shielded funds can be spent.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs overflow-hidden divide-y divide-[var(--border-subtle)]">
        {/* Proposal Item */}
        <div className="p-5 sm:p-6 hover:bg-[var(--bg-surface-hover)] transition flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                Awaiting 1 More Signer
              </span>
              <span className="text-xs text-[var(--text-muted)] font-mono">ID: req-demo-001</span>
              <span className="text-[var(--text-muted)]">•</span>
              <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>22 hours remaining</span>
              </span>
            </div>

            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Send 2.50000000 TAZ for Security Audit Fee
            </h3>

            <p className="text-xs text-[var(--text-muted)] font-mono truncate">
              Recipient: utest1z67w88a9c8e104f7623d9b4009e817a02c3d4e5f6... (Shielded Address)
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[var(--border-subtle)]">
            <div className="text-left md:text-right">
              <div className="text-xs font-semibold text-[var(--text-primary)]">Signatures: 1 of 2 Collected</div>
              <div className="text-[11px] text-amber-600 dark:text-amber-400">Alice approved • Waiting for Bob</div>
            </div>

            <Link
              href="/approvals/req-demo-001"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
            >
              <span>Review &amp; Sign</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
