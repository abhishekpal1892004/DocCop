import { getAbdmRuntimeConfig } from '../../../integrations/abdm/abdm.config.js';
import { ApiResponse } from '../../../utils/ApiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { abdmRepository } from '../abdm.repository.js';
import { getHfrStatus, linkHfrFacility, searchHfrFacility } from '../services/hfr.service.js';
import { getHipExchangeStatus, linkHealthRecordAsHip, notifyHipContext } from '../services/hip.service.js';
import { discoverExternalRecords, getHiuExchangeStatus, listMyImportedFhirRecords, requestExternalHealthData } from '../services/hiu.service.js';
import { getHprStatus, linkHprProfile, searchHprProfile } from '../services/hpr.service.js';
import { ApiError } from '../../../utils/ApiError.js';

export const postHprSearch = asyncHandler(async (req, res) => {
  const result = await searchHprProfile(req.currentUser, req.body);
  return ApiResponse.send(res, { statusCode: 200, data: result, message: 'HPR lookup completed' });
});

export const postHprLink = asyncHandler(async (req, res) => {
  const hprLink = await linkHprProfile(req.currentUser, req.body, req.id ?? null);
  return ApiResponse.send(res, { statusCode: 200, data: { hprLink }, message: 'HPR profile linked for review' });
});

export const getMyHprStatus = asyncHandler(async (req, res) => {
  const hprLink = await getHprStatus(req.currentUser);
  return ApiResponse.send(res, { statusCode: 200, data: { hprLink }, message: 'HPR status retrieved' });
});

export const postHfrSearch = asyncHandler(async (req, res) => {
  const result = await searchHfrFacility(req.currentUser, req.body);
  return ApiResponse.send(res, { statusCode: 200, data: result, message: 'HFR lookup completed' });
});

export const postHfrLink = asyncHandler(async (req, res) => {
  const hfrLink = await linkHfrFacility(req.currentUser, req.body, req.id ?? null);
  return ApiResponse.send(res, { statusCode: 200, data: { hfrLink }, message: 'HFR facility associated' });
});

export const getClinicHfrStatus = asyncHandler(async (req, res) => {
  const hfrLink = await getHfrStatus(req.currentUser, req.query.clinicId);
  return ApiResponse.send(res, { statusCode: 200, data: { hfrLink }, message: 'HFR status retrieved' });
});

export const postHipLinkRecord = asyncHandler(async (req, res) => {
  const exchange = await linkHealthRecordAsHip(req.currentUser, req.body, req.id ?? null);
  return ApiResponse.send(res, { statusCode: 201, data: { exchange }, message: 'HIP care-context link initiated' });
});

export const postHipNotifyRecord = asyncHandler(async (req, res) => {
  const exchange = await notifyHipContext(req.currentUser, req.body, req.id ?? null);
  return ApiResponse.send(res, { statusCode: 200, data: { exchange }, message: 'HIP context notification sent' });
});

export const getHipRecordStatus = asyncHandler(async (req, res) => {
  const exchange = await getHipExchangeStatus(req.currentUser, req.params.id);
  return ApiResponse.send(res, { statusCode: 200, data: { exchange }, message: 'HIP exchange status retrieved' });
});

export const postHiuDiscover = asyncHandler(async (req, res) => {
  const result = await discoverExternalRecords(req.currentUser, req.body);
  return ApiResponse.send(res, { statusCode: 200, data: result, message: 'Care contexts discovered' });
});

export const postHiuDataRequest = asyncHandler(async (req, res) => {
  const exchange = await requestExternalHealthData(req.currentUser, req.body, req.id ?? null);
  return ApiResponse.send(res, { statusCode: 201, data: { exchange }, message: 'HIU data request initiated' });
});

export const getHiuExchange = asyncHandler(async (req, res) => {
  const exchange = await getHiuExchangeStatus(req.currentUser, req.params.id);
  return ApiResponse.send(res, { statusCode: 200, data: { exchange }, message: 'HIU exchange retrieved' });
});

export const getMyHiuImports = asyncHandler(async (req, res) => {
  const imports = await listMyImportedFhirRecords(req.currentUser);
  return ApiResponse.send(res, { statusCode: 200, data: { imports }, message: 'Imported external records retrieved' });
});

export const patchAdminRegistryReview = asyncHandler(async (req, res) => {
  const existing = await abdmRepository.findRegistryLinkById(req.params.id);
  if (!existing) throw new ApiError(404, 'Registry association not found', 'REGISTRY_LINK_NOT_FOUND');
  const updated = await abdmRepository.updateRegistryLinkById(existing._id, {
    adminReviewStatus: req.body.adminReviewStatus,
    reviewedBy: req.currentUser._id,
    reviewedAt: new Date(),
  });
  return ApiResponse.send(res, {
    statusCode: 200,
    data: {
      registryLink: {
        id: String(updated._id),
        registryType: updated.registryType,
        registryId: updated.registryId,
        adminReviewStatus: updated.adminReviewStatus,
        reviewedAt: updated.reviewedAt,
      },
    },
    message: 'Registry association reviewed',
  });
});

export const getAdminAbdmDashboard = asyncHandler(async (_req, res) => {
  const cfg = getAbdmRuntimeConfig();
  const [abhaLinkedPatients, hprLinkedDoctors, hfrLinkedClinics, exchangeStats, pendingCallbacks, recentExchanges] =
    await Promise.all([
      abdmRepository.countVerifiedAbha(),
      abdmRepository.countRegistryLinks('HPR'),
      abdmRepository.countRegistryLinks('HFR'),
      abdmRepository.getExchangeStats(),
      abdmRepository.countPendingWebhooks(),
      abdmRepository.listRecentExchanges(10),
    ]);

  return ApiResponse.send(res, {
    statusCode: 200,
    data: {
      integration: {
        enabled: cfg.enabled,
        environment: cfg.environment,
        isExternalConnectivityReady: cfg.isExternalConnectivityReady,
        integrationRoles: cfg.integrationRoles,
        facilityId: cfg.facilityId || null,
      },
      metrics: {
        abhaLinkedPatients,
        hprLinkedDoctors,
        hfrLinkedClinics,
        hipTransactions: exchangeStats.hipTotal,
        hiuTransactions: exchangeStats.hiuTotal,
        successfulExchanges: exchangeStats.completed,
        failedExchanges: exchangeStats.failed,
        pendingCallbacks,
      },
      recentExchanges: recentExchanges.map((ex) => ({
        id: String(ex._id),
        role: ex.role,
        direction: ex.direction,
        recordType: ex.recordType,
        status: ex.status,
        createdAt: ex.createdAt,
      })),
    },
    message: 'ABDM integration dashboard retrieved',
  });
});
