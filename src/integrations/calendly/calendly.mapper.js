export const formatDisplayTime = (isoUtc, timezone = 'UTC') => {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(isoUtc));
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(isoUtc));
  }
};

export const mapCalendlyUser = (payload) => {
  const res = payload?.resource ?? payload ?? {};
  return {
    uri: res.uri ?? null,
    name: res.name ?? null,
    email: res.email ?? null,
    timezone: res.timezone ?? 'UTC',
    currentOrganization: res.current_organization ?? null,
  };
};

export const mapEventType = (et) => ({
  uri: et.uri,
  name: et.name,
  description: et.description_plain ?? et.description_html ?? '',
  durationMinutes: et.duration ?? 30,
  kind: et.kind ?? 'solo',
  active: Boolean(et.active),
  schedulingUrl: et.scheduling_url ?? null,
});

export const mapAvailableSlot = (slot, timezone = 'UTC') => ({
  startTime: slot.start_time,
  displayTime: formatDisplayTime(slot.start_time, timezone),
  status: slot.status === 'available' ? 'AVAILABLE' : String(slot.status ?? 'AVAILABLE').toUpperCase(),
});
