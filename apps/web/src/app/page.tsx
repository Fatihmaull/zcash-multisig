import Link from "next/link";
import { 
  Shield, 
  KeyRound, 
  FileCheck2, 
  ArrowUpRight, 
  Lock, 
  Layers, 
  ChevronRight 
} from "lucide-react";

export default function Home() {
  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 sm:p-8 lg:p-10 shadow-xs">
        {/* Glow ambient background element */}
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl space-y-3.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-xs text-amber-600 dark:text-amber-300 font-medium">
            <Shield className="w-3.5 h-3.5" />
            <span>Zcash Shielded Multisig • Zero Custody</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[var(--text-primary)] leading-snug">
            Manage Shared Funds Privately &amp; Securely
          </h1>

          <p className="text-[var(--text-secondary)] text-sm sm:text-base leading-relaxed">
            A collaborative treasury vault where transfers require cryptographic consensus from at least <strong>2 of 3 signers</strong>. Your private keys stay safely on your devices — never stored on a server.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              href="/vaults/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs sm:text-sm font-semibold transition shadow-md shadow-amber-500/20 active:scale-98"
            >
              <KeyRound className="w-4 h-4" />
              <span>Create New Vault</span>
            </Link>
            <Link
              href="/approvals"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] text-xs sm:text-sm font-medium transition shadow-xs"
            >
              <FileCheck2 className="w-4 h-4 text-amber-500" />
              <span>Pending Approvals (1)</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row: 4 Clean & Adaptive Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Vaults */}
        <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Active Vaults</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 dark:text-amber-400">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">1 Vault</div>
          <div className="text-xs text-[var(--text-muted)]">Policy: 2-of-3 threshold</div>
        </div>

        {/* Balance tile removed — wallet feature, out of scope.
            See CLAUDE.md "Scope boundary" and docs/02-product-spec.md §5. */}

        {/* Metric 3: Pending */}
        <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Awaiting Signature</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 dark:text-amber-400">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">1 Proposal</div>
          <div className="text-xs text-amber-600 dark:text-amber-400">1 of 2 signatures collected</div>
        </div>

        {/* Metric 4: Security */}
        <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Security State</span>
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">Optimal</div>
          <div className="text-xs text-[var(--text-muted)]">All signer devices verified</div>
        </div>
      </div>

      {/* Main Grid: Pending Proposals & Vault Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Proposal */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2 font-sans">
              <FileCheck2 className="w-4 h-4 text-[var(--zcash-gold)]" />
              <span>Pending Spend Proposals</span>
            </h2>
            <Link
              href="/approvals"
              className="text-xs text-[var(--zcash-gold)] hover:underline inline-flex items-center gap-1 transition"
            >
              <span>View all</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-4 hover:border-[var(--zcash-gold-border)] transition">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-mono">
                    Awaiting 1 More Signer
                  </span>
                  <span className="text-xs text-[var(--text-muted)] font-mono">ID: req-demo-001</span>
                </div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  Send 2.50000000 TAZ for Security Audit Fee
                </h3>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-xs font-semibold text-[var(--text-primary)]">Progress: 1 of 2 Signers</div>
                <div className="text-[11px] text-amber-600 dark:text-amber-400">Alice approved • Waiting for Bob</div>
              </div>
            </div>

            {/* Recipient Address */}
            <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-secondary)] truncate">
              Recipient: utest1z67w88a9c8e104f7623d9b4009e817a02c3d4e5f6... (Shielded Address)
            </div>

            {/* Action */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-muted)]">
                Approval deadline: 22 hours remaining
              </span>

              <Link
                href="/approvals/req-demo-001"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition shadow-md shadow-amber-500/20 active:scale-95"
              >
                <span>Review &amp; Sign</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Vault Profile */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2 font-sans">
              <Layers className="w-4 h-4 text-[var(--zcash-gold)]" />
              <span>Team Vault Profile</span>
            </h2>
            <Link
              href="/vaults"
              className="text-xs text-[var(--zcash-gold)] hover:underline inline-flex items-center gap-1 transition"
            >
              <span>Details</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">Dev Treasury</div>
                <div className="text-xs text-[var(--text-muted)]">2-of-3 threshold policy</div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                ACTIVE
              </span>
            </div>

            <div className="space-y-2.5 pt-3 border-t border-[var(--border-subtle)] text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Key Holders:</span>
                <span className="text-[var(--text-primary)] font-medium">3 Signers (Alice, Bob, Carol)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Spend Policy:</span>
                <span className="text-[var(--zcash-gold)] font-semibold">At least 2 signers approve</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Network:</span>
                <span className="text-[var(--text-primary)]">Zcash Testnet (Shielded)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Key Custody:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">100% On-Device</span>
              </div>
            </div>

            <Link
              href="/vaults/vault-demo-001/ceremony"
              className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-[var(--border-default)] hover:border-[var(--zcash-gold-border)] bg-[var(--bg-secondary)] hover:bg-[var(--zcash-gold-dim)] text-xs text-[var(--text-secondary)] hover:text-[var(--zcash-gold)] transition"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Simulate Key Ceremony</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
