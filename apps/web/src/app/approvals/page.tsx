import Link from "next/link";
import { ArrowUpRight, Clock, FileCheck2, Send, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type ApprovalRequestWithRelations = Prisma.ApprovalRequestGetPayload<{
  include: {
    vault: { include: { participants: true } };
    signatureRoundEvents: true;
  };
}>;

export default async function ApprovalsPage() {
  let requests: ApprovalRequestWithRelations[] = [];

  try {
    requests = await prisma.approvalRequest.findMany({
      include: {
        vault: {
          include: { participants: true },
        },
        signatureRoundEvents: true,
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch approvals from DB:", error);
  }

  // Supabase fallback if local DB has fewer records
  if (requests.length === 0) {
    try {
      const { data: sbRequests } = await supabase
        .from("approval_requests")
        .select("*, vaults(*), signature_round_events(*)")
        .order("created_at", { ascending: false });

      if (sbRequests && sbRequests.length > 0) {
        requests = sbRequests.map((r: any) => ({
          id: r.id,
          vaultId: r.vault_id,
          recipientAddress: r.recipient_address,
          amountZatoshi: BigInt(r.amount_zatoshi || 0),
          memo: r.memo,
          status: r.status,
          txid: r.txid,
          anchorBlock: r.anchor_block,
          expiresAt: r.expires_at ? new Date(r.expires_at) : null,
          createdAt: new Date(r.created_at),
          updatedAt: new Date(r.updated_at),
          vault: {
            id: r.vaults?.id || "vault-demo-001",
            label: r.vaults?.label || "Foundation Treasury",
            threshold: r.vaults?.threshold || 2,
            totalParticipants: r.vaults?.total_participants || 3,
            shieldedAddress: r.vaults?.shielded_address || "",
            status: r.vaults?.status || "ACTIVE",
            network: r.vaults?.network || "TESTNET",
            createdAt: new Date(),
            updatedAt: new Date(),
            participants: [],
          },
          signatureRoundEvents: (r.signature_round_events || []).map((e: any) => ({
            id: e.id,
            approvalRequestId: r.id,
            participantId: e.participant_id,
            roundType: e.round_type,
            status: e.status,
            createdAt: new Date(),
          })),
        })) as any;
      }
    } catch (sbErr) {
      console.error("Supabase approvals query error:", sbErr);
    }
  }

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

        <Link
          href="/approvals/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs sm:text-sm font-semibold transition shadow-md shadow-amber-500/20 active:scale-98 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Propose Transfer</span>
        </Link>
      </div>

      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xs overflow-hidden divide-y divide-[var(--border-subtle)]">
        {requests.length > 0 ? (
          requests.map((req) => {
            const amountZec = (Number(req.amountZatoshi) / 100000000).toFixed(8);
            const receivedEvents = req.signatureRoundEvents.filter(
              (e) => e.status === "RECEIVED" && e.roundType === "SIGNATURE_SHARE"
            );
            const collectedCount = Math.max(1, receivedEvents.length);

            return (
              <div 
                key={req.id}
                className="p-5 sm:p-6 hover:bg-[var(--bg-surface-hover)] transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 max-w-xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                      {req.status}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] font-mono">ID: {req.id}</span>
                    <span className="text-[var(--text-muted)]">•</span>
                    <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>{req.expiresAt ? new Date(req.expiresAt).toLocaleDateString() : "24h window"}</span>
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-[var(--text-primary)]">
                    Send {amountZec} TAZ
                  </h3>

                  {req.memo && (
                    <p className="text-xs text-[var(--text-secondary)] italic">
                      &ldquo;{req.memo}&rdquo;
                    </p>
                  )}

                  <p className="text-xs text-[var(--text-muted)] font-mono truncate">
                    Recipient: {req.recipientAddress}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[var(--border-subtle)]">
                  <div className="text-left md:text-right">
                    <div className="text-xs font-semibold text-[var(--text-primary)]">
                      Signatures: {collectedCount} of {req.vault.threshold} Collected
                    </div>
                    <div className="text-[11px] text-amber-600 dark:text-amber-400">
                      Vault: {req.vault.label}
                    </div>
                  </div>

                  <Link
                    href={`/approvals/${req.id}`}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
                  >
                    <span>Review &amp; Sign</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-10 text-center space-y-3">
            <FileCheck2 className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">No Proposals Found</h3>
            <p className="text-xs text-[var(--text-muted)]">No pending spend approvals found in the database.</p>
          </div>
        )}
      </div>
    </div>
  );
}
