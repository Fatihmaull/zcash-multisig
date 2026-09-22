# Quorum — Panduan Penggunaan & Arsitektur Sistem

> **Shared Custody untuk Zcash Shielded Funds (Private Multisig)**  
> *Non-custodial threshold signing menggunakan re-randomized FROST & RedPallas di Zcash Testnet (Ironwood Pool).*

Bahasa: [English](README.md) | **Bahasa Indonesia**

---

## 1. Konsep Dasar — Apa Itu Quorum?

Di Zcash shielded pool (dana privat/terenkripsi), **tidak ada opcode multisig di level blockchain**. Biasanya, organisasi terpaksa memilih salah satu dari dua opsi buruk:
1. Menggunakan **transparent address** (semua saldo & riwayat terbuka publik — menghilangkan fungsi privasi Zcash).
2. Menyerahkan **private key/seed phrase ke satu orang bendahara** (*single point of failure* / risiko pencurian).

### Solusi Quorum:
Quorum menghadirkan **tata kelola threshold multisig (2-of-3)**:
- **Zero Custody:** Server/database sama sekali **tidak pernah menyimpan private key atau key share**.
- **FROST (Flexible Round-Optimized Schnorr Threshold):** Private key dibagi menjadi 3 pecahan (*shares*) yang dipegang oleh masing-masing signer (Alice, Bob, Carol) di perangkat lokal mereka.
- **Konsensus 2-dari-3:** Transaksi transfer shielded hanya sah jika minimal 2 signer menyetujui dan menggabungkan tanda tangan matematika mereka.
- **Viewing-Key Audit Trail:** Pihak auditor atau dewan yayasan dapat memverifikasi laporan pengeluaran secara independen tanpa memerlukan hak akses transfer dana.

---

## 2. Alur Penggunaan (Core Flows)

```
       [ 1. Key Ceremony (DKG) ]
       3 Peserta membuat Shared Vault
                   │
                   ▼
     [ 2. Buat Spend Proposal ]
     (Tentukan Penerima, Jumlah TAZ, & Alasan)
                   │
                   ▼
     [ 3. Approval & Threshold Signing ]
     Alice menyetujui (1/2) ─► Bob menyetujui (2/2)
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
   [ Skenario Normal ]   [ Skenario Masalah (F4) ]
   Threshold tercapai,   Bob kirim signature korup / offline?
   gabung signature      Sistem deteksi otomatis (Culprit Detection),
         │               lalu beralih ke Carol (Standby Signer)
         ▼                   │
   [ 4. Broadcast Tx ] ◄─────┘
   Kirim ke Zcash Testnet
```

### Penjelasan Langkah Demi Langkah di Web Dashboard:

1. **Membuat Vault Baru (`/vaults/new`)**:
   - Tentukan nama vault (misal: "Dev Treasury").
   - Masukkan 3 penandatangan (Alice, Bob, Carol) dengan threshold 2.
   - Jalankan simulasi **DKG (Distributed Key Generation)** di `/vaults/[id]/ceremony` untuk menerbitkan satu Zcash Shielded Address bersama (`utest1...`).

2. **Membuat & Melihat Pengajuan Pengeluaran (`/approvals`)**:
   - Buka menu **Approvals** untuk melihat proposal transaksi yang sedang menunggu persetujuan (contoh: *Kirim 2.5 TAZ untuk Security Audit*).

3. **Menyetujui Transaksi (Signing Process)**:
   - Masuk ke detail proposal (`/approvals/req-demo-001`).
   - Anda akan melihat status kuorum: **1 dari 2 tanda tangan terkumpul (Alice sudah menyetujui)**.
   - Klik **"Sign as Bob"**: Bob melakukan verifikasi dan submit signature share.

4. **Uji Kasus Masalah di "Interactive Edge-Case Sandbox" (Pojok Kanan Bawah)**:
   - **Normal Flow:** Bob menyetujui lancar ➔ Transaksi langsung di-broadcast ke Zcash Testnet.
   - **Bob Unreachable (Offline / Timeout):** Jika Bob sedang di pesawat / tidak merespons, tombol beralih otomatis mengizinkan **Carol (Standby Signer)** untuk menandatangani agar operasional tidak macet.
   - **Corrupt Share (F4 Culprit Detection):** Jika ada perangkat signer yang mengirim pecahan kunci palsu atau terkena malware, sistem menolak transaksi secara instan, mengidentifikasi siapa pelakunya (*culprit*), dan mengamankan dana treasury.

---

## 3. Prasyarat Sistem & Persiapan

Pastikan perangkat Anda sudah terinstal:
- **Node.js**: `v20` atau `v22` (rekomendasi `v22.x`)
- **pnpm**: `v10.x`
- **Docker & Docker Compose**: Untuk menjalankan database PostgreSQL lokal.

---

## 4. Cara Menjalankan Aplikasi

### Langkah 1: Persiapkan File Konfigurasi `.env`
Salin template konfigurasi:
```bash
cp .env.example .env
cp .env apps/web/.env
```

Pastikan variabel berikut sudah terisi:
```env
ZCASH_NETWORK=testnet
LIGHTWALLETD_ENDPOINT=https://testnet.zec.rocks:443
DATABASE_URL="postgresql://quorum:quorum_dev_password@localhost:5432/quorum?schema=public"
VIEWING_KEY_ENCRYPTION_KEY=<base64-random-key>
```
*(Catatan: generate viewing key dengan `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)*

### Langkah 2: Jalankan Database PostgreSQL
Nyalakan container PostgreSQL:
```bash
docker compose up -d postgres
```

### Langkah 3: Setup Skema Database & Seed Data Demo
Jalankan migrasi dan data awal demo:
```bash
# Sinkronkan skema prisma
pnpm --filter web exec prisma db push

# Isi data simulasi awal (Treasury, Signer Alice-Bob-Carol, dsb)
pnpm db:seed
```

### Langkah 4: Jalankan Frontend Web App
```bash
pnpm dev
```
Buka browser di: **[http://localhost:3000](http://localhost:3000)**.

---

## 5. Pertanyaan Umum (FAQ)

- **Apakah saya butuh connect wallet browser (seperti MetaMask)?**  
  *Tidak.* Quorum menggunakan threshold signing FROST Zcash Shielded yang berbasis device keyshare terisolasi, bukan web3 browser wallet biasa.
- **Apakah saya butuh saldo asli sekarang?**  
  *Untuk demo antarmuka saat ini, tidak.* Semua proposal dan alur threshold sudah memiliki sandbox interaktif. Untuk pengujian on-chain riil (tahap CLI/Gate B), alamat vault akan didanai menggunakan koin Zcash Testnet (TAZ) dari testnet faucet.

---

## 6. Struktur Direktori

```
zcash-multisig/
├── apps/
│   └── web/                # Antarmuka Dashboard Next.js (Tailwind + Lucide)
│       ├── src/app/        # Halaman: /, /vaults, /approvals
│       ├── prisma/         # Schema database metadata & seed script
│       └── public/         # Aset logo, icon, dan favicon
├── docs/                   # Dokumentasi teknis lengkap arsitektur Zcash & FROST
├── packages/
│   └── core/               # Quorum Core Rust library (FROST RedPallas, PCZT)
└── docker-compose.yml      # Service PostgreSQL lokal
```
