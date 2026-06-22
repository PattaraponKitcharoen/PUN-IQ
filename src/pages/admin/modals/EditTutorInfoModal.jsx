import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function EditTutorInfoModal({ isOpen, onClose, tutor, onSuccess }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tutor) {
      setName(tutor.name || '');
      setUsername(tutor.username || '');
      setEmail(tutor.email || '');
      setError('');
    }
  }, [tutor, isOpen]);

  if (!isOpen || !tutor) return null;

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('กรุณาล็อกอินใหม่');
  
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            targetUserId: tutor.id,
            email, 
            name, 
            username
          })
        }
      );
  
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
  
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
          <h3 className="text-lg font-bold">แก้ไขข้อมูลคุณครู</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleUpdate} className="p-6 space-y-4">
          {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm break-words">{error}</div>}

          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase tracking-wider mb-2">อีเมล (Email)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 text-xs font-bold uppercase tracking-wider mb-2">ชื่อ - นามสกุล</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
            <div>
              <label className="block text-gray-700 text-xs font-bold uppercase tracking-wider mb-2">ชื่อผู้ใช้งาน</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
          </div>

          <div className="flex space-x-3 pt-2">
            <button type="button" onClick={onClose} className="w-1/2 bg-gray-100 text-gray-700 font-bold py-2 rounded-lg text-sm">ยกเลิก</button>
            <button type="submit" disabled={loading} className="w-1/2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-lg text-sm transition">
              {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}