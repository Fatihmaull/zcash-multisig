# Quorum — Plain English Guide (Layperson's Manual)

> **Simple Real-World Analogy:**  
> Imagine an office **combination safe** that requires **3 different physical keys**, held separately by Alice, Bob, and Carol.  
> To unlock the safe and withdraw company funds, **at least 2 of the 3 key holders** must insert and turn their keys.  
> The game-changing superpowers:  
> 1. **Zero Knowledge / Shielded Privacy:** Nobody standing outside the room can see how much money is inside the safe or where it goes.  
> 2. **Zero Custody:** The application and its servers **never possess or see your keys**. They remain safely stored on each person's laptop or phone.

---

## 1. What Problem Does Quorum Solve?

1. **Standard Public Blockchains (Bitcoin, Ethereum):**  
   Every transaction amount and account balance is publicly visible to anyone on the internet.

2. **Zcash Shielded Pools:**  
   Zcash uses cutting-edge zero-knowledge cryptography (*shielded addresses*) that makes balances and transfers completely private — just like digital cash in a sealed envelope.

3. **The Historical Dilemma for Organizations:**  
   Prior to Quorum, if a DAO, non-profit, company, or team wanted to store shielded Zcash, **only a single person could hold the secret spending key**. If that person lost their device or went rogue, the money was lost forever.  
   If they wanted shared ownership (multisig), they were forced to use transparent addresses, revealing all their balances to the world.

4. **The Quorum Breakthrough:**  
   Quorum unifies privacy and shared governance using **threshold FROST / RedPallas cryptography**.  
   **Funds stay 100% private, yet spend actions require mutual agreement from 2-of-3 signers without any central server holding custody.**

---

## 2. Technical Concepts in Plain Human Terms

| Technical Term | Meaning in Plain English |
| :--- | :--- |
| **Zero-Custody / Non-Custodial** | **We don't hold your funds.** Your secret key share never touches our server. It stays encrypted right inside your browser or device. |
| **Multisig / Threshold (2-of-3)** | **Shared Decision.** Out of 3 total team members, at least 2 must sign off on an outgoing payment before any money can move. |
| **Shielded Address** | **Private Account Number.** An encrypted Zcash address (`u1...`) where outside observers cannot see the account balance or transaction amounts. |
| **Key Ceremony (DKG)** | **Key Distribution Party.** An automated setup step where participants link their devices to generate the shared vault without anyone revealing their individual secret. |
| **Culprit Identification (F4)** | **Automatic Fraud Detector.** If a signer submits a corrupted or tampered key share, the protocol identifies exactly whose device failed and prevents any loss of funds. |

---

## 3. Key Web Application Features

1. **Intuitive Dashboard:**  
   Inspect your active shielded vault balance, review pending spend requests, and verify device health status at a glance.

2. **3-Step Key Ceremony Wizard:**  
   - **Step 1:** Name your vault and define the threshold rule (e.g. at least 2 out of 3 members).  
   - **Step 2:** Connect participant devices via encrypted point-to-point tunnels.  
   - **Step 3:** Generate the shared shielded address with zero central coordinator.

3. **Spend Approvals & Signer Flow:**  
   When a withdrawal is initiated, co-signers receive an alert to review recipient details and apply their cryptographic approval.

4. **Live Scenario Sandbox (Top Right):**  
   Easily toggle real-world edge cases:
   - **Happy Path:** Standard 2-of-3 approvals complete smoothly.  
   - **Signer Offline (Timeout):** Switch seamlessly to a standby backup signer (Carol).  
   - **Corrupt Key (F4):** Automatic detection flags the faulty share and allows one-click resumption with the backup signer.

5. **Dual Theme (Light & Dark Mode):**  
   Switch between high-contrast dark mode (Obsidian & Cypherpunk Gold) and crisp light mode (Pearl Slate & Amber) with a single click.

---

## 4. How to Run Locally

### Quick Start:

1. Open your terminal in the project directory:
   ```bash
   cd apps/web
   ```

2. Start the development server:
   ```bash
   pnpm dev
   ```

3. Open your browser:
   **[http://localhost:3000](http://localhost:3000)**

Fully responsive across both mobile smartphones and desktop widescreen monitors.
