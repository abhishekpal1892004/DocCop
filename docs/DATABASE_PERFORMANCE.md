# MediBook Database Performance & Index Audit

## 1. Audited Compound Indexes Across Core Modules
- **Users & Patients:** `users.clerkUserId` (unique), `users.email` (unique), `patientprofiles.userId` (unique).
- **Doctor Directory (`src/modules/doctors/doctor.model.js`):**
  - `{ profileStatus: 1, isAcceptingPatients: 1, 'professionalDetails.specialization': 1 }`
  - `{ consultationFee: 1, 'professionalDetails.experience': -1 }`
  - `{ 'clinicDetails.address.city': 1, 'clinicDetails.address.state': 1 }`
  - `{ 'professionalDetails.medicalSystem': 1 }`
- **Clinics & Organizations:** `clinics.organizationId`, `organizations.ownerUserId`.
- **Appointments (`appointment.model.js`):** `patientId + scheduledStart`, `doctorId + scheduledStart`, `calendlyInviteeUri` (unique), `status`.
- **Notifications (`notificationJob.model.js`):** `status + nextAttemptAt + leaseExpiresAt` for atomic worker claiming.
- **Payments & Exchanges:** `payment.orderId` (unique), `abdmExchange.requestId` (unique), `abdmExchange.patientId + role + createdAt`.
- **Support & Waitlist:** `supportTicket.userId + createdAt`, `supportTicket.status + priority + createdAt`, `waitlist.doctorId + status`.

## 2. Query & Pagination Discipline
- List APIs (`/doctors`, `/appointments/my`, `/admin/support/tickets`, `/admin/audit-logs`, `/medical-records`) enforce bounded `page` & `limit` (max 100) via Zod schemas, `.lean()` reads, and projection/sanitization (`toPublic*`) so raw GridFS binary chunks or encrypted secrets are never loaded in list queries.
- Production MongoDB Atlas operators should run `.explain('executionStats')` on `doctors` directory searches and `notificationjobs` claim queries after seeding representative dataset volumes.
