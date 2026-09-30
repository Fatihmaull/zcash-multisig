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
import { supabase } from "@/lib/supabase";
import { getVaultIronwoodBalance } from "@/lib/onchain-balance";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

interface DashboardParticipant {
  id: string;
  label: string;
  publicKeyIdentifier?: string | null;
  isActive: boolean;
}

interface DashboardVault {
  id: string;
  label: string;
  threshold: number;
  totalParticipants: number;
  shieldedAddress?: string | null;
  status: string;
  network: string;
  participants: DashboardParticipant[];
}

interface DashboardApproval {
  id: string;
  vaultId: string;
  recipientAddress: string;
  amountZatoshi: bigint;
  memo: string | null;
  status: string;
  expiresAt: Date | null;
  vault: {
    label: string;
  };
}

export default async function DashboardPage() {
  // Query live vaults and pending approvals from database
  let vaultsCount = 0;
  let approvalsCount = 0;
  let activeVault: DashboardVault | null = null;
  let latestApproval: DashboardApproval | null = null;
  // Summed across the vaults whose balance we can actually read, with a count
  // of how many we cannot. Never one wallet's figure presented as the treasury.
  let treasuryZat = 0;
  let readable = 0;
  let unreadable = 0;
  let atHeight = 0;

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

    // A shielded balance needs the vault's viewing key; an address will not
    // do. So this tile adds up what is genuinely readable and says how many
    // vaults are not, rather than printing a number that covers for them.
    //
    // It used to show getLiveWalletBalance() — the operator's own devtool
    // wallet — labelled "Shielded Treasury" with a live indicator beside it.
    for (const v of vaults) {
      const b = await getVaultIronwoodBalance(v.shieldedAddress);
      if (b) {
        treasuryZat += Math.round(parseFloat(b.ironwood) * 100_000_000);
        if (b.height != null) atHeight = Math.max(atHeight, b.height);
        readable += 1;
      } else {
        unreadable += 1;
      }
    }
    if (vaults[0]) {
      activeVault = {
        id: vaults[0].id,
        label: vaults[0].label,
        threshold: vaults[0].threshold,
        totalParticipants: vaults[0].totalParticipants,
        shieldedAddress: vaults[0].shieldedAddress,
        status: vaults[0].status,
        network: vaults[0].network,
        participants: vaults[0].participants.map((p) => ({
          id: p.id,
          label: p.label,
          publicKeyIdentifier: p.publicKeyIdentifier,
          isActive: p.isActive,
        })),
      };
    }
    if (approvals[0]) {
      latestApproval = {
        id: approvals[0].id,
        vaultId: approvals[0].vaultId,
        recipientAddress: approvals[0].recipientAddress,
        amountZatoshi: approvals[0].amountZatoshi,
        memo: approvals[0].memo,
        status: approvals[0].status,
        expiresAt: approvals[0].expiresAt,
        vault: {
          label: approvals[0].vault.label,
        },
      };
    }
  } catch (error) {
    console.error("Dashboard DB query error:", error);
  }

  // Supabase fallback if local DB has 0 vaults
  if (!activeVault && supabase) {
    try {
      const [sbVaultsRes, sbApprovalsRes] = await Promise.all([
        supabase.from("vaults").select("*, participants(*)").order("created_at", { ascending: false }),
        supabase.from("approval_requests").select("*, vaults(*), signature_round_events(*)").eq("status", "PENDING").order("created_at", { ascending: false }),
      ]);

      if (sbVaultsRes.data && sbVaultsRes.data.length > 0) {
        vaultsCount = sbVaultsRes.data.length;
        const v = sbVaultsRes.data[0];
        activeVault = {
          id: v.id,
          label: v.label,
          threshold: v.threshold,
          totalParticipants: v.total_participants,
          shieldedAddress: v.shielded_address,
          status: v.status,
          network: v.network,
          participants: (v.participants || []).map((p: {
            id: string;
            label: string;
            public_key_identifier?: string | null;
            is_active: boolean;
          }) => ({
            id: p.id,
            label: p.label,
            publicKeyIdentifier: p.public_key_identifier,
            isActive: p.is_active,
          })),
        };
      }

      if (sbApprovalsRes.data && sbApprovalsRes.data.length > 0) {
        approvalsCount = sbApprovalsRes.data.length;
        const a = sbApprovalsRes.data[0];
        latestApproval = {
          id: a.id,
          vaultId: a.vault_id,
          recipientAddress: a.recipient_address,
          amountZatoshi: BigInt(a.amount_zatoshi || 0),
          memo: a.memo,
          status: a.status,
          expiresAt: a.expires_at ? new Date(a.expires_at) : null,
          vault: {
            label: a.vaults?.label || "Vault",
          },
        };
      }
    } catch (sbErr) {
      console.error("Supabase dashboard fallback error:", sbErr);
    }
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 sm:p-8 lg:p-10 shadow-xs">
        <div className="relative z-10 max-w-2xl space-y-3.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--zcash-gold-dim)] border border-[var(--zcash-gold-border)] text-xs text-[var(--text-primary)] font-medium">
            <Shield className="w-3.5 h-3.5 text-[var(--zcash-gold)]" />
            <span>Zcash Shielded Multisig</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[var(--text-primary)] leading-snug">
            Treasury Dashboard &amp; Operations
          </h1>

          <p className="text-[var(--text-secondary)] text-sm sm:text-base leading-relaxed">
            A collaborative treasury vault where transfers require cryptographic consensus from{" "}
            {activeVault ? (
              <strong>{activeVault.threshold} of {activeVault.totalParticipants} signers</strong>
            ) : (
              "the vault's signers"
            )}
            . Private keys stay on the devices that hold them.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <Button
              variant="primary"
              size="md"
              href="/vaults/new"
              icon={<KeyRound className="w-4 h-4" />}
            >
              Create New Vault
            </Button>
            <Button
              variant="outline"
              size="md"
              href="/approvals"
              icon={<FileCheck2 className="w-4 h-4" style={{ color: "var(--warning)" }} />}
            >
              Pending Approvals ({approvalsCount})
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics Row: Live Cards from DB */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Vaults */}
        <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Active Vaults</span>
            <div className="w-7 h-7 rounded-lg bg-[var(--zcash-gold-dim)] flex items-center justify-center text-[var(--zcash-gold)]">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">
            {vaultsCount} Vault{vaultsCount !== 1 ? "s" : ""}
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            Policy: {activeVault ? `${activeVault.threshold} of ${activeVault.totalParticipants}` : "—"}
          </div>
        </div>

        {/* Metric 2: Pending Approvals */}
        <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Awaiting Signature</span>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "var(--warning-bg)", color: "var(--warning)" }}
            >
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">
            {approvalsCount} Proposal{approvalsCount !== 1 ? "s" : ""}
          </div>
          <div className="text-xs" style={{ color: approvalsCount > 0 ? "var(--warning-text)" : "var(--text-muted)" }}>
            {approvalsCount > 0 ? "Threshold pending" : "No pending proposals"}
          </div>
        </div>

        {/* Metric 3: Shielded balance, across the vaults we can read */}
        <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Shielded Treasury</span>
            {readable > 0 && (
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--success)" }} title="Read with a viewing key" />
            )}
          </div>
          <div
            className="text-2xl font-bold font-mono flex items-baseline gap-1.5"
            style={{ color: readable > 0 ? "var(--success-text)" : "var(--text-muted)" }}
          >
            <span>{readable > 0 ? (treasuryZat / 100_000_000).toFixed(8) : "—"}</span>
            {readable > 0 && (
              <span className="text-xs font-bold text-[var(--zcash-gold)]">TAZ</span>
            )}
          </div>
          <div className="text-xs text-[var(--text-muted)] flex items-center justify-between gap-2">
            <span>
              {readable > 0
                ? `Ironwood · ${readable} of ${readable + unreadable} vault${readable + unreadable === 1 ? "" : "s"}`
                : "Needs each vault's viewing key"}
            </span>
            {atHeight > 0 && <span className="font-mono text-[10px]">#{atHeight}</span>}
          </div>
        </div>

        {/* Metric 4: Network */}
        <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Network Node</span>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "var(--info-bg)", color: "var(--info)" }}
            >
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">Testnet</div>
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
              className="text-xs text-[var(--zcash-gold)] hover:underline inline-flex items-center gap-1 transition-palette"
            >
              <span>View all</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {latestApproval ? (
            <div className="p-5 sm:p-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-4 hover:border-[var(--zcash-gold-border)] transition-palette">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded text-[11px] font-semibold border font-mono"
                      style={{
                        background: "var(--warning-bg)",
                        color: "var(--warning-text)",
                        borderColor: "var(--warning-border)",
                      }}
                    >
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
                  <div className="text-[11px] text-[var(--text-secondary)]">
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

                <Button
                  variant="primary"
                  size="sm"
                  href={`/approvals/${latestApproval.id}`}
                  iconRight={<ArrowUpRight className="w-3.5 h-3.5" />}
                >
                  Review &amp; Sign
                </Button>
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
              className="text-xs text-[var(--zcash-gold)] hover:underline inline-flex items-center gap-1 transition-palette"
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
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold border font-mono"
                  style={
                    activeVault.status === "PENDING_DKG"
                      ? { background: "var(--warning-bg)", color: "var(--warning-text)", borderColor: "var(--warning-border)" }
                      : activeVault.status === "ACTIVE"
                        ? { background: "var(--success-bg)", color: "var(--success-text)", borderColor: "var(--success-border)" }
                        : { background: "var(--border-subtle)", color: "var(--text-muted)", borderColor: "var(--border-default)" }
                  }
                >
                  {activeVault.status}
                </span>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-[var(--border-subtle)] text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Key Holders:</span>
                  <span className="text-[var(--text-primary)] font-medium">
                    {activeVault.participants.length > 0 
                      ? activeVault.participants.map((p: { label: string }) => p.label.split(" ")[0]).join(", ")
                      : `${activeVault.totalParticipants} Signers`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Spend Policy:</span>
                  <span className="text-[var(--text-primary)] font-semibold">
                    At least {activeVault.threshold} signers approve
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Network:</span>
                  <span className="text-[var(--text-primary)]">Zcash {activeVault.network}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Key Custody:</span>
                  <span className="font-medium" style={{ color: "var(--success-text)" }}>On-device</span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                fullWidth
                href={`/vaults/${activeVault.id}/ceremony`}
                icon={<KeyRound className="w-3.5 h-3.5" />}
              >
                Simulate Key Ceremony
              </Button>
            </div>
          ) : (
            <div className="p-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] text-center space-y-3">
              <p className="text-xs text-[var(--text-muted)]">No active vault found.</p>
              <Button
                variant="primary"
                size="sm"
                href="/vaults/new"
                icon={<KeyRound className="w-3.5 h-3.5" />}
              >
                Create One
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
