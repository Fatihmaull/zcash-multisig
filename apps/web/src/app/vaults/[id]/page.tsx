import Link from "next/link";
import { KeyRound, ArrowLeft, Users, Send, CheckCircle2, FileDown } from "lucide-react";
import { LiveBalanceCard } from "@/components/vaults/LiveBalanceCard";
import { getLiveWalletBalance } from "@/lib/onchain-balance";
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
  if (!vault) {
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

  const vaultLabel = vault?.label || "Foundation Treasury";
  const vaultThreshold = vault?.threshold || 2;
  const vaultParticipants = vault?.participants && vault.participants.length > 0
    ? vault.participants
    : [
        { id: "part-alice", label: "Alice (Lead Treasurer)", isActive: true },
        { id: "part-bob", label: "Bob (Finance Director)", isActive: true },
        { id: "part-carol", label: "Carol (Standby Signer)", isActive: true },
      ];
  const vaultAddress = vault?.shieldedAddress || onchainBalance.address;

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
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                PENDING DKG
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
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
              icon={<KeyRound className="w-4 h-4 text-amber-500" />}
            >
              Simulate Key Ceremony
            </Button>
          )}

          <div className="relative group inline-block">
            <Button
              variant="outline"
              size="sm"
              icon={<FileDown className="w-4 h-4 text-emerald-500" />}
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
        <div className="p-4 sm:p-5 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
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
            <span className="text-amber-600 dark:text-amber-400 font-mono text-[11px] flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Pending DKG Setup
            </span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px] flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Receiver Active
            </span>
          )}
        </div>
        <div className="bg-[var(--bg-secondary)] p-3 rounded-xl border border-[var(--border-subtle)] flex items-center justify-between gap-3">
          <p className="text-xs font-mono text-[var(--text-secondary)] break-all select-all leading-relaxed">
            {vaultAddress}
          </p>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
        <LiveBalanceCard initialData={onchainBalance} />

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
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">Zero Custody</div>
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
          <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Zero Keys on Server</span>
          </span>
        </div>

        <div className="divide-y divide-[var(--border-subtle)] text-xs">
          {vaultParticipants.map((p: ParticipantItem, idx: number) => (
            <div key={p.id || idx} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">{p.label}</div>
                <div className="text-xs text-[var(--text-muted)]">Participant #{idx + 1} • Key Share Registered</div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium font-mono ${
                p.isActive 
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-default)]"
              } self-start sm:self-auto`}>
                {p.isActive ? "CONNECTED" : "STANDBY"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
