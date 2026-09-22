// ──────────────────────────────────────────────────────────────
// Quorum — Coordinator Client Adapter
//
// P3-B1: Client adapter that satisfies CoordinatorService interface.
// Structurally designed to switch between MockCoordinator and the
// real live Rust quorum-coordinator daemon via HTTP/REST or JSON-RPC.
//
// Zero-Custody: The browser/web app never accesses private keys or shares.
// ──────────────────────────────────────────────────────────────

import type {
  CoordinatorService,
  DkgSessionRequest,
  DkgSessionState,
  DkgSessionResult,
  ApprovalSubmission,
  ApprovalRequestState,
  MockScenario,
} from "@/types/coordinator";
import { getCoordinator } from "@/lib/mock-coordinator";

const LIVE_COORDINATOR_URL = process.env.COORDINATOR_URL;

class CoordinatorClientAdapter implements CoordinatorService {
  private useLive: boolean;
  private endpoint: string;

  constructor() {
    this.useLive = Boolean(LIVE_COORDINATOR_URL);
    this.endpoint = LIVE_COORDINATOR_URL || "";
  }

  // ── DKG ──────────────────────────────────────────────────

  async createDkgSession(request: DkgSessionRequest): Promise<DkgSessionState> {
    if (this.useLive) {
      const res = await fetch(`${this.endpoint}/v1/dkg/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!res.ok) throw new Error(`Live coordinator DKG failed: ${res.statusText}`);
      return res.json();
    }
    return getCoordinator().createDkgSession(request);
  }

  async getDkgStatus(sessionId: string): Promise<DkgSessionState> {
    if (this.useLive) {
      const res = await fetch(`${this.endpoint}/v1/dkg/status?sessionId=${sessionId}`);
      if (!res.ok) throw new Error(`Live coordinator DKG status failed: ${res.statusText}`);
      return res.json();
    }
    return getCoordinator().getDkgStatus(sessionId);
  }

  async completeDkg(sessionId: string): Promise<DkgSessionResult> {
    if (this.useLive) {
      const res = await fetch(`${this.endpoint}/v1/dkg/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error(`Live coordinator complete DKG failed: ${res.statusText}`);
      return res.json();
    }
    return getCoordinator().completeDkg(sessionId);
  }

  // ── Approval Lifecycle ───────────────────────────────────

  async submitApproval(submission: ApprovalSubmission): Promise<ApprovalRequestState> {
    if (this.useLive) {
      const res = await fetch(`${this.endpoint}/v1/approvals/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...submission,
          amountZatoshi: submission.amountZatoshi.toString(),
        }),
      });
      if (!res.ok) throw new Error(`Live coordinator submit approval failed: ${res.statusText}`);
      const data = await res.json();
      return {
        ...data,
        amountZatoshi: BigInt(data.amountZatoshi),
      };
    }
    return getCoordinator().submitApproval(submission);
  }

  async getApprovalStatus(approvalId: string): Promise<ApprovalRequestState> {
    if (this.useLive) {
      const res = await fetch(`${this.endpoint}/v1/approvals/status?approvalId=${approvalId}`);
      if (!res.ok) throw new Error(`Live coordinator approval status failed: ${res.statusText}`);
      const data = await res.json();
      return {
        ...data,
        amountZatoshi: BigInt(data.amountZatoshi),
      };
    }
    return getCoordinator().getApprovalStatus(approvalId);
  }

  // ── Switch Mock Scenario (Mock mode only) ────────────────
  setMockScenario(scenario: MockScenario) {
    if (!this.useLive) {
      getCoordinator(scenario);
    }
  }

  isLive(): boolean {
    return this.useLive;
  }
}

export const coordinatorClient = new CoordinatorClientAdapter();
