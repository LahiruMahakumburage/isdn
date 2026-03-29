import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatDateTime } from '../../utils/formatDate';

const ROLES = ['super_admin','rdc_manager','rdc_staff','logistics_officer','customer'];

export default function UserDetailPage() {
  const { id }               = useParams<{ id: string }>();
  const navigate             = useNavigate();
  const [user,    setUser]   = useState<any>(null);
  const [rdcs,    setRdcs]   = useState<any[]>([]);
  const [loading, setLoad]   = useState(true);
  const [saving,  setSaving] = useState(false);
  const [msg,     setMsg]    = useState('');
  const [isError, setIsErr]  = useState(false);
  const [form, setForm]      = useState({
    full_name:'', phone:'', rdc_id:'', role:'customer', is_active: true
  });
  const [pwForm, setPwForm]  = useState({ password:'', confirm:'' });
  const [savingPw,setSavPw]  = useState(false);

  const fetchUser = async () => {
    setLoad(true);
    try {
      const [uRes, rRes] = await Promise.all([
        api.get(`/users/${id}`),
        api.get('/rdcs'),
      ]);
      const u = uRes.data.data;
      setUser(u);
      setRdcs(rRes.data.data || []);
      setForm({
        full_name: u.full_name || '',
        phone:     u.phone     || '',
        rdc_id:    u.rdc_id    ? String(u.rdc_id) : '',
        role:      u.roles?.[0] || 'customer',
        is_active: Boolean(u.is_active),
      });
    } finally { setLoad(false); }
  };

  useEffect(() => { fetchUser(); }, [id]);

  const handleSave = async () => {
    setMsg(''); setSaving(true);
    try {
      await api.patch(`/users/${id}`, {
        full_name: form.full_name,
        phone:     form.phone     || null,
        rdc_id:    form.rdc_id    ? Number(form.rdc_id) : null,
        is_active: form.is_active ? 1 : 0,
      });
      await api.patch(`/users/${id}/roles`, { role: form.role });
      setMsg('User updated successfully.'); setIsErr(false);
      fetchUser();
    } catch (e: any) {
      setMsg(e.response?.data?.message || 'Update failed.'); setIsErr(true);
    } finally { setSaving(false); }
  };

  const handlePasswordReset = async () => {
    setMsg('');
    if (!pwForm.password)                   return setMsg('Enter a new password.');
    if (pwForm.password !== pwForm.confirm) return setMsg('Passwords do not match.');
    if (pwForm.password.length < 6)         return setMsg('Minimum 6 characters.');
    setSavPw(true);
    try {
      await api.patch(`/users/${id}/password`, { password: pwForm.password });
      setMsg('Password updated.'); setIsErr(false);
      setPwForm({ password:'', confirm:'' });
    } catch (e: any) {
      setMsg(e.response?.data?.message || 'Password reset failed.'); setIsErr(true);
    } finally { setSavPw(false); }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  if (!user)   return <div className="p-8 text-center text-gray-500">User not found.</div>;

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/users')}
          className="text-gray-400 hover:text-gray-600 text-sm">← Users</button>
        <h1 className="text-2xl font-semibold text-gray-900">{user.full_name}</h1>
        <span className={`px-3 py-1 rounded-full text-sm font-medium
          ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 space-y-4">
        <h2 className="text-sm font-medium text-gray-700">Profile</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label:'Full Name', key:'full_name', type:'text' },
            { label:'Phone',     key:'phone',     type:'text' },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1">{label}</label>
              <input type={type} value={(form as any)[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
          ))}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input value={user.email} disabled
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                         bg-gray-50 text-gray-400 cursor-not-allowed"/>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Role</label>
            <select value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500">
              {ROLES.map(r => (
                <option key={r} value={r}>{r.replace(/_/g,' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Assigned RDC</label>
            <select value={form.rdc_id}
              onChange={e => setForm(f => ({ ...f, rdc_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Head Office (none)</option>
              {rdcs.map((r: any) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors
                  ${form.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow
                  transition-transform
                  ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`}/>
              </div>
              <span className="text-sm text-gray-600">
                {form.is_active ? 'Active' : 'Inactive'}
              </span>
            </label>
          </div>
        </div>

        {msg && (
          <p className={`text-sm rounded-lg px-3 py-2 border
            ${isError
              ? 'text-red-600 bg-red-50 border-red-200'
              : 'text-green-600 bg-green-50 border-green-200'}`}>
            {msg}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm
                       font-medium hover:bg-blue-700 disabled:opacity-50 transition">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={() => navigate('/users')}
            className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-medium text-gray-700 mb-4">Reset Password</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">New Password</label>
            <input type="password" value={pwForm.password}
              onChange={e => setPwForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Min 6 characters"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Confirm Password</label>
            <input type="password" value={pwForm.confirm}
              onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
              placeholder="Repeat password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
        </div>
        <button onClick={handlePasswordReset} disabled={savingPw}
          className="mt-3 bg-orange-500 text-white px-5 py-2 rounded-lg text-sm
                     font-medium hover:bg-orange-600 disabled:opacity-50 transition">
          {savingPw ? 'Updating…' : 'Reset Password'}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Account Activity</h2>
        <div className="space-y-2 text-sm">
          {[
            ['Last login',      user.last_login_at ? formatDateTime(user.last_login_at) : 'Never'],
            ['Account created', formatDateTime(user.created_at)],
            ['Current roles',   user.roles?.join(', ')?.replace(/_/g,' ') || 'None'],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between">
              <span className="text-gray-500">{k}</span>
              <span className="text-gray-700 capitalize">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
