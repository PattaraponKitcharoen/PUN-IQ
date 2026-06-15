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
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          ตั้งรหัสผ่านใหม่
        </h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 text-sm">
            {message}
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)</label>
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
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
          >
            {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
          </button>
        </form>
      </div>
    </div>
  );
}