/**
 * Configuration for the NMC Indian Medical Register integration.
 *
 * STATE_COUNCILS keys are the state codes the NMC endpoint uses in its `state`
 * parameter and returns in `state_code`. Only codes OBSERVED in real responses are
 * listed. Anything else is treated as "not configured" (manual review) rather than guessed.
 * To support another council, add its code here after confirming it against the endpoint.
 */
export const NMC_PROVIDER_NAME = 'NMC_INDIAN_MEDICAL_REGISTER';
export const NMC_SEARCH_URL = 'https://nmc.org.in/indian-medical-register/search';
export const NMC_SEARCH_TYPE = 'advance';
export const NMC_PAGE_SIZE = 25;

export const STATE_COUNCILS = Object.freeze({
  UP: 'Uttar Pradesh Medical Council',
  ASS: 'Assam Medical Council',
  WES: 'West Bengal Medical Council',
  ORI: 'Orissa Council of Medical Registration',
  AND: 'Andhra Pradesh Medical Council',
  KAR: 'Karnataka Medical Council',
  MAH: 'Maharashtra Medical Council',
  RAJ: 'Rajasthan Medical Council',
  PUN: 'Punjab Medical Council',
  MAD: 'Madhya Pradesh Medical Council',
  BIH: 'Bihar Medical Council',
  TAM: 'Tamil Nadu Medical Council',
  GUJ: 'Gujarat Medical Council',
  TC: 'Travancore Cochin Medical Council, Trivandrum',
});

export const LOOKUP_STATUS = Object.freeze({
  MATCH_FOUND: 'MATCH_FOUND',
  NO_MATCH: 'NO_MATCH',
  PARTIAL_MATCH: 'PARTIAL_MATCH',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  MANUAL_REVIEW_REQUIRED: 'MANUAL_REVIEW_REQUIRED',
});

export const FIELD_RESULT = Object.freeze({
  MATCH: 'MATCH',
  MISMATCH: 'MISMATCH',
  PARTIAL: 'PARTIAL',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
});

export const normalizeStateCode = (value) => String(value ?? '').trim().toUpperCase();
export const isSupportedState = (code) => Object.hasOwn(STATE_COUNCILS, normalizeStateCode(code));
export const getCouncilName = (code) => STATE_COUNCILS[normalizeStateCode(code)] ?? null;
