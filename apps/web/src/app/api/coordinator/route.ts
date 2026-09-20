// ──────────────────────────────────────────────────────────────
// Quorum — Mock Coordinator API Routes
//
// REST-style route handlers wrapping the mock coordinator.
// POST /api/coordinator — dispatch actions
//
// Actions:
//   dkg/create     — Create a new DKG session
//   dkg/status     — Get DKG session status
//   dkg/complete   — Complete DKG and generate vault
//   approval/submit  — Submit a new approval request
//   approval/status  — Get approval request status
//
// Signer actions (SignerService). In production these are NOT reachable
// from the browser: they belong to the signer binary talking to the
// coordinator over frostd, authenticated as the participant. They are
// exposed here only because the mock has no signer process yet.
// See docs/11-contract-review.md §2.
//
//   signer/pending   — Requests awaiting this participant
//   signer/commit    — Round 1: submit commitments
//   signer/packages  — Signing packages + per-action randomizers
//   signer/shares    — Round 2: submit signature shares
//   signer/decline   — Refuse to sign
// ──────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getCoordinator } from "@/lib/mock-coordinator";
import type { MockScenario } from "@/types/coordinator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, scenario, ...params } = body;

    const coordinator = getCoordinator(scenario as MockScenario | undefined);

    switch (action) {
      // ── DKG ──────────────────────────────────────────────
      case "dkg/create": {
        const result = await coordinator.createDkgSession(params);
        return NextResponse.json(result);
      }

      case "dkg/status": {
        const result = await coordinator.getDkgStatus(params.sessionId);
        return NextResponse.json(result);
      }

      case "dkg/complete": {
        const result = await coordinator.completeDkg(params.sessionId);
        return NextResponse.json(result);
      }

      // ── Approval ─────────────────────────────────────────
      case "approval/submit": {
        // Convert amountZatoshi from string to bigint for transport
        const submission = {
          ...params,
          amountZatoshi: BigInt(params.amountZatoshi),
        };
        const result = await coordinator.submitApproval(submission);
        return NextResponse.json(serializeBigInt(result));
      }

      case "approval/status": {
        const result = await coordinator.getApprovalStatus(params.approvalId);
        return NextResponse.json(serializeBigInt(result));
      }

      // ── Signer (mock only — see the header note) ─────────
      case "signer/pending": {
        const result = await coordinator.fetchPendingRequests(
          params.participantId
        );
        return NextResponse.json(serializeBigInt(result));
      }

      case "signer/commit": {
        const result = await coordinator.submitCommitments(
          params.approvalId,
          params.participantId,
          params.commitmentsHex ?? []
        );
        return NextResponse.json(result);
      }

      case "signer/packages": {
        const result = await coordinator.getSigningPackages(
          params.approvalId,
          params.participantId
        );
        return NextResponse.json(result);
      }

      case "signer/shares": {
        const result = await coordinator.submitSignatureShares(
          params.approvalId,
          params.participantId,
          params.sharesHex ?? []
        );
        return NextResponse.json(result);
      }

      case "signer/decline": {
        const result = await coordinator.declineApproval(
          params.approvalId,
          params.participantId
        );
        return NextResponse.json(serializeBigInt(result));
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * JSON doesn't support BigInt natively. Convert to string for transport.
 */
function serializeBigInt(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = serializeBigInt(value);
    }
    return result;
  }
  return obj;
}
