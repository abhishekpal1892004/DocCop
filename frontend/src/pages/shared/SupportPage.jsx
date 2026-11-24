import { useCallback, useEffect, useState } from 'react';
import { HelpCircle, Plus } from 'lucide-react';
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
  Input,
  LoadingState,
  Modal,
  Select,
  Textarea,
  useToast,
} from '../../components/ui';

export default function SupportPage() {
  const { apiFetch } = useAppAuth();
  const { addToast } = useToast();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('BOOKING');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/support/tickets/my');
      setTickets(res.data?.tickets || res.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load support tickets.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/support/tickets', {
        method: 'POST',
        body: {
          subject: subject.trim(),
          category,
          description: description.trim(),
        },
      });
      addToast({ variant: 'success', title: 'Support ticket submitted' });
      setCreateOpen(false);
      setSubject('');
      setDescription('');
      loadTickets();
    } catch (err) {
      addToast({ variant: 'error', title: 'Submission failed', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Help & Support Tickets</h1>
          <p className="text-sm text-slate-600 mt-0.5">Raise billing, technical, or appointment support requests.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>New Ticket</span>
        </Button>
      </div>

      {loading ? (
        <LoadingState rows={3} label="Loading support tickets..." />
      ) : error ? (
        <ErrorState title="Could not load tickets" message={error} onRetry={loadTickets} />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title="No support tickets"
          description="Need help? Create a support ticket and our team will respond."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Create Ticket
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t._id}>
              <CardHeader
                title={t.subject}
                description={`${t.category || 'GENERAL'} • Created ${formatDateTime(t.createdAt)}`}
                action={<Badge status={t.status || 'OPEN'} />}
              />
              {t.description && (
                <CardBody>
                  <p className="text-sm text-slate-600">{t.description}</p>
                </CardBody>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Support Ticket">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Subject"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Short summary of your issue"
          />
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={[
              { value: 'BOOKING', label: 'Booking & Scheduling' },
              { value: 'PAYMENT', label: 'Payment & Refund' },
              { value: 'TECHNICAL', label: 'Technical / Video Issue' },
              { value: 'ACCOUNT', label: 'Account & Verification' },
            ]}
          />
          <Textarea
            label="Description"
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what happened..."
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Submit Ticket
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
