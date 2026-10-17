import { useEffect, useState } from 'react';
import { History, Search } from 'lucide-react';
import { getActivity, toErrorMessage } from '../../api/client';
import { usePageMeta } from '../../components/layout/DashboardLayout.jsx';
import Button from '../../components/common/Button.jsx';
import {
  Alert,
  EmptyRow,
  FilterBar,
  FilterField,
  LoadingRow,
  PageHeader,
  Panel,
  Pill,
  formatDate,
} from '../../components/admin/ui.jsx';

/** Admin → Activity log: an append-only record of key changes made by staff. */

const CATEGORIES = [
  ['pricing', 'Pricing', 'amber'],
  ['publishing', 'Publishing', 'blue'],
  ['enrolment', 'Enrolment', 'green'],
  ['payment', 'Payment', 'amber'],
  ['learner', 'Learner', 'blue'],
  ['course', 'Course', 'blue'],
  ['task', 'Task', 'blue'],
  ['certificate', 'Certificate', 'green'],
  ['settings', 'Settings', 'gray'],
  ['team', 'Team', 'gray'],
  ['security', 'Security', 'red'],
];
const META = Object.fromEntries(CATEGORIES.map(([value, label, tone]) => [value, { label, tone }]));

export default function AdminActivity() {
  const [filters, setFilters] = useState({ category: '', search: '', from: '', to: '' });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ entries: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  usePageMeta('Activity log', 'Key changes made by the admin team.');

  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((prev) => (prev.search === query.trim() ? prev : { ...prev, search: query.trim() }));
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries({ ...filters, page }).filter(([, v]) => v));
    getActivity(params)
      .then((result) => {
        setData(result);
        setError('');
      })
      .catch((err) => setError(toErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [filters, page]);

  const setFilter = (key) => (event) => {
    setFilters((prev) => ({ ...prev, [key]: event.target.value }));
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={History}
        title="Activity log"
        description="Pricing, publishing, enrolment and payment edits, learner and team changes, settings and security events — who did what, and when."
      />

      <Alert tone="error">{error}</Alert>

      <Panel icon={History} title={`${data.total} ${data.total === 1 ? 'entry' : 'entries'}`} bodyClassName="">
        <FilterBar>
          <FilterField label="Search" className="lg:flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" aria-hidden="true" />
              <input type="search" className="admin-field w-full pl-9" placeholder="What changed, or who changed it" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </FilterField>
          <FilterField label="Category" className="lg:w-48">
            <select className="admin-field" value={filters.category} onChange={setFilter('category')}>
              <option value="">All categories</option>
              {CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="From" className="lg:w-40">
            <input type="date" className="admin-field" value={filters.from} onChange={setFilter('from')} />
          </FilterField>
          <FilterField label="To" className="lg:w-40">
            <input type="date" className="admin-field" value={filters.to} onChange={setFilter('to')} />
          </FilterField>
        </FilterBar>

        {loading && !data.entries.length ? (
          <LoadingRow label="Loading activity…" />
        ) : data.entries.length === 0 ? (
          <EmptyRow icon={History} title="Nothing logged for these filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[48rem]">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Category</th>
                  <th>What happened</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry) => {
                  const meta = META[entry.category] || { label: entry.category, tone: 'gray' };
                  return (
                    <tr key={entry.id}>
                      <td className="whitespace-nowrap text-[13px]">{formatDate(entry.createdAt, true)}</td>
                      <td><Pill tone={meta.tone}>{meta.label}</Pill></td>
                      <td className="text-[13px] text-ink-800">{entry.summary}</td>
                      <td>
                        <p className="text-[13px] font-medium text-ink-900">{entry.actorName}</p>
                        <p className="text-[11.5px] text-ink-400">{entry.actorEmail}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data.pages > 1 && (
          <div className="flex items-center justify-between border-t border-ink-100 px-6 py-3 text-[13px] text-ink-600">
            <span>
              Page {data.page} of {data.pages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Newer
              </Button>
              <Button size="sm" variant="secondary" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                Older
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
