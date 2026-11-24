import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listAuditLogs } from '../auditLogs/auditLog.service.js';
import {
  associateDoctorToClinicByAdmin,
  getClinicDetailsForAdmin,
  listClinicsForAdmin,
  verifyAssociationByAdmin,
  verifyClinicByAdmin,
} from '../clinics/clinic.service.js';
import {
  approveDoctorApplication,
  getAdminDashboardStats,
  getApplicationDetailsForAdmin,
  listApplicationsForAdmin,
  listDoctorsForAdmin,
  rejectDoctorApplication,
  requestMoreInformation,
  startApplicationReview,
  updateClinicVerification,
  updateDoctorStatusByAdmin,
  updateGstVerification,
  updateProfessionalVerification,
} from './admin.service.js';

export const getDashboard = asyncHandler(async (_req, res) => {
  const stats = await getAdminDashboardStats();
  res.json(new ApiResponse({ stats }, 'Admin dashboard stats retrieved'));
});

export const listApplications = asyncHandler(async (req, res) => {
  const result = await listApplicationsForAdmin(req.query);
  res.json(new ApiResponse(result, 'Doctor applications retrieved'));
});

export const getApplicationDetails = asyncHandler(async (req, res) => {
  const result = await getApplicationDetailsForAdmin(req.params.id);
  res.json(new ApiResponse(result, 'Doctor application details retrieved'));
});

export const patchStartReview = asyncHandler(async (req, res) => {
  const application = await startApplicationReview(req.currentUser, req.params.id);
  res.json(new ApiResponse({ application }, 'Doctor application marked under review'));
});

export const patchProfessionalVerification = asyncHandler(async (req, res) => {
  const verification = await updateProfessionalVerification(req.currentUser, req.params.id, req.body);
  res.json(new ApiResponse({ verification }, 'Professional verification updated'));
});

export const patchClinicVerification = asyncHandler(async (req, res) => {
  const verification = await updateClinicVerification(req.currentUser, req.params.id, req.body);
  res.json(new ApiResponse({ verification }, 'Clinic verification updated'));
});

export const patchGstVerification = asyncHandler(async (req, res) => {
  const verification = await updateGstVerification(req.currentUser, req.params.id, req.body);
  res.json(new ApiResponse({ verification }, 'GST verification updated'));
});

export const postRequestInformation = asyncHandler(async (req, res) => {
  const application = await requestMoreInformation(req.currentUser, req.params.id, req.body);
  res.json(new ApiResponse({ application }, 'Additional information requested'));
});

export const postApproveApplication = asyncHandler(async (req, res) => {
  const result = await approveDoctorApplication(req.currentUser, req.params.id, req.body);
  res.json(new ApiResponse(result, 'Doctor approved successfully'));
});

export const postRejectApplication = asyncHandler(async (req, res) => {
  const application = await rejectDoctorApplication(req.currentUser, req.params.id, req.body);
  res.json(new ApiResponse({ application }, 'Doctor application rejected'));
});

export const listDoctors = asyncHandler(async (req, res) => {
  const result = await listDoctorsForAdmin(req.query);
  res.json(new ApiResponse(result, 'Doctors retrieved'));
});

export const patchDoctorStatus = asyncHandler(async (req, res) => {
  const doctor = await updateDoctorStatusByAdmin(req.currentUser, req.params.id, req.body);
  res.json(new ApiResponse({ doctor }, 'Doctor profile status updated'));
});

export const listClinics = asyncHandler(async (req, res) => {
  const result = await listClinicsForAdmin(req.query);
  res.json(new ApiResponse(result, 'Clinics retrieved'));
});

export const getClinicDetails = asyncHandler(async (req, res) => {
  const result = await getClinicDetailsForAdmin(req.params.id);
  res.json(new ApiResponse(result, 'Clinic details retrieved'));
});

export const patchVerifyClinic = asyncHandler(async (req, res) => {
  const clinic = await verifyClinicByAdmin(req.currentUser, req.params.id, req.body);
  res.json(new ApiResponse({ clinic }, 'Clinic verification updated'));
});

export const postAssociateDoctorToClinic = asyncHandler(async (req, res) => {
  const association = await associateDoctorToClinicByAdmin(req.currentUser, req.params.id, req.body);
  res.status(201).json(new ApiResponse({ association }, 'Doctor associated with clinic'));
});

export const patchVerifyAssociation = asyncHandler(async (req, res) => {
  const association = await verifyAssociationByAdmin(req.currentUser, req.params.associationId, req.body);
  res.json(new ApiResponse({ association }, 'Doctor-clinic association verification updated'));
});

export const getAuditLogs = asyncHandler(async (req, res) => {
  const result = await listAuditLogs(req.query);
  res.json(new ApiResponse(result, 'Audit logs retrieved'));
});
