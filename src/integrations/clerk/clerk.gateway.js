import { createClerkClient } from '@clerk/express';
import { env } from '../../config/env.js';

let client;
const getClient = () => {
  client ??= createClerkClient({ secretKey: env.CLERK_SECRET_KEY, publishableKey: env.CLERK_PUBLISHABLE_KEY });
  return client;
};

/**
 * Thin wrapper around the Clerk Backend API. Kept as an object so tests can mock it
 * without network access or real credentials.
 */
export const clerkGateway = {
  getUser: (clerkUserId) => getClient().users.getUser(clerkUserId),
};
