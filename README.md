# SmartPrint V2 — QR Document Sharing & Browser Printing System

A modern, multi-tenant document sharing and browser-based printing web application designed specifically for stationery shops, Xerox centres, print shops, and cyber cafés. It completely replaces messy WhatsApp document transfers with a fast, private, QR-driven workflow.

---

## 🌟 Key Features

### 1. For Customers
* **QR-Based Quick Upload:** Scan the shop's printed counter QR code with a smartphone camera to directly access that specific shop's upload page (`/print/[shopCode]`).
* **Multi-Format Support:** Upload **PDF, Word (.docx), PNG, JPEG/JPG, WebP, and TXT** documents (up to 20 MB each).
* **Multi-File Submission:** Upload multiple documents in a single submission.
* **Preview Before Upload:** Customers can preview documents (full-resolution image previews, PDF previews via embedded viewer, Word/text cards) and remove incorrect files with one click before submitting.
* **Drag-and-Drop & Progress Feedback:** Smooth drag-and-drop zone with real-time upload progress.
* **Zero Friction:** No account creation, no password, no email, no phone number, and no tracking required. Customers simply enter their name for counter collection.

### 2. For Shopkeepers
* **Smart Document Dashboard:** Live, real-time incoming queue displaying customer names, original filenames, document types/formats, file sizes, and exact upload timestamps.
* **Live Search & Date Filtering:** Search by customer name or filename with instant results. Filter by date (Today, Yesterday, Past 7 Days, or All Dates) and sort newest first.
* **One-Click Native Browser Printing:** Open PDFs, Word documents, or images and trigger the browser's native print dialog with **one click** (`Ctrl+P` / `⌘P`) without downloading or saving files to the computer's hard drive.
* **Automatic 24-Hour File Purging:** Customer files in Cloudflare R2 / storage are automatically deleted after 24 hours for privacy and zero storage bloat, while customer metadata (name, document name, upload time) is preserved in the database for business record-keeping.
* **Printable Counter QR Posters:** Generates high-resolution local QR codes and provides a 1-click printable A4 counter poster with shop branding and simple 3-step instructions.

---

## 🛠️ Technology Stack

| Component | Technology | Description |
|---|---|---|
| **Framework** | Next.js 15 (App Router, React 19) | Full-stack React framework with TypeScript |
| **Database** | LibSQL / Cloudflare D1 / SQLite | Zero-config local SQLite + remote LibSQL/Turso/D1 |
| **Object Storage** | Cloudflare R2 (S3 API) | Private bucket with zero egress fees (with local disk fallback) |
| **Document Processing**| Mammoth.js | Converts Word `.docx` documents into print-ready styled HTML |
| **Authentication** | Web Crypto PBKDF2 + HTTP-only Cookies | Native Worker/Node secure password hashing & session management |
| **QR Generation** | `qrcode` (local npm package) | Offline, secure local SVG/PNG QR generation without third-party APIs |
| **Deployment** | Vercel / Cloudflare Workers / Node | Standard Next.js serverless deployment |

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed Initial Shop & Owner
Creates a local SQLite database (`local.db`) with an active test shop:
```bash
npm run seed
```

**Default Test Credentials:**
* **Dashboard Login:** `http://localhost:3000/login`
* **Email:** `admin@smartprint.com`
* **Password:** `password123`
* **Customer Upload URL:** `http://localhost:3000/print/royal-xerox`

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

Run the automated test suite:
```bash
npm test
```
Runs 8 deterministic integration tests covering:
* Magic bytes validation (PDF, PNG, JPEG, DOCX)
* Rejection of malicious / masqueraded file extensions
* Filename path traversal sanitization
* PBKDF2 password hashing & verification
* 24-hour file purging with customer metadata retention

Run linting and production build:
```bash
npm run lint
npm run build
```

---

## ☁️ Deployment

### Deploying on Vercel (Recommended)
1. Push this repository to GitHub.
2. Import the project into [Vercel](https://vercel.com).
3. Set the following Environment Variables in Vercel Project Settings:

```env
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
DATABASE_URL=libsql://your-turso-database.turso.io
DATABASE_AUTH_TOKEN=your-turso-auth-token
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=stationery-documents
CRON_SECRET=your-random-cron-secret-token
```
4. Deploy! The included `vercel.json` automatically schedules the 24-hour file cleanup cron job to run hourly at `/api/cron/cleanup`.

---

## 🔒 Security & Privacy Notes
* **Zero WhatsApp Security Risks:** Customers no longer need to save the shopkeeper's phone number or broadcast files to WhatsApp servers.
* **Private R2 Buckets:** All uploaded files are stored privately. Previews and print streams require authenticated shopkeeper session tokens.
* **No-Store Headers:** File preview endpoints emit `Cache-Control: private, no-store, no-cache, must-revalidate` to prevent persistent browser caching of sensitive documents.
* **Strict Magic Bytes Validation:** File content is inspected byte-by-byte on the server to prevent malicious executable files disguised as PDFs or images.
