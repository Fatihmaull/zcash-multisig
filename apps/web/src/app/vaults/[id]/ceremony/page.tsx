import { KeyCeremonyView } from "@/components/ceremony/KeyCeremonyView";

export default async function CeremonyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <KeyCeremonyView vaultId={id} />
    </div>
  );
}
