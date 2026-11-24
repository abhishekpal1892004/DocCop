import { useCallback, useEffect, useState } from 'react';
import { Play, Users } from 'lucide-react';
import { useAppAuth } from '../../context/AuthContext';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  useToast,
} from '../../components/ui';

export default function DoctorQueuePage() {
  const { apiFetch } = useAppAuth();
  const { addToast } = useToast();
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/doctor/queues');
      setQueue(res.data?.queue || res.data || null);
    } catch (err) {
      if (err.status === 404) {
        setQueue(null);
      } else {
        setError(err.message || 'Unable to load clinic queue.');
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const runAction = async (path, method = 'POST', successMsg = 'Queue updated') => {
    setBusy(true);
    try {
      await apiFetch(path, { method });
      addToast({ variant: 'success', title: successMsg });
      loadQueue();
    } catch (err) {
      addToast({ variant: 'error', title: 'Action failed', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState rows={3} label="Loading live queue..." />;
  if (error) return <ErrorState title="Queue unavailable" message={error} onRetry={loadQueue} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Live Clinic Queue</h1>
          <p className="text-sm text-slate-600 mt-0.5">Manage patient check-ins and call the next token.</p>
        </div>
        {!queue ? (
          <Button onClick={() => runAction('/doctor/queues/open', 'POST', 'Queue opened')} loading={busy}>
            Open Today's Queue
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Badge status={queue.status || 'OPEN'} />
            <Button
              size="sm"
              onClick={() => runAction(`/doctor/queues/${queue._id}/call-next`, 'POST', 'Called next patient')}
              loading={busy}
            >
              <Play className="w-4 h-4" aria-hidden="true" />
              <span>Call Next</span>
            </Button>
          </div>
        )}
      </div>

      {!queue ? (
        <EmptyState
          icon={Users}
          title="No active queue for today"
          description="Open your clinic queue to allow checked-in patients to receive live tokens."
        />
      ) : (
        <Card>
          <CardHeader title="Queue Tokens" description={`Current token: ${queue.currentTokenNumber ?? '—'}`} />
          <CardBody>
            {!queue.entries || queue.entries.length === 0 ? (
              <p className="text-sm text-slate-500">No patients checked in yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {queue.entries.map((entry) => (
                  <div key={entry._id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Token #{entry.tokenNumber} — {entry.patientName || 'Patient'}
                      </p>
                      <Badge status={entry.status} className="mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
