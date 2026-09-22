import { ApprovalDetailView } from "@/components/approvals/ApprovalDetailView";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { getLiveWalletBalance } from "@/lib/onchain-balance";

export const dynamic = "force-dynamic";

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const onchainBalance = await getLiveWalletBalance();

  let dbApproval: any = null;
  try {
    dbApproval = await prisma.approvalRequest.findUnique({
      where: { id },
      include: {
        vault: {
          include: { participants: true },
        },
        signatureRoundEvents: true,
      },
    });
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

  return (
    <div className="space-y-6">
      <ApprovalDetailView 
        requestId={id} 
        initialData={initialData} 
        liveBalance={onchainBalance.ironwood} 
      />
    </div>
  );
}
