import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Video, XCircle } from 'lucide-react';
import { useAppAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../lib/constants';
import {
  Badge,
  Button,
  Card,
  CardBody,
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Select,
  Textarea,
  useToast,
} from '../../components/ui';

export default function DoctorAppointmentsPage() {
  const { apiFetch } = useAppAuth();
  const { addToast } = useToast();
  const [appointments, setAppointments] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      const res = await apiFetch(`/doctor/appointments${qs}`);
      setAppointments(res.data?.appointments || res.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load doctor appointments.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, status]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setSubmitting(true);
    try {
      await apiFetch(`/appointments/${cancelTarget._id}/cancel`, {
        method: 'POST',
        body: { reason: reason.trim() || 'Cancelled by doctor' },
      });
      addToast({ variant: 'success', title: 'Appointment cancelled' });
      setCancelTarget(null);
      setReason('');
      loadAppointments();
    } catch (err) {
      addToast({ variant: 'error', title: 'Cancellation failed', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Doctor Appointments</h1>
          <p className="text-sm text-slate-600 mt-0.5">Review patient bookings and start video consultations.</p>
        </div>
        <div className="w-48">
          <Select
            aria-label="Filter appointments"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="All statuses"
            options={[
              { value: 'CONFIRMED', label: 'Confirmed' },
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <LoadingState rows={4} label="Loading appointments..." />
      ) : error ? (
        <ErrorState title="Could not load appointments" message={error} onRetry={loadAppointments} />
      ) : appointments.length === 0 ? (
        <EmptyState icon={Calendar} title="No appointments found" description="No bookings match this filter." />
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => (
            <Card key={appt._id}>
              <CardBody className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900">
                      {appt.patient?.fullName || appt.patientName || 'Patient'}
                    </h2>
                    <Badge status={appt.status} />
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {formatDateTime(appt.startTime)} • {appt.consultationMode || 'IN_PERSON'}
                  </p>
                  {appt.reason && <p className="text-xs text-slate-500 mt-1">Reason: {appt.reason}</p>}
                </div>

                <div className="flex items-center gap-2">
                  {appt.consultationMode === 'VIDEO' && appt.status === 'CONFIRMED' && (
                    <Link to={`/consultation/${appt._id}`}>
                      <Button variant="secondary" size="sm">
                        <Video className="w-4 h-4" aria-hidden="true" />
                        <span>Start Video</span>
                      </Button>
                    </Link>
                  )}
                  {!['CANCELLED', 'COMPLETED'].includes(appt.status) && (
                    <Button variant="outline" size="sm" onClick={() => setCancelTarget(appt)}>
                      <XCircle className="w-4 h-4 text-red-600" aria-hidden="true" />
                      <span>Cancel</span>
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <ConfirmationDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        loading={submitting}
        title="Cancel patient appointment?"
        confirmLabel="Cancel Appointment"
      >
        <Textarea
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional note for the patient"
        />
      </ConfirmationDialog>
    </div>
  );
}
