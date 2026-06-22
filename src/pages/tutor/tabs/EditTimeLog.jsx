import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';

export default function EditTimeLog() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // รับข้อมูล log ที่ส่งข้ามหน้ามาจาก HistoryLog.jsx
  const log = location.state?.log; 

  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ถ้าไม่มีข้อมูล log (เช่น แอบพิมพ์ URL เข้ามาตรงๆ) ให้เด้งกลับไปหน้าประวัติ
  useEffect(() => {
    if (!log) {
      // 🔴 อัปเดตให้เด้งกลับไปหน้าประวัติ (history)
      navigate('/tutor/history', { replace: true });
      return;
    }
    setDate(log.teaching_date || '');
    setStartTime(log.start_time ? log.start_time.substring(0, 5) : ''); 
    setEndTime(log.end_time ? log.end_time.substring(0, 5) : '');
    setTopic(log.topic || '');
  }, [log, navigate]);

  if (!log) return null;

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. คำนวณเวลาสอนใหม่
      const start = new Date(`1970-01-01T${startTime}:00`);
      const end = new Date(`1970-01-01T${endTime}:00`);
      let diff = (end - start) / (1000 * 60 * 60);

      if (diff <= 0) {
        throw new Error('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มสอน');
      }

      const duration_hours = Math.round(diff * 100) / 100;

      // 2. อัปเดตข้อมูลลง Database
      const { error: updateError } = await supabase
        .from('teaching_logs')
        .update({
          teaching_date: date,
          start_time: startTime,
          end_time: endTime,
          duration_hours: duration_hours,
          topic: topic
        })
        .eq('id', log.id);

      if (updateError) throw new Error(updateError.message);

      // 🔴 บันทึกสำเร็จ ให้เด้งกลับไปหน้าตารางประวัติ (history)
      navigate('/tutor/history');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center space-x-4 mb-6">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
          title="ย้อนกลับ"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">แก้ไขประวัติการสอน</h1>
          <p className="text-gray-500 text-sm mt-1">อัปเดตเวลาและเนื้อหาของคลาสเรียน</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-100 p-4 px-6 flex items-center">
          <svg className="w-5 h-5 text-amber-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="text-sm font-medium text-amber-800">กำลังแก้ไขข้อมูลของนักเรียน: <span className="font-bold">{log.users?.name || log.users?.username}</span></span>
        </div>

        <form onSubmit={handleUpdate} className="p-6 md:p-8 space-y-6">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-center"><svg className="w-5 h-5 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{error}</div>}

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">วันที่สอน</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-gray-50 hover:bg-white transition" required />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">เวลาเริ่ม</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-gray-50 hover:bg-white transition" required />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">เวลาสิ้นสุด</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-gray-50 hover:bg-white transition" required />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">เนื้อหาที่สอน / รายละเอียด (Topic)</label>
            <textarea 
              value={topic} 
              onChange={(e) => setTopic(e.target.value)} 
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none h-32 resize-none bg-gray-50 hover:bg-white transition" 
              placeholder="ระบุเนื้อหาที่สอน ความคืบหน้า หรือการบ้านที่สั่ง..."
            ></textarea>
          </div>

          <div className="pt-4 flex items-center justify-end space-x-3">
            <button type="button" onClick={() => navigate(-1)} className="px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition">
              ยกเลิก
            </button>
            <button type="submit" disabled={loading} className="px-8 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition shadow-lg shadow-amber-500/30 disabled:opacity-50 flex items-center">
              {loading ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}