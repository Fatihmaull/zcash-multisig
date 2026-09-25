// ──────────────────────────────────────────────────────────────
// Quorum — Coordinator Client Adapter
//
// P3-B1: Client adapter that satisfies CoordinatorService interface.
// Structurally designed to switch between MockCoordinator and the
// real live Rust quorum-coordinator daemon via HTTP/REST.
//
// Aligned with the quorum-coordinatord routes (/coordinator/*).
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
  VaultRegistrationRequest,
  VaultRegistrationResponse,
  VaultAuditRequest,
  VaultAuditResponse,
} from "@/types/coordinator";
import { getCoordinator } from "@/lib/mock-coordinator";
import { DEFAULT_UNSIGNED_PCZT_HEX } from "@/lib/fixtures/pczt";

const LIVE_COORDINATOR_URL = process.env.COORDINATOR_URL;

class CoordinatorClientAdapter implements CoordinatorService {
  private useLive: boolean;
  private endpoint: string;

  constructor() {
    this.useLive = Boolean(LIVE_COORDINATOR_URL);
    this.endpoint = (LIVE_COORDINATOR_URL || "").replace(/\/$/, "");
  }

  // ── Health Check ─────────────────────────────────────────

  async checkHealth(): Promise<{ status: string; network: string }> {
    if (this.useLive) {
      const res = await fetch(`${this.endpoint}/health`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Coordinator health check failed: ${res.statusText}`);
      return res.json();
    }
    return { status: "ok", network: "testnet" };
  }

  // ── DKG ──────────────────────────────────────────────────

  async createDkgSession(request: DkgSessionRequest): Promise<DkgSessionState> {
    // In both live and mock mode, DKG sessions are initialized via the DKG workflow
    return getCoordinator().createDkgSession(request);
  }

  async getDkgStatus(sessionId: string): Promise<DkgSessionState> {
    return getCoordinator().getDkgStatus(sessionId);
  }

  async completeDkg(sessionId: string): Promise<DkgSessionResult> {
    const result = await getCoordinator().completeDkg(sessionId);

    // If live coordinator is active, automatically register the completed vault
    if (this.useLive) {
      try {
        await this.registerVault({
          label: `Vault ${result.vaultId}`,
          threshold: 2,
          address: result.shieldedAddress,
          publicKeyPackage: {
            verifyingKey: result.participants[0]?.publicKeyIdentifier || "",
          },
          participants: result.participants.map((p) => ({
            id: p.identifier,
            label: p.label,
          })),
        });
      } catch (err) {
        console.warn("Failed to auto-register completed DKG vault with live coordinator:", err);
      }
    }

    return result;
  }

  // ── Vault Management ─────────────────────────────────────

  async registerVault(request: VaultRegistrationRequest): Promise<VaultRegistrationResponse> {
    if (this.useLive) {
      const res = await fetch(`${this.endpoint}/coordinator/vault/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          errorData?.message || `Live coordinator vault registration failed (${res.status}): ${res.statusText}`
        );
      }
      return res.json();
    }

    // Mock mode fallback response
    return {
      vaultId: `vault-${Date.now().toString(36)}`,
      participantTokens: request.participants.map((p) => ({
        participantId: p.id,
        label: p.label,
        token: `mock-token-${Math.random().toString(36).substring(2, 10)}`,
      })),
    };
  }

  async listVaults(): Promise<
    Array<{
      id: string;
      label: string;
      threshold: number;
      shieldedAddress: string;
      network: string;
      participants: Array<{ identifier: string; label: string }>;
    }>
  > {
    if (this.useLive) {
      const res = await fetch(`${this.endpoint}/coordinator/vault/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        throw new Error(`Live coordinator vault list failed: ${res.statusText}`);
      }
      return res.json();
    }
    return [];
  }

  async auditVault(request: VaultAuditRequest): Promise<VaultAuditResponse> {
    if (this.useLive) {
      const res = await fetch(`${this.endpoint}/coordinator/vault/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          errorData?.message || `Live coordinator vault audit failed (${res.status}): ${res.statusText}`
        );
      }
      return res.json();
    }
    throw new Error("Vault audit requires live coordinator or mock audit log.");
  }

  // ── Approval Lifecycle ───────────────────────────────────

  async submitApproval(submission: ApprovalSubmission): Promise<ApprovalRequestState> {
    if (this.useLive) {
      const payload = {
        vaultId: submission.vaultId,
        recipientAddress: submission.recipientAddress,
        amountZatoshi: submission.amountZatoshi.toString(),
        memo: submission.memo ?? null,
        pcztHex: submission.pcztHex || DEFAULT_UNSIGNED_PCZT_HEX,
        signerDeadlineSecs: submission.signerDeadlineSecs ?? 300,
      };

      const res = await fetch(`${this.endpoint}/coordinator/approval/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          errorData?.message || `Live coordinator submit approval failed (${res.status}): ${res.statusText}`
        );
      }

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
      const res = await fetch(`${this.endpoint}/coordinator/approval/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          errorData?.message || `Live coordinator approval status failed (${res.status}): ${res.statusText}`
        );
      }

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

  getEndpoint(): string {
    return this.endpoint;
  }
}

export const coordinatorClient = new CoordinatorClientAdapter();
