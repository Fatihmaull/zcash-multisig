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
  // Deferring the anchor to broadcast (constraint C3) removes the common
  // cause — an anchor going stale while signers take hours to respond. It
  // does not remove every cause: the node can still reject the anchor chosen
  // at broadcast if a reorg lands in between, or if the chosen block has
  // fallen outside the node's anchor retention window. Rare, recoverable by
  // re-anchoring and re-broadcasting; the collected signatures stay valid.
  | "ANCHOR_STALE"
  | "DKG_CHANNEL_ERROR"   // Authenticated+confidential channel failure during DKG
  | "ROUND_ABORTED";      // Round explicitly aborted by coordinator

export interface CoordinatorError {
  code: CoordinatorErrorCode;
  /**
   * Participants responsible, if identifiable. Always a list, never a bare
   * value: FROST v3 changed `InvalidSignatureShare::culprit` to `culprits`
   * (a vector) because a single round can implicate more than one signer.
   * A singular field alongside it would eventually get read instead, and a
   * second culprit would vanish silently.
   *
   * Empty or absent means the failure could not be attributed to anyone.
   */
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
  /**
   * Hex-encoded randomizer seed for this signing round.
   *
   * FROST v3 derives the randomizer from this seed **plus every participating
   * signer's round-1 commitments**, and each participant regenerates it
   * locally rather than being handed one — so nobody has to trust the
   * coordinator's RNG (constraint C6).
   *
   * Persisted because it is required to re-derive `RandomizedParams` and
   * re-verify the round after the fact. Without it the audit trail cannot be
   * independently checked. Set once round 1 closes; absent before then.
   *
   * Not secret, but bound to this round — never reuse across rounds.
   */
  randomizerSeedHex?: string;
  /** Threshold required for this vault */
  threshold: number;
  /** Number of valid signatures collected so far */
  signaturesCollected: number;
  /** Per-signer status */
  signerStatuses: SignerStatus[];
  /** Signing round events */
  events: SigningRoundEvent[];
  /** ISO 8601. A string, not a Date — see the note on CoordinatorService. */
  createdAt: string;
  /** ISO 8601. */
  expiresAt?: string;
}

export interface SignerStatus {
  participantId: string;
  participantLabel: string;
  status: "PENDING" | "APPROVED" | "DECLINED" | "TIMEOUT" | "INVALID_SHARE";
  /** ISO 8601. Timestamp of last status change. */
  updatedAt: string;
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
  /** ISO 8601. */
  timestamp: string;
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

/**
 * Implemented by both the mock (P2-B4) and the real Rust coordinator (P3-A1),
 * so swapping one for the other is a type-safe replacement rather than a
 * rewrite.
 *
 * **Timestamps are ISO 8601 strings, never `Date` objects.** Over HTTP a
 * `Date` serialises to a string anyway; typing it as `Date` lets the mock
 * return real Dates while the real coordinator returns strings, and
 * TypeScript would not catch the difference. Parse at the boundary if you
 * need date arithmetic.
 *
 * **Status is poll-only.** There is no subscription or long-poll: callers
 * re-read `getApprovalStatus` / `getDkgStatus`. Adequate for this build and
 * deliberately not being built now — but do not write UI that would need
 * rewriting to accept pushed updates later.
 */
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
