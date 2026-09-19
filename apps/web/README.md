# Quorum Web Interface

The official modern web interface for **Quorum** — a non-custodial threshold multisig orchestration layer for Zcash shielded pools (FROST / RedPallas).

> **Executive Summary:**  
> Quorum allows organizations, DAOs, and collaborative teams to manage Zcash privately. Outgoing transfers require cryptographic consensus from at least **2-of-3 signers**. Key shares are stored client-side on individual devices (zero custody) and never sent to a server.

---

## Quick Start (Running Locally)

### 1. Install Dependencies
```bash
# From workspace root or apps/web
pnpm install
```

### 2. Start Development Server
```bash
cd apps/web
pnpm dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## Core Application Views

* **Dashboard (`/`):** Overview of active vaults, protected balance, pending spend requests, and device security states.
* **Vaults (`/vaults`):** List of shielded multi-signature vaults and key holder details.
* **Create New Vault (`/vaults/new`):** 3-step wizard to configure threshold rules and perform distributed key generation (DKG).
* **Approvals (`/approvals`):** Interface for key holders to review, sign, or reject outgoing transfer proposals.
* **Proposal Detail (`/approvals/[id]`):** Interactive signing session with live Quorum Indicator and F4 misbehavior detection.

---

## Interactive Edge-Case Simulator (FROST Orchestration)

Use the scenario switcher in the top navigation bar to test real-world scenarios:
1. **Normal Flow (Happy Path):** Standard 2-of-3 signing flow where Alice and Bob approve the transaction.
2. **1 Signer Offline (Timeout):** Simulates an unresponsive co-signer; enables seamless fallback to Carol (standby signer).
3. **Corrupt Key Share (F4 Culprit Detection):** Automatically flags corrupted or fraudulent key shares, isolating the culprit while keeping funds 100% secure.

---

## Plain English Guide

For a comprehensive explanation designed for non-technical users and stakeholders, please review [DOKUMENTASI_AWAM.md](../../DOKUMENTASI_AWAM.md).
