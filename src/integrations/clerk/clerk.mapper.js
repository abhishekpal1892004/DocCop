const pickPrimary = (items, primaryId) => items?.find((i) => i.id === primaryId) ?? items?.[0];

/** Map a Clerk Backend API User (camelCase) to application identity fields. */
export const mapClerkUser = (u) => {
  const email = pickPrimary(u.emailAddresses, u.primaryEmailAddressId);
  const phone = pickPrimary(u.phoneNumbers, u.primaryPhoneNumberId);
  return {
    clerkUserId: u.id,
    firstName: u.firstName ?? undefined,
    lastName: u.lastName ?? undefined,
    email: email?.emailAddress,
    isEmailVerified: email?.verification?.status === 'verified',
    profileImage: u.imageUrl ?? undefined,
    phoneNumber: phone?.phoneNumber ?? undefined,
    clerkUpdatedAt: u.updatedAt ? new Date(u.updatedAt) : undefined,
  };
};

/** Map a webhook user payload (snake_case) to application identity fields. */
export const mapClerkWebhookUser = (d) => {
  const email = pickPrimary(d.email_addresses, d.primary_email_address_id);
  return {
    clerkUserId: d.id,
    email: email?.email_address,
    isEmailVerified: email?.verification?.status === 'verified',
    profileImage: d.image_url ?? undefined,
    clerkUpdatedAt: d.updated_at ? new Date(d.updated_at) : undefined,
  };
};
