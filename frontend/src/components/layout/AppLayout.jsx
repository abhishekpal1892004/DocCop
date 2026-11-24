import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Show, UserButton } from '@clerk/react';
import {
  Activity,
  Bell,
  Building2,
  Calendar,
  ClipboardList,
  CreditCard,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useAppAuth } from '../../context/AuthContext';
import { ROLES, ROLE_LABELS, getDashboardPathForRole } from '../../lib/constants';
import { Button } from '../ui';

const NAV_BY_ROLE = {
  [ROLES.PATIENT]: [
    { to: '/patient/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/doctors', label: 'Find Doctors', icon: Stethoscope },
    { to: '/patient/appointments', label: 'Appointments', icon: Calendar },
    { to: '/patient/records', label: 'Medical Records', icon: FileText },
    { to: '/patient/prescriptions', label: 'Prescriptions', icon: ClipboardList },
    { to: '/patient/payments', label: 'Payments', icon: CreditCard },
    { to: '/patient/abdm', label: 'ABHA & Consent', icon: ShieldCheck },
    { to: '/patient/notifications', label: 'Notifications', icon: Bell },
    { to: '/patient/profile', label: 'Profile & Settings', icon: UserCog },
    { to: '/support', label: 'Support', icon: HelpCircle },
  ],
  [ROLES.DOCTOR]: [
    { to: '/doctor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/doctor/appointments', label: 'Appointments', icon: Calendar },
    { to: '/doctor/queue', label: 'Live Queue', icon: Users },
    { to: '/doctor/prescriptions', label: 'Prescriptions', icon: ClipboardList },
    { to: '/doctor/practice', label: 'Practice & Types', icon: Stethoscope },
    { to: '/doctor/onboarding', label: 'Verification & Onboarding', icon: UserCheck },
    { to: '/doctor/profile', label: 'Profile & Calendly', icon: UserCog },
    { to: '/support', label: 'Support', icon: HelpCircle },
  ],
  [ROLES.ADMIN]: [
    { to: '/admin/dashboard', label: 'Admin Overview', icon: LayoutDashboard },
    { to: '/admin/applications', label: 'Doctor Applications', icon: UserCheck },
    { to: '/admin/doctors', label: 'Doctors Directory', icon: Stethoscope },
    { to: '/admin/clinics', label: 'Clinics', icon: Building2 },
    { to: '/admin/reviews', label: 'Reviews Moderation', icon: ClipboardList },
    { to: '/admin/support', label: 'Support Tickets', icon: HelpCircle },
    { to: '/admin/abdm', label: 'ABDM Status', icon: ShieldCheck },
    { to: '/admin/audit-logs', label: 'Audit Logs', icon: FileText },
    { to: '/admin/system-health', label: 'System Health', icon: Activity },
  ],
  [ROLES.CLINIC_MANAGER]: [
    { to: '/clinic/dashboard', label: 'Clinic Dashboard', icon: LayoutDashboard },
    { to: '/clinic/staff', label: 'Staff Management', icon: Users },
    { to: '/support', label: 'Support', icon: HelpCircle },
  ],
  [ROLES.RECEPTIONIST]: [
    { to: '/clinic/dashboard', label: 'Clinic Desk', icon: LayoutDashboard },
    { to: '/support', label: 'Support', icon: HelpCircle },
  ],
};

const PORTAL_PREFIXES = ['/patient', '/doctor', '/admin', '/clinic', '/support', '/consultation'];

export function AppLayout() {
  const { isSignedIn, role, needsOnboarding } = useAppAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);

  const roleNav = role ? NAV_BY_ROLE[role] || [] : [];
  const isPortalRoute = PORTAL_PREFIXES.some((p) => location.pathname.startsWith(p));
  const showSidebar = isSignedIn && roleNav.length > 0 && isPortalRoute;

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F5F0] text-[#171916]">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="sticky top-0 z-40 bg-[#F7F5F0]/95 backdrop-blur-xs border-b border-[#D9D5CA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              className="lg:hidden p-2 rounded-sm text-[#171916] hover:bg-[#EFECE4] transition-colors"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
            <Link
              to="/"
              className="font-editorial text-2xl sm:text-[1.75rem] font-semibold tracking-tight text-[#171916] focus-visible:outline-none"
            >
              DocCop
            </Link>
          </div>

          <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-8 text-[13px] tracking-wide text-[#444640]">
            <NavLink
              to="/doctors"
              className={({ isActive }) =>
                `transition-colors hover:text-[#183F32] ${isActive ? 'text-[#183F32] font-medium underline underline-offset-8' : ''}`
              }
            >
              Discover Doctors
            </NavLink>
            <Link to="/#how-it-works" className="hover:text-[#183F32] transition-colors">
              How It Works
            </Link>
            <Link to="/onboarding" className="hover:text-[#183F32] transition-colors">
              For Doctors
            </Link>
            <Link to="/#about" className="hover:text-[#183F32] transition-colors">
              About
            </Link>
            <Show when="signed-in">
              {needsOnboarding ? (
                <Link to="/onboarding" className="font-medium text-[#183F32] hover:underline underline-offset-4">
                  Complete Setup
                </Link>
              ) : (
                role && (
                  <Link
                    to={getDashboardPathForRole(role)}
                    className="font-medium text-[#183F32] hover:underline underline-offset-4"
                  >
                    {ROLE_LABELS[role] || 'Dashboard'}
                  </Link>
                )
              )}
            </Show>
          </nav>

          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <Link to="/sign-in" className="hidden sm:inline-block text-[13px] text-[#444640] hover:text-[#171916] px-2 py-1">
                Sign In
              </Link>
              <Link to="/doctors">
                <Button variant="primary" size="sm">
                  Book an Appointment
                </Button>
              </Link>
            </Show>
            <Show when="signed-in">
              {role && (
                <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-sm font-mono-label text-[10px] tracking-[0.14em] uppercase bg-white text-[#183F32] border border-[#D9D5CA]">
                  {ROLE_LABELS[role]}
                </span>
              )}
              <UserButton afterSignOutUrl="/" />
            </Show>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-[#171916]/45"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <aside
            aria-label="Mobile navigation"
            className="w-76 max-w-[85vw] h-full bg-[#F7F5F0] border-r border-[#D9D5CA] flex flex-col"
          >
            <div className="h-16 px-5 border-b border-[#D9D5CA] flex items-center justify-between">
              <span className="font-editorial text-xl font-semibold text-[#171916]">DocCop</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 rounded-sm text-[#777C68] hover:bg-[#EFECE4]"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <nav className="p-4 space-y-1 overflow-y-auto flex-1 text-sm">
              <Link to="/doctors" className="block px-3 py-2.5 rounded-sm text-[#171916] hover:bg-[#EFECE4]">
                Discover Doctors
              </Link>
              <Link to="/#how-it-works" className="block px-3 py-2.5 rounded-sm text-[#171916] hover:bg-[#EFECE4]">
                How It Works
              </Link>
              <Link to="/onboarding" className="block px-3 py-2.5 rounded-sm text-[#171916] hover:bg-[#EFECE4]">
                For Doctors
              </Link>
              <Link to="/#about" className="block px-3 py-2.5 rounded-sm text-[#171916] hover:bg-[#EFECE4]">
                About
              </Link>
              <Show when="signed-out">
                <Link to="/sign-in" className="block px-3 py-2.5 rounded-sm font-medium text-[#183F32] hover:bg-[#EFECE4]">
                  Sign In
                </Link>
              </Show>

              {showSidebar && (
                <div className="pt-4 mt-4 border-t border-[#D9D5CA] space-y-1">
                  <p className="px-3 pb-1 font-mono-label text-[10px] uppercase tracking-[0.18em] text-[#777C68]">
                    Workspace
                  </p>
                  {roleNav.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors ${
                            isActive ? 'bg-[#183F32] text-[#F7F5F0]' : 'text-[#444640] hover:bg-[#EFECE4]'
                          }`
                        }
                      >
                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </nav>
          </aside>
        </div>
      )}

      <div className="flex-1 w-full flex">
        {showSidebar && (
          <aside
            aria-label="Portal navigation"
            className="hidden lg:block w-64 shrink-0 border-r border-[#D9D5CA] bg-white/70 p-5"
          >
            <p className="px-3 pb-3 font-mono-label text-[10px] uppercase tracking-[0.18em] text-[#777C68]">
              {ROLE_LABELS[role] || 'Portal'}
            </p>
            <nav className="space-y-1 sticky top-24">
              {roleNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-[#183F32] text-[#F7F5F0]'
                          : 'text-[#444640] hover:bg-[#EFECE4]'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </aside>
        )}

        <main
          id="main-content"
          className={`flex-1 min-w-0 ${isPortalRoute ? 'max-w-6xl mx-auto p-4 sm:p-6 lg:p-10' : ''}`}
        >
          <Outlet />
        </main>
      </div>

      <footer className="border-t border-[#D9D5CA] bg-[#F7F5F0] py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
          <div className="md:col-span-6 space-y-2">
            <span className="font-editorial text-2xl font-semibold text-[#171916]">DocCop</span>
            <p className="text-xs text-[#777C68] max-w-sm leading-relaxed">
              Private healthcare discovery, verified clinical appointments, and patient-controlled medical records.
            </p>
          </div>
          <div className="md:col-span-6 flex flex-wrap md:justify-end items-center gap-6 text-xs text-[#444640]">
            <Link to="/doctors" className="hover:text-[#183F32] transition-colors">
              Discover Doctors
            </Link>
            <Link to="/#how-it-works" className="hover:text-[#183F32] transition-colors">
              How It Works
            </Link>
            <Link to="/onboarding" className="hover:text-[#183F32] transition-colors">
              For Doctors
            </Link>
            <Link to="/support" className="hover:text-[#183F32] transition-colors">
              Support
            </Link>
            <span className="font-mono-label text-[10px] text-[#777C68]">© {new Date().getFullYear()} DOCCOP</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
