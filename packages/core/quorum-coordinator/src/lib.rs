// quorum-coordinator — FROST coordinator role
//
// Drives the coordinator role: builds PCZTs, aggregates signature shares,
// maps InvalidSignatureShare::culprits to typed domain errors, broadcasts.
//
// HOLDS NO KEY MATERIAL. If a code path would cause share material to cross
// into this process, that path is wrong. See docs/03-architecture.md §2.
//
// Placeholder: Dev A implements this after spike S1.
// See docs/10-roadmap.md P1-A3.
