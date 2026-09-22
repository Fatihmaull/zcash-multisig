// ──────────────────────────────────────────────────────────────
// Quorum — Mock Coordinator Engine
//
// Simulates the FROST lifecycle for UI development.
// Implements the CoordinatorService interface from types/coordinator.ts
// so that swapping in the real Rust coordinator (P3-B1) is a type-safe
// replacement, not a rewrite.
//
// Three scenarios:
//   1. happy_path        — Signers A+B approve → BROADCASTED
//   2. non_responding    — Signer C times out after delay
//   3. malicious_share   — Signer B sends invalid share → structured error
//
// See docs/10-roadmap.md P2-B4.
// ──────────────────────────────────────────────────────────────

import type {
  CoordinatorService,
  SignerService,
  SigningPackages,
  CoordinatorError,
  DkgSessionRequest,
  DkgSessionState,
  DkgSessionResult,
  ApprovalSubmission,
  ApprovalRequestState,
  SignRoundUpdate,
  SignerStatus,
  SigningRoundEvent,
  MockScenario,
  ParticipantPublicInfo,
} from "@/types/coordinator";

// ── Helpers ──────────────────────────────────────────────────

function generateId(): string {
  return `qr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateFakeAddress(): string {
  // Fake testnet unified address (prefix only — not a real address)
  const chars = "abcdef0123456789";
  let addr = "utest1";
  for (let i = 0; i < 64; i++) {
    addr += chars[Math.floor(Math.random() * chars.length)];
  }
  return addr;
}

function generateFakePublicKey(): string {
  const chars = "abcdef0123456789";
  let key = "";
  for (let i = 0; i < 64; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

function generateFakeTxid(): string {
  const chars = "abcdef0123456789";
  let txid = "";
  for (let i = 0; i < 64; i++) {
    txid += chars[Math.floor(Math.random() * chars.length)];
  }
  return txid;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── In-Memory State ──────────────────────────────────────────

interface DkgSession {
  state: DkgSessionState;
  request: DkgSessionRequest;
}

interface ApprovalSession {
  state: ApprovalRequestState;
  scenario: MockScenario;
  vault: {
    threshold: number;
    participants: ParticipantPublicInfo[];
  };
}

const dkgSessions = new Map<string, DkgSession>();
const approvalSessions = new Map<string, ApprovalSession>();

// ── Default demo vault for quick testing ─────────────────────
export const DEMO_VAULT_ID = "vault_demo_2of3";
const DEMO_PARTICIPANTS: ParticipantPublicInfo[] = [
  {
    label: "Alice (Treasurer)",
    identifier: "participant_a",
    publicKeyIdentifier: generateFakePublicKey(),
  },
  {
    label: "Bob (Director)",
    identifier: "participant_b",
    publicKeyIdentifier: generateFakePublicKey(),
  },
  {
    label: "Carol (Auditor)",
    identifier: "participant_c",
    publicKeyIdentifier: generateFakePublicKey(),
  },
];

// ── Mock Coordinator ─────────────────────────────────────────

export class MockCoordinator implements CoordinatorService, SignerService {
  private scenario: MockScenario;
  /** Simulated delay in ms to mimic network latency */
  private latencyMs: number;
  /** Timeout for non-responding signer (ms) */
  private signerTimeoutMs: number;

  constructor(
    scenario: MockScenario = "happy_path",
    options?: { latencyMs?: number; signerTimeoutMs?: number }
  ) {
    this.scenario = scenario;
    this.latencyMs = options?.latencyMs ?? 800;
    this.signerTimeoutMs = options?.signerTimeoutMs ?? 5000;
  }

  setScenario(scenario: MockScenario): void {
    this.scenario = scenario;
  }

  // ── DKG (Key Ceremony) ──────────────────────────────────────

  async createDkgSession(
    request: DkgSessionRequest
  ): Promise<DkgSessionState> {
    await delay(this.latencyMs);

    const sessionId = generateId();
    const participants = request.participants.map((p) => ({
      ...p,
      publicKeyIdentifier: "",
      connected: false,
    }));

    const state: DkgSessionState = {
      sessionId,
      vaultLabel: request.vaultLabel,
      status: "WAITING_FOR_PARTICIPANTS",
      participants,
    };

    dkgSessions.set(sessionId, { state, request });
    return { ...state };
  }

  async getDkgStatus(sessionId: string): Promise<DkgSessionState> {
    const session = dkgSessions.get(sessionId);
    if (!session) {
      throw new Error(`DKG session not found: ${sessionId}`);
    }
    return { ...session.state };
  }

  async completeDkg(sessionId: string): Promise<DkgSessionResult> {
    const session = dkgSessions.get(sessionId);
    if (!session) {
      throw new Error(`DKG session not found: ${sessionId}`);
    }

    // Simulate DKG round progression
    // Round 1: All participants connect
    session.state.status = "ROUND_1_IN_PROGRESS";
    session.state.participants = session.state.participants.map((p) => ({
      ...p,
      connected: true,
    }));
    await delay(this.latencyMs);

    // Round 2: Generate key shares (public identifiers only)
    session.state.status = "ROUND_2_IN_PROGRESS";
    await delay(this.latencyMs);

    // Complete
    const shieldedAddress = generateFakeAddress();
    const participants: ParticipantPublicInfo[] =
      session.state.participants.map((p) => ({
        label: p.label,
        identifier: p.identifier,
        publicKeyIdentifier: generateFakePublicKey(),
      }));

    session.state.status = "COMPLETED";
    session.state.shieldedAddress = shieldedAddress;
    session.state.participants = participants.map((p) => ({
      ...p,
      connected: true,
    }));

    const result: DkgSessionResult = {
      vaultId: generateId(),
      shieldedAddress,
      participants,
      network: session.request.network,
    };

    return result;
  }

  // ── Approval Request ────────────────────────────────────────

  async submitApproval(
    submission: ApprovalSubmission
  ): Promise<ApprovalRequestState> {
    await delay(this.latencyMs);

    const id = generateId();
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const expiresAt = new Date(
      nowDate.getTime() + 24 * 60 * 60 * 1000,
    ).toISOString(); // 24h

    const signerStatuses: SignerStatus[] = DEMO_PARTICIPANTS.map((p) => ({
      participantId: p.identifier,
      participantLabel: p.label,
      status: "PENDING" as const,
      updatedAt: now,
    }));

    const state: ApprovalRequestState = {
      id,
      vaultId: submission.vaultId,
      recipientAddress: submission.recipientAddress,
      amountZatoshi: submission.amountZatoshi,
      memo: submission.memo,
      status: "PENDING",
      threshold: 2,
      signaturesCollected: 0,
      signerStatuses,
      events: [],
      createdAt: now,
      expiresAt,
    };

    approvalSessions.set(id, {
      state,
      scenario: this.scenario,
      vault: { threshold: 2, participants: DEMO_PARTICIPANTS },
    });

    return { ...state };
  }

  async getApprovalStatus(approvalId: string): Promise<ApprovalRequestState> {
    const session = approvalSessions.get(approvalId);
    if (!session) {
      throw new Error(`Approval request not found: ${approvalId}`);
    }
    return { ...session.state };
  }

  // ── Signing (SignerService) ─────────────────────────────────

  async fetchPendingRequests(
    participantId: string
  ): Promise<ApprovalRequestState[]> {
    await delay(this.latencyMs);
    return [...approvalSessions.values()]
      .filter(
        (s) =>
          s.state.status === "PENDING" &&
          s.vault.participants.some((p) => p.identifier === participantId)
      )
      .map((s) => ({ ...s.state }));
  }

  /** Round 1. The matching nonces would stay on the signer's machine. */
  async submitCommitments(
    approvalId: string,
    participantId: string,
    commitmentsHex: string[]
  ): Promise<SignRoundUpdate> {
    await delay(this.latencyMs);
    const { session, participant } = this.resolve(approvalId, participantId);

    if (commitmentsHex.length === 0) {
      throw new Error(
        "No commitments submitted. One per action is required — an empty " +
          "list usually means the wrong bundle was queried."
      );
    }

    session.state.events.push({
      id: generateId(),
      approvalRequestId: approvalId,
      participantId,
      participantLabel: participant.label,
      roundType: "COMMITMENT",
      status: "RECEIVED",
      culpritDetected: false,
      timestamp: new Date().toISOString(),
    });

    return {
      approvalRequestId: approvalId,
      participantId,
      roundType: "COMMITMENT",
      status: "RECEIVED",
    };
  }

  /**
   * Mock shape only. The real coordinator reads each action's alpha out of
   * the PCZT; here they are synthetic so the UI has something to render.
   */
  async getSigningPackages(
    approvalId: string,
    participantId: string
  ): Promise<SigningPackages> {
    await delay(this.latencyMs);
    this.resolve(approvalId, participantId);
    return {
      sighashHex: "00".repeat(32),
      // Gate B is deliberately single-input; see docs/13-phase-1-plan.md.
      actions: [{ pool: "IRONWOOD", index: 0, alphaHex: "11".repeat(32) }],
      signingPackagesHex: ["22".repeat(64)],
    };
  }

  private resolve(approvalId: string, participantId: string) {
    const session = approvalSessions.get(approvalId);
    if (!session) {
      throw new Error(`Approval request not found: ${approvalId}`);
    }
    const participant = session.vault.participants.find(
      (p) => p.identifier === participantId
    );
    if (!participant) {
      throw new Error(`Participant not found: ${participantId}`);
    }
    return { session, participant };
  }

  /**
   * Round 2. The scenario logic lives here because both failures it models
   * surface at share verification. Note the simplification: a genuinely
   * non-responding signer would fail at round 1, never reaching this call.
   */
  async submitSignatureShares(
    approvalId: string,
    participantId: string,
    sharesHex: string[]
  ): Promise<SignRoundUpdate> {
    await delay(this.latencyMs);
    void sharesHex;

    const session = approvalSessions.get(approvalId);
    if (!session) {
      throw new Error(`Approval request not found: ${approvalId}`);
    }

    const participant = session.vault.participants.find(
      (p) => p.identifier === participantId
    );
    if (!participant) {
      throw new Error(`Participant not found: ${participantId}`);
    }

    const now = new Date().toISOString();

    // ── Scenario: Malicious share ─────────────────────────────
    if (
      session.scenario === "malicious_share" &&
      participantId === "participant_b"
    ) {
      const error: CoordinatorError = {
        code: "INVALID_SHARE",
        culprits: [participant.label],
        recoverable: true,
        message: `Signature share rejected — ${participant.label}. The share returned does not verify against the commitment made in round 1. This vault has not been charged and no funds moved. Re-run the round without this signer, or investigate the device.`,
      };

      const event: SigningRoundEvent = {
        id: generateId(),
        approvalRequestId: approvalId,
        participantId,
        participantLabel: participant.label,
        roundType: "SIGNATURE_SHARE",
        status: "INVALID",
        culpritDetected: true,
        errorCode: "INVALID_SHARE",
        errorDetails: error.message,
        timestamp: now,
      };

      session.state.events.push(event);

      // Update signer status
      const signerIdx = session.state.signerStatuses.findIndex(
        (s) => s.participantId === participantId
      );
      if (signerIdx !== -1) {
        session.state.signerStatuses[signerIdx] = {
          ...session.state.signerStatuses[signerIdx],
          status: "INVALID_SHARE",
          updatedAt: now,
        };
      }

      return {
        approvalRequestId: approvalId,
        participantId,
        roundType: "SIGNATURE_SHARE",
        status: "INVALID",
        error,
      };
    }

    // ── Scenario: Non-responding signer ───────────────────────
    if (
      session.scenario === "non_responding" &&
      participantId === "participant_c"
    ) {
      // Simulate timeout
      await delay(this.signerTimeoutMs);

      const error: CoordinatorError = {
        code: "TIMEOUT",
        culprits: [participant.label],
        recoverable: true,
        message: `${participant.label} did not respond within the signing deadline. This is normal — they may be offline or unavailable. The round can proceed if threshold is met with other signers.`,
      };

      const event: SigningRoundEvent = {
        id: generateId(),
        approvalRequestId: approvalId,
        participantId,
        participantLabel: participant.label,
        roundType: "COMMITMENT",
        status: "TIMEOUT",
        culpritDetected: false,
        errorCode: "TIMEOUT",
        errorDetails: error.message,
        timestamp: now,
      };

      session.state.events.push(event);

      const signerIdx = session.state.signerStatuses.findIndex(
        (s) => s.participantId === participantId
      );
      if (signerIdx !== -1) {
        session.state.signerStatuses[signerIdx] = {
          ...session.state.signerStatuses[signerIdx],
          status: "TIMEOUT",
          updatedAt: now,
        };
      }

      return {
        approvalRequestId: approvalId,
        participantId,
        roundType: "COMMITMENT",
        status: "TIMEOUT",
        error,
      };
    }

    // ── Happy path: valid signature ───────────────────────────

    // Signature share round (the commitment round is submitCommitments)
    const shareEvent: SigningRoundEvent = {
      id: generateId(),
      approvalRequestId: approvalId,
      participantId,
      participantLabel: participant.label,
      roundType: "SIGNATURE_SHARE",
      status: "RECEIVED",
      culpritDetected: false,
      timestamp: new Date().toISOString(),
    };
    session.state.events.push(shareEvent);

    // Update signer status
    const signerIdx = session.state.signerStatuses.findIndex(
      (s) => s.participantId === participantId
    );
    if (signerIdx !== -1) {
      session.state.signerStatuses[signerIdx] = {
        ...session.state.signerStatuses[signerIdx],
        status: "APPROVED",
        updatedAt: new Date().toISOString(),
      };
    }

    session.state.signaturesCollected += 1;

    // Check if threshold is met
    if (session.state.signaturesCollected >= session.vault.threshold) {
      session.state.status = "APPROVED";

      // Simulate broadcast
      await delay(this.latencyMs);
      session.state.status = "BROADCASTED";
      session.state.txid = generateFakeTxid();
      // Testnet Ironwood range. Mainnet heights in a testnet-only build are
      // the kind of detail that ends up in a screenshot. See constraint C9.
      session.state.anchorBlock = 4_360_000 + Math.floor(Math.random() * 1000);
    }

    return {
      approvalRequestId: approvalId,
      participantId,
      roundType: "SIGNATURE_SHARE",
      status: "RECEIVED",
    };
  }

  async declineApproval(
    approvalId: string,
    participantId: string
  ): Promise<ApprovalRequestState> {
    await delay(this.latencyMs);

    const session = approvalSessions.get(approvalId);
    if (!session) {
      throw new Error(`Approval request not found: ${approvalId}`);
    }

    const participant = session.vault.participants.find(
      (p) => p.identifier === participantId
    );

    const now = new Date().toISOString();

    const signerIdx = session.state.signerStatuses.findIndex(
      (s) => s.participantId === participantId
    );
    if (signerIdx !== -1) {
      session.state.signerStatuses[signerIdx] = {
        ...session.state.signerStatuses[signerIdx],
        status: "DECLINED",
        updatedAt: now,
      };
    }

    // Check if rejection makes threshold impossible
    const declinedCount = session.state.signerStatuses.filter(
      (s) => s.status === "DECLINED" || s.status === "TIMEOUT"
    ).length;
    const remainingSigners =
      session.vault.participants.length - declinedCount;

    if (remainingSigners < session.vault.threshold) {
      session.state.status = "REJECTED";
    }

    const event: SigningRoundEvent = {
      id: generateId(),
      approvalRequestId: approvalId,
      participantId,
      participantLabel: participant?.label ?? participantId,
      roundType: "SIGNATURE_SHARE",
      status: "INVALID",
      culpritDetected: false,
      errorCode: undefined,
      errorDetails: `${participant?.label ?? participantId} declined this approval request.`,
      timestamp: now,
    };
    session.state.events.push(event);

    return { ...session.state };
  }
}

// ── Singleton for route handlers ─────────────────────────────

let _instance: MockCoordinator | null = null;

export function getCoordinator(
  scenario?: MockScenario
): MockCoordinator {
  if (!_instance) {
    _instance = new MockCoordinator(scenario ?? "happy_path");
  }
  if (scenario) {
    _instance.setScenario(scenario);
  }
  return _instance;
}
