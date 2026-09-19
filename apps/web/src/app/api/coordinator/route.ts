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
//   approval/sign    — Sign an approval request
//   approval/reject  — Reject an approval request
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

      case "approval/sign": {
        const result = await coordinator.signApproval(
          params.approvalId,
          params.participantId
        );
        return NextResponse.json(result);
      }

      case "approval/reject": {
        const result = await coordinator.rejectApproval(
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
