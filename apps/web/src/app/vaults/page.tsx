import Link from "next/link";
import { Shield, KeyRound, ArrowUpRight, Plus } from "lucide-react";

export default function VaultsPage() {
  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
            Shielded Multisig Vaults
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Collaborative vaults where outgoing transactions require threshold consensus from key holders.
          </p>
        </div>

        <Link
          href="/vaults/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs sm:text-sm font-semibold transition shadow-md shadow-amber-500/20 active:scale-98 self-start sm:self-auto cursor-pointer"
        >
          <KeyRound className="w-4 h-4" />
          <span>Create New Vault</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Active Vault Card */}
        <div className="p-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs hover:border-[var(--zcash-gold-border)] transition flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] text-base">Dev Treasury</h3>
                  <p className="text-xs text-[var(--text-muted)] font-mono">ID: vault-demo-001</p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                ACTIVE
              </span>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Operational vault for infrastructure costs, research grants, and protocol security audits.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[var(--border-subtle)] text-xs">
              <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)] block text-[11px]">Spend Policy</span>
                <span className="font-semibold text-[var(--text-primary)]">2 of 3 signers</span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)] block text-[11px]">Shielded Balance</span>
                <span className="font-semibold text-[var(--zcash-gold)] font-mono">14.50000000 TAZ</span>
              </div>
              <div className="col-span-2 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)] block text-[11px]">Privacy Level</span>
                <span className="text-[var(--text-secondary)]">Balance and transaction history are completely hidden from public view</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
            <Link
              href="/vaults/vault-demo-001/ceremony"
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--zcash-gold)] inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-500" />
              <span>Simulate Ceremony</span>
            </Link>

            <Link
              href="/vaults/vault-demo-001"
              className="px-3.5 py-2 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-default)] text-[var(--text-primary)] text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>View Vault</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Create New Vault Placeholder Card */}
        <Link
          href="/vaults/new"
          className="p-8 rounded-2xl border border-dashed border-[var(--border-default)] hover:border-[var(--zcash-gold-border)] bg-[var(--bg-secondary)] hover:bg-[var(--zcash-gold-dim)] transition flex flex-col items-center justify-center text-center group min-h-[260px] space-y-3 cursor-pointer"
        >
          <div className="w-12 h-12 rounded-2xl bg-[var(--bg-card)] group-hover:bg-amber-500/10 group-hover:border-amber-500/30 border border-[var(--border-default)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-amber-500 transition shadow-xs">
            <Plus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">Create New Vault</h3>
            <p className="text-xs text-[var(--text-muted)] max-w-xs mt-1 leading-relaxed">
              Launch a 3-step wizard to configure participants and distribute threshold key shares.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
