import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function EditStudentAccountModal({ isOpen, onClose, student, onSuccess }) {
  const [companyAccountId, setCompanyAccountId] = useState('');
  const [companyAccounts, setCompanyAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ดึงรายชื่อบัญชีธนาคารมาทำเป็นตัวเลือก
  useEffect(() => {
    const fetchCompanyAccounts = async () => {
      const { data } = await supabase
        .from('company_accounts')
        .select('id, bank_name, account_name, account_number')
        .eq('is_active', true);
      
      if (data) setCompanyAccounts(data);
    };

    if (isOpen) fetchCompanyAccounts();
  }, [isOpen]);

  // ดึงค่าบัญชีเดิมที่เคยเลือกไว้มาแสดง
  useEffect(() => {
    if (student) {
      setCompanyAccountId(student.company_account_id || '');
      setError('');
    }
  }, [student, isOpen]);

  if (!isOpen || !student) return null;

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('กรุณาล็อกอินใหม่');
  
      // ส่งไปอัปเดตผ่าน Edge Function เหมือนเดิม แต่ส่งไปแค่ข้อมูลบัญชี
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            targetUserId: student.id,
            company_account_id: companyAccountId
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
          <h3 className="text-lg font-bold">ตั้งค่าบัญชีรับชำระเงิน</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleUpdate} className="p-6 space-y-4">
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              กำหนดบัญชีธนาคารที่จะแสดงบนใบแจ้งหนี้สำหรับ 
              <span className="font-bold text-gray-900 ml-1">{student.name || student.username}</span>
            </p>
          </div>

          {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm break-words">{error}</div>}

          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase mb-2">เลือกบัญชีรับเงิน</label>
            <select 
              value={companyAccountId} 
              onChange={(e) => setCompanyAccountId(e.target.value)} 
              className="w-full px-3 py-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="">-- ใช้บัญชีเริ่มต้นของระบบ (Default) --</option>
              {companyAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.bank_name} ({acc.account_number}) - {acc.account_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex space-x-3 pt-4">
            <button type="button" onClick={onClose} className="w-1/2 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">ยกเลิก</button>
            <button type="submit" disabled={loading} className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-sm transition shadow-sm">
              {loading ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}