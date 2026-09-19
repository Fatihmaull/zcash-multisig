import { ApprovalDetailView } from "@/components/approvals/ApprovalDetailView";

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <ApprovalDetailView requestId={id} />
    </div>
  );
}
