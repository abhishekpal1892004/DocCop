import { useCallback, useEffect, useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../lib/constants';
import { Badge, Button, Card, CardBody, CardHeader, ErrorState, LoadingState, Table, useToast } from '../../components/ui';

export function AdminReviewsPage() {
  const { apiFetch } = useAppAuth();
  const { addToast } = useToast();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/admin/reviews');
      setReviews(res.data?.reviews || res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const moderate = async (id, action) => {
    try {
      await apiFetch(`/admin/reviews/${id}/moderate`, { method: 'PATCH', body: { action } });
      addToast({ variant: 'success', title: `Review ${action.toLowerCase()}` });
      load();
    } catch (err) {
      addToast({ variant: 'error', title: 'Moderation failed', description: err.message });
    }
  };

  if (loading) return <LoadingState rows={3} label="Loading reviews..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Reviews Moderation</h1>
      <Table
        rows={reviews}
        columns={[
          { key: 'rating', header: 'Rating', render: (r) => `${r.rating}/5` },
          { key: 'comment', header: 'Comment', render: (r) => r.comment || '—' },
          { key: 'status', header: 'Status', render: (r) => <Badge status={r.status || 'ACTIVE'} /> },
          {
            key: 'actions',
            header: 'Actions',
            render: (r) => (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => moderate(r._id, 'APPROVE')}>Approve</Button>
                <Button size="sm" variant="danger" onClick={() => moderate(r._id, 'HIDE')}>Hide</Button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

export function AdminSupportPage() {
  const { apiFetch } = useAppAuth();
  const { addToast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/admin/support/tickets');
      setTickets(res.data?.tickets || res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const resolveTicket = async (id) => {
    try {
      await apiFetch(`/admin/support/tickets/${id}`, { method: 'PATCH', body: { status: 'RESOLVED' } });
      addToast({ variant: 'success', title: 'Ticket marked resolved' });
      load();
    } catch (err) {
      addToast({ variant: 'error', title: 'Update failed', description: err.message });
    }
  };

  if (loading) return <LoadingState rows={3} label="Loading support tickets..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Support Tickets</h1>
      <Table
        rows={tickets}
        columns={[
          { key: 'subject', header: 'Subject' },
          { key: 'category', header: 'Category' },
          { key: 'status', header: 'Status', render: (r) => <Badge status={r.status || 'OPEN'} /> },
          { key: 'createdAt', header: 'Created', render: (r) => formatDateTime(r.createdAt) },
          {
            key: 'action',
            header: 'Action',
            render: (r) =>
              r.status !== 'RESOLVED' ? (
                <Button size="sm" onClick={() => resolveTicket(r._id)}>Resolve</Button>
              ) : (
                <span className="text-xs text-slate-400">Closed</span>
              ),
          },
        ]}
      />
    </div>
  );
}

export function AdminAuditLogsPage() {
  const { apiFetch } = useAppAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/admin/audit-logs');
      setLogs(res.data?.logs || res.data?.auditLogs || res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState rows={3} label="Loading audit logs..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
      <Table
        rows={logs}
        columns={[
          { key: 'action', header: 'Action' },
          { key: 'entityType', header: 'Entity' },
          { key: 'actorRole', header: 'Role' },
          { key: 'createdAt', header: 'Timestamp', render: (r) => formatDateTime(r.createdAt) },
        ]}
      />
    </div>
  );
}

export function AdminSystemHealthPage() {
  const { apiFetch } = useAppAuth();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/admin/system-health');
      setHealth(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState rows={2} label="Loading system health..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">System Health</h1>
        <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Database & Runtime" action={<Badge status={health?.database === 'up' || health?.status === 'ok' ? 'ACTIVE' : 'PENDING'} />} />
          <CardBody className="text-sm space-y-1 text-slate-700">
            <p>Uptime: {health?.uptimeSeconds ?? health?.uptime ?? '—'}s</p>
            <p>Environment: {health?.environment || 'development'}</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Circuit Breakers & Providers" />
          <CardBody className="text-sm text-slate-700">
            <pre className="text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 overflow-x-auto">
              {JSON.stringify(health?.circuitBreakers || health?.providers || health, null, 2)}
            </pre>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export function AdminAbdmPage() {
  const { apiFetch } = useAppAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/abdm/admin/dashboard');
      setData(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState rows={2} label="Loading ABDM dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">ABDM Integration Status</h1>
      <Card>
        <CardHeader title="ABDM Sandbox / Gateway Overview" />
        <CardBody>
          <pre className="text-xs bg-slate-50 p-4 rounded-lg border border-slate-200 overflow-x-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </CardBody>
      </Card>
    </div>
  );
}
