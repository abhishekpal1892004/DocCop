import '../tests/setup.js';
import http from 'node:http';
import { createFakeUserRepository } from '../tests/helpers/fakeUserRepository.js';
import { signSessionToken } from '../tests/setup.js';

const { default: app } = await import('../src/app.js');
const { userRepository } = await import('../src/modules/users/user.repository.js');

const fakeUsers = createFakeUserRepository();
Object.assign(userRepository, fakeUsers.repo);

const admin = await fakeUsers.repo.create({
  clerkUserId: 'load_admin_1',
  email: 'loadadmin@test.local',
  role: 'ADMIN',
  accountStatus: 'ACTIVE',
  onboardingStatus: 'COMPLETED',
});
const adminToken = signSessionToken(admin.clerkUserId);

const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

const runEndpointLoad = async (name, path, headers = {}, totalRequests = 150, concurrency = 15) => {
  const latencies = [];
  let errors = 0;
  let completed = 0;
  const startAll = process.hrtime.bigint();

  const worker = async () => {
    while (completed < totalRequests) {
      const idx = completed++;
      if (idx >= totalRequests) break;
      const t0 = process.hrtime.bigint();
      try {
        const res = await fetch(`${baseUrl}${path}`, { headers });
        if (res.status >= 500) errors += 1;
        await res.arrayBuffer();
      } catch {
        errors += 1;
      }
      latencies.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const totalMs = Number(process.hrtime.bigint() - startAll) / 1e6;
  latencies.sort((a, b) => a - b);
  const pct = (p) => Number((latencies[Math.min(latencies.length - 1, Math.ceil((p / 100) * latencies.length) - 1)] || 0).toFixed(2));
  const avg = Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2));
  const rps = Number(((totalRequests / totalMs) * 1000).toFixed(1));

  return { name, totalRequests, concurrency, avgMs: avg, p50Ms: pct(50), p95Ms: pct(95), p99Ms: pct(99), rps, errors };
};

const results = [
  await runEndpointLoad('Health Liveness', '/api/v1/health/live'),
  await runEndpointLoad('User Profile (/users/me)', '/api/v1/users/me', { Authorization: `Bearer ${adminToken}` }),
  await runEndpointLoad('Admin System Health', '/api/v1/admin/system-health', { Authorization: `Bearer ${adminToken}` }),
];

console.log(JSON.stringify(results, null, 2));
await new Promise((resolve) => server.close(resolve));
process.exit(0);
