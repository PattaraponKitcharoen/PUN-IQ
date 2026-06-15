import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || hash.includes('type=invite')) {
      navigate('/reset-password');
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        if (window.location.hash.includes('type=invite')) {
          navigate('/reset-password');
        } else if (event === 'PASSWORD_RECOVERY') {
          navigate('/reset-password');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // ข้อความแจ้งเตือนความปลอดภัยแบบส่วนกลางเพื่อป้องกันการสุ่มหาชื่อบัญชี
    const GENERIC_ERROR = 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง';

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, role')
      .eq('username', username)
      .single();

    if (userError || !userData) {
      setError(GENERIC_ERROR);
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: userData.email,
      password,
    });

    if (authError) {
      setError(GENERIC_ERROR);
      setLoading(false);
      return;
    }

    if (userData.role === 'admin') {
      navigate('/admin');
    } else if (userData.role === 'tutor') {
      navigate('/tutor');
    } else if (userData.role === 'student') {
      navigate('/student');
    } else {
      setError('สิทธิ์การใช้งานไม่ถูกต้อง');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* เอฟเฟกต์แสงไฟเรืองรองด้านหลังฟอร์ม */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md backdrop-blur-md z-10 transition-all duration-300">
        
        {/* บล็อกส่วนโลโก้สถานศึกษา */}
        <div className="flex flex-col items-center mb-8">
          {/* <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4 overflow-hidden">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-11 h-11 object-contain"
              onError={(e) => {
                // ตัวสำรองกรณีที่ยังหาไฟล์รูปภาพไม่เจอในเครื่อง
                e.target.style.display = 'none';
                e.target.parentNode.innerHTML = '<span class="text-white text-2xl font-black">IQ</span>';
              }}
            />
          </div> */}
          <h2 className="text-2xl font-extrabold text-white tracking-tight">PUN-IQ Portal</h2>
          <p className="text-slate-400 text-xs mt-1 font-medium">ระบบบริหารจัดการและบันทึกเวลาเรียน</p>
        </div>
        
        {error && (
          <div className="bg-red-950/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl mb-5 text-sm flex items-center space-x-2 animate-shake">
            <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">ชื่อผู้ใช้งาน (Username)</label>
            <input
              type="text"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition duration-200 text-sm font-medium"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="กรอกชื่อผู้ใช้งานของคุณ"
              required
            />
          </div>
          
          <div>
            <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">รหัสผ่าน (Password)</label>
            <input
              type="password"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition duration-200 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition duration-200 shadow-lg shadow-blue-600/20 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none mt-2 text-sm"
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  );
}