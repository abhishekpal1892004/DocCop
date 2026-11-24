import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CreditCard, Video, XCircle } from 'lucide-react';
import { useAppAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime } from '../../lib/constants';
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

export default function PatientAppointmentsPage() {
  const { apiFetch } = useAppAuth();
  const { addToast } = useToast();

  const [appointments, setAppointments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const res = await apiFetch(`/appointments/my${qs}`);
      setAppointments(res.data?.appointments || res.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load appointments.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, statusFilter]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setActionLoading(true);
    try {
      await apiFetch(`/appointments/${cancelTarget._id}/cancel`, {
        method: 'POST',
        body: { reason: cancelReason.trim() || 'Cancelled by patient' },
      });
      addToast({ variant: 'success', title: 'Appointment cancelled' });
      setCancelTarget(null);
      setCancelReason('');
      loadAppointments();
    } catch (err) {
      addToast({ variant: 'error', title: 'Cancellation failed', description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayNow = async (appt) => {
    setActionLoading(true);
    try {
      const res = await apiFetch('/payments/create-order', {
        method: 'POST',
        body: { appointmentId: appt._id },
      });
      addToast({
        variant: 'info',
        title: 'Payment order ready',
        description: `Order ${res.data?.order?.id || res.data?.orderId || ''} created. Complete checkout in Razorpay.`,
      });
      loadAppointments();
    } catch (err) {
      addToast({ variant: 'error', title: 'Payment initiation failed', description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Appointments</h1>
          <p className="text-sm text-slate-600 mt-0.5">Track booking status, payments, and video consultations.</p>
        </div>
        <div className="w-48">
          <Select
            aria-label="Filter appointments by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="All statuses"
            options={[
              { value: 'CONFIRMED', label: 'Confirmed' },
              { value: 'PENDING_PAYMENT', label: 'Payment Pending' },
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <LoadingState rows={4} label="Loading appointments..." />
      ) : error ? (
        <ErrorState title="Unable to load appointments" message={error} onRetry={loadAppointments} />
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No appointments found"
          description="You have no appointments matching this filter."
          action={
            <Link to="/doctors">
              <Button size="sm">Book an Appointment</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => {
            const canCancel = !['CANCELLED', 'COMPLETED'].includes(appt.status);
            const needsPayment = appt.status === 'PENDING_PAYMENT' || appt.paymentStatus === 'PENDING';
            const canJoinVideo = appt.consultationMode === 'VIDEO' && appt.status === 'CONFIRMED';

            return (
              <Card key={appt._id}>
                <CardBody className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-900">
                        {appt.doctor?.fullName || appt.doctorName || 'Doctor Consultation'}
                      </h2>
                      <Badge status={appt.status} />
                      {appt.paymentStatus && <Badge status={appt.paymentStatus} />}
                    </div>
                    <p className="text-sm text-slate-600">
                      {formatDateTime(appt.startTime)} • {appt.consultationMode || 'IN_PERSON'}
                      {appt.fee != null ? ` • ${formatCurrency(appt.fee)}` : ''}
                    </p>
                    {appt.clinic?.name && (
                      <p className="text-xs text-slate-500">
                        Clinic: {appt.clinic.name} {appt.clinic.city ? `(${appt.clinic.city})` : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {needsPayment && (
                      <Button size="sm" onClick={() => handlePayNow(appt)} loading={actionLoading}>
                        <CreditCard className="w-4 h-4" aria-hidden="true" />
                        <span>Pay Now</span>
                      </Button>
                    )}
                    {canJoinVideo && (
                      <Link to={`/consultation/${appt._id}`}>
                        <Button variant="secondary" size="sm">
                          <Video className="w-4 h-4" aria-hidden="true" />
                          <span>Join Video</span>
                        </Button>
                      </Link>
                    )}
                    {canCancel && (
                      <Button variant="outline" size="sm" onClick={() => setCancelTarget(appt)}>
                        <XCircle className="w-4 h-4 text-red-600" aria-hidden="true" />
                        <span>Cancel</span>
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmationDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        loading={actionLoading}
        title="Cancel appointment?"
        description="This will release your reserved time slot."
        confirmLabel="Cancel Appointment"
      >
        <Textarea
          label="Cancellation reason"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Optional reason for cancelling"
        />
      </ConfirmationDialog>
    </div>
  );
}
