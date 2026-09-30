import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { label, threshold, totalParticipants, participants } = body;

    if (!label || !threshold || !totalParticipants || !participants || !Array.isArray(participants)) {
      return NextResponse.json(
        { success: false, error: "Missing required vault parameters" },
        { status: 400 }
      );
    }

    const vaultId = `vault-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    // A vault created here has no address, and cannot have one.
    //
    // A vault's shielded address is derived from a group key nobody holds
    // alone plus a seed every participant agreed on. Neither exists until the
    // ceremony has run, so there is nothing to write down yet.
    //
    // This used to fall back to a hardcoded address when none was supplied.
    // Two vaults created that way shared an address, which is impossible for
    // real vaults, and the list then showed them as ACTIVE with an on-chain
    // balance — for an address neither of them controlled. The route now
    // records what is true: a vault awaiting its ceremony.
    //
    // Run it with ./scripts/three-party-ceremony.sh, or drive it through
    // POST /coordinator/ceremony/create; the vault becomes ACTIVE via
    // /api/vaults/[id]/ceremony once every participant reports the same
    // address and the coordinator has verified it.

    // 1. Save to local PostgreSQL (Prisma)
    const newVault = await prisma.vault.create({
      data: {
        id: vaultId,
        label,
        threshold: Number(threshold),
        totalParticipants: Number(totalParticipants),
        shieldedAddress: null,
        // Not negotiable by the caller. A vault is ACTIVE when a ceremony has
        // produced it, and that transition belongs to /api/vaults/[id]/ceremony
        // where the coordinator's verification happens.
        status: "PENDING_DKG",
        network: "TESTNET",
        participants: {
          create: participants.map((p: { name: string; role?: string }, index: number) => ({
            id: `part-${vaultId}-${index + 1}`,
            label: `${p.name} (${p.role || "Key Holder"})`,
            // The schema says "Set after DKG completes", and it is right.
            // A participant's FROST identifier comes out of the ceremony; the
            // previous value here was `02` followed by random hex, which is
            // not an identifier of anything and would have been used to
            // attribute a signature to a person.
            publicKeyIdentifier: null,
            isActive: true,
          })),
        },
      },
      include: { participants: true },
    });

    // 2. Sync to Supabase
    try {
      if (!supabase) throw new Error("Supabase is not configured");
      const { error: supabaseVaultErr } = await supabase.from("vaults").upsert(
        {
          id: newVault.id,
          label: newVault.label,
          threshold: newVault.threshold,
          total_participants: newVault.totalParticipants,
          shielded_address: newVault.shieldedAddress,
          status: newVault.status,
          network: "TESTNET",
        },
        { onConflict: "id" }
      );

      if (supabaseVaultErr) {
        console.error("Supabase vault sync error:", supabaseVaultErr);
      } else if (newVault.participants && newVault.participants.length > 0) {
        const supabaseParticipants = newVault.participants.map((p) => ({
          id: p.id,
          vault_id: newVault.id,
          label: p.label,
          public_key_identifier: p.publicKeyIdentifier,
          is_active: p.isActive,
        }));
        await supabase.from("participants").upsert(supabaseParticipants, { onConflict: "id" });
      }
    } catch (sbErr) {
      console.error("Failed to sync new vault to Supabase:", sbErr);
    }

    return NextResponse.json({
      success: true,
      vault: newVault,
    });
  } catch (error) {
    console.error("Error creating vault:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create vault",
      },
      { status: 500 }
    );
  }
}
