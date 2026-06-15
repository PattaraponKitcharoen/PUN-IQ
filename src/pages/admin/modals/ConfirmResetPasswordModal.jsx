import { useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function ConfirmResetPasswordModal({ isOpen, onClose, tutor }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!isOpen || !tutor) return null;

  const handleSendResetEmail = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(tutor.email);

    if (resetError) {
      setError(`ส่งอีเมลไม่สำเร็จ: ${resetError.message}`);
    } else {
      setMessage(`ส่งลิงก์เปลี่ยนรหัสผ่านไปที่ ${tutor.email} เรียบร้อยแล้ว`);
      // รอ 2 วินาทีให้แอดมินอ่านข้อความ แล้วค่อยปิดหน้าต่าง
      setTimeout(() => {
        onClose();
        setMessage('');
      }, 2000);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden text-center p-6">
        
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>

        <h3 className="text-xl font-bold text-gray-800 mb-2">รีเซ็ตรหัสผ่าน</h3>
        <p className="text-sm text-gray-600 mb-6">
          คุณต้องการส่งอีเมลเพื่อรีเซ็ตรหัสผ่านไปให้<br/>
          <span className="font-bold text-gray-900">{tutor.name || tutor.username}</span> ใช่หรือไม่?
        </p>

        {error && <div className="bg-red-100 text-red-700 p-2 rounded-lg text-sm mb-4">{error}</div>}
        {message && <div className="bg-green-100 text-green-700 p-2 rounded-lg text-sm mb-4">{message}</div>}

        <div className="flex space-x-3">
          <button 
            onClick={onClose} 
            disabled={loading}
            className="w-1/2 bg-gray-100 text-gray-700 font-bold py-2 rounded-lg text-sm hover:bg-gray-200 transition"
          >
            ยกเลิก
          </button>
          <button 
            onClick={handleSendResetEmail} 
            disabled={loading}
            className="w-1/2 bg-blue-600 text-white font-bold py-2 rounded-lg text-sm hover:bg-blue-700 transition"
          >
            {loading ? 'กำลังส่ง...' : 'ยืนยันส่งอีเมล'}
          </button>
        </div>
      </div>
    </div>
  );
}