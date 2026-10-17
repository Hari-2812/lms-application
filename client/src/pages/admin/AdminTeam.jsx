import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Minus, Plus, ShieldCheck, UserPlus, X } from 'lucide-react';
import { addTeamMember, getTeam, resetUserPassword, toErrorMessage, updateTeamMember } from '../../api/client';
import { usePageMeta } from '../../components/layout/DashboardLayout.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  AccountStatus,
  Alert,
  EmptyRow,
  Initials,
  LoadingRow,
  PageHeader,
  Panel,
  Pill,
  formatDate,
  timeAgo,
  useFlash,
} from '../../components/admin/ui.jsx';

/**
 * Admin → Team & roles: staff accounts, their role (Super Admin or
 * Support / Reviewer), and what each role may do.
 */

const ROLE_LABEL = { super_admin: 'Super Admin', support: 'Support / Reviewer' };

const PERMISSIONS = [
  ['View dashboard, learners and payments', true, true],
  ['Download payment reports', true, true],
  ['Review tasks — feedback and scores', true, true],
  ['View and download certificates', true, true],
  ['Send notifications to learners', true, true],
  ['Enrol learners, grant or remove access', true, false],
  ['Mark payments paid / failed, retry, edit references', true, false],
  ['Suspend or activate learners, reset passwords', true, false],
  ['Create and edit courses, pricing and publishing', true, false],
  ['Tasks, events, LMS settings, team and activity log', true, false],
];

const EMPTY = { name: '', email: '', adminRole: 'support', password: '' };

export default function AdminTeam() {
  const { student } = useAuth();
  const flash = useFlash();
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [secret, setSecret] = useState(null); // { name, password }

  usePageMeta('Team & roles', 'Staff accounts and permissions.');

  const load = () =>
    getTeam()
      .then(setTeam)
      .catch((err) => flash.error(toErrorMessage(err)))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  const onAdd = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { member, temporaryPassword } = await addTeamMember(form);
      if (temporaryPassword) setSecret({ name: member.name, password: temporaryPassword });
      flash.success(`${member.name} added as ${ROLE_LABEL[member.adminRole]}.`);
      setForm(EMPTY);
      setOpen(false);
      load();
    } catch (err) {
      flash.error(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const change = async (member, patch, message) => {
    setBusyId(member.id);
    try {
      await updateTeamMember(member.id, patch);
      flash.success(message);
      load();
    } catch (err) {
      flash.error(toErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async (member) => {
    if (!window.confirm(`Set a new one-time password for ${member.name}? Their current password stops working.`)) return;
    setBusyId(member.id);
    try {
      const result = await resetUserPassword(member.id, 'temporary');
      setSecret({ name: member.name, password: result.temporaryPassword });
    } catch (err) {
      flash.error(toErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="Admin access & security"
        description="Who can sign in to the admin panel, and what each role is allowed to do."
        actions={
          !open && (
            <Button size="sm" onClick={() => setOpen(true)}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Add team member
            </Button>
          )
        }
      />

      {flash.node}
      {secret && (
        <Alert tone="success" onClose={() => setSecret(null)}>
          One-time password for {secret.name}:{' '}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono font-semibold text-ink-900">{secret.password}</code>
          <button type="button" onClick={() => navigator.clipboard?.writeText(secret.password)} className="ml-2 inline-flex items-center gap-1 text-[12px] font-semibold underline">
            <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy
          </button>
          <span className="mt-1 block text-[12px]">Shown only once. They can change it under My account after signing in.</span>
        </Alert>
      )}

      {open && (
        <Panel icon={UserPlus} title="Add a team member">
          <form onSubmit={onAdd} className="grid gap-4 sm:grid-cols-2">
            <Input label="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <div>
              <label className="field-label" htmlFor="member-role">Role</label>
              <select id="member-role" className="field-input" value={form.adminRole} onChange={(e) => setForm({ ...form, adminRole: e.target.value })}>
                <option value="support">Support / Reviewer</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <Input
              label="Password (optional)"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              hint="Leave empty to generate a one-time password."
              autoComplete="new-password"
            />
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" size="sm" loading={saving}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add member
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" aria-hidden="true" />
                Cancel
              </Button>
            </div>
          </form>
        </Panel>
      )}

      <Panel icon={ShieldCheck} title="Team" bodyClassName="">
        {loading ? (
          <LoadingRow />
        ) : team.length === 0 ? (
          <EmptyRow icon={ShieldCheck} title="No staff accounts" />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[48rem]">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Last sign-in</th>
                  <th>Added</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {team.map((member) => {
                  const isMe = member.id === student?.id;
                  const busy = busyId === member.id;
                  return (
                    <tr key={member.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Initials name={member.name} size="sm" />
                          <div className="min-w-0">
                            <p className="font-semibold text-ink-900">
                              {member.name} {isMe && <span className="text-[11px] font-medium text-primary-600">(you)</span>}
                            </p>
                            <p className="text-[12px] text-ink-500">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        {isMe ? (
                          <Pill tone="blue">{ROLE_LABEL[member.adminRole]}</Pill>
                        ) : (
                          <select
                            className="admin-field py-1.5"
                            value={member.adminRole}
                            disabled={busy}
                            onChange={(e) => change(member, { adminRole: e.target.value }, `${member.name} is now ${ROLE_LABEL[e.target.value]}.`)}
                            aria-label={`Role for ${member.name}`}
                          >
                            <option value="super_admin">Super Admin</option>
                            <option value="support">Support / Reviewer</option>
                          </select>
                        )}
                      </td>
                      <td className="text-[13px]">{timeAgo(member.lastLoginAt)}</td>
                      <td className="text-[13px]">{formatDate(member.createdAt)}</td>
                      <td><AccountStatus status={member.status} /></td>
                      <td>
                        {!isMe && (
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" variant="secondary" disabled={busy} onClick={() => resetPassword(member)}>
                              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                              Reset password
                            </Button>
                            <Button
                              size="sm"
                              variant={member.status === 'suspended' ? 'soft' : 'ghost'}
                              disabled={busy}
                              onClick={() =>
                                change(
                                  member,
                                  { status: member.status === 'suspended' ? 'active' : 'suspended' },
                                  member.status === 'suspended' ? `${member.name} re-activated.` : `${member.name} deactivated.`
                                )
                              }
                            >
                              {member.status === 'suspended' ? 'Re-activate' : 'Deactivate'}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel icon={ShieldCheck} title="What each role can do" bodyClassName="">
        <div className="overflow-x-auto">
          <table className="admin-table min-w-[36rem]">
            <thead>
              <tr>
                <th>Permission</th>
                <th className="text-center">Super Admin</th>
                <th className="text-center">Support / Reviewer</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map(([label, superAdmin, support]) => (
                <tr key={label}>
                  <td className="text-[13px]">{label}</td>
                  <td className="text-center">{superAdmin ? <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Yes" /> : <Minus className="mx-auto h-4 w-4 text-ink-300" aria-label="No" />}</td>
                  <td className="text-center">{support ? <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Yes" /> : <Minus className="mx-auto h-4 w-4 text-ink-300" aria-label="No" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-ink-100 px-6 py-4 text-[12.5px] text-ink-500">
          Security: sign-in locks for 15 minutes after 5 wrong passwords, resetting or changing a password signs out every other session, and admin sign-ins are recorded in the activity log.
        </p>
      </Panel>
    </div>
  );
}
