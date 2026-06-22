import { useState } from 'react';
import { supabase } from '../../../lib/supabase';

// URL สำหรับเรียกใช้ Edge Function (เหมือนกับตอนสร้างแอดมิน/ครู)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

export default function ConfirmDeleteTutorModal({ isOpen, onClose, tutor, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !tutor) return null;

  const handleDelete = async () => {
    setLoading(true);
    setError('');

    try {
      // ตรวจสอบก่อนว่าคุณครูมีประวัติการสอนค้างอยู่หรือไม่ (ป้องกันปัญหา Foreign Key ขัดข้อง)
      const { count } = await supabase
        .from('teaching_logs')
        .select('*', { count: 'exact', head: true })
        .eq('tutor_id', tutor.id);

      if (count > 0) {
        throw new Error(`ไม่สามารถลบได้ เนื่องจากคุณครูท่านนี้มีประวัติการสอนค้างอยู่ในระบบ ${count} รายการ`);
      }

      // เนื่องจากตาราง users ผูกอยู่กับระบบ Auth ของ Supabase
      // แนะนำให้ยิงไปที่ Edge Function ที่มีสิทธิ์ระดับ Service Role เพื่อลบบัญชี Auth ออกอย่างสมบูรณ์
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: tutor.id })
      });

      // 🔴 รับค่า Error จริงๆ ที่เซิร์ฟเวอร์ตอบกลับมา
      const result = await response.json();

      if (!response.ok) {
        // 🔴 ถ้าพัง ให้โยน Error โชว์บนหน้าจอทันที จะได้ไม่ต้องเดา
        throw new Error(result.error || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">ยืนยันการลบคุณครู?</h3>
          <p className="text-gray-500 text-sm mb-6">
            คุณแน่ใจหรือไม่ว่าต้องการลบ <span className="font-bold text-gray-800">{tutor.name || tutor.username}</span> ออกจากระบบ? การกระทำนี้ไม่สามารถย้อนกลับได้
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg text-left">
              {error}
            </div>
          )}

          <div className="flex space-x-3">
            <button 
              onClick={onClose} 
              disabled={loading}
              className="w-1/2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl transition"
            >
              ยกเลิก
            </button>
            <button 
              onClick={handleDelete} 
              disabled={loading}
              className="w-1/2 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl transition shadow-lg shadow-red-500/30 flex items-center justify-center"
            >
              {loading ? 'กำลังลบ...' : 'ลบข้อมูล'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}