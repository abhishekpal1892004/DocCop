# MediBook Phase 13 – Testing Environment Setup

- **Runtime:** Node.js `v26.3.0`, native `node --test` runner, `supertest` `v7.3.2`
- **Isolation (`tests/setup.js`):**
  - `NODE_ENV=test`
  - Ephemeral RSA-2048 keypair generated in-memory for networkless Clerk JWT signing (`signSessionToken`) and Svix webhook HMAC signing (`signWebhook`).
  - In-memory fake repositories (`tests/helpers/fake*Repositories.js`) isolate tests from MongoDB Atlas and guarantee zero production data access.
  - Mocked external provider clients (`clerkGateway`, `nmcClient`, `calendlyClient`, `twilioClient`, `razorpayClient`, `agoraTokenBuilder`, `abdmClient`) ensure zero real SMS, WhatsApp messages, payments, bookings, or ABDM exchanges are triggered.
