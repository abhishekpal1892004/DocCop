import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider, LoadingState } from './components/ui';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ROLES } from './lib/constants';
import { SignInPage, SignUpPage, OnboardingPage } from './pages/public/AuthPages';

const LandingPage = lazy(() => import('./pages/public/LandingPage'));
const DoctorsDirectoryPage = lazy(() => import('./pages/public/DoctorsDirectoryPage'));
const DoctorProfilePage = lazy(() => import('./pages/public/DoctorProfilePage'));

const PatientDashboardPage = lazy(() => import('./pages/patient/PatientDashboardPage'));
const PatientAppointmentsPage = lazy(() => import('./pages/patient/PatientAppointmentsPage'));
const PatientRecordsPage = lazy(() => import('./pages/patient/PatientRecordsPage'));
const PatientPrescriptionsPage = lazy(() => import('./pages/patient/PatientPrescriptionsPage'));
const PatientPaymentsPage = lazy(() => import('./pages/patient/PatientPaymentsPage'));
const PatientAbdmPage = lazy(() => import('./pages/patient/PatientAbdmPage'));
const PatientNotificationsPage = lazy(() => import('./pages/patient/PatientNotificationsPage'));
const PatientProfilePage = lazy(() => import('./pages/patient/PatientProfilePage'));

const DoctorDashboardPage = lazy(() => import('./pages/doctor/DoctorDashboardPage'));
const DoctorAppointmentsPage = lazy(() => import('./pages/doctor/DoctorAppointmentsPage'));
const DoctorQueuePage = lazy(() => import('./pages/doctor/DoctorQueuePage'));
const DoctorPrescriptionsPage = lazy(() => import('./pages/doctor/DoctorPrescriptionsPage'));
const DoctorOnboardingPage = lazy(() => import('./pages/doctor/DoctorOnboardingPage'));
const DoctorPracticePage = lazy(() => import('./pages/doctor/DoctorPracticePage'));
const DoctorSettingsProfilePage = lazy(() => import('./pages/doctor/DoctorProfilePage'));

const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminApplicationsPage = lazy(() => import('./pages/admin/AdminApplicationsPage'));
const AdminDoctorsPage = lazy(() => import('./pages/admin/AdminDoctorsPage'));
const AdminClinicsPage = lazy(() => import('./pages/admin/AdminClinicsPage'));
const AdminOperations = {
  Reviews: lazy(() => import('./pages/admin/AdminOperationsPage').then((m) => ({ default: m.AdminReviewsPage }))),
  Support: lazy(() => import('./pages/admin/AdminOperationsPage').then((m) => ({ default: m.AdminSupportPage }))),
  AuditLogs: lazy(() => import('./pages/admin/AdminOperationsPage').then((m) => ({ default: m.AdminAuditLogsPage }))),
  SystemHealth: lazy(() => import('./pages/admin/AdminOperationsPage').then((m) => ({ default: m.AdminSystemHealthPage }))),
  Abdm: lazy(() => import('./pages/admin/AdminOperationsPage').then((m) => ({ default: m.AdminAbdmPage }))),
};

const ClinicDashboardPage = lazy(() => import('./pages/clinic/ClinicDashboardPage'));
const ClinicStaffPage = lazy(() => import('./pages/clinic/ClinicStaffPage'));

const SupportPage = lazy(() => import('./pages/shared/SupportPage'));
const VideoConsultationPage = lazy(() => import('./pages/shared/VideoConsultationPage'));

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<div className="max-w-4xl mx-auto p-6"><LoadingState rows={3} /></div>}>
              <Routes>
                <Route element={<AppLayout />}>
                  {/* Public Routes */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/doctors" element={<DoctorsDirectoryPage />} />
                  <Route path="/doctors/:id" element={<DoctorProfilePage />} />
                  <Route path="/sign-in/*" element={<SignInPage />} />
                  <Route path="/sign-up/*" element={<SignUpPage />} />
                  <Route path="/onboarding" element={<OnboardingPage />} />

                  {/* Patient Portal */}
                  <Route path="/patient/dashboard" element={<ProtectedRoute allowedRoles={[ROLES.PATIENT]}><PatientDashboardPage /></ProtectedRoute>} />
                  <Route path="/patient/appointments" element={<ProtectedRoute allowedRoles={[ROLES.PATIENT]}><PatientAppointmentsPage /></ProtectedRoute>} />
                  <Route path="/patient/records" element={<ProtectedRoute allowedRoles={[ROLES.PATIENT]}><PatientRecordsPage /></ProtectedRoute>} />
                  <Route path="/patient/prescriptions" element={<ProtectedRoute allowedRoles={[ROLES.PATIENT]}><PatientPrescriptionsPage /></ProtectedRoute>} />
                  <Route path="/patient/payments" element={<ProtectedRoute allowedRoles={[ROLES.PATIENT]}><PatientPaymentsPage /></ProtectedRoute>} />
                  <Route path="/patient/abdm" element={<ProtectedRoute allowedRoles={[ROLES.PATIENT]}><PatientAbdmPage /></ProtectedRoute>} />
                  <Route path="/patient/notifications" element={<ProtectedRoute allowedRoles={[ROLES.PATIENT]}><PatientNotificationsPage /></ProtectedRoute>} />
                  <Route path="/patient/profile" element={<ProtectedRoute allowedRoles={[ROLES.PATIENT]}><PatientProfilePage /></ProtectedRoute>} />

                  {/* Doctor Portal */}
                  <Route path="/doctor/dashboard" element={<ProtectedRoute allowedRoles={[ROLES.DOCTOR]}><DoctorDashboardPage /></ProtectedRoute>} />
                  <Route path="/doctor/appointments" element={<ProtectedRoute allowedRoles={[ROLES.DOCTOR]}><DoctorAppointmentsPage /></ProtectedRoute>} />
                  <Route path="/doctor/queue" element={<ProtectedRoute allowedRoles={[ROLES.DOCTOR]}><DoctorQueuePage /></ProtectedRoute>} />
                  <Route path="/doctor/prescriptions" element={<ProtectedRoute allowedRoles={[ROLES.DOCTOR]}><DoctorPrescriptionsPage /></ProtectedRoute>} />
                  <Route path="/doctor/onboarding" element={<ProtectedRoute allowedRoles={[ROLES.DOCTOR]}><DoctorOnboardingPage /></ProtectedRoute>} />
                  <Route path="/doctor/practice" element={<ProtectedRoute allowedRoles={[ROLES.DOCTOR]}><DoctorPracticePage /></ProtectedRoute>} />
                  <Route path="/doctor/profile" element={<ProtectedRoute allowedRoles={[ROLES.DOCTOR]}><DoctorSettingsProfilePage /></ProtectedRoute>} />

                  {/* Admin Portal */}
                  <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]}><AdminDashboardPage /></ProtectedRoute>} />
                  <Route path="/admin/applications" element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]}><AdminApplicationsPage /></ProtectedRoute>} />
                  <Route path="/admin/doctors" element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]}><AdminDoctorsPage /></ProtectedRoute>} />
                  <Route path="/admin/clinics" element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]}><AdminClinicsPage /></ProtectedRoute>} />
                  <Route path="/admin/reviews" element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]}><AdminOperations.Reviews /></ProtectedRoute>} />
                  <Route path="/admin/support" element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]}><AdminOperations.Support /></ProtectedRoute>} />
                  <Route path="/admin/abdm" element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]}><AdminOperations.Abdm /></ProtectedRoute>} />
                  <Route path="/admin/audit-logs" element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]}><AdminOperations.AuditLogs /></ProtectedRoute>} />
                  <Route path="/admin/system-health" element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]}><AdminOperations.SystemHealth /></ProtectedRoute>} />

                  {/* Clinic Staff Portal */}
                  <Route path="/clinic/dashboard" element={<ProtectedRoute allowedRoles={[ROLES.CLINIC_MANAGER, ROLES.RECEPTIONIST]}><ClinicDashboardPage /></ProtectedRoute>} />
                  <Route path="/clinic/staff" element={<ProtectedRoute allowedRoles={[ROLES.CLINIC_MANAGER]}><ClinicStaffPage /></ProtectedRoute>} />

                  {/* Shared Authenticated Routes */}
                  <Route path="/support" element={<ProtectedRoute><SupportPage /></ProtectedRoute>} />
                  <Route path="/consultation/:appointmentId" element={<ProtectedRoute allowedRoles={[ROLES.PATIENT, ROLES.DOCTOR]}><VideoConsultationPage /></ProtectedRoute>} />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </MotionConfig>
  );
}
