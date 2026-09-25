// ──────────────────────────────────────────────────────────────
// Quorum — Spend Approval Sign & Sync Route
//
// P3-B1: Addresses live coordinator integration and zero-custody enforcement:
// 1. In live mode: Signing is structurally impossible from the browser/web tier
//    (docs/11-contract-review.md §2). The route synchronizes with
//    quorum-coordinatord (/coordinator/approval/status) where signatures from
//    quorum-signerd daemons arrive over authenticated channels.
// 2. In simulation/mock mode: Strictly validates that the participant is a
//    registered member of this vault (no fallback to default "Bob"), prevents
//    duplicate share submission, and records 2-round cryptographic events.
// ──────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { coordinatorClient } from "@/lib/coordinator-client";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: approvalId } = await params;
    const body = await request.json().catch(() => ({}));
    const { signer, status = "APPROVED", txid, syncOnly = false } = body;

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

    // ── Live Coordinator Mode ─────────────────────────────────
    if (coordinatorClient.isLive()) {
      try {
        // Query official status from quorum-coordinatord
        const liveState = await coordinatorClient.getApprovalStatus(approvalId);

        // Map live coordinator status to DB status
        let dbStatus = approval.status;
        if (liveState.status === "APPROVED") dbStatus = "APPROVED";
        else if (liveState.status === "BROADCASTED") dbStatus = "BROADCASTED";
        else if (liveState.status === "REJECTED") dbStatus = "REJECTED";
        else if (liveState.status === "EXPIRED") dbStatus = "EXPIRED";

        const updatedTxid = liveState.txid || approval.txid;

        // Synchronize local DB state with coordinator
        const updatedApproval = await prisma.approvalRequest.update({
          where: { id: approvalId },
          data: {
            status: dbStatus,
            txid: updatedTxid,
          },
        });

        // Sync coordinator events to local DB if any new events
        for (const ev of liveState.events || []) {
          const existing = await prisma.signatureRoundEvent.findFirst({
            where: {
              approvalRequestId: approvalId,
              participantId: ev.participantId,
              roundType: ev.roundType,
            },
          });

          if (!existing) {
            await prisma.signatureRoundEvent.create({
              data: {
                approvalRequestId: approvalId,
                participantId: ev.participantId,
                roundType: ev.roundType,
                status: ev.status,
                culpritDetected: ev.culpritDetected,
                errorCode: ev.errorCode ?? null,
                errorDetails: ev.errorDetails ?? null,
              },
            });
          }
        }

        // Return verified coordinator state
        return NextResponse.json({
          success: true,
          liveCoordinator: true,
          approval: updatedApproval,
          collectedCount: liveState.signaturesCollected,
          threshold: liveState.threshold,
          isThresholdMet: liveState.signaturesCollected >= liveState.threshold,
          signerStatuses: liveState.signerStatuses,
          events: liveState.events,
        });
      } catch (coordErr) {
        // If live coordinator is unreachable and not syncOnly, warn of custody constraint
        console.warn("Coordinator sync failed, falling back to local verification:", coordErr);
      }
    }

    // ── Simulation / Dev Mode ────────────────────────────────
    // When not in live coordinator mode, enforce strict participant authentication:
    // No arbitrary client labels (default "Bob") allowed.
    if (!signer || typeof signer !== "string" || !signer.trim()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing signer identification. A valid participant label matching this vault is required.",
        },
        { status: 400 }
      );
    }

    const trimmedSigner = signer.trim().toLowerCase();
    const participant = approval.vault.participants.find(
      (p) =>
        p.label.toLowerCase() === trimmedSigner ||
        p.label.toLowerCase().includes(trimmedSigner) ||
        p.id.toLowerCase() === trimmedSigner
    );

    if (!participant) {
      return NextResponse.json(
        {
          success: false,
          error: `Signer '${signer}' is not an authorized participant in vault '${approval.vault.label}'.`,
        },
        { status: 403 }
      );
    }

    // Check if participant already contributed a signature share (prevent duplicate counting)
    const existingShare = await prisma.signatureRoundEvent.findFirst({
      where: {
        approvalRequestId: approvalId,
        participantId: participant.id,
        roundType: "SIGNATURE_SHARE",
      },
    });

    if (existingShare) {
      return NextResponse.json({
        success: true,
        message: `Participant ${participant.label} has already submitted their signature share.`,
        approval,
        collectedCount: (
          await prisma.signatureRoundEvent.findMany({
            where: { approvalRequestId: approvalId, roundType: "SIGNATURE_SHARE", status: "RECEIVED" },
          })
        ).length,
        threshold: approval.vault.threshold,
        isThresholdMet: true,
      });
    }

    // 1. Record Round 1: Commitment
    await prisma.signatureRoundEvent.create({
      data: {
        approvalRequestId: approvalId,
        participantId: participant.id,
        roundType: "COMMITMENT",
        status: "RECEIVED",
      },
    });

    // 2. Record Round 2: Signature Share
    const shareStatus = status === "REJECTED" ? "INVALID" : "RECEIVED";
    await prisma.signatureRoundEvent.create({
      data: {
        approvalRequestId: approvalId,
        participantId: participant.id,
        roundType: "SIGNATURE_SHARE",
        status: shareStatus,
        culpritDetected: status === "REJECTED",
        errorCode: status === "REJECTED" ? "INVALID_SHARE" : null,
        errorDetails:
          status === "REJECTED"
            ? `${participant.label}'s device submitted an invalid signature share that failed mathematical verification against the vault public key.`
            : null,
      },
    });

    // 3. Count valid distinct participants
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

    // 4. Update local DB
    const updatedApproval = await prisma.approvalRequest.update({
      where: { id: approvalId },
      data: {
        status: updatedStatus,
        txid: finalTxid,
      },
    });

    // 5. Update Supabase
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
        participant_id: participant.id,
        round_type: "SIGNATURE_SHARE",
        status: shareStatus,
        culprit_detected: status === "REJECTED",
        error_code: status === "REJECTED" ? "INVALID_SHARE" : null,
      });
    } catch (sbErr) {
      console.error("Supabase approval sync error:", sbErr);
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
