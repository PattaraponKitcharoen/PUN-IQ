import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function HistoryLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // ฟังก์ชันพาไปหน้าแก้ไข
  const handleEditClick = (log) => {
    navigate('/tutor/edit-log', { state: { log } });
  };

  // 🔴 1. เพิ่มฟังก์ชันสำหรับลบ Log
  const handleDeleteClick = async (logId, date, studentName) => {
    const confirmDelete = window.confirm(
      `⚠️ ยืนยันการลบประวัติการสอน?\n\nคุณต้องการลบ Log วันที่ ${new Date(date).toLocaleDateString('th-TH')} ของนักเรียน "${studentName}" ใช่หรือไม่? \n(การกระทำนี้ไม่สามารถย้อนกลับได้)`
    );

    if (!confirmDelete) return;

    try {
      const { error: deleteError } = await supabase
        .from('teaching_logs')
        .delete()
        .eq('id', logId);

      if (deleteError) throw new Error(deleteError.message);

      // ลบสำเร็จ ให้ดึงข้อมูลมาแสดงใหม่ทันที
      fetchLogs();
    } catch (err) {
      setError(`ไม่สามารถลบข้อมูลได้: ${err.message}`);
      setTimeout(() => setError(''), 4000); // ล้างแจ้งเตือน Error หลัง 4 วินาที
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const tutorId = session?.user?.id;

    if (tutorId) {
      const { data, error } = await supabase
        .from('teaching_logs')
        .select('*, users!teaching_logs_student_id_fkey(name, username), subjects(subject_name), custom_courses(course_name)')
        .eq('tutor_id', tutorId)
        .order('teaching_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && data) setLogs(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatTime = (timeStr) => timeStr ? timeStr.substring(0, 5) : '-';

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">ประวัติการสอน</h1>
        <p className="text-gray-500 mt-1">ดูประวัติการลงเวลาย้อนหลัง แก้ไข หรือลบข้อมูลคลาสเรียน</p>
      </div>

      {/* กล่องแสดงข้อความแจ้งเตือน Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold">
          ⚠️ {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {loading ? (
          <div className="text-center py-10 text-gray-400 animate-pulse">กำลังโหลดประวัติการสอน...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-10 text-gray-400">ยังไม่มีประวัติการสอนในระบบ</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs uppercase tracking-wider">
                  <th className="p-3">วันที่</th>
                  <th className="p-3 text-center">เวลา</th>
                  <th className="p-3">ประเภทคลาส / รายวิชา</th>
                  <th className="p-3">นักเรียน</th>
                  <th className="p-3 text-center">ชม.</th>
                  {/* ปรับความกว้างคอลัมน์ให้รองรับ 2 ปุ่ม */}
                  <th className="p-3 text-center w-28">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map(log => {
                  const studentName = log.users?.name || log.users?.username || '-';
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 text-sm transition-colors">
                      <td className="p-3 whitespace-nowrap text-gray-600 font-medium">
                        {new Date(log.teaching_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="p-3 text-center text-gray-500 text-xs whitespace-nowrap">
                        {log.start_time && log.end_time ? `${formatTime(log.start_time)} - ${formatTime(log.end_time)}` : '-'}
                      </td>
                      <td className="p-3">
                        {log.learning_type === 'course' ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            🏆 {log.custom_courses?.course_name || 'คอร์สพิเศษ'}
                          </span>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              log.learning_type === 'advanced' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                            }`}>
                              {log.learning_type === 'advanced' ? 'Advanced' : 'General'}
                            </span>
                            <span className="text-gray-800 font-medium">{log.subjects?.subject_name || '-'}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-indigo-700 font-semibold">{studentName}</td>
                      <td className="p-3 text-center font-bold text-gray-800 bg-gray-50/50">{log.duration_hours}</td>
                      
                      {/* 🔴 2. เพิ่มปุ่มลบลมถังขยะสีแดงวางคู่กับปุ่มแก้ไข */}
                      <td className="p-3 text-center space-x-1">
                        <button 
                          onClick={() => handleEditClick(log)} 
                          className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition inline-flex items-center justify-center" 
                          title="แก้ไขประวัติการสอน"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        
                        <button 
                          onClick={() => handleDeleteClick(log.id, log.teaching_date, studentName)} 
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition inline-flex items-center justify-center" 
                          title="ลบประวัติการสอน"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}