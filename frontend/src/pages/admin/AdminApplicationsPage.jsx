import { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useAppAuth } from '../../context/AuthContext';
import { formatDate } from '../../lib/constants';
import {
  Badge,
  Button,
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Table,
  Textarea,
  useToast,
} from '../../components/ui';

export default function AdminApplicationsPage() {
  const { apiFetch } = useAppAuth();
  const { addToast } = useToast();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionModal, setActionModal] = useState(null); // { type: 'approve' | 'reject', app }
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/admin/doctor-applications');
      setApplications(res.data?.applications || res.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load doctor applications.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const handleConfirm = async () => {
    if (!actionModal) return;
    setBusy(true);
    try {
      const { type, app } = actionModal;
      await apiFetch(`/admin/doctor-applications/${app._id}/${type}`, {
        method: 'POST',
        body: { remarks: remarks.trim() || (type === 'approve' ? 'Verified and approved' : 'Rejected by admin') },
      });
      addToast({ variant: 'success', title: `Application ${type}d` });
      setActionModal(null);
      setRemarks('');
      loadApplications();
    } catch (err) {
      addToast({ variant: 'error', title: 'Action failed', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'registrationNumber', header: 'Reg. Number', render: (r) => r.registrationNumber || '—' },
    { key: 'council', header: 'Council', render: (r) => r.registrationCouncil || '—' },
    { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
    { key: 'submittedAt', header: 'Submitted', render: (r) => formatDate(r.submittedAt || r.createdAt) },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-2 justify-end md:justify-start">
          <Button size="sm" onClick={() => setActionModal({ type: 'approve', app: r })}>
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Approve</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActionModal({ type: 'reject', app: r })}>
            <X className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
            <span>Reject</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Doctor Verification Applications</h1>
        <p className="text-sm text-slate-600 mt-0.5">Review NMC checks, clinic details, and approve or reject applications.</p>
      </div>

      {loading ? (
        <LoadingState rows={4} label="Loading applications..." />
      ) : error ? (
        <ErrorState title="Could not load applications" message={error} onRetry={loadApplications} />
      ) : applications.length === 0 ? (
        <EmptyState title="No applications found" description="Doctor onboarding submissions will appear here." />
      ) : (
        <Table columns={columns} rows={applications} />
      )}

      <ConfirmationDialog
        open={Boolean(actionModal)}
        onClose={() => setActionModal(null)}
        onConfirm={handleConfirm}
        loading={busy}
        variant={actionModal?.type === 'approve' ? 'primary' : 'danger'}
        title={actionModal?.type === 'approve' ? 'Approve doctor application?' : 'Reject doctor application?'}
        confirmLabel={actionModal?.type === 'approve' ? 'Approve Doctor' : 'Reject Application'}
      >
        <Textarea
          label="Review remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Add notes for the audit log..."
        />
      </ConfirmationDialog>
    </div>
  );
}
