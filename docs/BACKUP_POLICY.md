# MediBook MongoDB Backup Policy

## 1. Scope & Capabilities
- **Database:** MongoDB Atlas (collections + GridFS `fs.files`/`fs.chunks` for encrypted medical documents).
- **Plan Note:** Continuous Point-in-Time Recovery (PITR) and automated cloud snapshot retention depend on the provisioned MongoDB Atlas tier (M10+ for continuous cloud backups; M0/M2/M5 have limited or manual `mongodump` options).

## 2. Proposed Backup Schedule & Retention (Targets Requiring Approval)
- **Daily Automated Snapshots:** Retained for 7–30 days depending on Atlas tier.
- **Weekly Snapshots:** Retained for 4 weeks.
- **Encryption:** TLS 1.2+ in transit; Atlas encryption at rest + application-level AES-256-GCM on medical documents, OAuth tokens, and ABHA identifiers.
- **Access Control:** Backup snapshots and `mongodump` archives restricted to designated SRE/DBAs with MFA.

## 3. Verification
- Never restore production patient data into shared/unsecured staging environments; use synthetic or de-identified data for restore drills.
