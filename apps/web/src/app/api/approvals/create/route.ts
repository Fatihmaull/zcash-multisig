import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vaultId, recipientAddress, amountZec, memo } = body;

    if (!recipientAddress || !amountZec) {
      return NextResponse.json(
        { success: false, error: "Recipient address and amount are required" },
        { status: 400 }
      );
    }

    const defaultVaultId = vaultId || "vault-demo-001";
    const amountZatoshi = BigInt(Math.round(parseFloat(amountZec) * 100_000_000));
    const reqId = `req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    // 1. Create in PostgreSQL (Prisma)
    const newApproval = await prisma.approvalRequest.create({
      data: {
        id: reqId,
        vaultId: defaultVaultId,
        recipientAddress,
        amountZatoshi,
        memo: typeof memo === "string" && memo.trim() ? memo.trim() : null,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // No signature is recorded here. A proposal is not an approval, and
    // writing a RECEIVED share for "Alice" counted a signature nobody made.

    // 3. Sync to Supabase
    try {
      if (!supabase) throw new Error("Supabase is not configured");
      await supabase.from("approval_requests").insert({
        id: newApproval.id,
        vault_id: newApproval.vaultId,
        recipient_address: newApproval.recipientAddress,
        amount_zatoshi: Number(amountZatoshi),
        memo: newApproval.memo,
        status: "PENDING",
        expires_at: newApproval.expiresAt ? newApproval.expiresAt.toISOString() : null,
      });
    } catch (sbErr) {
      console.error("Supabase new approval sync error:", sbErr);
    }

    return NextResponse.json({
      success: true,
      approvalId: newApproval.id,
    });
  } catch (error) {
    console.error("Error creating proposal:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create proposal",
      },
      { status: 500 }
    );
  }
}
