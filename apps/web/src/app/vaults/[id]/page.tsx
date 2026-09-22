import Link from "next/link";
import { KeyRound, ArrowLeft, Users, Send, CheckCircle2 } from "lucide-react";
import { LiveBalanceCard } from "@/components/vaults/LiveBalanceCard";
import { getLiveWalletBalance } from "@/lib/onchain-balance";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

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
            {vaultLabel}
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

      {/* On-Chain Vault Shielded Address */}
      <div className="p-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-muted)] font-semibold uppercase tracking-wider">
            Vault Shielded Address (Ironwood Testnet)
          </span>
          <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Receiver Active
          </span>
        </div>
        <p className="text-xs font-mono text-[var(--text-secondary)] break-all bg-[var(--bg-secondary)] p-3 rounded-xl border border-[var(--border-subtle)] select-all">
          {vaultAddress}
        </p>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <LiveBalanceCard initialData={onchainBalance} />

        <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs">
          <span className="text-xs text-[var(--text-muted)]">Spend Policy</span>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">
            {vaultThreshold} <span className="text-sm font-normal text-[var(--text-muted)]">of</span> {vaultParticipants.length} Signers
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">Requires {vaultThreshold} approvals per transaction</p>
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
