import { useState } from 'react';
import { supabase } from '../../../lib/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

export default function AddStudentModal({ isOpen, onClose, onSuccess }) {
  const [name, setName] = useState(''); 
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');  
  const [grade, setGrade] = useState('');  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    // 🔴 ปรับปรุงความปลอดภัย (P4): ใช้ crypto เพื่อสร้างรหัสผ่านที่เดายากขึ้น
    const tempPassword = crypto.randomUUID().slice(0, 12) + "Stu@1";

    try {
      // 1. ดึง Token ของแอดมินที่กำลังล็อกอินอยู่ เพื่อส่งไปยืนยันตัวตนกับ Server
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) throw new Error("ไม่พบเซสชันการล็อกอิน กรุณาล็อกอินใหม่");

      // 2. เรียกใช้งาน Edge Function แทนการเขียนฐานข้อมูลตรงๆ จากหน้าเว็บ
      const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          email: email, 
          password: tempPassword,
          name: name, 
          username: username, 
          role: 'student', 
          phone: phone, 
          grade: grade 
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'เกิดข้อผิดพลาดในการสร้างผู้ใช้');

      // 3. ส่งอีเมลตั้งรหัสผ่าน (ใช้ supabase client ปกติเรียกได้เลย เพราะส่งหา email ปลายทาง)
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);

      if (resetError) {
        setError(`สร้างบัญชีสำเร็จ แต่ส่งอีเมลไม่สำเร็จ: ${resetError.message}`);
      } else {
        setMessage(`ลงทะเบียนสำเร็จ! ส่งลิงก์ตั้งรหัสผ่านไปที่ ${email} แล้ว`);
        setName(''); 
        setEmail('');
        setUsername('');
        setPhone('');
        setGrade('');
        setTimeout(() => {
          onSuccess();
          onClose();
          setMessage('');
        }, 2000);
      }
      
    } catch (err) {
      setError(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 🔴 สร้างฟังก์ชันล้างค่าก่อนปิดหน้าต่าง
  const handleClose = () => {
    setName('');
    setEmail('');
    setUsername('');
    setPhone('');
    setGrade(''); // ถ้าเป็นหน้า AddTutor ให้ลบตัวนี้ทิ้งครับ
    setError('');
    setMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
          <h3 className="text-lg font-bold">ลงทะเบียนนักเรียนใหม่</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleAddStudent} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm break-words">{error}</div>}
          {message && <div className="bg-green-100 text-green-700 p-3 rounded-lg text-sm">{message}</div>}

          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase mb-2">ชื่อ - นามสกุล</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="เช่น เด็กชายรักเรียน ดีเด่น" required />
          </div>

          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase mb-2">ชื่อผู้ใช้งาน (Username)</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="เช่น student_jack" required />
          </div>
          
          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase mb-2">อีเมลนักเรียน / ผู้ปกครอง</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="เช่น jack@gmail.com" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 text-xs font-bold uppercase mb-2">ระดับชั้น</label>
              <input type="text" value={grade} onChange={(e) => setGrade(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="เช่น ม.4, ป.6" required />
            </div>
            <div>
              <label className="block text-gray-700 text-xs font-bold uppercase mb-2">เบอร์โทรศัพท์</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="เช่น 0987654321" required />
            </div>
          </div>

          <div className="flex space-x-3 pt-2">
            <button type="button" onClick={handleClose} className="w-1/2 bg-gray-100 text-gray-700 font-bold py-2 rounded-lg text-sm">ยกเลิก</button>
            <button type="submit" disabled={loading} className="w-1/2 bg-blue-600 text-white font-bold py-2 rounded-lg text-sm">{loading ? 'กำลังประมวลผล...' : 'สร้างและส่งอีเมล'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}