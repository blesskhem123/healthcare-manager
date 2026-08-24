# Healthcare Appointment Platform System Design

## 1. Double-Booking Prevention Architecture
Double-booking prevention is enforced through a multi-layered concurrency strategy combining client slot locks, application-level isolation, and database unique constraints.

When a patient initiates booking, the system creates a temporary `SlotHold` record. If two users simultaneously request the exact same doctor slot (`doctorId`, `appointmentDate`, `startTime`), an isolated database transaction enforces single-owner reservation. The transaction checks for existing confirmed bookings (`status = BOOKED`) or active unexpired slot holds. 

At the storage layer, a compound `UNIQUE` database constraint on `(doctorId, appointmentDate, startTime)` guarantees zero double bookings even under heavy concurrent traffic. If a collision occurs, the database aborts the secondary transaction, and the backend returns a `400 Conflict` response advising the user to choose an alternative slot.

```
Patient 1 ---> [ Hold Slot ] ---> DB (Lock Acquired) ---> [ Confirm Booking ] ---> Status: BOOKED
Patient 2 ---> [ Hold Slot ] ---> DB (Lock Active) ------> REJECTED (400 Conflict)
```

---

## 2. Doctor Leave Conflict Handling
When an Admin or Doctor designates a leave date (`YYYY-MM-DD`), the `leaveManagementService` executes an automated conflict resolution pipeline:

1. **Leave Registration:** A `DoctorLeave` record is created for the doctor and date.
2. **Conflict Query:** The system queries all active `Appointment` records where `doctorId = ID`, `appointmentDate = Date`, and `status = BOOKED`.
3. **Atomic Status Mutation:** Affected appointments are atomically updated to `CANCELLED_LEAVE`.
4. **Patient Notification & Calendar Cleanup:** For every cancelled appointment:
   - If a Google Calendar event ID exists, the system calls the Google Calendar API to delete the synced event.
   - An automated cancellation email is dispatched to the patient explaining the doctor leave and providing a direct link to reschedule.
   - A `NotificationLog` entry records the dispatch outcome.

---

## 3. Slot Hold Mechanism (Temporary Lock)
To prevent race conditions while a patient completes the pre-visit symptom form, the system implements a 5-minute transient slot reservation:

- **Lock Duration:** 5 minutes (`300 seconds`).
- **Expiration Management:** Each `SlotHold` record contains an `expiresAt` timestamp (`now() + 5 minutes`).
- **Client Countdown Synchronization:** The React UI renders a live countdown timer. If the timer expires before checkout completion, the frontend releases the slot and prompts the patient to select again.
- **Automatic Cleanup:** On slot query or hold creation, expired holds (`expiresAt < now()`) are purged, returning abandoned slots back to the public pool.

---

## 4. Notification & Retry Infrastructure
Notification reliability (Email and Google Calendar sync) is engineered to withstand third-party API downtime, rate limits, or network failures.

```
Event (Booking / Cancellation / Reminder)
   │
   ├──> Attempt Dispatch (Nodemailer / Google Calendar API)
   │       ├──> SUCCESS  ==> Log status "SENT" in NotificationLog
   │       └──> FAILURE  ==> Log status "PENDING_RETRY" in NotificationLog
   │
   └──> Background Cron Worker (Every 5 mins)
           └──> Query status "PENDING_RETRY" & retryCount < 3
                   ├──> Exponential Backoff Retry
                   └──> Mark "FAILED" if retryCount >= 3
```

- **Asynchronous Decoupling:** Email and calendar dispatches do not block HTTP request resolution. Failures log a `PENDING_RETRY` state into `NotificationLog`.
- **Background Cron Worker:** A cron task running every 5 minutes scans pending retries and executes up to 3 retry attempts with exponential backoff.
- **Graceful Fallbacks:** If the Google Gemini LLM or Email SMTP service encounters downtime, built-in heuristic fallback engines generate clinical summaries and mock dispatches, ensuring 100% core system uptime.
