import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { label, threshold, totalParticipants, shieldedAddress, participants, status } = body;

    if (!label || !threshold || !totalParticipants || !participants || !Array.isArray(participants)) {
      return NextResponse.json(
        { success: false, error: "Missing required vault parameters" },
        { status: 400 }
      );
    }

    const vaultId = `vault-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const finalAddress =
      shieldedAddress ||
      "utest1quqhwz3035hsf3z2pv4v24qce5r42qalfeqgzxslfjrys660kfg5m6spw4fahvcpw02y4x38t4j3ykh44lnvmvct3zkjuuugggr2k772lh6gvs52t62yv94m2gngu7n7t0yk0whue3rtk5y73w9xj2hssm4p46wvsw5n8rqctm6c63vwdl3df2t6t9aqpr42qgs90cpyup7zghh8482";

    // 1. Save to local PostgreSQL (Prisma)
    const newVault = await prisma.vault.create({
      data: {
        id: vaultId,
        label,
        threshold: Number(threshold),
        totalParticipants: Number(totalParticipants),
        shieldedAddress: finalAddress,
        status: status === "PENDING_DKG" ? "PENDING_DKG" : "ACTIVE",
        network: "TESTNET",
        participants: {
          create: participants.map((p: { name: string; role?: string }, index: number) => ({
            id: `part-${vaultId}-${index + 1}`,
            label: `${p.name} (${p.role || "Key Holder"})`,
            publicKeyIdentifier: `02${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}00000000000000000000000000000000000000000000000000000000`,
            isActive: true,
          })),
        },
      },
      include: { participants: true },
    });

    // 2. Sync to Supabase
    try {
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
