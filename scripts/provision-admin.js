/**
 * Trusted admin provisioning. Run from a server shell with production env loaded:
 *   npm run provision:admin -- <clerkUserId> --confirm
 * Verifies the Clerk account exists, then sets role ADMIN in MongoDB.
 * There is intentionally no HTTP endpoint for this.
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { provisionAdmin } from '../src/modules/users/user.service.js';

const [clerkUserId, flag] = process.argv.slice(2);

if (!clerkUserId || !/^user_[A-Za-z0-9]+$/.test(clerkUserId) || flag !== '--confirm') {
  console.error('Usage: npm run provision:admin -- <clerkUserId> --confirm');
  console.error('  clerkUserId looks like user_2abc... (Clerk Dashboard -> Users)');
  process.exit(1);
}

try {
  await connectDatabase();
  const admin = await provisionAdmin(clerkUserId);
  console.log(`ADMIN provisioned: ${admin.email} (${admin.clerkUserId})`);
  await disconnectDatabase();
} catch (err) {
  console.error(`Provisioning failed: ${err.message}`);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
}
