# MediBook Phase 14 – Frontend Performance Report

- **Production Build (`vite build`):** **PASS** (built in 15.59s, `sourcemap: false`).
- **Code Splitting:** All portal pages lazy-loaded via `React.lazy` + `Suspense`; manual vendor chunks (`vendor` 14.45 kB gzip, `clerk` 25.45 kB gzip, `ui` 4.35 kB gzip, main entry 76.04 kB gzip).
- **Privacy & Caching:** Zero PHI stored in `localStorage`; `public/sw.js` explicitly bypasses `/api/*` and third-party origins.
