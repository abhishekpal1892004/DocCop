import { FIELD_RESULT, LOOKUP_STATUS, normalizeStateCode } from './nmc.constants.js';

const { MATCH, MISMATCH, PARTIAL, NOT_AVAILABLE } = FIELD_RESULT;

/** Uppercase, alphanumerics only, leading zeros dropped: "0249", "249 " and "249" are equal. */
export const normalizeRegistrationNumber = (value) =>
  String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+(?=.)/, '');

const TITLES = new Set(['DR', 'DOCTOR', 'PROF', 'PROFESSOR', 'MR', 'MRS', 'MS', 'SMT', 'SHRI', 'LATE']);

export const nameTokens = (value) =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !TITLES.has(t));

const tokenEquals = (a, b) => a === b || (a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b));

/**
 * MATCH: every token of the shorter name appears in the longer one (initials allowed).
 * PARTIAL: at least one full (non-initial) token overlaps. MISMATCH otherwise.
 * Name is informational: it can never produce a positive match on its own.
 */
export const compareNames = (submitted, registered) => {
  const a = nameTokens(submitted);
  const b = nameTokens(registered);
  if (!a.length || !b.length) return NOT_AVAILABLE;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  const remaining = [...long];
  let matched = 0;
  let fullTokenOverlap = 0;
  for (const token of short) {
    const idx = remaining.findIndex((t) => tokenEquals(token, t));
    if (idx >= 0) {
      matched += 1;
      if (token.length > 1 && remaining[idx].length > 1) fullTokenOverlap += 1;
      remaining.splice(idx, 1);
    }
  }
  if (matched === short.length) return MATCH;
  return fullTokenOverlap > 0 ? PARTIAL : MISMATCH;
};

const equalOrUnavailable = (submitted, actual, eq) => {
  if (actual === null || actual === undefined || actual === '') return NOT_AVAILABLE;
  return eq(submitted, actual) ? MATCH : MISMATCH;
};

export const compareRecord = (submitted, record) => ({
  registrationNumber: equalOrUnavailable(submitted.registrationNumber, record.registrationNumber, (s, r) => normalizeRegistrationNumber(s) === normalizeRegistrationNumber(r)),
  registrationYear: equalOrUnavailable(submitted.registrationYear, record.registrationYear, (s, r) => Number(s) === Number(r)),
  council: equalOrUnavailable(submitted.state, record.stateCode, (s, r) => normalizeStateCode(s) === normalizeStateCode(r)),
  name: compareNames(submitted.name, record.name),
});

const hasRemovalFlag = (record) => record.removedStatus !== null && record.removedStatus !== '0';

/**
 * Positive matching needs registration number AND council to match exactly, and the year to match
 * whenever the register provides it. Fields the register did not provide are reported as
 * NOT_AVAILABLE and never assumed to match.
 *
 * @returns {{ lookupStatus: string, summary: string, results: Array<{record: object, comparison: object, identityMatch: boolean}> }}
 */
export const evaluateLookup = (submitted, records) => {
  if (!records.length) {
    return {
      lookupStatus: LOOKUP_STATUS.NO_MATCH,
      summary: 'No register entry was returned for these details. This does not by itself mean the registration is invalid (spelling, a different council, or register coverage may explain it); manual review is required.',
      results: [],
    };
  }

  const results = records.map((record) => {
    const comparison = compareRecord(submitted, record);
    const identityMatch =
      comparison.registrationNumber === MATCH &&
      comparison.council === MATCH &&
      (comparison.registrationYear === MATCH || comparison.registrationYear === NOT_AVAILABLE);
    return { record, comparison, identityMatch };
  });

  const identical = results.filter((r) => r.identityMatch);
  const verifiable = identical.filter((r) => r.comparison.registrationYear === MATCH);

  if (identical.length) {
    const best = verifiable.find((r) => r.comparison.name === MATCH) ?? identical.find((r) => r.comparison.name === MATCH);
    if (best && !hasRemovalFlag(best.record) && best.comparison.registrationYear === MATCH) {
      return { lookupStatus: LOOKUP_STATUS.MATCH_FOUND, summary: 'A register entry matches the registration number, council, year and name. Admin review is still required.', results };
    }
    if (best && hasRemovalFlag(best.record)) {
      return { lookupStatus: LOOKUP_STATUS.MANUAL_REVIEW_REQUIRED, summary: 'A matching entry carries a removal/status flag that needs human interpretation.', results };
    }
    if (best) {
      return { lookupStatus: LOOKUP_STATUS.MANUAL_REVIEW_REQUIRED, summary: 'Number and council match, but the register did not provide the registration year, so it could not be fully compared.', results };
    }
    return { lookupStatus: LOOKUP_STATUS.PARTIAL_MATCH, summary: 'Registration number and council match, but the registered name differs from the submitted name.', results };
  }

  const someNumberMatch = results.some((r) => r.comparison.registrationNumber === MATCH);
  if (someNumberMatch) {
    return { lookupStatus: LOOKUP_STATUS.PARTIAL_MATCH, summary: 'An entry with the same registration number was found, but the year or council does not match.', results };
  }
  const unknown = results.some((r) => Object.values(r.comparison).includes(NOT_AVAILABLE) && r.comparison.registrationNumber === NOT_AVAILABLE);
  if (unknown) {
    return { lookupStatus: LOOKUP_STATUS.MANUAL_REVIEW_REQUIRED, summary: 'The register response did not include the fields needed for comparison.', results };
  }
  return { lookupStatus: LOOKUP_STATUS.NO_MATCH, summary: 'Entries were returned but none has the submitted registration number; manual review is required.', results };
};
