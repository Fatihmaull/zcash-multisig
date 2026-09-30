/**
 * The sentence the coordinator emits. docs/07 beat 5 — quote it, do not paraphrase.
 * The participant name is the only substitution.
 */
export function f4RejectionMessage(participantName: string): string {
  return (
    `Signature share rejected — ${participantName}. The share does not verify against the ` +
    "commitment made in round 1. This vault has not been charged and no funds moved. " +
    "Re-run the round without this signer, or investigate the device."
  );
}
