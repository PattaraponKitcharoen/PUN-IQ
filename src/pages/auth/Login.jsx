import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // เซนเซอร์ดักจับลิงก์จาก Supabase (รองรับทั้งรีเซ็ตรหัสผ่าน และ คำเชิญใช้งาน)
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

    // จังหวะที่ 1: เอา Username ไปค้นหา อีเมล และ Role ในตาราง users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, role')
      .eq('username', username)
      .single();

    if (import.meta.env.DEV) {
        console.log("ข้อมูลที่ดึงได้:", userData);
        console.log("Error จาก Supabase:", userError);
    }

    if (userError || !userData) {
      setError('ไม่พบชื่อผู้ใช้งานนี้ในระบบ');
      setLoading(false);
      return;
    }

    // จังหวะที่ 2: เมื่อได้อีเมลจริงมาแล้ว ค่อยส่งไปให้ระบบ Auth ตรวจสอบรหัสผ่าน
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: userData.email,
      password,
    });

    if (authError) {
      setError('รหัสผ่านไม่ถูกต้อง');
      setLoading(false);
      return;
    }

    // จังหวะที่ 3: ปรับปรุงเงื่อนไขเปิดทางและ Navigate นักเรียนไปยังโซนระบบของตัวเอง
    if (userData.role === 'admin') {
      navigate('/admin');
    } else if (userData.role === 'tutor') {
      navigate('/tutor');
    } else if (userData.role === 'student') {
      navigate('/student'); // 🔴 เปิดสิทธิ์ให้นักเรียนพุ่งไปหน้า Student Dashboard
    } else {
      setError('สิทธิ์การใช้งานไม่ถูกต้อง');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          ระบบจัดการกวดวิชา
        </h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">ชื่อผู้ใช้งาน (Username)</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="กรอกชื่อผู้ใช้งาน"
              required
            />
          </div>
          
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">รหัสผ่าน</label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
          >
            {loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  );
}