import { useState }      from 'react';
import { useNavigate }   from 'react-router-dom';
import { useAuthStore }  from '../../store/authStore';
import api               from '../../services/api';

export default function LoginPage() {
  const navigate        = useNavigate();
  const { setUser }     = useAuthStore();
  const [email,    setEmail]   = useState('');
  const [password, setPassword]= useState('');
  const [error,    setError]   = useState('');
  const [loading,  setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return setError('Please enter email and password.');
    setLoading(true); setError('');
    try {
      const res  = await api.post('/auth/login', { email, password });
      const data = res.data.data;
      setUser(
        {
          id:    data.user?.id    || data.id,
          name:  data.user?.name  || data.full_name || data.name || '',
          email: data.user?.email || data.email,
          roles: data.user?.roles || data.roles || [],
        },
        data.accessToken || data.token || ''
      );
      const roles: string[] = data.user?.roles || data.roles || [];
      if      (roles.includes('super_admin'))       navigate('/admin/dashboard');
      else if (roles.includes('rdc_manager'))       navigate('/staff/dashboard');
      else if (roles.includes('rdc_staff'))         navigate('/staff/dashboard');
      else if (roles.includes('logistics_officer')) navigate('/staff/dashboard');
      else if (roles.includes('customer'))          navigate('/customer/dashboard');
      else navigate('/login');
    } catch (e: any) {
      setError(e.response?.data?.message || 'Login failed. Check your credentials.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-600 px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center
                          w-14 h-14 bg-white rounded-2xl mb-3 shadow-lg">
            <span className="text-blue-600 text-xl font-bold">IS</span>
          </div>
          <h1 className="text-xl font-bold text-white">ISDN</h1>
          <p className="text-xs text-blue-200 mt-0.5">
            Island-wide Sales Distribution Network
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-7">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Sign in</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@isdn.lk"
                autoComplete="email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5
                           text-sm focus:outline-none focus:ring-2
                           focus:ring-blue-500 focus:border-transparent"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5
                           text-sm focus:outline-none focus:ring-2
                           focus:ring-blue-500 focus:border-transparent"/>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <p className="text-red-600 text-xs">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm
                         font-semibold hover:bg-blue-700 disabled:opacity-50
                         transition focus:outline-none focus:ring-2
                         focus:ring-blue-500 focus:ring-offset-2">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-blue-200 mt-5">
          ISDN © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
