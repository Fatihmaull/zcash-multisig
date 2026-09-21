import { ApprovalDetailView } from "@/components/approvals/ApprovalDetailView";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let dbApproval = null;
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

  const initialData = dbApproval
    ? {
        id: dbApproval.id,
        amountZec: (Number(dbApproval.amountZatoshi) / 100000000).toFixed(8),
        purpose: dbApproval.memo || "Treasury disbursement",
        vaultName: dbApproval.vault.label,
        recipientAddress: dbApproval.recipientAddress,
        status: dbApproval.status,
        txid: dbApproval.txid,
      }
    : undefined;

  return (
    <div className="space-y-6">
      <ApprovalDetailView requestId={id} initialData={initialData} />
    </div>
  );
}
