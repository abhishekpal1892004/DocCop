import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAppAuth } from '../../context/AuthContext';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Input,
  LoadingState,
  Select,
  useToast,
} from '../../components/ui';

export default function DoctorOnboardingPage() {
  const { apiFetch } = useAppAuth();
  const { addToast } = useToast();

  const [app, setApp] = useState(null);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [registrationCouncil, setRegistrationCouncil] = useState('');
  const [registrationYear, setRegistrationYear] = useState('');
  const [medicalSystem, setMedicalSystem] = useState('ALLOPATHY');
  const [specialties, setSpecialties] = useState('');
  const [consultationFee, setConsultationFee] = useState('500');
  const [clinicName, setClinicName] = useState('');
  const [clinicCity, setClinicCity] = useState('');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadApplication = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/doctor-applications/my');
      const a = res.data?.application || res.data;
      if (a) {
        setApp(a);
        setRegistrationNumber(a.registrationNumber || '');
        setRegistrationCouncil(a.registrationCouncil || '');
        setRegistrationYear(a.registrationYear ? String(a.registrationYear) : '');
        setMedicalSystem(a.medicalSystem || 'ALLOPATHY');
        setSpecialties(Array.isArray(a.specialties) ? a.specialties.join(', ') : '');
        setConsultationFee(a.consultationFee != null ? String(a.consultationFee) : '500');
        setClinicName(a.clinicDetails?.name || '');
        setClinicCity(a.clinicDetails?.city || '');
      }
    } catch (err) {
      if (err.status !== 404) {
        setError(err.message || 'Unable to load doctor application.');
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadApplication();
  }, [loadApplication]);

  const handleSave = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        registrationNumber: registrationNumber.trim(),
        registrationCouncil: registrationCouncil.trim(),
        registrationYear: Number(registrationYear),
        medicalSystem,
        specialties: specialties.split(',').map((s) => s.trim()).filter(Boolean),
        consultationFee: Number(consultationFee),
        clinicDetails: {
          name: clinicName.trim(),
          city: clinicCity.trim(),
        },
      };
      if (app?._id) {
        await apiFetch(`/doctor-applications/${app._id}`, { method: 'PATCH', body: payload });
      } else {
        await apiFetch('/doctor-applications', { method: 'POST', body: payload });
      }
      addToast({ variant: 'success', title: 'Application saved' });
      loadApplication();
    } catch (err) {
      addToast({ variant: 'error', title: 'Save failed', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleNmcCheck = async () => {
    if (!app?._id) return;
    setBusy(true);
    try {
      const res = await apiFetch('/doctor-verification/nmc-check', {
        method: 'POST',
        body: {
          applicationId: app._id,
          registrationNumber: registrationNumber.trim(),
          registrationCouncil: registrationCouncil.trim(),
          registrationYear: Number(registrationYear),
        },
      });
      addToast({
        variant: 'info',
        title: 'NMC Check Complete',
        description: `Status: ${res.data?.matchStatus || res.data?.status || 'Checked'}`,
      });
      loadApplication();
    } catch (err) {
      addToast({ variant: 'error', title: 'NMC verification failed', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitApp = async () => {
    if (!app?._id) return;
    setBusy(true);
    try {
      await apiFetch(`/doctor-applications/${app._id}/submit`, { method: 'POST' });
      addToast({ variant: 'success', title: 'Application submitted for review' });
      loadApplication();
    } catch (err) {
      addToast({ variant: 'error', title: 'Submission failed', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState rows={4} label="Loading doctor application..." />;
  if (error) return <ErrorState title="Application unavailable" message={error} onRetry={loadApplication} />;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Doctor Verification & Onboarding</h1>
          <p className="text-sm text-slate-600 mt-0.5">Submit your medical registration and clinic details for admin approval.</p>
        </div>
        {app?.status && <Badge status={app.status} />}
      </div>

      {app?.adminRemarks && (
        <Alert variant="warning" title="Reviewer Remarks">
          {app.adminRemarks}
        </Alert>
      )}

      <Card>
        <CardHeader title="Registration & Practice Details" />
        <CardBody>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="NMC / Council Registration Number"
                required
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
              />
              <Input
                label="State Medical Council"
                required
                value={registrationCouncil}
                onChange={(e) => setRegistrationCouncil(e.target.value)}
                placeholder="e.g. Karnataka Medical Council"
              />
              <Input
                label="Registration Year"
                type="number"
                required
                value={registrationYear}
                onChange={(e) => setRegistrationYear(e.target.value)}
                placeholder="2018"
              />
              <Select
                label="Medical System"
                value={medicalSystem}
                onChange={(e) => setMedicalSystem(e.target.value)}
                options={[
                  { value: 'ALLOPATHY', label: 'Allopathy (MBBS / MD / MS)' },
                  { value: 'AYURVEDA', label: 'Ayurveda' },
                  { value: 'HOMEOPATHY', label: 'Homeopathy' },
                  { value: 'DENTAL', label: 'Dental' },
                ]}
              />
              <Input
                label="Specialties (comma-separated)"
                required
                value={specialties}
                onChange={(e) => setSpecialties(e.target.value)}
                placeholder="General Medicine, Cardiology"
              />
              <Input
                label="Consultation Fee (INR)"
                type="number"
                required
                value={consultationFee}
                onChange={(e) => setConsultationFee(e.target.value)}
              />
              <Input
                label="Clinic Name"
                required
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
              />
              <Input
                label="Clinic City"
                required
                value={clinicCity}
                onChange={(e) => setClinicCity(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button type="submit" loading={busy}>
                Save Draft
              </Button>
              {app?._id && (
                <>
                  <Button type="button" variant="secondary" onClick={handleNmcCheck} loading={busy}>
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                    <span>Run NMC Check</span>
                  </Button>
                  <Button type="button" variant="outline" onClick={handleSubmitApp} loading={busy}>
                    Submit for Approval
                  </Button>
                </>
              )}
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
