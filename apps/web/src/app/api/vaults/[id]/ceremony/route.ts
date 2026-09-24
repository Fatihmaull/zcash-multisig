import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// POST /api/vaults/[id]/ceremony - Activate vault upon completing Key Ceremony
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { shieldedAddress } = body;

    // 1. Update in local Prisma
    const updatedVault = await prisma.vault.update({
      where: { id },
      data: {
        status: "ACTIVE",
        ...(shieldedAddress ? { shieldedAddress } : {}),
      },
      include: {
        participants: true,
      },
    });

    // 2. Sync to Supabase
    try {
      await supabase
        .from("vaults")
        .update({
          status: "ACTIVE",
          ...(shieldedAddress ? { shielded_address: shieldedAddress } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    } catch (sbErr) {
      console.warn("Failed to sync ceremony activation to Supabase:", sbErr);
    }

    return NextResponse.json({
      success: true,
      message: `Vault ${id} activated successfully after key ceremony`,
      vault: updatedVault,
    });
  } catch (error) {
    console.error("Ceremony activation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to activate vault",
      },
      { status: 500 }
    );
  }
}

// GET /api/vaults/[id]/ceremony - Get vault ceremony details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let vault = await prisma.vault.findUnique({
      where: { id },
      include: { participants: true },
    });

    if (!vault) {
      const { data: sbVault } = await supabase
        .from("vaults")
        .select("*, participants(*)")
        .eq("id", id)
        .maybeSingle();

      if (sbVault) {
        vault = {
          id: sbVault.id,
          label: sbVault.label,
          threshold: sbVault.threshold,
          totalParticipants: sbVault.total_participants,
          shieldedAddress: sbVault.shielded_address,
          status: sbVault.status,
          network: sbVault.network,
          createdAt: new Date(sbVault.created_at),
          updatedAt: new Date(sbVault.updated_at),
          participants: (sbVault.participants || []).map((p: any) => ({
            id: p.id,
            vaultId: sbVault.id,
            label: p.label,
            publicKeyIdentifier: p.public_key_identifier,
            isActive: p.is_active,
            joinedAt: new Date(p.joined_at || 0),
            updatedAt: new Date(p.updated_at || 0),
          })),
        } as any;
      }
    }

    if (!vault) {
      return NextResponse.json(
        { success: false, error: "Vault not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      vault,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch vault ceremony data" },
      { status: 500 }
    );
  }
}
