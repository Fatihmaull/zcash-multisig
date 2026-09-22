import Link from "next/link";
import { 
  Shield, 
  KeyRound, 
  FileCheck2, 
  ArrowUpRight, 
  Lock, 
  Layers, 
  ChevronRight,
  Sparkles
} from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Query live vaults and pending approvals from database
  let vaultsCount = 0;
  let approvalsCount = 0;
  let activeVault = null;
  let latestApproval = null;

  try {
    const [vaults, approvals] = await Promise.all([
      prisma.vault.findMany({
        include: { participants: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.approvalRequest.findMany({
        where: { status: "PENDING" },
        include: { vault: true, signatureRoundEvents: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    vaultsCount = vaults.length;
    approvalsCount = approvals.length;
    activeVault = vaults[0] || null;
    latestApproval = approvals[0] || null;
  } catch (error) {
    console.error("Dashboard DB query error:", error);
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 sm:p-8 lg:p-10 shadow-xs">
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-gradient-to-br from-amber-500/20 via-fuchsia-500/15 to-cyan-500/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl space-y-3.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/15 via-purple-500/15 to-cyan-500/15 border border-amber-500/30 text-xs text-[var(--text-primary)] font-medium">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>Zcash Shielded Multisig • Zero Custody</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[var(--text-primary)] leading-snug">
            Treasury Dashboard &amp; Operations
          </h1>

          <p className="text-[var(--text-secondary)] text-sm sm:text-base leading-relaxed">
            A collaborative treasury vault where transfers require cryptographic consensus from at least <strong>{activeVault?.threshold || 2} of {activeVault?.totalParticipants || 3} signers</strong>. Your private keys stay safely on your devices — never stored on a server.
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
              <span>Pending Approvals ({approvalsCount})</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row: Live Cards from DB */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Vaults */}
        <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Active Vaults</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 dark:text-amber-400">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">
            {vaultsCount} Vault{vaultsCount !== 1 ? "s" : ""}
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            Policy: {activeVault?.threshold || 2}-of-{activeVault?.totalParticipants || 3} threshold
          </div>
        </div>

        {/* Metric 2: Pending Approvals */}
        <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Awaiting Signature</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 dark:text-amber-400">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">
            {approvalsCount} Proposal{approvalsCount !== 1 ? "s" : ""}
          </div>
          <div className="text-xs text-amber-600 dark:text-amber-400">
            {approvalsCount > 0 ? "Threshold pending" : "No pending proposals"}
          </div>
        </div>

        {/* Metric 3: Security State */}
        <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Security State</span>
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">Optimal</div>
          <div className="text-xs text-[var(--text-muted)]">FROST RedPallas Active</div>
        </div>

        {/* Metric 4: Network */}
        <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Network Node</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--zcash-gold)]">Testnet</div>
          <div className="text-xs text-[var(--text-muted)]">Ironwood Pool (NU6.3)</div>
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

          {latestApproval ? (
            <div className="p-5 sm:p-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-4 hover:border-[var(--zcash-gold-border)] transition">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-mono">
                      Awaiting Signatures
                    </span>
                    <span className="text-xs text-[var(--text-muted)] font-mono">ID: {latestApproval.id}</span>
                  </div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">
                    Send {(Number(latestApproval.amountZatoshi) / 100000000).toFixed(8)} TAZ
                  </h3>
                  {latestApproval.memo && (
                    <p className="text-xs text-[var(--text-muted)] italic">
                      &ldquo;{latestApproval.memo}&rdquo;
                    </p>
                  )}
                </div>

                <div className="text-left sm:text-right">
                  <div className="text-xs font-semibold text-[var(--text-primary)]">Status: {latestApproval.status}</div>
                  <div className="text-[11px] text-amber-600 dark:text-amber-400">
                    Vault: {latestApproval.vault.label}
                  </div>
                </div>
              </div>

              {/* Recipient Address */}
              <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-secondary)] truncate">
                Recipient: {latestApproval.recipientAddress}
              </div>

              {/* Action */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[var(--border-subtle)]">
                <span className="text-xs text-[var(--text-muted)]">
                  Expires: {latestApproval.expiresAt ? new Date(latestApproval.expiresAt).toLocaleDateString() : "No expiry"}
                </span>

                <Link
                  href={`/approvals/${latestApproval.id}`}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition shadow-md shadow-amber-500/20 active:scale-95"
                >
                  <span>Review &amp; Sign</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] text-center space-y-2">
              <FileCheck2 className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">No Pending Proposals</p>
              <p className="text-xs text-[var(--text-muted)]">All spend requests have been completed or none exist.</p>
            </div>
          )}
        </div>

        {/* Right 1 Col: Vault Profile */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2 font-sans">
              <Layers className="w-4 h-4 text-[var(--zcash-gold)]" />
              <span>Active Vault Profile</span>
            </h2>
            <Link
              href="/vaults"
              className="text-xs text-[var(--zcash-gold)] hover:underline inline-flex items-center gap-1 transition"
            >
              <span>All Vaults</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {activeVault ? (
            <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{activeVault.label}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {activeVault.threshold}-of-{activeVault.totalParticipants} threshold policy
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                  {activeVault.status}
                </span>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-[var(--border-subtle)] text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Key Holders:</span>
                  <span className="text-[var(--text-primary)] font-medium">
                    {activeVault.participants.length > 0 
                      ? activeVault.participants.map(p => p.label.split(" ")[0]).join(", ")
                      : `${activeVault.totalParticipants} Signers`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Spend Policy:</span>
                  <span className="text-[var(--zcash-gold)] font-semibold">
                    At least {activeVault.threshold} signers approve
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Network:</span>
                  <span className="text-[var(--text-primary)]">Zcash {activeVault.network}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Key Custody:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">100% On-Device</span>
                </div>
              </div>

              <Link
                href={`/vaults/${activeVault.id}/ceremony`}
                className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-[var(--border-default)] hover:border-[var(--zcash-gold-border)] bg-[var(--bg-secondary)] hover:bg-[var(--zcash-gold-dim)] text-xs text-[var(--text-secondary)] hover:text-[var(--zcash-gold)] transition"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Simulate Key Ceremony</span>
              </Link>
            </div>
          ) : (
            <div className="p-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] text-center space-y-3">
              <p className="text-xs text-[var(--text-muted)]">No active vault found.</p>
              <Link
                href="/vaults/new"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 text-black text-xs font-semibold"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Create One</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
