import { useState } from 'react';
import { KeyRound, Save, UserCog } from 'lucide-react';
import { toErrorMessage } from '../../api/client';
import { usePageMeta } from '../../components/layout/DashboardLayout.jsx';
import Button from '../../components/common/Button.jsx';
import ChangePasswordForm from '../../components/common/ChangePasswordForm.jsx';
import Input from '../../components/common/Input.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { Initials, PageHeader, Panel, Pill, useFlash } from '../../components/admin/ui.jsx';

/** Admin → My account: your own details and password, for every staff role. */
export default function AdminAccount() {
  const { student, isSuperAdmin, updateProfile } = useAuth();
  const flash = useFlash();
  const [profile, setProfile] = useState({ name: student?.name || '', phone: student?.phone || '' });
  const [savingProfile, setSavingProfile] = useState(false);

  usePageMeta('My account', 'Your details and password.');

  const onProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile(profile);
      flash.success('Your details are saved.');
    } catch (err) {
      flash.error(toErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader icon={UserCog} title="My account" description="Keep your details and password up to date.">
        <div className="mt-5 flex items-center gap-3 border-t border-ink-100 pt-5">
          <Initials name={student?.name} />
          <div>
            <p className="text-sm font-semibold text-ink-900">{student?.name}</p>
            <p className="text-[12.5px] text-ink-500">{student?.email}</p>
          </div>
          <Pill tone="blue" className="ml-auto">{isSuperAdmin ? 'Super Admin' : 'Support / Reviewer'}</Pill>
        </div>
      </PageHeader>

      {flash.node}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel icon={UserCog} title="Your details">
          <form onSubmit={onProfile} className="space-y-4">
            <Input label="Full name" required value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            <Input label="Email" value={student?.email || ''} disabled hint="Ask a Super Admin to change the email on an account." />
            <Input label="Phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            <Button type="submit" loading={savingProfile}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Save details
            </Button>
          </form>
        </Panel>

        <Panel icon={KeyRound} title="Change password" description="Signing in again is needed on your other devices afterwards.">
          <ChangePasswordForm />
        </Panel>
      </div>
    </div>
  );
}
