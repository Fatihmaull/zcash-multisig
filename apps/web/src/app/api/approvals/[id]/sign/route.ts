import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: approvalId } = await params;
    const body = await request.json();
    const { signer, status = "APPROVED", txid } = body;

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: approvalId },
      include: {
        vault: { include: { participants: true } },
        signatureRoundEvents: true,
      },
    });

    if (!approval) {
      return NextResponse.json(
        { success: false, error: "Approval request not found" },
        { status: 404 }
      );
    }

    // Find participant matching label or fallback
    const signerLabel = signer || "Bob";
    const participant = approval.vault.participants.find((p) =>
      p.label.toLowerCase().includes(signerLabel.toLowerCase())
    );

    const participantId = participant ? participant.id : `part-${signerLabel.toLowerCase()}`;

    // Record commitment & signature round events
    await prisma.signatureRoundEvent.create({
      data: {
        approvalRequestId: approvalId,
        participantId: participantId,
        roundType: "COMMITMENT",
        status: "RECEIVED",
      },
    });

    await prisma.signatureRoundEvent.create({
      data: {
        approvalRequestId: approvalId,
        participantId: participantId,
        roundType: "SIGNATURE_SHARE",
        status: status === "REJECTED" ? "INVALID" : "RECEIVED",
      },
    });

    // Re-count valid signatures
    const allShares = await prisma.signatureRoundEvent.findMany({
      where: {
        approvalRequestId: approvalId,
        roundType: "SIGNATURE_SHARE",
        status: "RECEIVED",
      },
    });

    const uniqueParticipants = new Set(allShares.map((s) => s.participantId));
    const collectedCount = uniqueParticipants.size;
    const isThresholdMet = collectedCount >= approval.vault.threshold;

    let updatedStatus = approval.status;
    let finalTxid = approval.txid;

    if (isThresholdMet && status !== "REJECTED") {
      updatedStatus = "APPROVED";
      if (txid) {
        finalTxid = txid;
        updatedStatus = "BROADCASTED";
      }
    } else if (status === "REJECTED") {
      updatedStatus = "REJECTED";
    }

    // Update local DB
    const updatedApproval = await prisma.approvalRequest.update({
      where: { id: approvalId },
      data: {
        status: updatedStatus,
        txid: finalTxid,
      },
    });

    // Update Supabase
    try {
      await supabase
        .from("approval_requests")
        .update({
          status: updatedStatus,
          txid: finalTxid,
          updated_at: new Date().toISOString(),
        })
        .eq("id", approvalId);

      await supabase.from("signature_round_events").insert({
        approval_request_id: approvalId,
        participant_id: participantId,
        round_type: "SIGNATURE_SHARE",
        status: status === "REJECTED" ? "INVALID" : "RECEIVED",
      });
    } catch (sbErr) {
      console.error("Supabase approval update error:", sbErr);
    }

    return NextResponse.json({
      success: true,
      approval: updatedApproval,
      collectedCount,
      threshold: approval.vault.threshold,
      isThresholdMet,
    });
  } catch (error) {
    console.error("Error updating approval signature:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to record signature",
      },
      { status: 500 }
    );
  }
}
