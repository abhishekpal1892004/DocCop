import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, ArrowUpRight, Search } from 'lucide-react';
import { apiRequest, buildQuery } from '../../lib/api';
import { useAppAuth } from '../../context/AuthContext';
import { formatCurrency, getDashboardPathForRole } from '../../lib/constants';
import { Avatar, Badge, Button } from '../../components/ui';

const STEPS = [
  {
    num: '01',
    title: 'Discover your doctor.',
    body: 'Search NMC-verified specialists by clinical discipline, city, and consultation format.',
  },
  {
    num: '02',
    title: 'Explore availability.',
    body: 'View transparent consultation fees, clinic locations, and real-time open slots.',
  },
  {
    num: '03',
    title: 'Book your appointment.',
    body: 'Reserve in-person clinic visits or encrypted video consultations in seconds.',
  },
  {
    num: '04',
    title: 'Stay connected with your care.',
    body: 'Receive reminders, download digital prescriptions, and control your medical records.',
  },
];

const SERVICES = [
  {
    title: 'Online appointments',
    detail: 'Real-time slot scheduling with clear local timezones and instant booking confirmation.',
  },
  {
    title: 'In-person consultations',
    detail: 'Verified clinic addresses, live queue tokens, and coordinated reception check-in.',
  },
  {
    title: 'Digital prescriptions',
    detail: 'Structured medication schedules and signed PDF prescriptions archived to your profile.',
  },
  {
    title: 'Medical records',
    detail: 'Private document vault where you decide exactly which doctor can view each file.',
  },
  {
    title: 'Secure video consultations',
    detail: 'Browser-based teleconsultations powered by short-lived encrypted session tokens.',
  },
  {
    title: 'Appointment reminders',
    detail: 'Timely SMS, WhatsApp, and in-app notifications so follow-ups are never missed.',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { isSignedIn, role, needsOnboarding } = useAppAuth();

  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [city, setCity] = useState('');
  const [mode, setMode] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);

  useEffect(() => {
    let active = true;
    apiRequest(`/doctors${buildQuery({ limit: 4 })}`)
      .then((res) => {
        if (!active) return;
        const list = res.data?.doctors || res.data?.items || res.data || [];
        setDoctors(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (active) setDoctors([]);
      })
      .finally(() => {
        if (active) setLoadingDoctors(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleDiscoverySubmit = (e) => {
    e.preventDefault();
    const qs = buildQuery({
      q: query.trim() || undefined,
      specialty: specialty.trim() || undefined,
      city: city.trim() || undefined,
      mode: mode || undefined,
    });
    navigate(`/doctors${qs}`);
  };

  return (
    <div className="bg-[#FAF7F2] text-[#1C1917]">
      {/* 1. Editorial Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-10 pb-16 lg:pt-16 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-end">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-7 space-y-7"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-[#57534E] font-medium">
              Clinical Discovery &amp; Care Coordination
            </p>
            <h1 className="font-editorial text-5xl sm:text-6xl lg:text-[4.5rem] font-normal leading-[1.04] tracking-[-0.02em] text-[#1C1917]">
              Healthcare, with a more <span className="italic text-[#1B4332]">human</span> touch.
            </h1>
            <p className="text-base sm:text-lg text-[#57534E] leading-relaxed max-w-xl">
              Discover trusted doctors, book appointments and manage your healthcare journey in one thoughtful place.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link to="/doctors">
                <Button size="lg" variant="primary">
                  <span>Find a Doctor</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Button>
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center h-12 px-5 text-sm font-medium text-[#1C1917] border border-[#D6CFC2] rounded-md hover:bg-[#F3EFE6] transition-colors"
              >
                How MediBook Works
              </a>
              {isSignedIn && needsOnboarding && (
                <Link
                  to="/onboarding"
                  className="text-sm font-medium text-[#1B4332] underline underline-offset-4"
                >
                  Complete Account Setup
                </Link>
              )}
              {isSignedIn && !needsOnboarding && role && (
                <Link
                  to={getDashboardPathForRole(role)}
                  className="text-sm font-medium text-[#1B4332] underline underline-offset-4"
                >
                  Open Dashboard
                </Link>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-5"
          >
            <div className="overflow-hidden rounded-md border border-[#E6E0D4] bg-[#F3EFE6]">
              <img
                src="/images/hero-clinic.jpg"
                alt="Doctor listening attentively to a patient inside a sunlit consultation room"
                className="w-full h-[320px] sm:h-[400px] lg:h-[460px] object-cover"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. Doctor Discovery Section */}
      <section id="discover" className="border-t border-[#E6E0D4] bg-white py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-7 space-y-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[#57534E] font-medium">
                Doctor Discovery
              </p>
              <h2 className="font-editorial text-4xl sm:text-5xl font-normal tracking-[-0.02em] text-[#1C1917]">
                Better care starts with the right connection.
              </h2>
            </div>
            <div className="lg:col-span-5 lg:text-right">
              <Link
                to="/doctors"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1B4332] hover:underline underline-offset-4"
              >
                <span>Explore full verified directory</span>
                <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Search & Filters */}
          <form
            onSubmit={handleDiscoverySubmit}
            role="search"
            aria-label="Search doctors"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 p-4 sm:p-5 bg-[#FAF7F2] border border-[#E6E0D4] rounded-md"
          >
            <div className="lg:col-span-4">
              <label htmlFor="home-q" className="sr-only">Doctor name or keyword</label>
              <input
                id="home-q"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Doctor name or keyword"
                className="w-full h-11 px-3.5 bg-white border border-[#D6CFC2] rounded-md text-sm text-[#1C1917] placeholder:text-[#78716C]"
              />
            </div>
            <div className="lg:col-span-3">
              <label htmlFor="home-specialty" className="sr-only">Specialty</label>
              <input
                id="home-specialty"
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="Specialty (e.g. Cardiology)"
                className="w-full h-11 px-3.5 bg-white border border-[#D6CFC2] rounded-md text-sm text-[#1C1917] placeholder:text-[#78716C]"
              />
            </div>
            <div className="lg:col-span-2">
              <label htmlFor="home-city" className="sr-only">City</label>
              <input
                id="home-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="w-full h-11 px-3.5 bg-white border border-[#D6CFC2] rounded-md text-sm text-[#1C1917] placeholder:text-[#78716C]"
              />
            </div>
            <div className="lg:col-span-2">
              <label htmlFor="home-mode" className="sr-only">Availability mode</label>
              <select
                id="home-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-[#D6CFC2] rounded-md text-sm text-[#1C1917]"
              >
                <option value="">All formats</option>
                <option value="IN_PERSON">In-person</option>
                <option value="VIDEO">Video consult</option>
              </select>
            </div>
            <div className="lg:col-span-1">
              <Button type="submit" className="w-full h-11 px-0" aria-label="Search doctors">
                <Search className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          </form>

          {/* Real Doctor Previews */}
          {loadingDoctors ? (
            <p className="text-sm text-[#57534E]">Loading verified practitioners...</p>
          ) : doctors.length === 0 ? (
            <div className="py-10 border-t border-b border-[#E6E0D4] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-sm text-[#57534E]">
                Verified doctor profiles appear here automatically once approved by administration.
              </p>
              <Link to="/doctors">
                <Button variant="outline" size="sm">Open Directory</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#E6E0D4] border-t border-b border-[#E6E0D4]">
              {doctors.map((doc) => {
                const name = doc.fullName || doc.user?.fullName || 'Doctor';
                const specs = Array.isArray(doc.specialties)
                  ? doc.specialties.join(', ')
                  : doc.specialty || 'Specialist';
                return (
                  <div
                    key={doc._id}
                    className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <Avatar name={name} src={doc.profileImage} size="lg" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="font-editorial text-2xl font-medium text-[#1C1917]">{name}</h3>
                          <Badge status="VERIFIED" />
                        </div>
                        <p className="text-sm text-[#57534E]">
                          {specs}
                          {doc.primaryClinic?.city ? ` — ${doc.primaryClinic.city}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      {doc.consultationFee != null && (
                        <span className="text-sm font-medium text-[#1C1917]">
                          {formatCurrency(doc.consultationFee)}
                        </span>
                      )}
                      <Link to={`/doctors/${doc._id}`}>
                        <Button variant="outline" size="sm">
                          View Profile
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 3. How MediBook Works */}
      <section id="how-it-works" className="border-t border-[#E6E0D4] bg-[#FAF7F2] py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            <p className="text-xs uppercase tracking-[0.18em] text-[#57534E] font-medium">
              The Process
            </p>
            <h2 className="font-editorial text-4xl sm:text-5xl font-normal tracking-[-0.02em] text-[#1C1917]">
              Thoughtful care, step by step.
            </h2>
            <div className="overflow-hidden rounded-md border border-[#E6E0D4] bg-[#F3EFE6]">
              <img
                src="/images/editorial-space.jpg"
                alt="Quiet contemporary clinic lounge with warm limestone walls and natural morning light"
                loading="lazy"
                className="w-full h-72 sm:h-80 object-cover"
              />
            </div>
          </div>

          <div className="lg:col-span-7 divide-y divide-[#E6E0D4] border-t border-b border-[#E6E0D4]">
            {STEPS.map((step) => (
              <div key={step.num} className="py-7 grid grid-cols-1 sm:grid-cols-12 gap-3 items-baseline">
                <span className="sm:col-span-2 font-editorial text-2xl text-[#1B4332]">{step.num}</span>
                <div className="sm:col-span-10 space-y-1.5">
                  <h3 className="font-editorial text-2xl sm:text-3xl font-normal text-[#1C1917]">
                    {step.title}
                  </h3>
                  <p className="text-sm sm:text-base text-[#57534E] leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Healthcare Services */}
      <section id="about" className="border-t border-[#E6E0D4] bg-[#F3EFE6] py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 space-y-12">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[#57534E] font-medium">
              Capabilities
            </p>
            <h2 className="font-editorial text-4xl sm:text-5xl font-normal tracking-[-0.02em] text-[#1C1917]">
              Designed around continuity of care.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 border-t border-[#D6CFC2] pt-8">
            {SERVICES.map((svc) => (
              <div key={svc.title} className="space-y-1.5 pb-6 border-b border-[#D6CFC2]/70">
                <h3 className="text-base font-semibold text-[#1C1917]">{svc.title}</h3>
                <p className="text-sm text-[#57534E] leading-relaxed">{svc.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Closing CTA */}
      <section className="bg-[#1C1917] text-[#FAF7F2] py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-7">
          <h2 className="font-editorial text-4xl sm:text-6xl font-normal leading-tight tracking-[-0.02em]">
            Your health deserves a better experience.
          </h2>
          <div>
            <Link to={isSignedIn ? (role ? getDashboardPathForRole(role) : '/onboarding') : '/sign-up'}>
              <button
                type="button"
                className="inline-flex items-center gap-2.5 h-12 px-7 rounded-md bg-[#FAF7F2] text-[#1C1917] text-sm font-medium hover:bg-[#EFEAE0] transition-colors cursor-pointer"
              >
                <span>Start Your Journey</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
