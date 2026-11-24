import { ApiError } from '../../../utils/ApiError.js';
import { notificationRepository } from '../notification.repository.js';

export const toPublicPreference = (pref, fallbackUser) => {
  if (!pref) {
    return {
      phoneNumber: fallbackUser?.phoneNumber ?? null,
      preferredChannel: 'SMS',
      sms: { enabled: false, optedIn: false, consentSource: null, consentAt: null, optedOutAt: null },
      whatsapp: { enabled: false, optedIn: false, consentSource: null, consentAt: null, optedOutAt: null },
      inApp: { enabled: true },
    };
  }
  return {
    id: String(pref._id),
    phoneNumber: pref.phoneNumber ?? fallbackUser?.phoneNumber ?? null,
    preferredChannel: pref.preferredChannel ?? 'SMS',
    sms: pref.sms ?? { enabled: false, optedIn: false },
    whatsapp: pref.whatsapp ?? { enabled: false, optedIn: false },
    inApp: pref.inApp ?? { enabled: true },
    updatedAt: pref.updatedAt,
  };
};

export const getMyNotificationPreferences = async (user) => {
  const pref = await notificationRepository.findPreferenceByUserId(user._id);
  return toPublicPreference(pref, user);
};

export const updateMyNotificationPreferences = async (user, input) => {
  const existing = await notificationRepository.findPreferenceByUserId(user._id);
  const phoneNumber = input.phoneNumber ?? existing?.phoneNumber ?? user.phoneNumber;

  const set = {};
  if (input.phoneNumber !== undefined) set.phoneNumber = input.phoneNumber;
  if (input.preferredChannel !== undefined) set.preferredChannel = input.preferredChannel;
  if (input.inApp !== undefined) set['inApp.enabled'] = input.inApp.enabled;

  const now = new Date();
  for (const ch of ['sms', 'whatsapp']) {
    if (!input[ch]) continue;
    const prev = existing?.[ch] ?? { enabled: false, optedIn: false };
    const nextOptedIn = input[ch].optedIn ?? prev.optedIn;
    const nextEnabled = input[ch].enabled ?? prev.enabled;

    if (nextEnabled && !nextOptedIn) {
      throw new ApiError(
        400,
        `Cannot enable ${ch.toUpperCase()} notifications without explicit opt-in consent`,
        'CONSENT_REQUIRED'
      );
    }
    if ((nextEnabled || nextOptedIn) && !phoneNumber) {
      throw new ApiError(
        400,
        `A verified E.164 phone number is required to opt in to ${ch.toUpperCase()}`,
        'PHONE_NUMBER_REQUIRED'
      );
    }

    set[`${ch}.enabled`] = nextOptedIn ? nextEnabled : false;
    set[`${ch}.optedIn`] = nextOptedIn;

    if (input[ch].optedIn === true && !prev.optedIn) {
      set[`${ch}.consentAt`] = now;
      set[`${ch}.consentSource`] = input[ch].consentSource ?? 'MEDIBOOK_SETTINGS';
      set[`${ch}.consentVersion`] = input[ch].consentVersion ?? 'v1';
      set[`${ch}.optedOutAt`] = null;
    } else if (input[ch].optedIn === false) {
      set[`${ch}.enabled`] = false;
      set[`${ch}.optedOutAt`] = now;
    }
  }

  const updated = await notificationRepository.upsertPreference(user._id, set);
  return toPublicPreference(updated, user);
};
