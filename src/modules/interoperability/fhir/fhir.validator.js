import { ABDM_PROFILE_URLS } from './fhir.constants.js';

const ALLOWED_PROFILE_SET = new Set(Object.values(ABDM_PROFILE_URLS));

const collectReferences = (obj, found = []) => {
  if (!obj || typeof obj !== 'object') return found;
  if (Array.isArray(obj)) {
    for (const item of obj) collectReferences(item, found);
    return found;
  }
  if (typeof obj.reference === 'string' && obj.reference.trim()) {
    found.push(obj.reference.trim());
  }
  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object') collectReferences(val, found);
  }
  return found;
};

const validateCodings = (obj, errors, path = 'resource') => {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => validateCodings(item, errors, `${path}[${i}]`));
    return;
  }
  if (Array.isArray(obj.coding)) {
    obj.coding.forEach((c, idx) => {
      if (!c || typeof c !== 'object' || !c.system || !c.code) {
        errors.push(`${path}.coding[${idx}] must include both system and code`);
      }
    });
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k !== 'coding' && v && typeof v === 'object') {
      validateCodings(v, errors, `${path}.${k}`);
    }
  }
};

export const validateFhirResource = (resource) => {
  const errors = [];
  if (!resource || typeof resource !== 'object' || !resource.resourceType) {
    return { valid: false, errors: ['Missing resourceType'] };
  }

  const profiles = resource.meta?.profile;
  if (!Array.isArray(profiles) || profiles.length === 0) {
    errors.push(`${resource.resourceType}: meta.profile is required`);
  } else if (!profiles.some((p) => ALLOWED_PROFILE_SET.has(p))) {
    errors.push(`${resource.resourceType}: unsupported ABDM profile ${profiles.join(', ')}`);
  }

  switch (resource.resourceType) {
    case 'Patient':
      if (!Array.isArray(resource.name) || !resource.name[0]?.text) errors.push('Patient.name[0].text is required');
      break;
    case 'Practitioner':
      if (!Array.isArray(resource.name) || !resource.name[0]?.text) errors.push('Practitioner.name[0].text is required');
      break;
    case 'Organization':
      if (!resource.name) errors.push('Organization.name is required');
      break;
    case 'Encounter':
      if (!resource.status) errors.push('Encounter.status is required');
      if (!resource.class?.code) errors.push('Encounter.class.code is required');
      if (!resource.subject?.reference) errors.push('Encounter.subject.reference is required');
      break;
    case 'Composition':
      if (!resource.status) errors.push('Composition.status is required');
      if (!resource.type) errors.push('Composition.type is required');
      if (!resource.subject?.reference) errors.push('Composition.subject.reference is required');
      if (!resource.date) errors.push('Composition.date is required');
      if (!Array.isArray(resource.author) || resource.author.length === 0) errors.push('Composition.author is required');
      if (!resource.title) errors.push('Composition.title is required');
      break;
    case 'MedicationRequest':
      if (!resource.status) errors.push('MedicationRequest.status is required');
      if (!resource.intent) errors.push('MedicationRequest.intent is required');
      if (!resource.subject?.reference) errors.push('MedicationRequest.subject.reference is required');
      if (!resource.medicationCodeableConcept?.text && !resource.medicationCodeableConcept?.coding?.length) {
        errors.push('MedicationRequest.medicationCodeableConcept is required');
      }
      break;
    case 'DiagnosticReport':
      if (!resource.status) errors.push('DiagnosticReport.status is required');
      if (!resource.code?.text && !resource.code?.coding?.length) errors.push('DiagnosticReport.code is required');
      if (!resource.subject?.reference) errors.push('DiagnosticReport.subject.reference is required');
      break;
    case 'DocumentReference':
      if (!resource.status) errors.push('DocumentReference.status is required');
      if (!resource.subject?.reference) errors.push('DocumentReference.subject.reference is required');
      if (!Array.isArray(resource.content) || !resource.content[0]?.attachment?.contentType) {
        errors.push('DocumentReference.content[0].attachment.contentType is required');
      }
      break;
    case 'Bundle':
      return validateFhirBundle(resource);
    default:
      errors.push(`Unsupported resourceType: ${resource.resourceType}`);
  }

  validateCodings(resource, errors, resource.resourceType);
  return { valid: errors.length === 0, errors };
};

export const validateFhirBundle = (bundle) => {
  const errors = [];
  if (!bundle || bundle.resourceType !== 'Bundle') {
    return { valid: false, errors: ['Resource must be a FHIR Bundle'] };
  }
  if (!bundle.type) errors.push('Bundle.type is required');
  if (!bundle.timestamp) errors.push('Bundle.timestamp is required');
  if (!Array.isArray(bundle.entry) || bundle.entry.length === 0) {
    errors.push('Bundle.entry must contain at least one resource');
    return { valid: false, errors };
  }

  const fullUrls = new Set();
  for (let i = 0; i < bundle.entry.length; i += 1) {
    const entry = bundle.entry[i];
    if (!entry.fullUrl) errors.push(`Bundle.entry[${i}].fullUrl is required`);
    else fullUrls.add(entry.fullUrl);
    if (!entry.resource) {
      errors.push(`Bundle.entry[${i}].resource is required`);
      continue;
    }
    const resCheck = validateFhirResource(entry.resource);
    if (!resCheck.valid) errors.push(...resCheck.errors);
  }

  if (bundle.type === 'document' && bundle.entry[0]?.resource?.resourceType !== 'Composition') {
    errors.push('Document Bundle.entry[0] must be a Composition resource');
  }

  for (const entry of bundle.entry) {
    if (!entry.resource) continue;
    const refs = collectReferences(entry.resource);
    for (const ref of refs) {
      if (ref.startsWith('urn:uuid:') && !fullUrls.has(ref)) {
        errors.push(`Unresolved bundle reference: ${ref}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
};
