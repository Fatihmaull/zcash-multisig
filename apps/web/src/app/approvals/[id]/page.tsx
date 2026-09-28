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
    /// Null until a ceremony has produced one.
    shieldedAddress?: string | null;
    participants?: unknown[];
  } | null;
  signatureRoundEvents?: unknown[];
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
  if (!dbApproval) {
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
          vault: {
            label: sbApproval.vaults?.label || "Foundation Treasury",
            threshold: sbApproval.vaults?.threshold || 2,
            participants: [],
          },
          signatureRoundEvents: sbApproval.signature_round_events || [],
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
        purpose: dbApproval.memo || "Treasury disbursement",
        vaultName: dbApproval.vault?.label || "Foundation Treasury",
        recipientAddress: dbApproval.recipientAddress,
        status: dbApproval.status,
        txid: dbApproval.txid,
        threshold: dbApproval.vault?.threshold || 2,
        participants: dbApproval.vault?.participants || [],
        signatureRoundEvents: dbApproval.signatureRoundEvents || [],
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
