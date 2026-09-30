import Link from "next/link";
import { KeyRound, ArrowLeft, Users, Send, CheckCircle2, FileDown } from "lucide-react";
import { LiveBalanceCard } from "@/components/vaults/LiveBalanceCard";
import { getLiveWalletBalance, getVaultIronwoodBalance } from "@/lib/onchain-balance";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

interface ParticipantItem {
  id: string;
  label: string;
  publicKeyIdentifier?: string | null;
  isActive: boolean;
}

interface VaultDetailRecord {
  id: string;
  label: string;
  threshold: number;
  totalParticipants: number;
  shieldedAddress: string | null;
  status: string;
  network: string;
  participants: ParticipantItem[];
}

export default async function VaultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const onchainBalance = await getLiveWalletBalance();

  let vault: VaultDetailRecord | null = null;
  try {
    const res = await prisma.vault.findUnique({
      where: { id },
      include: { participants: true },
    });
    if (res) {
      vault = {
        id: res.id,
        label: res.label,
        threshold: res.threshold,
        totalParticipants: res.totalParticipants,
        shieldedAddress: res.shieldedAddress,
        status: res.status,
        network: res.network,
        participants: res.participants.map((p) => ({
          id: p.id,
          label: p.label,
          publicKeyIdentifier: p.publicKeyIdentifier,
          isActive: p.isActive,
        })),
      };
    }
  } catch (err) {
    console.error("Prisma vault query error:", err);
  }

  // Fallback to Supabase if not in local DB
  if (!vault && supabase) {
    try {
      const { data: sbVault } = await supabase
        .from("vaults")
        .select("*, participants(*)")
        .eq("id", id)
        .maybeSingle();

      if (sbVault) {
        vault = {
          id: sbVault.id,
          label: sbVault.label,
          threshold: sbVault.threshold,
          totalParticipants: sbVault.total_participants,
          shieldedAddress: sbVault.shielded_address,
          status: sbVault.status,
          network: sbVault.network,
          participants: (sbVault.participants || []).map((p: {
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
    } catch (sbErr) {
      console.error("Supabase vault query error:", sbErr);
    }
  }

  if (!vault) {
    return (
      <div className="max-w-5xl mx-auto p-8 text-sm text-[var(--text-secondary)]">
        Vault not found.
      </div>
    );
  }

  const vaultLabel = vault.label;
  const vaultThreshold = vault.threshold;
  const vaultParticipants = vault.participants;
  // An ACTIVE vault can still have no address stored here. That is not the
  // same claim as "the ceremony has not run".
  const vaultAddress = vault.shieldedAddress ?? null;

  // Non-null only when the wallet we can actually read is this vault's.
  const vaultBalance = await getVaultIronwoodBalance(vaultAddress);

  const isPendingDkg = vault?.status === "PENDING_DKG";

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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              {vaultLabel}
            </h1>
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
          <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">ID: {id}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isPendingDkg ? (
            <Button
              variant="primary"
              size="sm"
              href={`/vaults/${id}/ceremony`}
              icon={<KeyRound className="w-4 h-4" />}
            >
              Sign Key Ceremony
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              href={`/vaults/${id}/ceremony`}
              icon={<KeyRound className="w-4 h-4 text-[var(--text-secondary)]" />}
            >
              Simulate Key Ceremony
            </Button>
          )}

          <div className="relative group inline-block">
            <Button
              variant="outline"
              size="sm"
              icon={<FileDown className="w-4 h-4" style={{ color: "var(--success)" }} />}
            >
              Audit Export
            </Button>
            <div className="absolute right-0 mt-1 hidden group-hover:flex group-focus-within:flex flex-col w-44 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xl p-1.5 z-20 text-xs backdrop-blur-md">
              <a
                href={`/api/vaults/${id}/audit-export?format=json`}
                download
                className="px-3 py-2 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] flex items-center justify-between transition-colors"
              >
                <span>Export JSON</span>
                <span className="font-mono text-[10px] text-[var(--text-muted)]">.json</span>
              </a>
              <a
                href={`/api/vaults/${id}/audit-export?format=csv`}
                download
                className="px-3 py-2 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] flex items-center justify-between transition-colors"
              >
                <span>Export CSV</span>
                <span className="font-mono text-[10px] text-[var(--text-muted)]">.csv</span>
              </a>
            </div>
          </div>

          <Button
            variant={isPendingDkg ? "outline" : "primary"}
            size="sm"
            href={isPendingDkg ? `/vaults/${id}/ceremony` : "/approvals"}
            icon={<Send className="w-4 h-4" />}
          >
            {isPendingDkg ? "Ceremony First" : "Propose Transfer"}
          </Button>
        </div>
      </div>

      {/* Pending DKG Alert Notice */}
      {isPendingDkg && (
        <div
          className="p-4 sm:p-5 rounded-2xl border flex items-start justify-between gap-4"
          style={{ borderColor: "var(--warning-border)", background: "var(--warning-bg)" }}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4" style={{ color: "var(--warning)" }} />
              <h3 className="text-sm font-semibold" style={{ color: "var(--warning-text)" }}>
                Key Ceremony Belum Ditandatangani (PENDING_DKG)
              </h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-2xl">
              Vault ini telah didaftarkan namun belum aktif. Agar dapat digunakan untuk menerima dan menandatangani transaksi transfer, seluruh key holder harus menyelesaikan Distributed Key Generation (DKG) Ceremony.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            href={`/vaults/${id}/ceremony`}
            className="shrink-0"
            icon={<KeyRound className="w-3.5 h-3.5" />}
          >
            Sign Ceremony
          </Button>
        </div>
      )}

      {/* On-Chain Vault Shielded Address */}
      <div className="p-4 sm:p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">
            Vault Shielded Address (Ironwood Testnet)
          </span>
          {isPendingDkg ? (
            <span className="font-mono text-[11px] font-medium" style={{ color: "var(--warning-text)" }}>
              Ceremony has not run
            </span>
          ) : !vaultAddress ? (
            <span className="font-mono text-[11px] font-medium text-[var(--text-muted)]">
              Address not recorded
            </span>
          ) : null}
        </div>
        <div className="bg-[var(--bg-secondary)] p-3 rounded-xl border border-[var(--border-subtle)] flex items-center justify-between gap-3">
          <p className="text-xs font-mono text-[var(--text-secondary)] break-all select-all leading-relaxed">
            {vaultAddress
              ?? (isPendingDkg
                ? "No address yet — this vault's ceremony has not run."
                : "Address not recorded in this app.")}
          </p>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
        {vaultBalance && onchainBalance ? (
          <LiveBalanceCard initialData={onchainBalance} />
        ) : (
          <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs flex flex-col justify-between">
            <div>
              <span className="text-xs text-[var(--text-muted)] font-medium">
                Shielded Balance
              </span>
              <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">—</div>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-snug mt-2">
              {isPendingDkg
                ? "No ceremony has run for this vault, so it has no address and holds nothing."
                : "A shielded balance cannot be read from an address — it needs this vault's viewing key, and this machine does not have it."}
            </p>
          </div>
        )}

        <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs text-[var(--text-muted)] font-medium">Spend Policy</span>
            <div className="text-2xl font-bold text-[var(--text-primary)] mt-1 flex items-baseline gap-1.5">
              <span>{vaultThreshold}</span>
              <span className="text-sm font-normal text-[var(--text-muted)]">of</span>
              <span>{vaultParticipants.length}</span>
              <span className="text-sm font-medium text-[var(--text-secondary)]">Signers</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)]">
            <p className="text-[11px] text-[var(--text-muted)]">Requires {vaultThreshold} approvals per transaction</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs text-[var(--text-muted)] font-medium">Key Custody</span>
            <div className="text-2xl font-bold mt-1" style={{ color: "var(--success-text)" }}>Non-custodial</div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)]">
            <p className="text-[11px] text-[var(--text-muted)]">Keys held exclusively on client devices</p>
          </div>
        </div>
      </div>

      {/* Key Holders List */}
      <div className="p-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--zcash-gold)]" />
            <span>Key Holders &amp; Devices ({vaultParticipants.length})</span>
          </h2>
          <span className="text-xs flex items-center gap-1" style={{ color: "var(--success-text)" }}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Zero Keys on Server</span>
          </span>
        </div>

        <div className="divide-y divide-[var(--border-subtle)] text-xs">
          {vaultParticipants.length === 0 ? (
            <p className="py-3.5 text-xs text-[var(--text-muted)]">No participants recorded.</p>
          ) : (
            vaultParticipants.map((p: ParticipantItem, idx: number) => (
              <div key={p.id || idx} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{p.label}</div>
                  <div className="text-xs text-[var(--text-muted)] font-mono break-all">
                    {p.publicKeyIdentifier
                      ? `Public key identifier recorded · ${p.publicKeyIdentifier}`
                      : "No public key identifier recorded"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
