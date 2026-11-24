import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAppAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../lib/constants';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmationDialog,
  ErrorState,
  Input,
  LoadingState,
  useToast,
} from '../../components/ui';

export default function PatientAbdmPage() {
  const { apiFetch } = useAppAuth();
  const { addToast } = useToast();

  const [abhaStatus, setAbhaStatus] = useState(null);
  const [consents, setConsents] = useState([]);
  const [abhaAddress, setAbhaAddress] = useState('');
  const [otp, setOtp] = useState('');
  const [txnId, setTxnId] = useState('');
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadAbdm = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statusRes, consentRes] = await Promise.all([
        apiFetch('/abdm/abha/status').catch(() => ({ data: null })),
        apiFetch('/abdm/hiu/consents/my').catch(() => ({ data: { consents: [] } })),
      ]);
      setAbhaStatus(statusRes.data);
      setConsents(consentRes.data?.consents || consentRes.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load ABDM status.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadAbdm();
  }, [loadAbdm]);

  const handleInitiate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch('/abdm/abha/initiate-link', {
        method: 'POST',
        body: { abhaAddress: abhaAddress.trim() },
      });
      setTxnId(res.data?.txnId || 'initiated');
      addToast({ variant: 'info', title: 'OTP sent', description: 'Enter the verification OTP to link your ABHA.' });
    } catch (err) {
      addToast({ variant: 'error', title: 'ABHA initiation failed', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/abdm/abha/verify', {
        method: 'POST',
        body: { txnId, otp: otp.trim() },
      });
      addToast({ variant: 'success', title: 'ABHA linked successfully' });
      setTxnId('');
      setOtp('');
      loadAbdm();
    } catch (err) {
      addToast({ variant: 'error', title: 'Verification failed', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setSubmitting(true);
    try {
      await apiFetch(`/abdm/hiu/consent/${revokeTarget._id}/revoke`, { method: 'POST' });
      addToast({ variant: 'success', title: 'Consent revoked' });
      setRevokeTarget(null);
      loadAbdm();
    } catch (err) {
      addToast({ variant: 'error', title: 'Could not revoke consent', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState rows={3} label="Loading ABDM status..." />;
  if (error) return <ErrorState title="ABDM unavailable" message={error} onRetry={loadAbdm} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ABHA & Health Data Consent</h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Link your Ayushman Bharat Health Account (ABHA) and manage HIU data-sharing consents.
        </p>
      </div>

      <Card>
        <CardHeader
          title="ABHA Linking Status"
          action={<Badge status={abhaStatus?.linked ? 'VERIFIED' : 'NOT_STARTED'}>{abhaStatus?.linked ? 'Linked' : 'Not Linked'}</Badge>}
        />
        <CardBody className="space-y-4">
          {abhaStatus?.linked ? (
            <Alert variant="success" title="ABHA Linked">
              ABHA Address: <span className="font-mono">{abhaStatus.abhaAddress || 'Verified'}</span>
            </Alert>
          ) : !txnId ? (
            <form onSubmit={handleInitiate} className="flex flex-col sm:flex-row gap-3 items-end">
              <Input
                label="ABHA Address"
                required
                wrapperClassName="flex-1"
                value={abhaAddress}
                onChange={(e) => setAbhaAddress(e.target.value)}
                placeholder="name@abdm"
              />
              <Button type="submit" loading={submitting}>
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                <span>Send Verification OTP</span>
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-3 items-end">
              <Input
                label="Verification OTP"
                required
                wrapperClassName="flex-1"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit OTP"
              />
              <Button type="submit" loading={submitting}>
                Verify & Link
              </Button>
            </form>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="HIU Consents" description="Active and historical health record access consents" />
        <CardBody>
          {consents.length === 0 ? (
            <p className="text-sm text-slate-500">No ABDM consent requests found.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {consents.map((c) => (
                <div key={c._id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{c.purpose || 'Care Management'}</p>
                    <p className="text-xs text-slate-500">Requested {formatDateTime(c.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={c.status} />
                    {c.status === 'GRANTED' && (
                      <Button variant="outline" size="sm" onClick={() => setRevokeTarget(c)}>
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <ConfirmationDialog
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        loading={submitting}
        title="Revoke health data consent?"
        description="The requesting provider will no longer be able to fetch records under this consent."
        confirmLabel="Revoke Consent"
      />
    </div>
  );
}
