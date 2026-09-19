import Link from "next/link";
import { KeyCeremonyView } from "@/components/ceremony/KeyCeremonyView";
import { ArrowLeft } from "lucide-react";

export default function NewVaultPage() {
  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <Link
          href="/vaults"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition mb-3 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Vaults
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
          Create New Shielded Vault
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
          Follow this 3-step wizard to configure key holders and generate distributed threshold key shares without trusted coordinators.
        </p>
      </div>

      <KeyCeremonyView />
    </div>
  );
}
