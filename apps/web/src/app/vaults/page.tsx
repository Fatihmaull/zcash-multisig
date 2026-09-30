import Link from "next/link";
import { Shield, KeyRound, ArrowUpRight, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import type { Prisma } from "@prisma/client";
import { getVaultIronwoodBalance } from "@/lib/onchain-balance";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

type VaultWithRelations = Prisma.VaultGetPayload<{
  include: { participants: true; approvalRequests: true };
}>;

export default async function VaultsPage() {
  let vaults: VaultWithRelations[] = [];

  try {
    vaults = await prisma.vault.findMany({
      include: {
        participants: true,
        approvalRequests: true,
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to load vaults from DB:", error);
  }

  // One lookup per vault, keyed by vault id. Resolved here because the render
  // below is synchronous.
  const balances = new Map(
    await Promise.all(
      vaults.map(
        async (v) =>
          [v.id, await getVaultIronwoodBalance(v.shieldedAddress)] as const
      )
    )
  );

interface SbVaultParticipant {
  id: string;
  label: string;
  public_key_identifier: string | null;
  is_active: boolean;
  joined_at?: string | null;
  updated_at?: string | null;
}

interface SbVaultApproval {
  id: string;
  recipient_address: string;
  amount_zatoshi?: number | string;
  memo: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "BROADCASTED";
  txid: string | null;
  anchor_block: number | null;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface SbVaultRecord {
  id: string;
  label: string;
  threshold: number;
  total_participants: number;
  shielded_address: string | null;
  status: "PENDING_DKG" | "ACTIVE" | "ARCHIVED";
  network: "TESTNET";
  created_at: string;
  updated_at: string;
  participants?: SbVaultParticipant[] | null;
  approval_requests?: SbVaultApproval[] | null;
}

  // Supabase fallback if local DB has fewer records
  if (vaults.length === 0 && supabase) {
    try {
      const { data: sbVaults } = await supabase
        .from("vaults")
        .select("*, participants(*), approval_requests(*)")
        .order("created_at", { ascending: false });

      if (sbVaults && sbVaults.length > 0) {
        vaults = (sbVaults as unknown as SbVaultRecord[]).map((v) => ({
          id: v.id,
          label: v.label,
          threshold: v.threshold,
          totalParticipants: v.total_participants,
          shieldedAddress: v.shielded_address,
          status: v.status,
          network: v.network,
          createdAt: new Date(v.created_at),
          updatedAt: new Date(v.updated_at),
          participants: (v.participants || []).map((p) => ({
            id: p.id,
            vaultId: v.id,
            label: p.label,
            publicKeyIdentifier: p.public_key_identifier,
            isActive: p.is_active,
            joinedAt: new Date(p.joined_at || 0),
            updatedAt: new Date(p.updated_at || 0),
          })),
          approvalRequests: (v.approval_requests || []).map((a) => ({
            id: a.id,
            vaultId: v.id,
            recipientAddress: a.recipient_address,
            amountZatoshi: BigInt(a.amount_zatoshi || 0),
            memo: a.memo,
            status: a.status,
            txid: a.txid,
            anchorBlock: a.anchor_block,
            expiresAt: a.expires_at ? new Date(a.expires_at) : null,
            createdAt: new Date(a.created_at || 0),
            updatedAt: new Date(a.updated_at || 0),
          })),
        }));
      }
    } catch (sbErr) {
      console.error("Supabase vaults query error:", sbErr);
    }
  }

  const activeVaultsCount = vaults.filter((v) => v.status === "ACTIVE").length;
  const pendingDkgCount = vaults.filter((v) => v.status === "PENDING_DKG").length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              Shielded Multisig Vaults
            </h1>
            <div className="hidden sm:flex items-center gap-1.5 pl-2">
              <span
                className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium border"
                style={{ background: "var(--success-bg)", color: "var(--success-text)", borderColor: "var(--success-border)" }}
              >
                {activeVaultsCount} Active
              </span>
              {pendingDkgCount > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium border"
                  style={{ background: "var(--warning-bg)", color: "var(--warning-text)", borderColor: "var(--warning-border)" }}
                >
                  {pendingDkgCount} Pending Setup
                </span>
              )}
            </div>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Collaborative vaults where outgoing transactions require threshold consensus from key holders.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          href="/vaults/new"
          icon={<KeyRound className="w-4 h-4" />}
        >
          Create New Vault
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Render Live Vaults from Database */}
        {vaults.map((vault) => {
          const isPendingDkg = vault.status === "PENDING_DKG";
          // Per vault, by its own address — never one figure reused across
          // cards. `null` means we cannot read this vault's balance, which is
          // the normal case: a shielded balance needs that vault's viewing
          // key, and the chain will not tell us from an address alone.
          const balance = balances.get(vault.id) ?? null;
          const pendingApprovalsCount = vault.approvalRequests.filter(
            (a) => a.status === "PENDING"
          ).length;

          return (
            <div 
              key={vault.id}
              className={`p-6 rounded-2xl border bg-[var(--bg-card)] shadow-xs transition-palette flex flex-col justify-between space-y-4 ${
                isPendingDkg
                  ? "border-[var(--warning-border)]"
                  : "border-[var(--border-default)] hover:border-[var(--zcash-gold-border)]"
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl border flex items-center justify-center"
                      style={
                        isPendingDkg
                          ? { background: "var(--warning-bg)", borderColor: "var(--warning-border)", color: "var(--warning)" }
                          : { background: "var(--zcash-gold-dim)", borderColor: "var(--zcash-gold-border)", color: "var(--zcash-gold)" }
                      }
                    >
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[var(--text-primary)] text-base">{vault.label}</h3>
                      <p className="text-xs text-[var(--text-muted)] font-mono">ID: {vault.id}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {pendingApprovalsCount > 0 && !isPendingDkg && (
                      <span
                        className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border font-mono"
                        style={{ background: "var(--warning-bg)", color: "var(--warning-text)", borderColor: "var(--warning-border)" }}
                      >
                        {pendingApprovalsCount} Need Sign
                      </span>
                    )}
                    {isPendingDkg ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border font-mono"
                        style={{ background: "var(--warning-bg)", color: "var(--warning-text)", borderColor: "var(--warning-border)" }}
                      >
                        PENDING DKG
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border font-mono"
                        style={{ background: "var(--success-bg)", color: "var(--success-text)", borderColor: "var(--success-border)" }}
                      >
                        ACTIVE
                      </span>
                    )}
                  </div>
                </div>

                {isPendingDkg && (
                  <div
                    className="p-3 rounded-xl border text-xs flex items-start gap-2"
                    style={{ background: "var(--warning-bg)", borderColor: "var(--warning-border)", color: "var(--warning-text)" }}
                  >
                    <KeyRound className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--warning)" }} />
                    <div className="leading-snug">
                      <span className="font-semibold">Key Ceremony Belum Ditandatangani</span>
                      <p className="text-[11px] mt-0.5 text-[var(--text-secondary)]">
                        Vault belum aktif karena para key holder belum menjalankan DKG Ceremony untuk membentuk group key.
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-mono break-all bg-[var(--bg-secondary)] p-2.5 rounded-xl border border-[var(--border-subtle)]">
                  {vault.shieldedAddress
                    || (isPendingDkg
                      ? "No shielded address yet — this vault's ceremony has not run."
                      : "Address not recorded in this app.")}
                </p>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[var(--border-subtle)] text-xs">
                  <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                    <span className="text-[var(--text-muted)] block text-[11px]">Shielded Balance</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="font-bold text-[var(--text-primary)] font-mono text-sm">
                        {isPendingDkg ? "—" : balance?.ironwood ?? "—"}
                      </span>
                      {!isPendingDkg && balance && (
                        <span className="text-[10px] text-[var(--zcash-gold)] font-bold">TAZ</span>
                      )}
                    </div>
                    <span
                      className="text-[9px] font-mono block mt-0.5"
                      style={{ color: balance ? "var(--success-text)" : "var(--text-muted)" }}
                    >
                      {isPendingDkg
                        ? "○ No ceremony yet"
                        : balance
                          ? "● Live Ironwood"
                          : "○ Needs this vault's viewing key"}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                    <span className="text-[var(--text-muted)] block text-[11px]">Spend Policy</span>
                    <span className="font-semibold text-[var(--text-primary)] block mt-0.5">
                      {vault.threshold} of {vault.totalParticipants} signers
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono block mt-0.5">
                      {vault.network}
                    </span>
                  </div>
                  <div className="col-span-2 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                    <span className="text-[var(--text-muted)] block text-[11px]">Signers ({vault.participants.length})</span>
                    <span className="text-[var(--text-secondary)] font-medium">
                      {vault.participants.length > 0 
                        ? vault.participants.map((p) => p.label).join(" • ")
                        : "No participants registered"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
                {isPendingDkg ? (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      href={`/vaults/${vault.id}/ceremony`}
                      icon={<KeyRound className="w-3.5 h-3.5" />}
                    >
                      Complete Key Ceremony
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      href={`/vaults/${vault.id}`}
                      iconRight={<ArrowUpRight className="w-3.5 h-3.5" />}
                    >
                      View Details
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      href={`/vaults/${vault.id}/ceremony`}
                      icon={<KeyRound className="w-3.5 h-3.5" />}
                    >
                      Simulate Ceremony
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      href={`/vaults/${vault.id}`}
                      iconRight={<ArrowUpRight className="w-3.5 h-3.5" />}
                    >
                      View Vault
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* Create New Vault Placeholder Card */}
        <Link
          href="/vaults/new"
          className="p-8 rounded-2xl border border-dashed border-[var(--border-default)] hover:border-[var(--zcash-gold-border)] bg-[var(--bg-secondary)] hover:bg-[var(--zcash-gold-dim)] transition-palette flex flex-col items-center justify-center text-center group min-h-[260px] space-y-3 cursor-pointer"
        >
          <div className="w-12 h-12 rounded-2xl bg-[var(--bg-card)] group-hover:bg-[var(--zcash-gold-dim)] group-hover:border-[var(--zcash-gold-border)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-[var(--zcash-gold)] shadow-xs">
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
