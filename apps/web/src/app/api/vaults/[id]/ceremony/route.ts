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
    const { shieldedAddress, ceremonyId } = body;

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

    // A browser is not a ceremony. Without a coordinator that has already
    // verified one, this route does not store an address or mark the vault
    // ACTIVE — including when the body contains a well-formed utest1 string.
    if (!coordinatorClient.isLive()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This route does not record an address from the browser. A vault address is stored only after a coordinator-verified ceremony.",
        },
        { status: 409 }
      );
    }

    const validatedAddress =
      typeof shieldedAddress === "string" && isValidZcashTestnetUnifiedAddress(shieldedAddress)
        ? shieldedAddress.trim()
        : null;

    // 3. In live mode the vault is read from the coordinator, not asserted here
    //
    // A format-valid address is not the same as the right address, and this
    // route cannot tell them apart: a vault's address comes from a group key
    // nobody holds alone plus a seed every participant agreed on. Neither is a
    // fact a browser is in a position to assert, and funds sent to a wrong
    // one are unspendable by any quorum.
    //
    // So the browser no longer registers the vault. The participants do, by
    // reporting what they each derived, and the coordinator registers it only
    // once all of them agree. This route's job is to check that happened and
    // copy the result.
    //
    // (The previous version fell back to a synthesised public key package —
    // `{ verifyingKey: <participant id or 32 zero bytes> }` — when the browser
    // sent none. A vault whose group key is a placeholder is a vault nobody
    // can sign for, and it would have been marked ACTIVE.)
    let verifiedAddress = validatedAddress;
    if (coordinatorClient.isLive()) {
      if (!ceremonyId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "ceremonyId is required when a coordinator is configured. A vault is activated by " +
              "a ceremony the coordinator verified, not by a request asserting one happened. " +
              "Start one with POST /coordinator/ceremony/create.",
          },
          { status: 400 }
        );
      }

      let ceremony;
      try {
        ceremony = await coordinatorClient.getCeremonyStatus(ceremonyId);
      } catch (coordErr) {
        return NextResponse.json(
          {
            success: false,
            error: `Could not reach the coordinator: ${
              coordErr instanceof Error ? coordErr.message : "unknown error"
            }`,
          },
          { status: 502 }
        );
      }

      if (!ceremony || ceremony.status !== "COMPLETE" || !ceremony.vaultId) {
        const waiting = ceremony
          ? `${ceremony.reported} of ${ceremony.expected} participants have reported`
          : "the coordinator has no record of it";
        return NextResponse.json(
          {
            success: false,
            error:
              `Ceremony ${ceremonyId} is not complete — ${waiting}. DKG has no threshold: every ` +
              `participant must finish and report the same vault, or there is no vault.`,
          },
          { status: 409 }
        );
      }

      const vault = await coordinatorClient.findVault(ceremony.vaultId);
      if (!vault?.shieldedAddress) {
        return NextResponse.json(
          {
            success: false,
            error: "The coordinator reported a complete ceremony but no vault address.",
          },
          { status: 502 }
        );
      }

      if (validatedAddress && vault.shieldedAddress !== validatedAddress) {
        // Not fatal — the coordinator is authoritative and we take its answer
        // — but a mismatch means the browser was working from stale or wrong
        // data and somebody should know.
        console.warn(
          `Vault ${id}: the request claimed ${validatedAddress} but the ceremony produced ` +
            `${vault.shieldedAddress}. Using the ceremony's.`
        );
      }
      verifiedAddress = vault.shieldedAddress;
    }

    // 4. Update in local Prisma
    const updatedVault = await prisma.vault.update({
      where: { id },
      data: {
        status: "ACTIVE",
        shieldedAddress: verifiedAddress,
      },
      include: {
        participants: true,
      },
    });

    // 5. Sync to Supabase
    try {
      if (!supabase) throw new Error("Supabase is not configured");
      await supabase
        .from("vaults")
        .update({
          status: "ACTIVE",
          shielded_address: verifiedAddress,
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

    if (!vault && supabase) {
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
