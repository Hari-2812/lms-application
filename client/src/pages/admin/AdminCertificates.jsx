import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Award, Download, Eye, FileBadge, Search, X } from 'lucide-react';
import { getAdminCertificates, getCourses, toErrorMessage } from '../../api/client';
import { usePageMeta } from '../../components/layout/DashboardLayout.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import CertificateFace from '../../components/certificates/CertificateFace.jsx';
import usePrintCertificate from '../../hooks/usePrintCertificate.js';
import { useBranding } from '../../context/BrandingContext.jsx';
import {
  Alert,
  EmptyRow,
  FilterBar,
  FilterField,
  LoadingRow,
  PageHeader,
  Panel,
  StatTile,
  formatDate,
} from '../../components/admin/ui.jsx';

/**
 * Admin → Certificates: the one standard certificate template with a live
 * sample preview, and the register of every certificate issued, each of
 * which can be viewed and downloaded (print → Save as PDF).
 */

export default function AdminCertificates() {
  const { learning } = useBranding();
  const { print, printingId } = usePrintCertificate();
  const [params, setParams] = useSearchParams();

  const [certificates, setCertificates] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState(params.get('search') || '');
  const [selected, setSelected] = useState(null);
  const [pendingPrint, setPendingPrint] = useState(null);

  const [sample, setSample] = useState({
    recipientName: 'Subramani Arumugam',
    courseTitle: 'Data Science and Machine Learning',
    serial: 'AA-2026-SAMPLE01',
  });

  const sampleRef = useRef(null);
  const viewerRef = useRef(null);

  usePageMeta('Certificates', 'Template, preview and issued certificates.');

  const search = params.get('search') || '';
  const courseId = params.get('courseId') || '';

  useEffect(() => {
    getCourses().then(setCourses).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    getAdminCertificates({ ...(search ? { search } : {}), ...(courseId ? { courseId } : {}) })
      .then((rows) => {
        setCertificates(rows);
        setError('');
        // Arriving from a learner's record with a serial opens that certificate.
        if (search && rows.length === 1) setSelected(rows[0]);
      })
      .catch((err) => setError(toErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [search, courseId]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (query.trim() === search) return;
      const next = new URLSearchParams(params);
      if (query.trim()) next.set('search', query.trim());
      else next.delete('search');
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text drives this
  }, [query]);

  // "Download" on a row: show it in the viewer first, then print once it has rendered.
  useEffect(() => {
    if (!pendingPrint || selected?.id !== pendingPrint || !viewerRef.current) return;
    print(pendingPrint, viewerRef.current);
    setPendingPrint(null);
  }, [pendingPrint, selected, print]);

  const setCourse = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('courseId', value);
    else next.delete('courseId');
    setParams(next, { replace: true });
  };

  const sampleCertificate = {
    id: 'sample-preview',
    kind: 'sample',
    recipientName: sample.recipientName || 'Learner Name',
    courseTitle: sample.courseTitle || 'Course Name',
    serial: sample.serial,
  };

  // Issued certificates show the learner's current profile name.
  const withHolder = (c) => ({ ...c, holderName: c.userId?.name || c.recipientName });

  const thisMonth = certificates.filter((c) => new Date(c.issuedAt) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Award}
        title="Certificate management"
        description={`One standard template. Certificates are issued automatically when a learner completes ${learning.certificateCompletionPercent}% of a course's lessons. The fixed text is edited in LMS settings → Branding.`}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatTile featured icon={Award} label={search || courseId ? 'Matching certificates' : 'Certificates issued'} value={certificates.length} />
        <StatTile icon={FileBadge} label="Issued this month" value={thisMonth} />
        <StatTile icon={FileBadge} tone="green" label="Courses with certificates" value={new Set(certificates.map((c) => String(c.courseId))).size} />
      </section>

      {/* --- template + sample preview -------------------------------------- */}
      <Panel
        icon={Eye}
        title="Standard template — sample preview"
        description="Learner name and course name fill in per certificate; month & year comes from the download date. Samples carry a faint watermark."
        actions={
          <Button size="sm" variant="secondary" loading={printingId === 'sample-preview'} onClick={() => print('sample-preview', sampleRef.current)}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Download sample
          </Button>
        }
      >
        <div className="grid gap-6 xl:grid-cols-[18rem_1fr]">
          <div className="space-y-4">
            <Input label="Learner name" value={sample.recipientName} maxLength={80} onChange={(e) => setSample({ ...sample, recipientName: e.target.value })} />
            <Input label="Course name" value={sample.courseTitle} maxLength={120} onChange={(e) => setSample({ ...sample, courseTitle: e.target.value })} />
            <Input label="Certificate ID" value={sample.serial} maxLength={40} onChange={(e) => setSample({ ...sample, serial: e.target.value })} hint="Real IDs are generated automatically, e.g. AA-2026-7F3C9B2A." />
            <p className="text-xs text-ink-500">Month &amp; year is set automatically from the day the certificate is downloaded.</p>
          </div>
          <div ref={sampleRef} className="overflow-hidden rounded-lg border border-ink-100">
            <CertificateFace certificate={sampleCertificate} />
          </div>
        </div>
      </Panel>

      {/* --- viewer --------------------------------------------------------- */}
      {selected && (
        <Panel
          icon={Award}
          title={`${withHolder(selected).holderName} — ${selected.courseTitle}`}
          description={`Certificate ${selected.serial} · issued ${formatDate(selected.issuedAt)}`}
          actions={
            <>
              <Button size="sm" loading={printingId === selected.id} onClick={() => print(selected.id, viewerRef.current)}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Download PDF
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)} aria-label="Close certificate">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </>
          }
        >
          <div ref={viewerRef} className="mx-auto max-w-4xl overflow-hidden rounded-lg border border-ink-100">
            <CertificateFace certificate={withHolder(selected)} />
          </div>
        </Panel>
      )}

      <Alert tone="error">{error}</Alert>

      {/* --- register ------------------------------------------------------- */}
      <Panel icon={FileBadge} title="Issued certificates" bodyClassName="">
        <FilterBar>
          <FilterField label="Search" className="lg:flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" aria-hidden="true" />
              <input
                type="search"
                className="admin-field w-full pl-9"
                placeholder="Learner, course or certificate ID"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </FilterField>
          <FilterField label="Course" className="lg:w-64">
            <select className="admin-field" value={courseId} onChange={(e) => setCourse(e.target.value)}>
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.title}
                </option>
              ))}
            </select>
          </FilterField>
        </FilterBar>

        {loading ? (
          <LoadingRow label="Loading certificates…" />
        ) : certificates.length === 0 ? (
          <EmptyRow icon={Award} title="No certificates issued yet" description="They appear here the moment a learner completes a course." />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[48rem]">
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>Course</th>
                  <th>Certificate ID</th>
                  <th>Completed on</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <p className="font-medium text-ink-900">{withHolder(c).holderName}</p>
                      <p className="text-[12px] text-ink-500">{c.userId?.email || '—'}</p>
                    </td>
                    <td className="text-[13px]">{c.courseTitle}</td>
                    <td className="font-mono text-[12.5px] text-primary-800">{c.serial}</td>
                    <td className="whitespace-nowrap text-[13px]">{formatDate(c.issuedAt)}</td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="soft" onClick={() => setSelected(c)}>
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={printingId === c.id}
                          onClick={() => {
                            setSelected(c);
                            setPendingPrint(c.id);
                          }}
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          Download
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
