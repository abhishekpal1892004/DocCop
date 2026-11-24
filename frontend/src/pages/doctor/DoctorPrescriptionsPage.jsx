import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Plus, Send } from 'lucide-react';
import { useAppAuth } from '../../context/AuthContext';
import { formatDate } from '../../lib/constants';
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
  Textarea,
  useToast,
} from '../../components/ui';

export default function DoctorPrescriptionsPage() {
  const { apiFetch } = useAppAuth();
  const { addToast } = useToast();

  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [appointmentId, setAppointmentId] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadPrescriptions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/doctor/prescriptions');
      setPrescriptions(res.data?.prescriptions || res.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load prescriptions.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadPrescriptions();
  }, [loadPrescriptions]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/prescriptions', {
        method: 'POST',
        body: {
          appointmentId: appointmentId.trim(),
          diagnosis: diagnosis.trim(),
          medications: [
            {
              name: medName.trim(),
              dosage: dosage.trim(),
              frequency: frequency.trim(),
              duration: duration.trim(),
            },
          ],
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      });
      addToast({ variant: 'success', title: 'Prescription draft created' });
      setCreateOpen(false);
      setAppointmentId('');
      setDiagnosis('');
      setMedName('');
      setDosage('');
      setFrequency('');
      setDuration('');
      setNotes('');
      loadPrescriptions();
    } catch (err) {
      addToast({ variant: 'error', title: 'Creation failed', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleIssue = async (id) => {
    try {
      await apiFetch(`/prescriptions/${id}/issue`, { method: 'POST' });
      addToast({ variant: 'success', title: 'Prescription issued to patient' });
      loadPrescriptions();
    } catch (err) {
      addToast({ variant: 'error', title: 'Issue failed', description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Prescriptions</h1>
          <p className="text-sm text-slate-600 mt-0.5">Create digital prescriptions and issue them to patients.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>New Prescription</span>
        </Button>
      </div>

      {loading ? (
        <LoadingState rows={3} label="Loading prescriptions..." />
      ) : error ? (
        <ErrorState title="Could not load prescriptions" message={error} onRetry={loadPrescriptions} />
      ) : prescriptions.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No prescriptions created"
          description="Create a prescription draft after a consultation and issue it when ready."
        />
      ) : (
        <div className="space-y-3">
          {prescriptions.map((rx) => (
            <Card key={rx._id}>
              <CardHeader
                title={rx.diagnosis || 'Prescription'}
                description={`Created ${formatDate(rx.createdAt)} • Patient: ${rx.patient?.fullName || 'Patient'}`}
                action={<Badge status={rx.status || 'DRAFT'} />}
              />
              {rx.status === 'DRAFT' && (
                <CardBody className="flex justify-end">
                  <Button size="sm" onClick={() => handleIssue(rx._id)}>
                    <Send className="w-4 h-4" aria-hidden="true" />
                    <span>Issue Prescription</span>
                  </Button>
                </CardBody>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Prescription Draft">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Appointment ID"
            required
            value={appointmentId}
            onChange={(e) => setAppointmentId(e.target.value)}
            placeholder="Paste confirmed Appointment ID"
          />
          <Input
            label="Diagnosis"
            required
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="e.g. Acute Viral Pharyngitis"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Medication name" required value={medName} onChange={(e) => setMedName(e.target.value)} placeholder="Paracetamol" />
            <Input label="Dosage" required value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="500 mg" />
            <Input label="Frequency" required value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="Twice daily" />
            <Input label="Duration" required value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="5 days" />
          </div>
          <Textarea label="Clinical notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={submitting}>Save Draft</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
