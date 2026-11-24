import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ClipboardList, Stethoscope, UserCheck, Users } from 'lucide-react';
import { useAppAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../lib/constants';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/ui';

export default function DoctorDashboardPage() {
  const { user, apiFetch } = useAppAuth();
  const [statusInfo, setStatusInfo] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statusRes, apptRes] = await Promise.all([
        apiFetch('/doctors/me/status').catch(() => ({ data: null })),
        apiFetch('/doctor/appointments?limit=5').catch(() => ({ data: { appointments: [] } })),
      ]);
      setStatusInfo(statusRes.data);
      setAppointments(apptRes.data?.appointments || apptRes.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load doctor dashboard.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) return <LoadingState rows={4} label="Loading doctor dashboard..." />;
  if (error) return <ErrorState title="Dashboard unavailable" message={error} onRetry={loadDashboard} />;

  const verificationStatus = statusInfo?.verificationStatus || user?.onboardingStatus || 'PENDING_VERIFICATION';
  const isApproved = verificationStatus === 'APPROVED';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-[#E6E0D4]">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[#57534E] font-medium">Doctor Workspace</p>
          <h1 className="font-editorial text-3xl sm:text-4xl font-normal text-[#1C1917] mt-1">
            Dr. {user?.fullName || 'Physician'}
          </h1>
          <p className="text-sm text-[#57534E] mt-1">
            Daily schedule, verification status, and clinical workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge status={verificationStatus} />
          {!isApproved && (
            <Link to="/doctor/onboarding">
              <Button size="sm">Complete Verification</Button>
            </Link>
          )}
        </div>
      </div>

      {!isApproved && (
        <Alert
          variant="warning"
          title="Verification required for public listing"
          action={
            <Link to="/doctor/onboarding">
              <Button variant="outline" size="sm">
                View Application
              </Button>
            </Link>
          }
        >
          Your doctor profile is currently <strong>{verificationStatus.replaceAll('_', ' ')}</strong>. Complete NMC verification and clinic details to start accepting bookings.
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardBody className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-teal-700 bg-teal-50 p-1.5 rounded-lg" aria-hidden="true" />
            <div>
              <p className="text-xs text-slate-500">Upcoming</p>
              <p className="text-lg font-bold text-slate-900">{appointments.length}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-sky-700" aria-hidden="true" />
              <span className="text-sm font-medium">Live Queue</span>
            </div>
            <Link to="/doctor/queue">
              <Button variant="outline" size="sm">Open</Button>
            </Link>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <ClipboardList className="w-5 h-5 text-teal-700" aria-hidden="true" />
              <span className="text-sm font-medium">Prescriptions</span>
            </div>
            <Link to="/doctor/prescriptions">
              <Button variant="outline" size="sm">Manage</Button>
            </Link>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Stethoscope className="w-5 h-5 text-slate-700" aria-hidden="true" />
              <span className="text-sm font-medium">Practice</span>
            </div>
            <Link to="/doctor/practice">
              <Button variant="outline" size="sm">Configure</Button>
            </Link>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Today & Upcoming Appointments"
          action={
            <Link to="/doctor/appointments" className="text-sm font-medium text-teal-700 hover:underline">
              View all
            </Link>
          }
        />
        <CardBody>
          {appointments.length === 0 ? (
            <EmptyState
              icon={UserCheck}
              title="No appointments scheduled"
              description="Confirmed patient bookings will appear here."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {appointments.map((appt) => (
                <div key={appt._id} className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {appt.patient?.fullName || appt.patientName || 'Patient'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(appt.startTime)} • {appt.consultationMode || 'IN_PERSON'}
                    </p>
                  </div>
                  <Badge status={appt.status} />
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
