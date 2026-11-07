import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, PhoneCall, RefreshCw, Search } from 'lucide-react';
import { getEnquiries, resyncAllEnquiries, resyncEnquiry, toErrorMessage } from '../../api/client';
import { usePageMeta } from '../../components/layout/DashboardLayout.jsx';
import Button from '../../components/common/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Alert,
  EmptyRow,
  FilterBar,
  FilterField,
  LoadingRow,
  PageHeader,
  Panel,
  Pill,
  StatTile,
  formatDate,
  useFlash,
} from '../../components/admin/ui.jsx';

/**
 * Admin → Enquiries: responses to the homepage "Enroll Now" form.
 *
 * Every response is saved here and copied to the Google Sheet set in
 * LMS settings → Google Sheet. The Sheet column shows whether that copy
 * worked; a failed one can be retried once the sheet problem is fixed.
 */

const SHEET_STATUS = {
  synced: { label: 'In sheet', tone: 'green' },
  pending: { label: 'Sending…', tone: 'blue' },
  failed: { label: 'Not in sheet', tone: 'red' },
  skipped: { label: 'Sync off', tone: 'gray' },
};

export default function AdminEnquiries() {
  const flash = useFlash();
  const { isSuperAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState(params.get('search') || '');
  const [busy, setBusy] = useState('');

  usePageMeta('Enquiries', 'Enroll Now form responses.');

  const filters = {
    search: params.get('search') || '',
    sheet: params.get('sheet') || '',
    from: params.get('from') || '',
    to: params.get('to') || '',
  };

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const load = () =>
    getEnquiries(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)))
      .then((result) => {
        setData(result);
        setError('');
      })
      .catch((err) => setError(toErrorMessage(err)));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the URL params are the dependency
  }, [params]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (query.trim() !== filters.search) setFilter('search', query.trim());
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text drives this
  }, [query]);

  const retry = async (enquiry) => {
    setBusy(enquiry._id);
    try {
      await resyncEnquiry(enquiry._id);
      flash.success(`${enquiry.name}'s enquiry is now in the sheet.`);
    } catch (err) {
      flash.error(toErrorMessage(err));
    } finally {
      setBusy('');
      load();
    }
  };

  const retryAll = async () => {
    setBusy('all');
    try {
      const result = await resyncAllEnquiries();
      flash.success(result.synced ? `${result.synced} enquir${result.synced === 1 ? 'y' : 'ies'} copied to the sheet.` : 'Nothing was waiting to be copied.');
    } catch (err) {
      flash.error(toErrorMessage(err));
    } finally {
      setBusy('');
      load();
    }
  };

  const summary = data?.summary;
  const enquiries = data?.enquiries || [];
  const notInSheet = summary ? summary.byStatus.failed + summary.byStatus.pending + summary.byStatus.skipped : 0;
  const filtered = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PhoneCall}
        title="Enroll Now enquiries"
        description="Responses to the homepage Enroll Now form. Each one is saved here and copied to the team's Google Sheet."
        actions={
          <>
            {isSuperAdmin && (
              <Button to="/admin/settings?tab=integrations" size="sm" variant="secondary">
                Google Sheet settings
              </Button>
            )}
            {notInSheet > 0 && (
              <Button size="sm" loading={busy === 'all'} onClick={retryAll}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Copy {notInSheet} to sheet
              </Button>
            )}
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Total enquiries" value={summary?.total ?? '—'} />
        <StatTile label="In the Google Sheet" value={summary?.byStatus.synced ?? '—'} />
        <StatTile label="Not in the sheet yet" value={summary ? notInSheet : '—'} tone={notInSheet ? 'amber' : undefined} />
      </section>

      {flash.node}
      <Alert tone="error">{error}</Alert>

      <Panel title="Responses" bodyClassName="">
        <FilterBar>
          <FilterField label="Search" className="lg:flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" aria-hidden="true" />
              <input
                type="search"
                className="admin-field w-full pl-9"
                placeholder="Name, email, phone, program or city"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </FilterField>
          <FilterField label="Google Sheet" className="lg:w-44">
            <select className="admin-field" value={filters.sheet} onChange={(e) => setFilter('sheet', e.target.value)}>
              <option value="">Any</option>
              <option value="synced">In sheet</option>
              <option value="failed">Not in sheet</option>
              <option value="skipped">Sync off</option>
            </select>
          </FilterField>
          <FilterField label="From" className="lg:w-40">
            <input type="date" className="admin-field" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
          </FilterField>
          <FilterField label="To" className="lg:w-40">
            <input type="date" className="admin-field" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
          </FilterField>
        </FilterBar>

        {!data ? (
          <LoadingRow label="Loading enquiries…" />
        ) : enquiries.length === 0 ? (
          <EmptyRow
            icon={PhoneCall}
            title={filtered ? 'No enquiries match these filters' : 'No enquiries yet'}
            description={filtered ? 'Try clearing a filter.' : 'They appear here as soon as someone submits the Enroll Now form on the homepage.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[60rem]">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Program</th>
                  <th>Message</th>
                  <th>Google Sheet</th>
                </tr>
              </thead>
              <tbody>
                {enquiries.map((enquiry) => {
                  const status = SHEET_STATUS[enquiry.sheetStatus] || SHEET_STATUS.pending;
                  return (
                    <tr key={enquiry._id}>
                      <td className="whitespace-nowrap text-[13px]">{formatDate(enquiry.createdAt, true)}</td>
                      <td>
                        <p className="font-semibold text-ink-900">{enquiry.name}</p>
                        {enquiry.city && <p className="text-[12px] text-ink-500">{enquiry.city}</p>}
                      </td>
                      <td>
                        <a href={`tel:${enquiry.phone}`} className="block text-[13px] text-ink-800 hover:text-primary-700">{enquiry.phone}</a>
                        <a href={`mailto:${enquiry.email}`} className="block text-[12px] text-ink-500 hover:text-primary-700">{enquiry.email}</a>
                      </td>
                      <td className="text-[13px]">{enquiry.program || '—'}</td>
                      <td className="max-w-xs text-[12.5px] text-ink-600">
                        <span className="line-clamp-2" title={enquiry.message}>{enquiry.message || '—'}</span>
                      </td>
                      <td>
                        <div className="flex flex-col items-start gap-1">
                          <Pill tone={status.tone}>{status.label}</Pill>
                          {enquiry.sheetStatus !== 'synced' && (
                            <>
                              {enquiry.sheetError && (
                                <span className="max-w-[16rem] text-[11px] leading-snug text-ink-500">{enquiry.sheetError}</span>
                              )}
                              <button
                                type="button"
                                onClick={() => retry(enquiry)}
                                disabled={busy === enquiry._id}
                                className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary-700 hover:text-primary-800 disabled:opacity-50"
                              >
                                <RefreshCw className={`h-3 w-3 ${busy === enquiry._id ? 'animate-spin' : ''}`} aria-hidden="true" /> Retry
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="flex items-center gap-1.5 text-[12px] text-ink-500">
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        The sheet keeps every row ever copied; deleting a row there does not delete the enquiry here.
      </p>
    </div>
  );
}
