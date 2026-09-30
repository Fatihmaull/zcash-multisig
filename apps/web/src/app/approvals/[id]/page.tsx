import { ApprovalDetailView } from "@/components/approvals/ApprovalDetailView";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { getVaultIronwoodBalance } from "@/lib/onchain-balance";

export const dynamic = "force-dynamic";

type ApprovalDetailRecord = {
  id: string;
  amountZatoshi: bigint;
  memo: string | null;
  recipientAddress: string;
  status: string;
  txid: string | null;
  vault?: {
    label: string;
    threshold: number;
    totalParticipants?: number | null;
    /// Null until a ceremony has produced one.
    shieldedAddress?: string | null;
    participants?: Array<{ id: string; label: string }>;
  } | null;
  signatureRoundEvents?: Array<{
    participantId: string;
    roundType: string;
    status: string;
    culpritDetected: boolean;
  }>;
};

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let dbApproval: ApprovalDetailRecord | null = null;
  try {
    const res = await prisma.approvalRequest.findUnique({
      where: { id },
      include: {
        vault: {
          include: { participants: true },
        },
        signatureRoundEvents: true,
      },
    });
    if (res) {
      dbApproval = res;
    }
  } catch (error) {
    console.error("Error fetching approval detail:", error);
  }

  // Supabase fallback
  if (!dbApproval && supabase) {
    try {
      const { data: sbApproval } = await supabase
        .from("approval_requests")
        .select("*, vaults(*), signature_round_events(*)")
        .eq("id", id)
        .maybeSingle();

      if (sbApproval) {
        dbApproval = {
          id: sbApproval.id,
          amountZatoshi: BigInt(sbApproval.amount_zatoshi || 0),
          memo: sbApproval.memo,
          recipientAddress: sbApproval.recipient_address,
          status: sbApproval.status,
          txid: sbApproval.txid,
          vault: sbApproval.vaults
            ? {
                label: sbApproval.vaults.label,
                threshold: sbApproval.vaults.threshold,
                totalParticipants: sbApproval.vaults.total_participants,
                shieldedAddress: sbApproval.vaults.shielded_address,
                participants: [],
              }
            : null,
          signatureRoundEvents: (sbApproval.signature_round_events || []).map(
            (event: {
              participant_id: string;
              round_type: string;
              status: string;
              culprit_detected?: boolean;
            }) => ({
              participantId: event.participant_id,
              roundType: event.round_type,
              status: event.status,
              culpritDetected: Boolean(event.culprit_detected),
            })
          ),
        };
      }
    } catch (sbErr) {
      console.error("Supabase approval fetch error:", sbErr);
    }
  }

  const initialData = dbApproval
    ? {
        id: dbApproval.id,
        amountZec: (Number(dbApproval.amountZatoshi) / 100000000).toFixed(8),
        purpose: dbApproval.memo,
        vaultName: dbApproval.vault?.label ?? null,
        recipientAddress: dbApproval.recipientAddress || null,
        status: dbApproval.status,
        txid: dbApproval.txid,
        threshold: dbApproval.vault?.threshold ?? null,
        totalParticipants: dbApproval.vault?.totalParticipants ?? null,
        participants: (dbApproval.vault?.participants || []).map((participant) => ({
          id: participant.id,
          label: participant.label,
        })),
        signatureRoundEvents: (dbApproval.signatureRoundEvents || []).map((event) => ({
          participantId: event.participantId,
          roundType: event.roundType,
          status: event.status,
          culpritDetected: event.culpritDetected,
        })),
      }
    : undefined;

  // This approval's own vault, or null. The sufficiency warning inside the
  // view is skipped when it is null, because a shortfall you have not
  // measured is not a shortfall you can warn about.
  //
  // This used to be getLiveWalletBalance() — the operator's local devtool
  // wallet, whichever vault the approval belonged to. It gated signing and
  // told the user it was quoting "saldo shielded vault".
  const vaultBalance = await getVaultIronwoodBalance(
    dbApproval?.vault?.shieldedAddress ?? null
  );

  return (
    <div className="space-y-6">
      <ApprovalDetailView 
        requestId={id} 
        initialData={initialData} 
        liveBalance={vaultBalance?.ironwood ?? null} 
      />
    </div>
  );
}
