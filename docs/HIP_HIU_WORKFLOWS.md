# HIP & HIU Workflows

- **HIP (Provider):** `POST /api/v1/abdm/hip/records/link`, `POST /api/v1/abdm/hip/records/notify`, `GET /api/v1/abdm/hip/records/status/:id`. Validates FHIR R4 bundle, prevents duplicate export linking (`409`), records `FhirExport` + `AbdmExchange`.
- **HIU (Consumer):** `POST /api/v1/abdm/hiu/discover`, `POST /api/v1/abdm/hiu/consent-request`, `POST /api/v1/abdm/hiu/data-request`, `GET /api/v1/abdm/hiu/exchange/:id`, `GET /api/v1/abdm/hiu/imports/my`. Imported external records are stored in `FhirImport` (`isExternal: true`) and never merged into MediBook clinical records.
