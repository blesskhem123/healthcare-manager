# Healthcare Appointment & Follow-up Manager Platform

A production-ready healthcare appointment management platform built with React 18, Vite, Node.js, Express, Prisma ORM, SQLite/PostgreSQL, Google Gemini AI, Nodemailer, and Google Calendar API.

---

## 🔗 Live Application & GitHub Repository

- **🌐 Live Hosted Application URL:** [https://healthcare-manager-5y9w.onrender.com](https://healthcare-manager-5y9w.onrender.com)
- **📦 GitHub Source Code Repository:** [https://github.com/blesskhem123/healthcare-manager](https://github.com/blesskhem123/healthcare-manager)

---

## 📋 Deliverables Overview

1. **Zip File with Complete Source Code:** `healthcare-manager.zip` (Generated via `npm run create-zip` and tracked in root repository).
2. **README Documentation:** Includes setup guide, `.env.example`, full API documentation, DB schema explanation, LLM prompts, and Google Calendar integration steps.
3. **Hosted Application URL:** [https://healthcare-manager-5y9w.onrender.com](https://healthcare-manager-5y9w.onrender.com) (Deployed on Render).
4. **System Design Write-Up:** [`system_design.md`](./system_design.md) (Max 800 words covering double-booking prevention, doctor leave conflict handling, 5-minute slot hold, and notification retries).

---

## 🌟 Key Features

1. **Role-Based Access Portals (JWT Auth):**
   - **Patient Portal:** Search doctors by specialization, 5-minute slot reservation hold, pre-visit symptom entry with AI urgency summary, view post-visit summaries and active medication schedule reminders.
   - **Doctor Portal:** View daily appointment schedule, review patient AI pre-visit summary & suggested consultation questions, submit clinical notes & prescriptions, generate patient-friendly post-visit AI summaries, manage leave dates.
   - **Admin Portal:** Manage doctor profiles (specialization, working hours e.g. `09:00-17:00`, slot duration e.g. `30 mins`), set doctor leave dates with automated conflict resolution & patient email notifications, system overview & audit logs.

2. **Double-Booking & Slot Hold Mechanism:**
   - 5-minute transient slot reservation (`SlotHold`) during checkout.
   - Database isolation transaction + compound `UNIQUE` SQL constraints on `(doctorId, appointmentDate, startTime)`.

3. **Doctor Leave Management:**
   - Automated detection of conflicting booked appointments upon leave creation.
   - Updates appointment status to `CANCELLED_LEAVE` and dispatches automated notification emails to affected patients.

4. **AI Summaries (Google Gemini):**
   - **Pre-Visit Symptom Summary:** Analyzes patient symptoms -> returns Urgency (`Low` | `Medium` | `High`), Chief Complaint, and 3 suggested questions for doctor.
   - **Post-Visit Patient Summary:** Converts raw clinical doctor notes into patient-friendly language, medication schedule & dosage, and follow-up instructions.
   - **Graceful Fallbacks:** Built-in heuristic engine guarantees zero application breakage even if Gemini API key is unconfigured or rate-limited.

5. **Notifications & Background Reminders:**
   - **Email:** Booking confirmations, reminders, cancellations via Nodemailer with retry queue.
   - **Google Calendar API:** Auto-creates calendar events on booking, syncs or deletes events on cancellation.
   - **Medication Reminders:** Background cron job scans active prescriptions and dispatches scheduled dosage reminders.

---

## 🚀 Setup & Local Installation Guide

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)

### Installation Steps

1. **Clone / Extract Source Code:**
   ```bash
   git clone https://github.com/blesskhem123/healthcare-manager.git
   cd healthcare-manager
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

4. **Initialize Database & Seed Demo Accounts:**
   ```bash
   npm run db:push
   node prisma/seed.js
   ```

5. **Start Application in Development Mode:**
   ```bash
   npm run dev
   ```
   - **Frontend UI:** http://localhost:3000
   - **Backend API:** http://localhost:5000

---

## 🔑 Demo Accounts (1-Click Login Available in UI)

Password for all pre-seeded demo accounts: `password123`

| Role | Email | Capabilities |
|---|---|---|
| **Patient** | `john.doe@example.com` | Search doctors, hold slot, book appointment, view AI summaries & medication schedule |
| **Doctor** | `sarah.jenkins@clinic.com` | View patient AI summaries, submit post-visit notes & prescription, set leave |
| **Admin** | `admin@clinic.com` | Manage doctor profiles, resolve leave conflicts, system audit log |

---

## ⚙️ Environment Variables (.env.example)

```env
# Server Configuration
PORT=5000
NODE_ENV=development
JWT_SECRET=super_secret_healthcare_jwt_key_2026

# Database Connection (SQLite local file)
DATABASE_URL="file:./dev.db"

# LLM Configuration (Google Gemini API)
GEMINI_API_KEY=your_gemini_api_key_here

# Email Notification Service (Nodemailer / Ethereal / SendGrid / SMTP)
EMAIL_HOST=smtp.ethereal.email
EMAIL_PORT=587
EMAIL_USER=your_email_username
EMAIL_PASS=your_email_password
EMAIL_FROM=noreply@healthmanager.com

# Google Calendar Integration (OAuth2 / Service Account)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
GOOGLE_REFRESH_TOKEN=your_google_refresh_token
```

---

## 📑 Complete API Documentation

### 1. Authentication Routes (`/api/auth`)
- **POST `/api/auth/register`**
  - **Body:** `{ email, password, name, role: "PATIENT"|"DOCTOR"|"ADMIN", phone, specialization? }`
  - **Response:** `{ message, token, user }`
- **POST `/api/auth/login`**
  - **Body:** `{ email, password }`
  - **Response:** `{ token, user }`
- **GET `/api/auth/me`** (Header: `Authorization: Bearer <token>`)
  - **Response:** Current authenticated user profile.

### 2. Patient Routes (`/api/patient`)
- **GET `/api/patient/doctors?specialization=Cardiology`**
  - Search doctors by specialization.
- **GET `/api/patient/doctors/:id/slots?date=YYYY-MM-DD`**
  - Returns doctor working hours time slots with `isAvailable`, `isBooked`, `isHeld`, and `isDoctorOnLeave`.
- **POST `/api/patient/hold-slot`**
  - **Body:** `{ doctorId, appointmentDate, startTime }`
  - **Response:** Returns 5-minute transient slot reservation hold.
- **POST `/api/patient/book`**
  - **Body:** `{ doctorId, appointmentDate, startTime, symptoms }`
  - **Response:** Confirms atomic DB booking, invokes Gemini AI pre-visit summary generator, creates Google Calendar event, sends confirmation email.
- **GET `/api/patient/appointments`**
  - List patient's past/upcoming appointments, AI summaries, post-visit notes, and active medication schedule reminders.

### 3. Doctor Routes (`/api/doctor`)
- **GET `/api/doctor/appointments`**
  - List appointments assigned to doctor with patient symptoms & AI pre-visit summaries.
- **POST `/api/doctor/appointments/:id/post-visit`**
  - **Body:** `{ doctorNotes, followUpDays }`
  - **Response:** Calls Gemini AI to convert notes to patient-friendly summary & medication schedule, creates medication reminders in DB, emails summary to patient.
- **POST `/api/doctor/leave`**
  - **Body:** `{ leaveDate, reason }`
  - **Response:** Registers leave, cancels conflicting appointments (`CANCELLED_LEAVE`), notifies affected patients.

### 4. Admin Routes (`/api/admin`)
- **GET `/api/admin/doctors`** - List doctor profiles.
- **POST `/api/admin/doctors`** - Create new doctor account & profile.
- **POST `/api/admin/doctors/:id/leave`** - Set doctor leave & resolve appointment conflicts.
- **GET `/api/admin/stats`** - System overview counts & notification audit logs.

### 5. Standalone AI Routes (`/api/ai`)
- **POST `/api/ai/pre-visit-summary`** - Body: `{ symptoms }`
- **POST `/api/ai/post-visit-summary`** - Body: `{ notes }`

---

## 🗄️ Database Schema (Prisma)

- **`User`**: Store account authentication details, roles (`PATIENT`, `DOCTOR`, `ADMIN`).
- **`DoctorProfile`**: Store doctor specialization, bio, working hours (`09:00`-`17:00`), slot duration (`30` mins).
- **`DoctorLeave`**: Track doctor leave dates (`YYYY-MM-DD`).
- **`SlotHold`**: 5-minute slot reservation locks. Unique constraint on `(doctorId, appointmentDate, startTime)`.
- **`Appointment`**: Store appointment status (`BOOKED`, `COMPLETED`, `CANCELLED_LEAVE`), patient ID, doctor ID, date, start/end time, symptoms, and Google Calendar event ID.
- **`PreVisitSummary`**: Store Gemini AI pre-visit urgency assessment, chief complaint, and suggested questions.
- **`PostVisitSummary`**: Store doctor clinical notes, patient-friendly summary, medication schedule JSON, and follow-up instructions.
- **`MedicationReminder`**: Track active patient medication schedules for background cron worker.
- **`NotificationLog`**: Track email/calendar dispatch status (`SENT`, `PENDING_RETRY`, `FAILED`) and retry attempt count.

---

## 🤖 LLM Usage & Guidance Prompts

### Pre-Visit Symptom Summary Prompt:
```
Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor.
Return ONLY valid JSON matching this exact structure:
{
  "urgency": "Low" | "Medium" | "High",
  "chiefComplaint": "string summary",
  "suggestedQuestions": ["question 1", "question 2", "question 3"]
}

Symptoms: <symptoms>
```

### Post-Visit Summary Prompt:
```
Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps.
Return ONLY valid JSON matching this exact structure:
{
  "patientSummary": "Clear, accessible explanation for the patient",
  "medicationSchedule": [
    {
      "name": "Medication Name",
      "dosage": "e.g. 500mg",
      "frequency": "e.g. Twice Daily after meals"
    }
  ],
  "followUpSteps": "Clear follow-up instructions and warning signs"
}

Notes: <notes>
```

---

## 📅 Google Calendar Setup Guide

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create project & enable **Google Calendar API**.
3. Create OAuth 2.0 Client ID Credentials.
4. Set Redirect URI to `http://localhost:5000/api/auth/google/callback`.
5. Insert Client ID, Secret, and Refresh Token into `.env`.
> *Note: If Google credentials are not configured, system safely uses Mock Calendar mode.*

---

## 🧪 System Verification & Zip Deliverable

To run automated verification test suite:
```bash
node tests/verify_system.js
```

To create the project zip deliverable (`healthcare-manager.zip`):
```bash
node scripts/zip_project.js
```
