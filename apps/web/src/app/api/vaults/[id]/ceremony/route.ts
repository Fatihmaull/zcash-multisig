import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { coordinatorClient } from "@/lib/coordinator-client";

export const dynamic = "force-dynamic";

/**
 * Validates that an address conforms to Zcash testnet unified address specification.
 * A testnet unified address starts with 'utest1' and is encoded with bech32m characters.
 */
function isValidZcashTestnetUnifiedAddress(address: unknown): address is string {
  if (typeof address !== "string") return false;
  const trimmed = address.trim();
  const bech32mRegex = /^utest1[02-9ac-hj-np-z]{80,350}$/i;
  return bech32mRegex.test(trimmed);
}

// POST /api/vaults/[id]/ceremony - Activate vault upon completing Key Ceremony
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { shieldedAddress, publicKeyPackage } = body;

    // 1. Verify that the vault exists
    const existingVault = await prisma.vault.findUnique({
      where: { id },
      include: { participants: true },
    });

    if (!existingVault) {
      return NextResponse.json(
        { success: false, error: "Vault not found" },
        { status: 404 }
      );
    }

    // 2. Validate cryptographic shielded address format (reject unverified / arbitrary strings)
    if (!shieldedAddress || !isValidZcashTestnetUnifiedAddress(shieldedAddress)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid shielded address. A valid Zcash testnet unified address (starting with 'utest1...') is required for vault activation.",
        },
        { status: 400 }
      );
    }

    const validatedAddress = shieldedAddress.trim();

    // 3. If live coordinator is active, register and cryptographically verify the vault
    if (coordinatorClient.isLive()) {
      try {
        const regResult = await coordinatorClient.registerVault({
          label: existingVault.label,
          threshold: existingVault.threshold,
          address: validatedAddress,
          publicKeyPackage: publicKeyPackage || {
            verifyingKey: existingVault.participants[0]?.publicKeyIdentifier || "00".repeat(32),
          },
          participants: existingVault.participants.map((p) => ({
            id: p.publicKeyIdentifier || p.id,
            label: p.label,
          })),
        });

        console.log(
          `Vault ${id} registered with live coordinator daemon (assigned: ${regResult.vaultId})`
        );
      } catch (coordErr) {
        console.error("Live coordinator vault registration failed:", coordErr);
        return NextResponse.json(
          {
            success: false,
            error: `Coordinator verification failed: ${
              coordErr instanceof Error ? coordErr.message : "Registration rejected"
            }`,
          },
          { status: 502 }
        );
      }
    }

    // 4. Update in local Prisma
    const updatedVault = await prisma.vault.update({
      where: { id },
      data: {
        status: "ACTIVE",
        shieldedAddress: validatedAddress,
      },
      include: {
        participants: true,
      },
    });

    // 5. Sync to Supabase
    try {
      await supabase
        .from("vaults")
        .update({
          status: "ACTIVE",
          shielded_address: validatedAddress,
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

    interface SbParticipant {
      id: string;
      label: string;
      public_key_identifier?: string | null;
      is_active: boolean;
      joined_at?: string | null;
      updated_at?: string | null;
    }

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
          participants: ((sbVault.participants as unknown as SbParticipant[]) || []).map((p) => ({
            id: p.id,
            vaultId: sbVault.id,
            label: p.label,
            publicKeyIdentifier: p.public_key_identifier ?? null,
            isActive: p.is_active,
            joinedAt: new Date(p.joined_at || 0),
            updatedAt: new Date(p.updated_at || 0),
          })),
        };
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
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch vault ceremony data" },
      { status: 500 }
    );
  }
}
