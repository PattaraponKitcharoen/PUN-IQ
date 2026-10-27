import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { USERNAME_PREFIXES, useNextUsername } from '../../../lib/usernameCodes';

// 🔴 ลบ createClient และ Service Key ออกทั้งหมด เพื่อความปลอดภัย
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

export default function AddTutorModal({ isOpen, onClose }) {
  const [name, setName] = useState(''); 
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [customCode, setCustomCode] = useState(''); // เว้นว่าง = ใช้รหัสถัดไปอัตโนมัติ
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [usernamePrefix, setUsernamePrefix] = useState(USERNAME_PREFIXES.tutor[0].prefix);
  const prefixConfig = USERNAME_PREFIXES.tutor.find(p => p.prefix === usernamePrefix);
  const nextCode = useNextUsername('tutor', prefixConfig, isOpen);

  if (!isOpen) return null;

  const handleAddTutor = async (e) => {
    e.preventDefault();
    // รหัสรันอัตโนมัติ (หรือรหัสที่กรอกเอง) แล้วต่อท้ายด้วยชื่อที่กรอก: ชื่อ = K28ครูพี่ปิง, Username = K28ปิง
    const code = customCode.trim() || nextCode.suggestion;
    if (!code) {
      setError(nextCode.loading ? '⏳ กำลังหารหัสถัดไป กรุณารอสักครู่' : `❌ หารหัสถัดไปไม่สำเร็จ: ${nextCode.error}`);
      return;
    }
    if (!name.trim() || !username.trim()) {
      setError('❌ กรุณากรอกชื่อที่แสดง และชื่อต่อท้าย Username ให้ครบ');
      return;
    }
    const finalName = `${code}${name.trim()}`;
    const finalUsername = `${code}${username.trim()}`;
    setLoading(true);
    setError('');
    setMessage('');

    // 🔴 ปรับปรุงความปลอดภัย: ใช้ crypto สร้างรหัสผ่านชั่วคราวที่เดายากขึ้น
    const tempPassword = crypto.randomUUID().slice(0, 12) + "Tutor@123";

    try {
      // 1. ดึง Token ของแอดมินเพื่อยืนยันตัวตนกับ Server
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) throw new Error("ไม่พบเซสชันการล็อกอิน กรุณาล็อกอินใหม่");

      // 2. เรียกใช้ Edge Function สร้างบัญชีผู้ใช้ใหม่ (ลดช่องโหว่ความปลอดภัย)
      const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          email: email, 
          password: tempPassword,
          name: finalName, 
          username: finalUsername, 
          role: 'tutor' // 🔴 ระบุบทบาทเป็นคุณครู
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'เกิดข้อผิดพลาดในการสร้างบัญชี');

      // 3. ส่งอีเมลตั้งรหัสผ่าน
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);

      if (resetError) {
        setError(`สร้างบัญชีสำเร็จ แต่ส่งอีเมลตั้งรหัสผ่านไม่สำเร็จ: ${resetError.message}`);
      } else {
        setMessage(`สร้างบัญชี ${finalUsername} สำเร็จและส่งลิงก์ตั้งรหัสผ่านไปที่ ${email} แล้ว!`);
        nextCode.refresh();
        setName(''); 
        setEmail('');
        setUsername('');
        setCustomCode('');
        setTimeout(() => {
          onClose();
          setMessage('');
        }, 2000);
      }
      
    } catch (err) {
      if (err.message.includes('users_username_key')) {
        setError('❌ รหัสนี้เพิ่งถูกใช้ไป ระบบหารหัสถัดไปใหม่ให้แล้ว ลองกดสร้างอีกครั้ง');
        nextCode.refresh();
      } else {
        setError(`เกิดข้อผิดพลาด: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 🔴 สร้างฟังก์ชันล้างค่าก่อนปิดหน้าต่าง
  const handleClose = () => {
    setName('');
    setEmail('');
    setUsername('');
    setCustomCode('');
    setError('');
    setMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
          <h3 className="text-lg font-bold">ลงทะเบียนบัญชีคุณครูคนใหม่</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleAddTutor} className="p-6 space-y-4">
          {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm break-words">{error}</div>}
          {message && <div className="bg-green-100 text-green-700 p-3 rounded-lg text-sm">{message}</div>}

          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase tracking-wider mb-2">รูปแบบรหัสครู</label>
            <div className="flex bg-gray-100 p-1 rounded-lg text-xs font-bold">
              {USERNAME_PREFIXES.tutor.map(({ prefix, digits }) => (
                <button
                  key={prefix}
                  type="button"
                  onClick={() => setUsernamePrefix(prefix)}
                  className={`flex-1 py-1.5 rounded-md transition ${usernamePrefix === prefix ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {prefix}{'X'.repeat(digits)}
                </button>
              ))}
            </div>
            {nextCode.error && <p className="text-[11px] text-red-500 mt-1">หารหัสถัดไปไม่สำเร็จ: {nextCode.error}</p>}
          </div>

          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase tracking-wider mb-2">ชื่อ - นามสกุล (ชื่อที่แสดง)</label>
            <div className="flex">
              <input
                type="text"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                placeholder={nextCode.loading ? '...' : nextCode.suggestion}
                title="เว้นว่างเพื่อใช้รหัสถัดไปอัตโนมัติ หรือพิมพ์รหัสที่ต้องการ"
                className="w-20 shrink-0 px-2 py-2 border border-r-0 border-gray-300 rounded-l-lg bg-gray-100 text-sm font-bold text-gray-700 text-center outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 placeholder:font-bold"
              />
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-r-lg text-sm" placeholder="เช่น ครูพี่สมชาย" required />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase tracking-wider mb-2">ชื่อผู้ใช้งาน (Username)</label>
            <div className="flex">
              <input
                type="text"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                placeholder={nextCode.loading ? '...' : nextCode.suggestion}
                title="เว้นว่างเพื่อใช้รหัสถัดไปอัตโนมัติ หรือพิมพ์รหัสที่ต้องการ"
                className="w-20 shrink-0 px-2 py-2 border border-r-0 border-gray-300 rounded-l-lg bg-gray-100 text-sm font-bold text-gray-700 text-center outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 placeholder:font-bold"
              />
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-r-lg text-sm" placeholder="เช่น สมชาย" required />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              {customCode.trim()
                ? <>ใช้รหัสที่กรอกเอง <span className="font-bold text-gray-700">{customCode.trim()}</span></>
                : <>เว้นช่องรหัสว่างไว้ ระบบจะใช้ <span className="font-bold text-gray-700">{nextCode.loading ? '...' : nextCode.suggestion}</span> ให้อัตโนมัติ</>}
            </p>
            {(name.trim() || username.trim()) && (customCode.trim() || nextCode.suggestion) && (
              <p className="text-[11px] text-gray-500 mt-0.5">
                จะได้ชื่อ <span className="font-bold text-gray-700">{customCode.trim() || nextCode.suggestion}{name.trim()}</span> · Username <span className="font-bold text-gray-700">{customCode.trim() || nextCode.suggestion}{username.trim()}</span>
              </p>
            )}
          </div>
          
          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase tracking-wider mb-2">อีเมล</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="เช่น somchai@gmail.com" required />
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