import { useCallback, useEffect, useState } from 'react';
import { Download, FileText, Share2, Trash2, Upload } from 'lucide-react';
import { useAppAuth } from '../../context/AuthContext';
import { formatDate } from '../../lib/constants';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  Select,
  useToast,
} from '../../components/ui';

export default function PatientRecordsPage() {
  const { apiFetch } = useAppAuth();
  const { addToast } = useToast();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('LAB_REPORT');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [shareTarget, setShareTarget] = useState(null);
  const [doctorId, setDoctorId] = useState('');
  const [archiveTarget, setArchiveTarget] = useState(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/medical-records/my');
      setRecords(res.data?.records || res.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load medical records.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      addToast({ variant: 'error', title: 'Select a file to upload' });
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title.trim() || file.name);
      formData.append('category', category);

      await apiFetch('/medical-records', {
        method: 'POST',
        body: formData,
        isFormData: true,
      });
      addToast({ variant: 'success', title: 'Medical record uploaded' });
      setUploadOpen(false);
      setTitle('');
      setFile(null);
      loadRecords();
    } catch (err) {
      addToast({ variant: 'error', title: 'Upload failed', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (rec) => {
    try {
      const blob = await apiFetch(`/medical-records/${rec._id}/download`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = rec.originalFileName || `${rec.title || 'record'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      addToast({ variant: 'error', title: 'Download failed', description: err.message });
    }
  };

  const handleShare = async (e) => {
    e.preventDefault();
    if (!shareTarget || !doctorId.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch(`/medical-records/${shareTarget._id}/share`, {
        method: 'POST',
        body: { doctorId: doctorId.trim() },
      });
      addToast({ variant: 'success', title: 'Record shared with doctor' });
      setShareTarget(null);
      setDoctorId('');
      loadRecords();
    } catch (err) {
      addToast({ variant: 'error', title: 'Share failed', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    setSubmitting(true);
    try {
      await apiFetch(`/medical-records/${archiveTarget._id}`, { method: 'DELETE' });
      addToast({ variant: 'success', title: 'Medical record archived' });
      setArchiveTarget(null);
      loadRecords();
    } catch (err) {
      addToast({ variant: 'error', title: 'Archive failed', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Medical Records</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Private, encrypted health documents. Only you and doctors you explicitly authorize can view them.
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="w-4 h-4" aria-hidden="true" />
          <span>Upload Record</span>
        </Button>
      </div>

      {loading ? (
        <LoadingState rows={3} label="Loading medical records..." />
      ) : error ? (
        <ErrorState title="Could not load records" message={error} onRetry={loadRecords} />
      ) : records.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No medical records uploaded"
          description="Upload lab reports, scans, or discharge summaries to keep them organized and shareable."
          action={
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              Upload First Record
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {records.map((rec) => (
            <Card key={rec._id}>
              <CardHeader
                title={rec.title || 'Medical Document'}
                description={`Uploaded ${formatDate(rec.createdAt)}`}
                action={<Badge tone="info">{rec.category || 'DOCUMENT'}</Badge>}
              />
              <CardBody className="flex flex-wrap items-center gap-2 pt-3">
                <Button variant="outline" size="sm" onClick={() => handleDownload(rec)}>
                  <Download className="w-4 h-4" aria-hidden="true" />
                  <span>Download</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShareTarget(rec)}>
                  <Share2 className="w-4 h-4" aria-hidden="true" />
                  <span>Share</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setArchiveTarget(rec)}>
                  <Trash2 className="w-4 h-4 text-red-600" aria-hidden="true" />
                  <span className="text-red-700">Archive</span>
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Medical Record">
        <form onSubmit={handleUpload} className="space-y-4">
          <Input
            label="Document title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Complete Blood Count - Nov 2026"
          />
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={[
              { value: 'LAB_REPORT', label: 'Lab Report' },
              { value: 'PRESCRIPTION', label: 'External Prescription' },
              { value: 'IMAGING', label: 'Imaging / Scan' },
              { value: 'DISCHARGE_SUMMARY', label: 'Discharge Summary' },
              { value: 'OTHER', label: 'Other' },
            ]}
          />
          <div className="space-y-1.5">
            <label htmlFor="record-file" className="block text-sm font-medium text-slate-800">
              File (PDF or Image, max 10 MB)
            </label>
            <input
              id="record-file"
              type="file"
              required
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-800 hover:file:bg-teal-100"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Upload
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(shareTarget)} onClose={() => setShareTarget(null)} title="Share Record with Doctor">
        <form onSubmit={handleShare} className="space-y-4">
          <Input
            label="Doctor ID"
            required
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            placeholder="Paste Doctor ID"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShareTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Grant Access
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmationDialog
        open={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        loading={submitting}
        title="Archive medical record?"
        description="Archived records are removed from your active list."
        confirmLabel="Archive"
      />
    </div>
  );
}
