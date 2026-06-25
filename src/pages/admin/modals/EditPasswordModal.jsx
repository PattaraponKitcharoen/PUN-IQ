import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function EditPasswordModal({ isOpen, onClose, user }) {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // ล้างฟอร์มทุกครั้งที่เปิด Modal ขึ้นมาใหม่
  useEffect(() => {
    if (isOpen) {
      setNewPassword('');
      setMessage('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      setError('❌ กรุณากรอกรหัสผ่านใหม่');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      // อัปเดตรหัสผ่านลงในคอลัมน์ password ตรงๆ
      const { error: updateError } = await supabase
        .from('users')
        .update({ password: newPassword.trim() })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setMessage('✅ เปลี่ยนรหัสผ่านสำเร็จ!');
      
      // หน่วงเวลาให้เห็นข้อความสำเร็จ 1 วินาที แล้วปิด Modal
      setTimeout(() => {
        onClose();
      }, 1000);

    } catch (err) {
      setError(`❌ เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col transform transition-all">
        
        {/* Header */}
        <div className="bg-slate-900 p-5 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3 text-white">
            <div className="p-2 bg-slate-800 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h3 className="font-bold text-lg tracking-wide">เปลี่ยนรหัสผ่านใหม่</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition rounded-full hover:bg-slate-800 p-1">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-5 bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center space-x-3">
             <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg shrink-0">
                {user.name ? user.name.charAt(0) : user.username.charAt(0)}
             </div>
             <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-0.5">เปลี่ยนรหัสให้บัญชี:</p>
                <p className="font-semibold text-gray-800">{user.username}</p>
             </div>
          </div>

          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 font-medium">{error}</div>}
          {message && <div className="mb-4 p-3 bg-green-50 text-green-600 text-sm rounded-lg border border-green-100 font-medium">{message}</div>}

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">รหัสผ่านใหม่ <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition"
                placeholder="กรอกรหัสผ่านใหม่ที่ต้องการ"
                required
                autoFocus
              />
            </div>

            <div className="flex space-x-3">
              <button 
                type="button" 
                onClick={onClose} 
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition"
              >
                ยกเลิก
              </button>
              <button 
                type="submit" 
                disabled={loading || !newPassword.trim()} 
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <span>บันทึกรหัสผ่าน</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}