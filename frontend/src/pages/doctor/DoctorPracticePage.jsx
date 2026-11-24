import { useCallback, useEffect, useState } from 'react';
import { Plus, Stethoscope } from 'lucide-react';
import { useAppAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/constants';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  Select,
  useToast,
} from '../../components/ui';

export default function DoctorPracticePage() {
  const { apiFetch } = useAppAuth();
  const { addToast } = useToast();

  const [types, setTypes] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [mode, setMode] = useState('IN_PERSON');
  const [fee, setFee] = useState('500');
  const [submitting, setSubmitting] = useState(false);

  const loadPractice = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [typesRes, clinicsRes] = await Promise.all([
        apiFetch('/doctors/me/appointment-types').catch(() => ({ data: { appointmentTypes: [] } })),
        apiFetch('/doctors/me/clinics').catch(() => ({ data: { clinics: [] } })),
      ]);
      setTypes(typesRes.data?.appointmentTypes || typesRes.data || []);
      setClinics(clinicsRes.data?.clinics || clinicsRes.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load practice configuration.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadPractice();
  }, [loadPractice]);

  const handleCreateType = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/doctors/me/appointment-types', {
        method: 'POST',
        body: {
          name: name.trim(),
          durationMinutes: Number(durationMinutes),
          consultationMode: mode,
          fee: Number(fee),
        },
      });
      addToast({ variant: 'success', title: 'Appointment type added' });
      setCreateOpen(false);
      setName('');
      loadPractice();
    } catch (err) {
      addToast({ variant: 'error', title: 'Failed to create', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState rows={3} label="Loading practice settings..." />;
  if (error) return <ErrorState title="Practice unavailable" message={error} onRetry={loadPractice} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Practice & Appointment Types</h1>
          <p className="text-sm text-slate-600 mt-0.5">Configure consultation types, durations, and associated clinics.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Add Appointment Type</span>
        </Button>
      </div>

      <Card>
        <CardHeader title="Appointment Types" />
        <CardBody>
          {types.length === 0 ? (
            <EmptyState
              icon={Stethoscope}
              title="No appointment types configured"
              description="Add consultation types so patients can pick the right visit duration."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {types.map((t) => (
                <div key={t._id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">
                      {t.durationMinutes} min • {t.consultationMode} • {formatCurrency(t.fee)}
                    </p>
                  </div>
                  <Badge status={t.isActive !== false ? 'ACTIVE' : 'SUSPENDED'} />
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Associated Clinics" />
        <CardBody>
          {clinics.length === 0 ? (
            <p className="text-sm text-slate-500">No clinics associated yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {clinics.map((c) => (
                <div key={c._id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{c.name || c.clinic?.name}</p>
                    <p className="text-xs text-slate-500">{c.city || c.clinic?.city}</p>
                  </div>
                  <Badge status={c.status || 'VERIFIED'} />
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Appointment Type">
        <form onSubmit={handleCreateType} className="space-y-4">
          <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Initial Consultation" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Duration (minutes)" type="number" required value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
            <Input label="Fee (INR)" type="number" required value={fee} onChange={(e) => setFee(e.target.value)} />
          </div>
          <Select
            label="Mode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            options={[
              { value: 'IN_PERSON', label: 'In-Person' },
              { value: 'VIDEO', label: 'Video' },
            ]}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={submitting}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
