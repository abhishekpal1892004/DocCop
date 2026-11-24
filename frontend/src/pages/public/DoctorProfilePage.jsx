import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Calendar, Clock, MapPin, ShieldCheck, Star } from 'lucide-react';
import { apiRequest, buildQuery } from '../../lib/api';
import { useAppAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime, ROLES } from '../../lib/constants';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
  Textarea,
  useToast,
} from '../../components/ui';

export default function DoctorProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isSignedIn, role, apiFetch } = useAppAuth();
  const { addToast } = useToast();

  const [doctor, setDoctor] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [slots, setSlots] = useState([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedSlot, setSelectedSlot] = useState('');
  const [consultationMode, setConsultationMode] = useState('IN_PERSON');
  const [appointmentTypeId, setAppointmentTypeId] = useState('');
  const [reason, setReason] = useState('');

  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [bookError, setBookError] = useState('');

  const loadDoctor = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [docRes, revRes] = await Promise.all([
        apiRequest(`/doctors/${id}`),
        apiRequest(`/doctors/${id}/reviews${buildQuery({ limit: 10 })}`).catch(() => ({ data: { reviews: [] } })),
      ]);
      const d = docRes.data?.doctor || docRes.data;
      setDoctor(d);
      if (d?.appointmentTypes?.length > 0) {
        setAppointmentTypeId(d.appointmentTypes[0]._id);
      }
      setReviews(revRes.data?.reviews || revRes.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load doctor profile.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadAvailability = useCallback(async () => {
    if (!date) return;
    setSlotsLoading(true);
    setSelectedSlot('');
    try {
      const res = await apiRequest(
        `/doctors/${id}/availability${buildQuery({
          date,
          appointmentTypeId: appointmentTypeId || undefined,
        })}`
      );
      const list = res.data?.slots || res.data?.availableSlots || res.data || [];
      setSlots(Array.isArray(list) ? list : []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [id, date, appointmentTypeId]);

  useEffect(() => {
    loadDoctor();
  }, [loadDoctor]);

  useEffect(() => {
    if (doctor) loadAvailability();
  }, [doctor, loadAvailability]);

  const handleBook = async (e) => {
    e.preventDefault();
    setBookError('');
    if (!isSignedIn) {
      navigate('/sign-in');
      return;
    }
    if (role !== ROLES.PATIENT) {
      setBookError('Only patient accounts can book appointments.');
      return;
    }
    if (!selectedSlot) {
      setBookError('Please select an available time slot.');
      return;
    }

    setBooking(true);
    try {
      const res = await apiFetch('/appointments', {
        method: 'POST',
        body: {
          doctorId: id,
          startTime: selectedSlot,
          consultationMode,
          ...(appointmentTypeId ? { appointmentTypeId } : {}),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        },
      });
      const apptId = res.data?.appointment?._id || res.data?._id;
      addToast({
        variant: 'success',
        title: 'Appointment requested',
        description: 'Your slot has been reserved. Review payment and details below.',
      });
      navigate(apptId ? `/patient/appointments?highlight=${apptId}` : '/patient/appointments');
    } catch (err) {
      setBookError(err.message || 'Could not book appointment. Please try another slot.');
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10">
        <LoadingState rows={4} label="Loading doctor profile..." />
      </div>
    );
  }
  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <ErrorState title="Doctor profile unavailable" message={error} onRetry={loadDoctor} />
      </div>
    );
  }
  if (!doctor) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <EmptyState title="Doctor not found" />
      </div>
    );
  }

  const name = doctor.fullName || doctor.user?.fullName || 'Doctor';
  const specs = Array.isArray(doctor.specialties) ? doctor.specialties.join(', ') : doctor.specialty || 'Specialist';
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10 lg:py-14 space-y-8">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#57534E]">
        <Link to="/doctors" className="hover:text-[#1B4332] underline-offset-4 hover:underline">
          Doctors Directory
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-[#1C1917] font-medium truncate">{name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left: Editorial Split Profile */}
        <div className="lg:col-span-7 space-y-10">
          <div className="flex flex-col sm:flex-row gap-6 items-start pb-8 border-b border-[#E6E0D4]">
            <Avatar name={name} src={doctor.profileImage} size="xl" />
            <div className="space-y-2.5 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-editorial text-4xl sm:text-5xl font-normal text-[#1C1917]">{name}</h1>
                <Badge status="VERIFIED" />
              </div>
              <p className="text-base font-medium text-[#1B4332]">{specs}</p>
              {doctor.qualifications && (
                <p className="text-sm text-[#57534E]">
                  {Array.isArray(doctor.qualifications) ? doctor.qualifications.join(', ') : doctor.qualifications}
                </p>
              )}

              <div className="flex flex-wrap gap-5 pt-2 text-xs text-[#57534E]">
                {doctor.experienceYears != null && <span>{doctor.experienceYears} years experience</span>}
                {doctor.primaryClinic?.name && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                    {doctor.primaryClinic.name}
                    {doctor.primaryClinic.city ? `, ${doctor.primaryClinic.city}` : ''}
                  </span>
                )}
                {doctor.averageRating != null && (
                  <span className="inline-flex items-center gap-1.5 text-[#1C1917]">
                    <Star className="w-3.5 h-3.5 text-[#78350F]" aria-hidden="true" />
                    {Number(doctor.averageRating).toFixed(1)} ({doctor.reviewCount || 0} reviews)
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-[#1B4332]">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  NMC Verified
                </span>
              </div>
            </div>
          </div>

          {doctor.bio && (
            <section className="space-y-2">
              <h2 className="text-xs uppercase tracking-[0.16em] text-[#57534E] font-semibold">Biography</h2>
              <p className="text-base text-[#1C1917] leading-relaxed">{doctor.bio}</p>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-[#E6E0D4] pb-2">
              <h2 className="font-editorial text-2xl text-[#1C1917]">Patient Reviews</h2>
              <span className="text-xs text-[#57534E]">{reviews.length} verified</span>
            </div>
            {reviews.length === 0 ? (
              <p className="text-sm text-[#57534E]">No reviews yet for this practitioner.</p>
            ) : (
              <div className="divide-y divide-[#E6E0D4]">
                {reviews.map((rev) => (
                  <div key={rev._id} className="py-4 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[#1C1917]">
                        {rev.patientName || 'Verified Patient'}
                      </span>
                      <span className="text-xs font-semibold text-[#78350F]">★ {rev.rating}/5</span>
                    </div>
                    {rev.comment && <p className="text-sm text-[#57534E] leading-relaxed">{rev.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: Booking Panel */}
        <div className="lg:col-span-5">
          <Card className="sticky top-24">
            <CardHeader
              title="Book an Appointment"
              description={`Consultation fee: ${doctor.consultationFee != null ? formatCurrency(doctor.consultationFee) : 'Standard'}`}
            />
            <CardBody>
              <form onSubmit={handleBook} className="space-y-4">
                {bookError && <Alert variant="error">{bookError}</Alert>}

                {doctor.appointmentTypes?.length > 0 && (
                  <Select
                    label="Appointment type"
                    value={appointmentTypeId}
                    onChange={(e) => setAppointmentTypeId(e.target.value)}
                    options={doctor.appointmentTypes.map((t) => ({
                      value: t._id,
                      label: `${t.name} (${t.durationMinutes} min)`,
                    }))}
                  />
                )}

                <Select
                  label="Consultation mode"
                  value={consultationMode}
                  onChange={(e) => setConsultationMode(e.target.value)}
                  options={[
                    { value: 'IN_PERSON', label: 'In-Person Clinic Visit' },
                    { value: 'VIDEO', label: 'Video Teleconsultation' },
                  ]}
                />

                <Input
                  label="Preferred date"
                  type="date"
                  required
                  min={new Date().toISOString().slice(0, 10)}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#1C1917]">Available slots</span>
                    <span className="text-xs text-[#57534E] flex items-center gap-1">
                      <Clock className="w-3 h-3" aria-hidden="true" />
                      {tz}
                    </span>
                  </div>

                  {slotsLoading ? (
                    <p className="text-xs text-[#57534E] py-2">Checking availability...</p>
                  ) : slots.length === 0 ? (
                    <p className="text-xs text-[#57534E] py-3 bg-[#FAF7F2] rounded-md px-3 border border-[#E6E0D4]">
                      No slots available on this date. Try another date.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                      {slots.map((slot) => {
                        const start = slot.startTime || slot.start || slot;
                        const active = selectedSlot === start;
                        return (
                          <button
                            key={start}
                            type="button"
                            onClick={() => setSelectedSlot(start)}
                            aria-pressed={active}
                            className={`px-2.5 py-2 rounded-sm text-xs font-medium border transition-colors cursor-pointer ${
                              active
                                ? 'bg-[#183F32] text-[#F7F5F0] border-[#183F32]'
                                : 'bg-white text-[#171916] border-[#D9D5CA] hover:bg-[#EFECE4]'
                            }`}
                          >
                            {formatDateTime(start)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Textarea
                  label="Reason for visit"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Brief symptoms or follow-up notes (optional)"
                />

                <Button type="submit" loading={booking} className="w-full" size="lg">
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                  <span>{isSignedIn ? 'Confirm Booking' : 'Sign in to Book'}</span>
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
