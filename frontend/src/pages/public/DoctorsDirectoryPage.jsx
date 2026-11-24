import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPin, Search, Star, Stethoscope, Video } from 'lucide-react';
import { apiRequest, buildQuery } from '../../lib/api';
import { formatCurrency } from '../../lib/constants';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Pagination,
  Select,
} from '../../components/ui';

export default function DoctorsDirectoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [specialty, setSpecialty] = useState(searchParams.get('specialty') || '');
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [mode, setMode] = useState(searchParams.get('mode') || '');
  const [page, setPage] = useState(Number(searchParams.get('page') || 1));

  const [doctors, setDoctors] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = buildQuery({
        q: searchParams.get('q') || undefined,
        specialty: searchParams.get('specialty') || undefined,
        city: searchParams.get('city') || undefined,
        consultationMode: searchParams.get('mode') || undefined,
        page: searchParams.get('page') || 1,
        limit: 12,
      });
      const res = await apiRequest(`/doctors${qs}`);
      const list = res.data?.doctors || res.data?.items || res.data || [];
      setDoctors(Array.isArray(list) ? list : []);
      setMeta({
        total: res.data?.total ?? list.length,
        page: res.data?.page ?? 1,
        totalPages: res.data?.totalPages ?? 1,
      });
    } catch (err) {
      setError(err.message || 'Unable to load doctors directory.');
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const applyFilters = (e) => {
    e?.preventDefault();
    const next = {};
    if (q.trim()) next.q = q.trim();
    if (specialty.trim()) next.specialty = specialty.trim();
    if (city.trim()) next.city = city.trim();
    if (mode) next.mode = mode;
    next.page = '1';
    setPage(1);
    setSearchParams(next);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    const next = Object.fromEntries(searchParams.entries());
    next.page = String(newPage);
    setSearchParams(next);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10 lg:py-14 space-y-10">
      <div className="max-w-2xl space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-[#57534E] font-medium">
          Verified Directory
        </p>
        <h1 className="font-editorial text-4xl sm:text-5xl font-normal tracking-[-0.02em] text-[#1C1917]">
          Discover verified practitioners.
        </h1>
        <p className="text-sm sm:text-base text-[#57534E]">
          Filter by specialty, location, or consultation format. Every listed clinician has completed verification.
        </p>
      </div>

      <form
        onSubmit={applyFilters}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end p-5 bg-white border border-[#E6E0D4] rounded-lg"
      >
        <Input
          label="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Doctor name or keyword"
        />
        <Input
          label="Specialty"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          placeholder="e.g. Cardiology"
        />
        <Input
          label="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="e.g. Bengaluru"
        />
        <Select
          label="Availability format"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          placeholder="All formats"
          options={[
            { value: 'IN_PERSON', label: 'In-Person' },
            { value: 'VIDEO', label: 'Video Consultation' },
          ]}
        />
        <Button type="submit" className="w-full">
          <Search className="w-4 h-4" aria-hidden="true" />
          <span>Search</span>
        </Button>
      </form>

      {loading ? (
        <LoadingState rows={4} label="Loading verified doctors..." />
      ) : error ? (
        <ErrorState title="Could not load doctors" message={error} onRetry={fetchDoctors} />
      ) : doctors.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="No doctors match your filters"
          description="Try clearing your search filters or searching a broader specialty or city."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQ('');
                setSpecialty('');
                setCity('');
                setMode('');
                setSearchParams({});
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : (
        <>
          <p className="text-xs uppercase tracking-wider text-[#57534E]">
            Showing {doctors.length} of {meta.total} verified practitioners
          </p>

          <div className="divide-y divide-[#E6E0D4] border-t border-b border-[#E6E0D4] bg-white px-5 rounded-lg">
            {doctors.map((doc) => {
              const name = doc.fullName || doc.user?.fullName || 'Doctor';
              const specs = Array.isArray(doc.specialties)
                ? doc.specialties.join(', ')
                : doc.specialty || 'General Medicine';

              return (
                <article
                  key={doc._id}
                  className="py-6 flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <Avatar name={name} src={doc.profileImage} size="xl" />
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="font-editorial text-2xl sm:text-3xl font-normal text-[#1C1917]">
                          {name}
                        </h2>
                        <Badge status="VERIFIED" />
                      </div>
                      <p className="text-sm font-medium text-[#1B4332]">{specs}</p>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#57534E]">
                        {doc.experienceYears != null && <span>{doc.experienceYears} years experience</span>}
                        {doc.primaryClinic?.city && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                            {doc.primaryClinic.name ? `${doc.primaryClinic.name}, ` : ''}
                            {doc.primaryClinic.city}
                          </span>
                        )}
                        {doc.averageRating != null && (
                          <span className="inline-flex items-center gap-1 text-[#1C1917]">
                            <Star className="w-3.5 h-3.5 text-[#78350F]" aria-hidden="true" />
                            {Number(doc.averageRating).toFixed(1)} ({doc.reviewCount || 0})
                          </span>
                        )}
                        {doc.consultationModes?.includes?.('VIDEO') && (
                          <span className="inline-flex items-center gap-1 text-[#1B4332]">
                            <Video className="w-3.5 h-3.5" aria-hidden="true" />
                            Video available
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#EFEAE0]">
                    <div className="md:text-right">
                      <span className="text-[11px] uppercase tracking-wider text-[#57534E] block">
                        Consultation fee
                      </span>
                      <span className="text-base font-semibold text-[#1C1917]">
                        {doc.consultationFee != null ? formatCurrency(doc.consultationFee) : 'See profile'}
                      </span>
                    </div>
                    <Link to={`/doctors/${doc._id}`}>
                      <Button size="md">View &amp; Book</Button>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          <Pagination page={page} totalPages={meta.totalPages} onPageChange={handlePageChange} />
        </>
      )}
    </div>
  );
}
