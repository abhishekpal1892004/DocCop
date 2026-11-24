import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Calendar, ClipboardList, FileText, Stethoscope } from 'lucide-react';
import { useAppAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../lib/constants';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/ui';

export default function PatientDashboardPage() {
  const { user, apiFetch } = useAppAuth();
  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [apptRes, rxRes, notifRes] = await Promise.all([
        apiFetch('/appointments/my?limit=5'),
        apiFetch('/prescriptions/my?limit=5').catch(() => ({ data: { prescriptions: [] } })),
        apiFetch('/notifications/my?limit=5').catch(() => ({ data: { notifications: [] } })),
      ]);
      setAppointments(apptRes.data?.appointments || apptRes.data || []);
      setPrescriptions(rxRes.data?.prescriptions || rxRes.data || []);
      setNotifications(notifRes.data?.notifications || notifRes.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) return <LoadingState rows={4} label="Loading patient dashboard..." />;
  if (error) return <ErrorState title="Dashboard unavailable" message={error} onRetry={loadDashboard} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-[#E6E0D4]">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[#57534E] font-medium">Patient Portal</p>
          <h1 className="font-editorial text-3xl sm:text-4xl font-normal text-[#1C1917] mt-1">
            Welcome back, {user?.fullName?.split(' ')[0] || 'Patient'}
          </h1>
          <p className="text-sm text-[#57534E] mt-1">
            Manage your appointments, prescriptions, and health records in one place.
          </p>
        </div>
        <Link to="/doctors">
          <Button>
            <Stethoscope className="w-4 h-4" aria-hidden="true" />
            <span>Book Appointment</span>
          </Button>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardBody className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <Calendar className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Recent Appointments</p>
              <p className="text-xl font-bold text-slate-900">{appointments.length}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
              <ClipboardList className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Prescriptions</p>
              <p className="text-xl font-bold text-slate-900">{prescriptions.length}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Bell className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Notifications</p>
              <p className="text-xl font-bold text-slate-900">{notifications.length}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Upcoming Appointments */}
      <Card>
        <CardHeader
          title="Recent & Upcoming Appointments"
          action={
            <Link to="/patient/appointments" className="text-sm font-medium text-teal-700 hover:underline">
              View all
            </Link>
          }
        />
        <CardBody>
          {appointments.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No appointments yet"
              description="Browse our verified doctors directory to schedule your first consultation."
              action={
                <Link to="/doctors">
                  <Button size="sm">Find a Doctor</Button>
                </Link>
              }
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {appointments.map((appt) => (
                <div key={appt._id} className="py-3.5 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm text-slate-900">
                      {appt.doctor?.fullName || appt.doctorName || 'Doctor Consultation'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatDateTime(appt.startTime)} • {appt.consultationMode || 'IN_PERSON'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={appt.status} />
                    {appt.paymentStatus && <Badge status={appt.paymentStatus} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardBody className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-teal-700 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Medical Records</h2>
                <p className="text-xs text-slate-500">Upload lab reports and manage doctor sharing</p>
              </div>
            </div>
            <Link to="/patient/records">
              <Button variant="outline" size="sm">
                Open
              </Button>
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-5 h-5 text-sky-700 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Digital Prescriptions</h2>
                <p className="text-xs text-slate-500">View issued medications and download PDFs</p>
              </div>
            </div>
            <Link to="/patient/prescriptions">
              <Button variant="outline" size="sm">
                Open
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
