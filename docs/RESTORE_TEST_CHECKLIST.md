# MediBook Restore Test Checklist (Staging Only)

- [ ] Provision isolated staging MongoDB cluster (never run destructive restore tests against production).
- [ ] Restore snapshot/archive to staging cluster.
- [ ] Run consistency checks on `users`, `doctors`, `clinics`, `appointments`, `payments`, `prescriptions`, `medicalrecords`, and GridFS `fs.files`/`fs.chunks`.
- [ ] Verify `GET /api/v1/health/ready` returns `200` against restored staging DB.
- [ ] Verify encrypted medical document decryption and prescription PDF generation on synthetic test records.
- [ ] Record actual restore duration vs RTO target and sign off.
