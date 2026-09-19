// ──────────────────────────────────────────────────────────────
// Quorum — Integration Contract Types
//
// The single source of truth for communication between the web app
// and the coordinator (mock or real Rust core).
//
// Both the mock coordinator (P2-B4) and the real coordinator (P3-A1)
// must implement the CoordinatorService interface.
//
// See docs/10-roadmap.md §Integration contract.
// ──────────────────────────────────────────────────────────────

// ── Network & Enums ──────────────────────────────────────────

// Testnet only — constraint C9. See docs/04-technical-constraints.md §C9.
export type ZcashNetwork = "testnet";

export type VaultStatus = "PENDING_DKG" | "ACTIVE" | "ARCHIVED";

export type ApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "BROADCASTED";

export type RoundType = "COMMITMENT" | "SIGNATURE_SHARE";

export type RoundEventStatus =
  | "PENDING"
  | "RECEIVED"
  | "TIMEOUT"
  | "INVALID";

export type ViewingKeyScope = "FULL_VIEWING" | "INCOMING_VIEWING";

// ── Error Taxonomy ───────────────────────────────────────────
// Structured errors — never strings to parse.
// See docs/02-product-spec.md §F4: misbehaving-signer detection.

export type CoordinatorErrorCode =
  | "INVALID_SHARE"       // InvalidSignatureShare::culprits (v3 vector)
  | "TIMEOUT"             // Signer did not respond within deadline
  | "THRESHOLD_NOT_MET"   // Not enough signers approved
  | "NETWORK_ERROR"       // Zebra/Zaino unreachable
  | "ANCHOR_STALE"        // v6 anchor became invalid (should not happen with deferred anchor)
  | "DKG_CHANNEL_ERROR"   // Authenticated+confidential channel failure during DKG
  | "ROUND_ABORTED";      // Round explicitly aborted by coordinator

export interface CoordinatorError {
  code: CoordinatorErrorCode;
  /** Participant identifier(s) responsible, if identifiable */
  culprit?: string;
  culprits?: string[];
  /** Whether the operation can be retried without a full restart */
  recoverable: boolean;
  /** Human-readable explanation for UI display */
  message: string;
}

// ── DKG (Key Ceremony) ──────────────────────────────────────

export interface ParticipantInfo {
  /** Display name / label for the participant */
  label: string;
  /** Unique identifier within this ceremony */
  identifier: string;
}

export interface ParticipantPublicInfo extends ParticipantInfo {
  /** Hex-encoded verifying share — the PUBLIC identifier, never the share itself */
  publicKeyIdentifier: string;
}

export interface DkgSessionRequest {
  vaultLabel: string;
  threshold: number;
  totalParticipants: number;
  participants: ParticipantInfo[];
  network: ZcashNetwork;
}

export type DkgRoundStatus =
  | "WAITING_FOR_PARTICIPANTS"
  | "ROUND_1_IN_PROGRESS"
  | "ROUND_2_IN_PROGRESS"
  | "COMPLETED"
  | "FAILED";

export interface DkgSessionState {
  sessionId: string;
  vaultLabel: string;
  status: DkgRoundStatus;
  participants: Array<ParticipantPublicInfo & { connected: boolean }>;
  /** Populated on completion */
  shieldedAddress?: string;
  error?: CoordinatorError;
}

export interface DkgSessionResult {
  vaultId: string;
  shieldedAddress: string;
  participants: ParticipantPublicInfo[];
  network: ZcashNetwork;
}

// ── Approval Request ─────────────────────────────────────────

export interface ApprovalSubmission {
  vaultId: string;
  recipientAddress: string;
  /** Amount in zatoshi (1 ZEC = 100_000_000 zatoshi). Integer to avoid float errors. */
  amountZatoshi: bigint;
  memo?: string;
}

export interface ApprovalRequestState {
  id: string;
  vaultId: string;
  recipientAddress: string;
  amountZatoshi: bigint;
  memo?: string;
  status: ApprovalStatus;
  /** Transaction ID, populated after broadcast */
  txid?: string;
  /** Anchor block height, set at broadcast (v6 deferred anchor) */
  anchorBlock?: number;
  /** Threshold required for this vault */
  threshold: number;
  /** Number of valid signatures collected so far */
  signaturesCollected: number;
  /** Per-signer status */
  signerStatuses: SignerStatus[];
  /** Signing round events */
  events: SigningRoundEvent[];
  createdAt: Date;
  expiresAt?: Date;
}

export interface SignerStatus {
  participantId: string;
  participantLabel: string;
  status: "PENDING" | "APPROVED" | "DECLINED" | "TIMEOUT" | "INVALID_SHARE";
  /** Timestamp of last status change */
  updatedAt: Date;
}

// ── Signing Rounds ───────────────────────────────────────────

export interface SigningRoundEvent {
  id: string;
  approvalRequestId: string;
  participantId: string;
  participantLabel: string;
  roundType: RoundType;
  status: RoundEventStatus;
  culpritDetected: boolean;
  errorCode?: CoordinatorErrorCode;
  errorDetails?: string;
  timestamp: Date;
}

export interface SignRoundUpdate {
  approvalRequestId: string;
  participantId: string;
  roundType: RoundType;
  status: RoundEventStatus;
  error?: CoordinatorError;
}

// ── Mock Scenario Control ────────────────────────────────────
// Used only by the mock coordinator for testing; the real coordinator
// does not accept scenario parameters.

export type MockScenario =
  | "happy_path"          // Signers A+B approve → BROADCASTED
  | "non_responding"      // Signer C times out
  | "malicious_share";    // Signer B sends invalid share

// ── Coordinator Service Interface ────────────────────────────
// Both mock and real coordinator implement this.
// Phase 3 (P3-B1): swap mock for real = type-safe replacement.

export interface CoordinatorService {
  // ── DKG ──
  createDkgSession(request: DkgSessionRequest): Promise<DkgSessionState>;
  getDkgStatus(sessionId: string): Promise<DkgSessionState>;
  completeDkg(sessionId: string): Promise<DkgSessionResult>;

  // ── Approval ──
  submitApproval(submission: ApprovalSubmission): Promise<ApprovalRequestState>;
  getApprovalStatus(approvalId: string): Promise<ApprovalRequestState>;

  // ── Signing ──
  signApproval(
    approvalId: string,
    participantId: string
  ): Promise<SignRoundUpdate>;
  rejectApproval(
    approvalId: string,
    participantId: string
  ): Promise<ApprovalRequestState>;
}
