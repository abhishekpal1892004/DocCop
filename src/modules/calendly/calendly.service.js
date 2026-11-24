import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { calendlyClient, CalendlyProviderError } from '../../integrations/calendly/calendly.client.js';
import { mapAvailableSlot, mapCalendlyUser, mapEventType } from '../../integrations/calendly/calendly.mapper.js';
import { calendlyOAuth } from '../../integrations/calendly/calendly.oauth.js';
import { calendlyTokenService } from '../../integrations/calendly/calendly.token.service.js';
import { doctorRepository } from '../doctors/doctor.repository.js';
import {
  CALENDLY_CONNECTION_STATUS,
  MAX_AVAILABILITY_CHUNK_DAYS,
  OAUTH_STATE_TTL_MS,
} from './calendly.constants.js';
import { calendlyRepository } from './calendly.repository.js';

export const toPublicConnection = (conn) => {
  if (!conn) {
    return { connectionStatus: CALENDLY_CONNECTION_STATUS.DISCONNECTED, connected: false };
  }
  return {
    id: String(conn._id),
    calendlyUserUri: conn.calendlyUserUri,
    calendlyEmail: conn.calendlyEmail ?? null,
    calendlyTimezone: conn.calendlyTimezone ?? 'UTC',
    grantedScopes: conn.grantedScopes ?? [],
    connectionStatus: conn.connectionStatus,
    connected: conn.connectionStatus === CALENDLY_CONNECTION_STATUS.CONNECTED,
    connectedAt: conn.connectedAt ?? null,
    disconnectedAt: conn.disconnectedAt ?? null,
  };
};

export const toPublicAppointmentType = (at) => ({
  id: String(at._id),
  doctorId: String(at.doctorId),
  name: at.name,
  description: at.description ?? '',
  durationMinutes: at.durationMinutes,
  consultationFee: at.consultationFee,
  consultationMode: at.consultationMode,
  isActive: Boolean(at.isActive),
  createdAt: at.createdAt,
});

export const requireApprovedDoctorForUser = async (user) => {
  const doctor = await doctorRepository.findByUserId(user._id);
  if (!doctor || !doctor.isVerified) {
    throw new ApiError(403, 'Only approved doctors can access this feature', 'DOCTOR_NOT_APPROVED');
  }
  if (doctor.profileStatus === 'SUSPENDED') {
    throw new ApiError(403, 'Your doctor profile is currently suspended', 'DOCTOR_SUSPENDED');
  }
  if (doctor.profileStatus !== 'PUBLISHED') {
    throw new ApiError(403, 'Doctor profile must be published', 'DOCTOR_NOT_PUBLISHED');
  }
  return doctor;
};

export const beginCalendlyOAuth = async (user) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const state = calendlyOAuth.generateState();
  const { codeVerifier, codeChallenge } = calendlyOAuth.generatePkcePair();

  await calendlyRepository.createOAuthState({
    state,
    doctorId: doctor._id,
    doctorUserId: user._id,
    codeVerifier,
    expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS),
  });

  const authorizationUrl = calendlyOAuth.buildAuthorizationUrl({ state, codeChallenge });
  return { authorizationUrl };
};

export const handleCalendlyCallback = async ({ code, state }) => {
  const oauthState = await calendlyRepository.consumeOAuthState(state, new Date());
  if (!oauthState) {
    throw new ApiError(400, 'Invalid or expired Calendly OAuth state', 'INVALID_OAUTH_STATE');
  }

  const tokenData = await calendlyOAuth.exchangeCodeForTokens({
    code,
    codeVerifier: oauthState.codeVerifier,
  });

  const userPayload = await calendlyClient.getCurrentUser(tokenData.access_token);
  const calendlyUser = mapCalendlyUser(userPayload);
  if (!calendlyUser.uri) {
    throw new ApiError(502, 'Calendly user profile did not include a user URI', 'CALENDLY_PROVIDER_ERROR');
  }

  const expiresInSec = Number(tokenData.expires_in ?? 7200);
  const tokenExpiresAt = new Date(Date.now() + expiresInSec * 1000);
  const grantedScopes = typeof tokenData.scope === 'string' ? tokenData.scope.split(/\s+/).filter(Boolean) : [];

  let webhookSubscriptionUri;
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY || env.CALENDLY_WEBHOOK_SIGNING_KEY;
  const webhookUrl = process.env.CALENDLY_WEBHOOK_URL;
  if (webhookUrl && calendlyUser.currentOrganization) {
    try {
      const sub = await calendlyClient.createWebhookSubscription(tokenData.access_token, {
        url: webhookUrl,
        events: ['invitee.created', 'invitee.canceled'],
        organizationUri: calendlyUser.currentOrganization,
        userUri: calendlyUser.uri,
        signingKey,
      });
      webhookSubscriptionUri = sub?.resource?.uri;
    } catch (err) {
      console.error('[calendly] Webhook subscription creation failed:', err?.message);
    }
  }

  const connection = await calendlyRepository.upsertConnection(oauthState.doctorId, {
    doctorId: oauthState.doctorId,
    doctorUserId: oauthState.doctorUserId,
    calendlyUserUri: calendlyUser.uri,
    calendlyOrganizationUri: calendlyUser.currentOrganization,
    calendlyEmail: calendlyUser.email,
    calendlyTimezone: calendlyUser.timezone,
    accessTokenEncrypted: calendlyTokenService.encrypt(tokenData.access_token),
    refreshTokenEncrypted: tokenData.refresh_token ? calendlyTokenService.encrypt(tokenData.refresh_token) : null,
    tokenExpiresAt,
    grantedScopes,
    ...(webhookSubscriptionUri ? { webhookSubscriptionUri } : {}),
    connectionStatus: CALENDLY_CONNECTION_STATUS.CONNECTED,
    connectedAt: new Date(),
    disconnectedAt: null,
  });

  return toPublicConnection(connection);
};

export const getCalendlyStatus = async (user) => {
  const doctor = await doctorRepository.findByUserId(user._id);
  if (!doctor) {
    throw new ApiError(403, 'Only approved doctors can view Calendly status', 'DOCTOR_NOT_APPROVED');
  }
  const conn = await calendlyRepository.findConnectionByDoctorId(doctor._id);
  return toPublicConnection(conn);
};

export const getValidCalendlyAccess = async (doctorId) => {
  const conn = await calendlyRepository.findConnectionByDoctorId(doctorId);
  if (!conn || conn.connectionStatus === CALENDLY_CONNECTION_STATUS.DISCONNECTED) {
    throw new ApiError(409, 'Doctor has not connected a Calendly account', 'CALENDLY_NOT_CONNECTED');
  }
  if (conn.connectionStatus === CALENDLY_CONNECTION_STATUS.REAUTH_REQUIRED) {
    throw new ApiError(401, 'Doctor Calendly connection requires re-authentication', 'CALENDLY_REAUTH_REQUIRED');
  }

  const expiresAt = conn.tokenExpiresAt ? new Date(conn.tokenExpiresAt).getTime() : Infinity;
  if (Date.now() + 60_000 < expiresAt) {
    return {
      connection: conn,
      accessToken: calendlyTokenService.decrypt(conn.accessTokenEncrypted),
    };
  }

  if (!conn.refreshTokenEncrypted) {
    await calendlyRepository.updateConnectionByDoctorId(doctorId, {
      connectionStatus: CALENDLY_CONNECTION_STATUS.REAUTH_REQUIRED,
    });
    throw new ApiError(401, 'Calendly token expired; reconnection required', 'CALENDLY_REAUTH_REQUIRED');
  }

  try {
    const refreshToken = calendlyTokenService.decrypt(conn.refreshTokenEncrypted);
    const refreshed = await calendlyOAuth.refreshAccessToken(refreshToken);
    const nextExpiresAt = new Date(Date.now() + Number(refreshed.expires_in ?? 7200) * 1000);
    const updated = await calendlyRepository.updateConnectionByDoctorId(doctorId, {
      accessTokenEncrypted: calendlyTokenService.encrypt(refreshed.access_token),
      ...(refreshed.refresh_token ? { refreshTokenEncrypted: calendlyTokenService.encrypt(refreshed.refresh_token) } : {}),
      tokenExpiresAt: nextExpiresAt,
      connectionStatus: CALENDLY_CONNECTION_STATUS.CONNECTED,
    });
    return { connection: updated, accessToken: refreshed.access_token };
  } catch (err) {
    await calendlyRepository.updateConnectionByDoctorId(doctorId, {
      connectionStatus: CALENDLY_CONNECTION_STATUS.REAUTH_REQUIRED,
    });
    throw err;
  }
};

export const fetchDoctorCalendlyEventTypes = async (user) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const { connection, accessToken } = await getValidCalendlyAccess(doctor._id);

  try {
    const payload = await calendlyClient.listEventTypes(accessToken, connection.calendlyUserUri);
    const items = (payload?.collection ?? [])
      .map(mapEventType)
      .filter((et) => et.active && et.kind === 'solo');
    return items;
  } catch (err) {
    if (err instanceof CalendlyProviderError && err.statusCode === 401) {
      await calendlyRepository.updateConnectionByDoctorId(doctor._id, {
        connectionStatus: CALENDLY_CONNECTION_STATUS.REAUTH_REQUIRED,
      });
    }
    if (err instanceof CalendlyProviderError) {
      throw new ApiError(err.statusCode, err.message, err.code);
    }
    throw err;
  }
};

export const syncDoctorEventTypes = async (user) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const remoteTypes = await fetchDoctorCalendlyEventTypes(user);
  const existing = await calendlyRepository.findAppointmentTypesByDoctorId(doctor._id);
  const byUri = new Map(existing.map((e) => [e.calendlyEventTypeUri, e]));

  const synced = [];
  for (const rt of remoteTypes) {
    const match = byUri.get(rt.uri);
    if (match) {
      const updated = await calendlyRepository.updateAppointmentTypeById(match._id, doctor._id, {
        durationMinutes: rt.durationMinutes,
      });
      synced.push(toPublicAppointmentType(updated));
    }
  }
  return { availableRemoteTypes: remoteTypes, syncedAppointmentTypes: synced };
};

export const selectCalendlyEventType = async (user, input) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const remoteTypes = await fetchDoctorCalendlyEventTypes(user);
  const match = remoteTypes.find((et) => et.uri === input.calendlyEventTypeUri);
  if (!match) {
    throw new ApiError(
      400,
      'Selected Calendly event type was not found or is not an active one-on-one event type on your account',
      'INVALID_EVENT_TYPE'
    );
  }

  const saved = await calendlyRepository.upsertAppointmentType(doctor._id, match.uri, {
    doctorId: doctor._id,
    calendlyEventTypeUri: match.uri,
    name: input.name ?? match.name,
    description: input.description ?? match.description,
    durationMinutes: match.durationMinutes,
    consultationFee: input.consultationFee,
    consultationMode: input.consultationMode,
    isActive: true,
  });

  return toPublicAppointmentType(saved);
};

export const disconnectCalendly = async (user) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const conn = await calendlyRepository.findConnectionByDoctorId(doctor._id);
  if (!conn || conn.connectionStatus === CALENDLY_CONNECTION_STATUS.DISCONNECTED) {
    return toPublicConnection(conn);
  }

  if (conn.webhookSubscriptionUri) {
    try {
      const accessToken = calendlyTokenService.decrypt(conn.accessTokenEncrypted);
      await calendlyClient.deleteWebhookSubscription(accessToken, conn.webhookSubscriptionUri);
    } catch {
      // Best-effort remote webhook cleanup.
    }
  }

  const updated = await calendlyRepository.updateConnectionByDoctorId(doctor._id, {
    connectionStatus: CALENDLY_CONNECTION_STATUS.DISCONNECTED,
    disconnectedAt: new Date(),
  });
  return toPublicConnection(updated);
};

// Doctor Appointment Type CRUD
export const listMyAppointmentTypes = async (user) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const items = await calendlyRepository.findAppointmentTypesByDoctorId(doctor._id);
  return items.map(toPublicAppointmentType);
};

export const updateMyAppointmentType = async (user, id, input) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const updated = await calendlyRepository.updateAppointmentTypeById(id, doctor._id, input);
  if (!updated) throw new ApiError(404, 'Appointment type not found', 'APPOINTMENT_TYPE_NOT_FOUND');
  return toPublicAppointmentType(updated);
};

export const updateMyAppointmentTypeStatus = async (user, id, isActive) => {
  const doctor = await requireApprovedDoctorForUser(user);
  const updated = await calendlyRepository.updateAppointmentTypeById(id, doctor._id, { isActive });
  if (!updated) throw new ApiError(404, 'Appointment type not found', 'APPOINTMENT_TYPE_NOT_FOUND');
  return toPublicAppointmentType(updated);
};

const splitDateRangeIntoChunks = (startDate, endDate, maxDays = MAX_AVAILABILITY_CHUNK_DAYS) => {
  const chunks = [];
  const maxMs = maxDays * 24 * 60 * 60 * 1000;
  let cursor = startDate.getTime();
  const endMs = endDate.getTime();
  while (cursor < endMs) {
    const next = Math.min(cursor + maxMs, endMs);
    chunks.push({
      startTime: new Date(cursor).toISOString(),
      endTime: new Date(next).toISOString(),
    });
    cursor = next;
  }
  return chunks;
};

export const getDoctorAvailability = async (doctorId, { appointmentTypeId, startDate, endDate, timezone }) => {
  const doctor = await doctorRepository.findById(doctorId);
  if (!doctor || !doctor.isVerified || doctor.profileStatus !== 'PUBLISHED') {
    throw new ApiError(404, 'Published doctor not found', 'DOCTOR_NOT_FOUND');
  }

  const appointmentType = await calendlyRepository.findAppointmentTypeById(appointmentTypeId);
  if (!appointmentType || String(appointmentType.doctorId) !== String(doctor._id) || !appointmentType.isActive) {
    throw new ApiError(404, 'Active appointment type not found for this doctor', 'APPOINTMENT_TYPE_NOT_FOUND');
  }

  const { accessToken } = await getValidCalendlyAccess(doctor._id);
  const now = new Date();
  const effectiveStart = startDate > now ? startDate : now;
  if (endDate <= effectiveStart) {
    return { timezone, availableSlots: [] };
  }

  const chunks = splitDateRangeIntoChunks(effectiveStart, endDate);
  const allSlots = [];

  try {
    for (const chunk of chunks) {
      const payload = await calendlyClient.listEventTypeAvailableTimes(accessToken, {
        eventTypeUri: appointmentType.calendlyEventTypeUri,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
      });
      for (const slot of payload?.collection ?? []) {
        allSlots.push(mapAvailableSlot(slot, timezone));
      }
    }
  } catch (err) {
    if (err instanceof CalendlyProviderError && err.statusCode === 401) {
      await calendlyRepository.updateConnectionByDoctorId(doctor._id, {
        connectionStatus: CALENDLY_CONNECTION_STATUS.REAUTH_REQUIRED,
      });
    }
    if (err instanceof CalendlyProviderError) {
      throw new ApiError(err.statusCode, err.message, err.code);
    }
    throw err;
  }

  return { timezone, availableSlots: allSlots };
};
