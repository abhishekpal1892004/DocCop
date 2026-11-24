import { Navigate, useLocation } from 'react-router-dom';
import { useAppAuth } from '../../context/AuthContext';
import { getDashboardPathForRole } from '../../lib/constants';
import { Alert, LoadingState } from '../ui';

export function ProtectedRoute({ allowedRoles, children }) {
  const { isLoaded, isSignedIn, user, role, needsOnboarding, loading, error, refreshUser } = useAppAuth();
  const location = useLocation();

  if (!isLoaded || loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <LoadingState rows={3} label="Verifying your session..." />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" state={{ from: location.pathname }} replace />;
  }

  if (needsOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Alert
          variant="error"
          title="Account verification failed"
          action={
            <button
              type="button"
              onClick={refreshUser}
              className="text-xs font-semibold underline cursor-pointer"
            >
              Retry
            </button>
          }
        >
          {error}
        </Alert>
      </div>
    );
  }

  if (user?.accountStatus === 'SUSPENDED' || user?.accountStatus === 'DEACTIVATED') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Alert variant="error" title={`Account ${user.accountStatus.toLowerCase()}`}>
          Your DocCop account is currently {user.accountStatus.toLowerCase()}. Please contact support for assistance.
        </Alert>
      </div>
    );
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to={getDashboardPathForRole(role)} replace />;
  }

  return children;
}
