# WCC Child Health Registry & Multi-Camp Management System
## উই ক্যান চেঞ্জ (WCC) শিশু স্বাস্থ্য রেজিস্ট্রি ও মাল্টি-ক্যাম্প ম্যানেজমেন্ট সিস্টেম

A complete, production-ready, secure, and responsive web application built for the Bangladeshi nonprofit organization **We Can Change (WCC)**. Designed specifically for low-resource remote health camps with a **Paper-First, Digital-Light** clinical workflow, robust Role-Based Access Control (RBAC), and strict medical data confidentiality.

---

## 🌟 Key Features

1. **Multi-Camp Lifecycle Management**:
   - Create unlimited health camps with automatically generated collision-safe Camp Codes (`CAMP-2026-001`, etc.).
   - Full lifecycle management: `DRAFT` ➔ `ACTIVE` ➔ `CLOSED`.
   - Independent operational dashboards, records, and reports for each camp.
   - Closing a camp safely locks new registrations and consultations while keeping historical records and reports fully accessible.

2. **Atomic Collision-Safe Patient Registration**:
   - Permanent human-readable Patient IDs (e.g. `WCC-000001`, `WCC-000002`...) generated atomically via MongoDB sequence counters.
   - **Critical Workflow Protection**: Volunteers *never* select or assign doctors; patients receive their permanent ID slip and can consult any available doctor independently.
   - Separate camp visit records allow returning patients to reuse their permanent Patient ID across different camps without duplicating records.
   - Compound index prevents accidental duplicate patient registration within the same camp.
   - Clear printable/handwritten Patient ID Slip generator.
   - Mandatory guardian consent recording with clear Bangla legal notice.

3. **Paper-First, Digital-Light Doctor Consultation**:
   - Zero tedious typing: Doctors write traditional paper prescriptions for patients.
   - Doctor searches patient using large Patient ID input (`WCC-XXXXXX`).
   - Doctor verifies patient identity, age, and previous medical history.
   - Server-side authenticated session strictly attaches `doctorId` (client doctorId is never trusted).
   - Quick selectable diagnosis categories in Bangla (জ্বর, সর্দি-কাশি, ডায়রিয়া, পেট ব্যথা, অপুষ্টি, সার্জিক্যাল সমস্যা, চর্মরোগ, অন্যান্য) + custom clinical notes.
   - Secure prescription photograph upload attached to consultation record.
   - Multi-doctor consultations supported without data overwriting.
   - Specialized hospital referral tracking with follow-up dates.

4. **Medical Document Privacy & Image Storage**:
   - Non-public, confidential storage for prescription photographs.
   - Permission-controlled streaming endpoint (`/api/images/:assetId`) restricted exclusively to authorized doctors and super admins.
   - ImagesDB provider adapter with secure local encrypted fallback.
   - Temporary upload cleanup, file format validation (JPEG, PNG, WebP), and size enforcement.
   - Zero binary images stored directly in MongoDB (clean metadata only).

5. **Camp-wise Reporting & Exports**:
   - Real-time camp summary metrics, doctor-wise performance breakdown, and volunteer counts.
   - Export to CSV (with UTF-8 BOM for native Bangla Excel rendering) and Excel (XLSX).
   - Formula injection protection: automatic escaping of `=, +, -, @` characters.

6. **Healthcare-Grade Application Security**:
   - Argon2id password hashing.
   - HttpOnly, SameSite, Secure cookie-based authentication.
   - Double-submit cookie CSRF protection.
   - Helmet security headers and CORS allowlist.
   - NoSQL injection sanitization.
   - Express rate limiters (global & brute-force login protection).
   - Tamper-proof audit logging of logins, registrations, consultations, and exports.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom design system), Vanilla JavaScript (ES6+), Google Font **Hind Siliguri**, Lucide SVG icons.
- **Backend**: Node.js (LTS), Express.js.
- **Database**: MongoDB Atlas / Mongoose ODM (includes automatic embedded in-memory fallback for zero-config offline testing).
- **Security**: Argon2id, Helmet, CORS, Cookie-Parser, CSRF, Rate Limiting, Zod validation.
- **File & Export Processing**: Multer, ExcelJS, csv-stringify.
- **Logging**: Pino structured logging with healthcare data redaction.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js v18+ (tested on Node.js v24 LTS)
- npm v9+

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp backend/.env.example backend/.env
```
*(Default settings automatically work out-of-the-box using the embedded in-memory MongoDB runner if no MongoDB Atlas URI is provided).*

### 4. Seed Initial Data
```bash
npm run seed
```

### 5. Start the Application
```bash
npm start
```
Open your browser at: **`http://localhost:5000`**

---

## 👥 Default Demo Credentials

| Role | Email | Password | Access |
|---|---|---|---|
| **Super Admin** | `admin@wcc.org.bd` | `AdminPassword@123` | Full system, camp lifecycle, audits, staff |
| **Pediatric Doctor** | `dr.farhana@wcc.org.bd` | `Doctor@123` | Active camp consultations, prescriptions |
| **Pediatric Doctor** | `dr.mahmud@wcc.org.bd` | `Doctor@123` | Active camp consultations, prescriptions |
| **Registration Volunteer** | `volunteer1@wcc.org.bd` | `Volunteer@123` | Patient registration desk & ID slips |
| **Camp Coordinator** | `coordinator1@wcc.org.bd` | `Volunteer@123` | Camp operations and summary reports |

---

## 🧪 Automated Testing

Run the test suite verifying all 24 required test scenarios and acceptance criteria:
```bash
npm test
```
The test suite tests:
- Admin and user authentication
- Role-based authorization & permission rejection
- Camp draft creation, activation, and closing
- Closed camp registration/consultation restrictions
- Unique Patient ID collision safety (`WCC-000001`)
- Duplicate camp visit prevention
- Session-derived doctor consultation linking
- Multiple doctors consulting one patient
- Confidential prescription upload and restricted access
- CSV and Excel export with formula sanitization
- Double-submit CSRF verification
- Cross-camp access prevention

---

## 📄 Emergency Paper Fallback Workflow

In remote rural camps where internet connectivity is lost:
1. The frontend displays an immediate high-contrast offline alert banner in Bangla.
2. Registration Volunteers use pre-printed physical Patient ID token slips to record:
   - Patient Name, Age, Sex, Guardian Contact, and handwritten temporary token number.
3. Doctors examine patients and write paper prescriptions as normal.
4. When connectivity resumes, volunteers enter the handwritten slips into the system. The permanent `WCC-XXXXXX` IDs are generated and linked to the camp visit records seamlessly.

---

## 🔒 Security Checklist

- [x] Argon2id hashing for all stored credentials
- [x] Session tokens stored strictly in HttpOnly SameSite cookies (no sensitive tokens in localStorage)
- [x] All mutation endpoints guarded with double-submit CSRF tokens
- [x] Server-derived doctor identity (client `doctorId` is never accepted)
- [x] Confidential prescription photos restricted to authorized doctors and super admin
- [x] NoSQL injection query sanitization applied to all request payloads
- [x] Formula injection protection for CSV and XLSX exports
- [x] Audit logs record security events while redacting sensitive medical diagnoses

---
*Developed for **We Can Change (WCC)** • Dedicated to humanitarian child healthcare.*
