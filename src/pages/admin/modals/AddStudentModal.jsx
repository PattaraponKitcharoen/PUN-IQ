import { useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function AddStudentModal({ isOpen, onClose }) {
  const [name, setName] = useState(''); 
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState(''); // 🔴 เพิ่ม State เก็บพาสเวิร์ดแทนเมล
  const [phone, setPhone] = useState('');  
  const [grade, setGrade] = useState('');  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('❌ กรุณากรอกข้อมูลชื่อผู้ใช้งานและรหัสผ่านให้ครบถ้วน');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      // 🔴 เปลี่ยนสถาปัตยกรรม: ยิงตรงเข้าตารางแบบเดียวกับ Parent และบังคับ email: null เพื่อไม่ให้ติดเงื่อนไข "" ซ้ำ
      const payload = {
        username: username.trim(),
        password: password.trim(),
        name: name.trim(),
        phone: phone.trim(),
        grade: grade.trim(),
        email: null, // บังคับให้เป็นค่าว่างแบบสมบูรณ์ของ DB (แก้อาการ Null ซ้ำแล้วพัง)
        role: 'student'
      };

      const { error: insertError } = await supabase.from('users').insert([payload]);
      if (insertError) throw insertError;

      setMessage('🎉 สร้างบัญชีนักเรียนใหม่สำเร็จเรียบร้อย!');
      
      // ล้างค่าฟอร์มกลับเป็นค่าเริ่มต้น
      setName('');
      setUsername('');
      setPassword('');
      setPhone('');
      setGrade('');
      
      setTimeout(() => {
        onClose(); // เรียกหน้าต่างปิด และสั่งให้ ManageStudent รีเฟรชตารางข้อมูลอัตโนมัติ
        setMessage('');
      }, 1500);
      
    } catch (err) {
      if (err.message.includes('users_username_key')) {
        setError('❌ ไม่สามารถสร้างได้: ชื่อผู้ใช้งาน (Username) นี้มีในระบบอยู่แล้ว');
      } else {
        setError(`เกิดข้อผิดพลาด: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setUsername('');
    setPassword('');
    setPhone('');
    setGrade('');
    setError('');
    setMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
          <h3 className="text-lg font-bold">ลงทะเบียนนักเรียนใหม่</h3>
          <button onClick={handleClose} className="text-slate-400 hover:text-white transition">
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
          
          {/* 🔴 เปลี่ยนจากอินพุตอีเมลเดิม มาเป็นอินพุตรหัสผ่านตรงๆ */}
          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase mb-2">รหัสผ่านสำหรับเข้าใช้งาน (Password)</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="ตั้งรหัสผ่านสำหรับนักเรียน..." required />
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
            <button type="submit" disabled={loading} className="w-1/2 bg-blue-600 text-white font-bold py-2 rounded-lg text-sm">{loading ? 'กำลังประมวลผล...' : 'บันทึกบัญชีนักเรียน'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}