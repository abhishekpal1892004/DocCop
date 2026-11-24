import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Download } from 'lucide-react';
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
  LoadingState,
  useToast,
} from '../../components/ui';

export default function PatientPrescriptionsPage() {
  const { apiFetch } = useAppAuth();
  const { addToast } = useToast();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPrescriptions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/prescriptions/my');
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

  const handleDownloadPdf = async (rx) => {
    try {
      const blob = await apiFetch(`/prescriptions/${rx._id}/pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prescription-${rx._id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      addToast({ variant: 'error', title: 'PDF download failed', description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Digital Prescriptions</h1>
        <p className="text-sm text-slate-600 mt-0.5">Review issued medications, dosage instructions, and download PDFs.</p>
      </div>

      {loading ? (
        <LoadingState rows={3} label="Loading prescriptions..." />
      ) : error ? (
        <ErrorState title="Could not load prescriptions" message={error} onRetry={loadPrescriptions} />
      ) : prescriptions.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No prescriptions yet"
          description="Prescriptions issued after your consultations will appear here."
        />
      ) : (
        <div className="space-y-4">
          {prescriptions.map((rx) => (
            <Card key={rx._id}>
              <CardHeader
                title={rx.diagnosis || 'Consultation Prescription'}
                description={`Issued ${formatDate(rx.issuedAt || rx.createdAt)} • Dr. ${rx.doctor?.fullName || 'Physician'}`}
                action={<Badge status={rx.status || 'ISSUED'} />}
              />
              <CardBody className="space-y-4">
                {Array.isArray(rx.medications) && rx.medications.length > 0 && (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                    {rx.medications.map((med, idx) => (
                      <div key={idx} className="p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div>
                          <p className="font-semibold text-slate-900">{med.name}</p>
                          <p className="text-xs text-slate-600">
                            {med.dosage} • {med.frequency} • {med.duration}
                          </p>
                        </div>
                        {med.instructions && <span className="text-xs text-slate-500">{med.instructions}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {rx.notes && <p className="text-sm text-slate-600">Notes: {rx.notes}</p>}

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(rx)}>
                    <Download className="w-4 h-4" aria-hidden="true" />
                    <span>Download PDF</span>
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
