# MediBook Backup and Recovery Procedure

## 1. MongoDB Atlas Automated Backups
- Enable **Cloud Backups** on the production MongoDB Atlas cluster (snapshots cover both collections and GridFS `medicalDocuments.files` / `medicalDocuments.chunks`).
- Enable **Continuous Cloud Backup / Point-in-Time Recovery (PITR)** on M10+ clusters.
- Configure retention (e.g., hourly/daily/weekly/monthly snapshots) in accordance with legal/medical record retention policies.

## 2. Restore Verification Drill
1. Create an isolated staging cluster in MongoDB Atlas.
2. Restore the latest snapshot (or PITR timestamp) to the staging cluster.
3. Verify collection counts (`users`, `doctors`, `appointments`, `prescriptions`, `medicalrecords`) and test downloading & decrypting a sample GridFS medical record using the corresponding `MEDICAL_DOC_ENCRYPTION_KEY_V*`.
4. Document restore duration (RTO) and data loss window (RPO).
