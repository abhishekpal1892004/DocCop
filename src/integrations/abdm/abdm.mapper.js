export const abdmMapper = {
  toConsentInitPayload({ consentRequestId, abhaAddress, hiuId, purpose, hiTypes, dateRange, expiryAt, requesterName }) {
    return {
      consent: {
        purpose: {
          text: purpose,
          code: 'CAREMGT',
        },
        patient: { id: abhaAddress },
        hiu: { id: hiuId },
        requester: {
          name: requesterName,
        },
        hiTypes,
        permission: {
          accessMode: 'VIEW',
          dateRange: {
            from: new Date(dateRange.from).toISOString(),
            to: new Date(dateRange.to).toISOString(),
          },
          dataEraseAt: new Date(expiryAt).toISOString(),
          frequency: { unit: 'HOUR', value: 1, repeats: 0 },
        },
      },
      requestId: consentRequestId,
    };
  },

  toHipCareContextLinkPayload({ transactionId, abhaAddress, patientReference, careContexts }) {
    return {
      transactionId,
      patient: {
        id: abhaAddress,
        referenceNumber: patientReference,
        careContexts,
      },
    };
  },
};
