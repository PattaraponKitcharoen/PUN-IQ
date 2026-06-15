import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // เก็บตัว subscription ไว้
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          console.log('ระบบพร้อมรับรหัสผ่านใหม่แล้ว');
        }
      }
    );
    
    // คืนค่าฟังก์ชันสำหรับ cleanup ตอนปิดหน้าเว็บ
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    // คำสั่งเปลี่ยนรหัสผ่านของ Supabase
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      setError('เกิดข้อผิดพลาด: รหัสผ่านอาจจะสั้นเกินไป (ต้อง 6 ตัวขึ้นไป)');
    } else {
      setMessage('เปลี่ยนรหัสผ่านสำเร็จ! กำลังพากลับไปหน้า Login...');
      // รอ 3 วินาทีแล้วเตะกลับไปหน้า Login
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-teal-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md backdrop-blur-md z-10">
        
        <div className="flex flex-col items-center mb-8">
          {/* <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4 overflow-hidden">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-11 h-11 object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentNode.innerHTML = '<span class="text-white text-2xl font-black">IQ</span>';
              }}
            />
          </div> */}
          <h2 className="text-2xl font-extrabold text-white tracking-tight">ตั้งรหัสผ่านใหม่</h2>
          <p className="text-slate-400 text-xs mt-1 font-medium">กรุณากำหนดรหัสผ่านที่มีความปลอดภัยสูง</p>
        </div>
        
        {error && (
          <div className="bg-red-950/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl mb-5 text-sm flex items-center space-x-2 animate-shake">
            <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {message && (
          <div className="bg-emerald-950/50 border border-emerald-500/50 text-emerald-200 px-4 py-3 rounded-xl mb-5 text-sm flex items-start space-x-2">
            <span className="font-medium text-center">{message}</span>
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-5">
          <div>
            <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">รหัสผ่านใหม่ (New Password)</label>
            <input
              type="password"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition duration-200 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ระบุอย่างน้อย 6 ตัวอักษร"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-4 rounded-xl transition duration-200 shadow-lg shadow-emerald-600/20 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none mt-2 text-sm"
          >
            {loading ? 'กำลังบันทึกข้อมูล...' : 'บันทึกรหัสผ่านใหม่'}
          </button>
        </form>
      </div>
    </div>
  );
}