import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { SignIn, SignUp } from '@clerk/react';
import { Stethoscope, User } from 'lucide-react';
import { useAppAuth } from '../../context/AuthContext';
import { getDashboardPathForRole, ROLES } from '../../lib/constants';
import { Alert, Button, Card, CardBody, CardHeader, Input, useToast } from '../../components/ui';

export function SignInPage() {
  return (
    <div className="flex justify-center py-6">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/onboarding" />
    </div>
  );
}

export function SignUpPage() {
  return (
    <div className="flex justify-center py-6">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/onboarding" />
    </div>
  );
}

export function OnboardingPage() {
  const { isSignedIn, needsOnboarding, role, clerkUser, apiFetch, refreshUser } = useAppAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [accountType, setAccountType] = useState(ROLES.PATIENT);
  const [fullName, setFullName] = useState(
    clerkUser?.fullName || [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') || ''
  );
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  if (!needsOnboarding && role) {
    return <Navigate to={getDashboardPathForRole(role)} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    setSubmitting(true);
    try {
      await apiFetch('/users/onboard', {
        method: 'POST',
        body: { accountType },
      });

      const trimmedName = fullName.trim();
      const [firstName, ...restName] = trimmedName ? trimmedName.split(/\s+/) : [];
      const lastName = restName.join(' ');
      if (firstName || phone.trim()) {
        await apiFetch('/users/me', {
          method: 'PATCH',
          body: {
            ...(firstName ? { firstName } : {}),
            ...(lastName ? { lastName } : {}),
            ...(phone.trim() ? { phoneNumber: phone.trim() } : {}),
          },
        }).catch(() => {});
      }

      await refreshUser();
      addToast({
        variant: 'success',
        title: 'Account initialized',
        description:
          accountType === ROLES.DOCTOR
            ? 'Complete your medical verification application next.'
            : 'Welcome to DocCop!',
      });
      navigate(accountType === ROLES.DOCTOR ? '/doctor/onboarding' : '/patient/profile');
    } catch (err) {
      setError(err.message || 'Unable to complete onboarding.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-4">
      <Card>
        <CardHeader
          title="Complete your DocCop setup"
          description="Select how you will use DocCop. This determines your workspace and permissions."
        />
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <Alert variant="error">{error}</Alert>}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-800">Account type</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAccountType(ROLES.PATIENT)}
                  aria-pressed={accountType === ROLES.PATIENT}
                  className={`p-4 rounded-md border text-left transition-colors cursor-pointer ${
                    accountType === ROLES.PATIENT
                      ? 'border-[#1B4332] bg-[#F3EFE6] ring-1 ring-[#1B4332]'
                      : 'border-[#D6CFC2] bg-white hover:bg-[#FAF7F2]'
                  }`}
                >
                  <User className="w-5 h-5 text-[#1B4332] mb-2" aria-hidden="true" />
                  <p className="font-semibold text-sm text-[#1C1917]">Patient</p>
                  <p className="text-xs text-[#57534E] mt-0.5">Book appointments, view prescriptions &amp; records</p>
                </button>

                <button
                  type="button"
                  onClick={() => setAccountType(ROLES.DOCTOR)}
                  aria-pressed={accountType === ROLES.DOCTOR}
                  className={`p-4 rounded-md border text-left transition-colors cursor-pointer ${
                    accountType === ROLES.DOCTOR
                      ? 'border-[#1B4332] bg-[#F3EFE6] ring-1 ring-[#1B4332]'
                      : 'border-[#D6CFC2] bg-white hover:bg-[#FAF7F2]'
                  }`}
                >
                  <Stethoscope className="w-5 h-5 text-[#1B4332] mb-2" aria-hidden="true" />
                  <p className="font-semibold text-sm text-[#1C1917]">Doctor</p>
                  <p className="text-xs text-[#57534E] mt-0.5">Verify credentials, manage slots &amp; consultations</p>
                </button>
              </div>
            </fieldset>

            <Input
              label="Full name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Dr. Priya Sharma / Aarav Patel"
            />

            <Input
              label="Phone number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919876543210"
              hint="Optional — used for appointment SMS/WhatsApp reminders"
            />

            <Button type="submit" loading={submitting} className="w-full">
              Continue to MediBook
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
