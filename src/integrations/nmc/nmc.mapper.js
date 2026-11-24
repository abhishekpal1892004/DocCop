/**
 * Maps one NMC register record to a minimal, sanitized shape.
 *
 * Field names below were taken from real responses (observed keys:
 * id, name, father_name, dob, registration_no, registration_date, uprn_no,
 * state_medical_council, state_code, year_of_info, permanent_address, qualification,
 * qualification_year, university, additional_qualifications, removed_status).
 *
 * Deliberately NOT mapped (unneeded personal data): father_name, dob, permanent_address, uprn_no.
 * `registration_date` is observed as "DD-MM-YYYY". The meaning of `removed_status` values is not
 * documented, so it is passed through raw and any value other than null/"0" forces manual review.
 */
const str = (v, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

const yearFromRegistrationDate = (value) => {
  const m = typeof value === 'string' ? value.trim().match(/^\d{1,2}-\d{1,2}-(\d{4})$/) : null;
  return m ? Number(m[1]) : null;
};

const toYear = (v) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{4}$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 1800 && n <= 2200 ? n : null;
};

export const mapNmcRecord = (raw) => {
  if (!raw || typeof raw !== 'object') return null;

  const registrationYear = yearFromRegistrationDate(raw.registration_date) ?? toYear(raw.year_of_info);
  const removed = raw.removed_status;

  return {
    name: str(raw.name),
    registrationNumber: str(raw.registration_no, 50),
    registrationYear,
    stateCode: str(raw.state_code, 10)?.toUpperCase() ?? null,
    councilName: str(raw.state_medical_council),
    qualification: str(raw.qualification),
    qualificationYear: toYear(raw.qualification_year),
    university: str(raw.university),
    additionalQualifications: Array.isArray(raw.additional_qualifications)
      ? raw.additional_qualifications.filter((q) => typeof q === 'string').map((q) => q.trim().slice(0, 100)).slice(0, 10)
      : [],
    removedStatus: removed === null || removed === undefined ? null : String(removed),
  };
};

/** Validates the envelope seen in real responses: { success, data: [...], pagination: {...} } */
export const mapNmcResponse = (body) => {
  if (!body || typeof body !== 'object' || body.success !== true || !Array.isArray(body.data)) return null;
  const total = Number(body.pagination?.total);
  return {
    records: body.data.map(mapNmcRecord).filter(Boolean),
    total: Number.isFinite(total) ? total : body.data.length,
  };
};
