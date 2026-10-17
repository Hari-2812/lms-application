import { useState } from 'react';
import { Award, BookOpen, Camera, Clock, Mail, MapPin, Phone, Save, User } from 'lucide-react';
import { toErrorMessage } from '../api/client';
import { usePageMeta } from '../components/layout/DashboardLayout.jsx';
import Avatar from '../components/common/Avatar.jsx';
import Badge from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import Input from '../components/common/Input.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import { ErrorState } from '../components/States.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useLearningData from '../hooks/useLearningData.js';
import { formatWatchTime } from '../utils/course.js';

export default function Profile() {
  const { student, updateProfile } = useAuth();
  const { courses, status, error, completedCourses, watchedSeconds, completedLessonCount } =
    useLearningData();

  const [form, setForm] = useState({
    name: student?.name || '',
    phone: student?.phone || '',
    city: student?.city || '',
    headline: student?.headline || '',
    bio: student?.bio || '',
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  usePageMeta('Profile', 'Manage how you appear across the platform.');

  const setField = (name) => (event) => {
    setForm((prev) => ({ ...prev, [name]: event.target.value }));
    setSaved(false);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      await updateProfile(form);
      setSaved(true);
    } catch (err) {
      setSaveError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (status === 'error') return <ErrorState message={error} />;

  const stats = [
    { icon: BookOpen, label: 'Courses enrolled', value: courses.length },
    { icon: Award, label: 'Courses completed', value: completedCourses.length },
    { icon: Clock, label: 'Time learned', value: formatWatchTime(watchedSeconds) },
  ];

  return (
    <div className="space-y-6">
      {/* --- Identity header ------------------------------------------ */}
      <section className="card overflow-hidden">
        <div className="h-28 bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500" />

        <div className="px-6 pb-6">
          <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="relative">
                <Avatar
                  name={student?.name}
                  src={student?.avatar}
                  size="xl"
                  className="ring-4 ring-white"
                />
                <span
                  className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-ink-100 text-ink-500"
                  title="Avatar uploads are not available yet"
                >
                  <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </div>

              <div className="mt-10 pb-1">
                <h2 className="text-lg font-bold text-ink-900">{student?.name}</h2>
                <p className="text-sm text-ink-500">{form.headline || 'Student'}</p>
              </div>
            </div>

            <Badge tone="primary" className="mt-10 self-start sm:self-auto">
              {completedLessonCount} lessons completed
            </Badge>
          </div>

          <dl className="mt-7 grid gap-4 border-t border-ink-100 pt-6 sm:grid-cols-3">
            {status === 'loading'
              ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-14" />)
              : stats.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-50 text-primary-600">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <dd className="text-lg font-bold leading-tight text-ink-900">{value}</dd>
                      <dt className="text-xs text-ink-500">{label}</dt>
                    </div>
                  </div>
                ))}
          </dl>
        </div>
      </section>

      {/* --- Editable details ----------------------------------------- */}
      <section className="card p-6">
        <h2 className="text-base font-semibold text-ink-900">Personal details</h2>
        <p className="mt-1 text-[13px] text-ink-500">
          These details appear on your profile and certificates.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Full name"
              icon={User}
              value={form.name}
              onChange={setField('name')}
              autoComplete="name"
            />
            <Input
              label="Email address"
              type="email"
              icon={Mail}
              value={student?.email || ''}
              disabled
              hint="Contact support to change the email on your account."
            />
            <Input
              label="Phone number"
              type="tel"
              icon={Phone}
              value={form.phone}
              onChange={setField('phone')}
              autoComplete="tel"
            />
            <Input label="City" icon={MapPin} value={form.city} onChange={setField('city')} autoComplete="address-level2" />
          </div>

          <Input
            label="Headline"
            placeholder="e.g. Frontend developer in training"
            value={form.headline}
            onChange={setField('headline')}
          />

          <div>
            <label htmlFor="profile-bio" className="field-label">
              About you
            </label>
            <textarea
              id="profile-bio"
              rows={4}
              value={form.bio}
              onChange={setField('bio')}
              placeholder="A short introduction — what you are learning and why."
              className="field-input resize-y leading-relaxed"
            />
          </div>

          <div className="flex items-center gap-4 border-t border-ink-100 pt-5">
            <Button type="submit" loading={saving}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Save changes
            </Button>
            {saved && (
              <p role="status" className="text-[13px] font-medium text-emerald-700">
                Profile updated.
              </p>
            )}
            {saveError && (
              <p role="alert" className="text-[13px] font-medium text-red-600">
                {saveError}
              </p>
            )}
          </div>
        </form>

      </section>
    </div>
  );
}
