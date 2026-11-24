import { useCallback, useEffect, useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  LoadingState,
  Select,
  useToast,
} from '../../components/ui';

export default function PatientProfilePage() {
  const { user, apiFetch, refreshUser } = useAppAuth();
  const { addToast } = useToast();

  const [hasProfile, setHasProfile] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/patients/me');
      const p = res.data?.patient || res.data;
      if (p) {
        setHasProfile(true);
        setDateOfBirth(p.dateOfBirth ? String(p.dateOfBirth).slice(0, 10) : '');
        setGender(p.gender || '');
        setBloodGroup(p.bloodGroup || '');
        setCity(p.address?.city || p.city || '');
      }
    } catch (err) {
      if (err.status === 404) {
        setHasProfile(false);
      } else {
        setError(err.message || 'Unable to load patient profile.');
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiFetch('/users/me', {
        method: 'PATCH',
        body: {
          fullName: fullName.trim(),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        },
      });

      const profilePayload = {
        ...(dateOfBirth ? { dateOfBirth } : {}),
        ...(gender ? { gender } : {}),
        ...(bloodGroup ? { bloodGroup } : {}),
        ...(city.trim() ? { address: { city: city.trim() } } : {}),
      };

      if (hasProfile) {
        await apiFetch('/patients/me', { method: 'PATCH', body: profilePayload });
      } else {
        await apiFetch('/patients/profile', { method: 'POST', body: profilePayload });
        setHasProfile(true);
      }

      await refreshUser();
      addToast({ variant: 'success', title: 'Profile saved' });
    } catch (err) {
      setError(err.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState rows={3} label="Loading profile..." />;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Patient Profile & Settings</h1>
        <p className="text-sm text-slate-600 mt-0.5">Keep your personal and medical demographics accurate.</p>
      </div>

      <Card>
        <CardHeader title="Personal Details" />
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <Alert variant="error">{error}</Alert>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <Input
                label="Phone number"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+919876543210"
              />
              <Input
                label="Date of birth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
              <Select
                label="Gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                placeholder="Select gender"
                options={[
                  { value: 'MALE', label: 'Male' },
                  { value: 'FEMALE', label: 'Female' },
                  { value: 'OTHER', label: 'Other' },
                ]}
              />
              <Select
                label="Blood group"
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                placeholder="Select blood group"
                options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => ({
                  value: b,
                  label: b,
                }))}
              />
              <Input
                label="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Mumbai"
              />
            </div>

            <div className="pt-2">
              <Button type="submit" loading={saving}>
                Save Changes
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
