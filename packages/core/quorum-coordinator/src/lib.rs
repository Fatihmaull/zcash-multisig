//! quorum-coordinator — drives FROST rounds and aggregates.
//!
//! **Holds no key material.** It can stall a round by refusing to relay, and
//! it can see who is participating. It cannot move funds: below threshold the
//! signature does not exist, and that is enforced by mathematics rather than
//! by a permission check here.
//!
//! See `docs/03-architecture.md` §2.

pub mod round;

pub use round::{Action, CollectingCommitments, CollectingShares, CoordinatorError, ShieldedPool};
