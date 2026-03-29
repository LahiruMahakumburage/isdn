import { useEffect, useState } from 'react';
import api from '../../services/api';
import { formatDateTime } from '../../utils/formatDate';

const ROLES = ['super_admin','rdc_manager','rdc_staff','logistics_officer','customer'];

export default function UserListPage() {
  const [users,    setUsers]   = useState<any[]>([]);
  const [loading,  setLoading] = useState(true);
  const [search,   setSearch]  = useState('');
  const [role,     setRole]    = useState('');
  const [showForm, setShowForm]= useState(false);
  const [form, setForm]        = useState({ full_name:'',email:'',password:'',phone:'',role:'customer',rdc_id:'' });
  const [rdcs, setRdcs]        = useState<any[]>([]);
  const [saving, setSaving]    = useState(false);
  const [err, setErr]          = useState('');

  const fetch = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (role)   params.role   = role;
      const [uRes, rRes] = await Promise.all([
        api.get('/users', { params }),
        api.get('/rdcs'),
      ]);
      setUsers(uRes.data.data.users);
      setRdcs(rRes.data.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [search, role]);

  const handleCreate = async () => {
    setErr('');
    if (!form.full_name||!form.email||!form.password) return setErr('Name, email and password required');
    setSaving(true);
    try {
      await api.post('/users', { ...form, rdc_id: form.rdc_id ? Number(form.rdc_id) : undefined });
      setShowForm(false);
      setForm({ full_name:'',email:'',password:'',phone:'',role:'customer',rdc_id:'' });
      fetch();
    } catch(e: any) { setErr(e.response?.data?.message||'Failed to create user'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    if (!confirm(`${current?'Deactivate':'Activate'} this user?`)) return;
    await api.patch(`/users/${id}`, { is_active: current ? 0 : 1 });
    fetch();
  };

  const changeRole = async (id: string, newRole: string) => {
    await api.patch(`/users/${id}/roles`, { role: newRole });
    fetch();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
        <button onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          + New User
        </button>
      </div>

      {/* Create user form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Create New User</h2>
          <div className="grid grid-cols-2 gap-3">
            {[['full_name','Full Name'],['email','Email'],['password','Password'],['phone','Phone (optional)']].map(([k,l])=>(
              <div key={k}>
                <label className="block text-xs text-gray-500 mb-1">{l}</label>
                <input type={k==='password'?'password':'text'} value={(form as any)[k]}
                  onChange={e => setForm(f=>({...f,[k]:e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            ))}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Role</label>
              <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {ROLES.map(r=><option key={r} value={r}>{r.replace('_',' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">RDC (if applicable)</label>
              <select value={form.rdc_id} onChange={e=>setForm(f=>({...f,rdc_id:e.target.value}))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">None (Head Office)</option>
                {rdcs.map((r:any)=><option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          {err && <p className="text-red-500 text-sm mt-2">{err}</p>}
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreate} disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving?'Creating…':'Create User'}
            </button>
            <button onClick={()=>{setShowForm(false);setErr('');}}
              className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex gap-3 items-center">
        <input type="text" placeholder="Search name or email…" value={search}
          onChange={e=>setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"/>
        <select value={role} onChange={e=>setRole(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All roles</option>
          {ROLES.map(r=><option key={r} value={r}>{r.replace('_',' ')}</option>)}
        </select>
        <span className="text-sm text-gray-400 ml-auto">{users.length} users</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading users…</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No users found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name','Email','Role','RDC','Last Login','Status','Actions'].map(h=>(
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u: any) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{u.full_name}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <select defaultValue={u.roles?.[0]||''}
                      onChange={e=>changeRole(u.id,e.target.value)}
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                      {ROLES.map(r=><option key={r} value={r}>{r.replace('_',' ')}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.rdc_name||'Head Office'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{u.last_login_at?formatDateTime(u.last_login_at):'Never'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.is_active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>
                      {u.is_active?'Active':'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={()=>toggleActive(u.id,u.is_active)}
                      className={`text-xs hover:underline ${u.is_active?'text-red-500':'text-green-600'}`}>
                      {u.is_active?'Deactivate':'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
