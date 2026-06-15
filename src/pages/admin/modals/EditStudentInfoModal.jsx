import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function EditStudentInfoModal({ isOpen, onClose, student, onSuccess }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(''); 
  const [grade, setGrade] = useState(''); 
  // 🔴 1. เพิ่ม State สำหรับเก็บข้อมูลบัญชีธนาคาร
  const [companyAccountId, setCompanyAccountId] = useState('');
  const [companyAccounts, setCompanyAccounts] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 🔴 2. ดึงรายชื่อบัญชีธนาคาร (เฉพาะบัญชีที่ Active) มาทำเป็นตัวเลือก
  useEffect(() => {
    const fetchCompanyAccounts = async () => {
      const { data } = await supabase
        .from('company_accounts')
        .select('id, bank_name, account_name, account_number')
        .eq('is_active', true);
      
      if (data) setCompanyAccounts(data);
    };

    if (isOpen) {
      fetchCompanyAccounts();
    }
  }, [isOpen]);

  useEffect(() => {
    if (student) {
      setName(student.name || '');
      setUsername(student.username || '');
      setEmail(student.email || '');
      setPhone(student.phone || '');
      setGrade(student.grade || '');
      // 🔴 3. เซ็ตค่าเริ่มต้นของบัญชีธนาคาร ถ้านักเรียนเคยมีข้อมูลผูกไว้แล้ว
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
            // 🔴 4. แนบ company_account_id ไปให้ Edge Function อัปเดตด้วย
            email, name, username, phone, grade, company_account_id: companyAccountId
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
          <h3 className="text-lg font-bold">แก้ไขข้อมูลนักเรียน</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleUpdate} className="p-6 space-y-4">
          {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm break-words">{error}</div>}

          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase mb-2">อีเมล (Email)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>

          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase mb-2">ชื่อ - นามสกุล</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>

          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase mb-2">ชื่อผู้ใช้งาน (Username)</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 text-xs font-bold uppercase mb-2">ระดับชั้น</label>
              <input type="text" value={grade} onChange={(e) => setGrade(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-gray-700 text-xs font-bold uppercase mb-2">เบอร์โทรศัพท์</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
          </div>

          {/* 🔴 5. เพิ่ม Dropdown สำหรับเลือกบัญชีธนาคาร */}
          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase mb-2">บัญชีรับชำระเงิน (สำหรับเด็กคนนี้)</label>
            <select 
              value={companyAccountId} 
              onChange={(e) => setCompanyAccountId(e.target.value)} 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">-- ใช้บัญชีเริ่มต้นของระบบ --</option>
              {companyAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.bank_name} ({acc.account_number}) - {acc.account_name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-gray-500 mt-1">
              * หากไม่เลือก ระบบจะดึงบัญชีอันแรกที่เปิดใช้งานอยู่ไปใส่ในใบแจ้งหนี้อัตโนมัติ
            </p>
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