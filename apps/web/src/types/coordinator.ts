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

// ── Signing: actions, not transactions ──────────────────────
// Every real shielded spend needs its own FROST round. A transaction with
// N inputs needs N complete rounds, each with its own randomizer, all over
// the same sighash. See docs/13-phase-1-plan.md.

/**
 * Which shielded bundle a spend lives in.
 *
 * A v6 transaction carries both an Orchard and an Ironwood bundle, and
 * either may hold spends — a ZIP 318 migration spends from Orchard while
 * outputting to Ironwood. They are reached through different signer entry
 * points, and **asking the wrong one returns no spends rather than an
 * error**, so the pool must travel with the index.
 */
export type ShieldedPool = "ORCHARD" | "IRONWOOD";

export interface SigningAction {
  pool: ShieldedPool;
  /** Index within that pool's bundle. */
  index: number;
  /**
   * The action's randomizer, hex, 32 bytes.
   *
   * Read from the PCZT (`action.spend().alpha()`) — **not** generated by
   * FROST. The v3 guidance to derive a randomizer via
   * `RandomizedParams::new_from_commitments()` is for generic FROST where
   * the signer chooses it; for Zcash the transaction dictates it. Signers
   * must use `RandomizedParams::from_randomizer()` with this value.
   */
  alphaHex: string;
}

export interface SigningPackages {
  /** The sighash every action in this request signs over. Hex, 32 bytes. */
  sighashHex: string;
  /**
   * One entry per real spend awaiting a signature.
   *
   * **Never legitimately empty.** An empty list means the wrong bundle was
   * queried, which the underlying API reports as success. Treat it as a
   * failure.
   */
  actions: SigningAction[];
  /** Parallel to `actions`, same order. */
  signingPackagesHex: string[];
}

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

  // No signing. See SignerService below — the omission is the point.
}

/**
 * **Signer binary → coordinator**, over `frostd`, authenticated as the
 * participant. The only surface that produces signatures.
 *
 * Key shares live in `quorum-signer` on the participant's own machine and
 * never in the browser (docs/03-architecture.md §2). Keeping this separate
 * from `CoordinatorService` makes the browser *structurally* incapable of
 * signing — enforced by the type system rather than by everyone
 * remembering. A single combined interface would let a browser call
 * produce a signature from nothing but a participant id, which either
 * means the share is in the browser or the call is a lie.
 *
 * FROST is two rounds and they cannot be collapsed. Round 1 nonces stay on
 * the signer's machine between calls and **must never be reused** — the
 * same nonce across two signing packages leaks the secret. A single
 * sign-it-all method would hide where those nonces live, and hidden state
 * is the state that leaks.
 */
export interface SignerService {
  /** Requests awaiting this participant. Poll-only; see the note above. */
  fetchPendingRequests(participantId: string): Promise<ApprovalRequestState[]>;

  /**
   * Round 1. One commitment per action, same order as
   * `getSigningPackages().actions`. The matching nonces stay on the signer.
   */
  submitCommitments(
    approvalId: string,
    participantId: string,
    commitmentsHex: string[]
  ): Promise<SignRoundUpdate>;

  /**
   * Available only once threshold commitments are in — before that the
   * coordinator cannot build the packages. Carries the per-action
   * randomizers the signer needs.
   */
  getSigningPackages(
    approvalId: string,
    participantId: string
  ): Promise<SigningPackages>;

  /** Round 2. One share per action, same order as round 1. */
  submitSignatureShares(
    approvalId: string,
    participantId: string,
    sharesHex: string[]
  ): Promise<SignRoundUpdate>;

  /** Refuse to sign. Distinct from failing to respond. */
  declineApproval(
    approvalId: string,
    participantId: string
  ): Promise<ApprovalRequestState>;
}
