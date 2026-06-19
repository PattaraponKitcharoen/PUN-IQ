import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTutors: 0,
    totalGroups: 0,
    thisMonthHours: 0
  });
  
  const [recentLogs, setRecentLogs] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    fetchStats(); 
  }, []);

  useEffect(() => {
    fetchRecentLogs(currentPage); 
  }, [currentPage]);

  const fetchStats = async () => {
    setLoadingStats(true);
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const [
      { count: studentCount },
      { count: tutorCount },
      { count: groupCount },
      { data: logsData }
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'tutor'),
      supabase.from('groups').select('*', { count: 'exact', head: true }),
      supabase.from('teaching_logs').select('duration_hours').gte('teaching_date', startDate).lte('teaching_date', endDate)
    ]);

    const totalHours = logsData ? logsData.reduce((sum, log) => sum + Number(log.duration_hours), 0) : 0;

    setStats({
      totalStudents: studentCount || 0,
      totalTutors: tutorCount || 0,
      totalGroups: groupCount || 0,
      thisMonthHours: totalHours
    });
    setLoadingStats(false);
  };

  const fetchRecentLogs = async (page) => {
    setLoadingLogs(true);
    const from = (page - 1) * ITEMS_PER_PAGE;
    // 🔴 1. สั่งให้ดึงข้อมูล "เกินมา 1 ตัว" เพื่อพิสูจน์ว่ามีหน้าถัดไปจริงๆ ไหม
    const to = from + ITEMS_PER_PAGE; 

    const { data } = await supabase
      .from('teaching_logs')
      .select('*, users!teaching_logs_student_id_fkey(name, username), tutor:tutor_id(name), subjects(subject_name), custom_courses(course_name, grade_level)')
      .order('teaching_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (data) {
      // 🔴 2. เช็คว่าดึงมาได้เกินโควต้าไหม ถ้าเกินแปลว่ามีหน้าถัดไปชัวร์
      setHasMoreLogs(data.length > ITEMS_PER_PAGE); 
      // 🔴 3. ตัดตัวที่เกินทิ้งไป ให้แสดงผลแค่ 10 แถวพอดี
      setRecentLogs(data.slice(0, ITEMS_PER_PAGE)); 
    }
    setLoadingLogs(false);
  };

  // 🔴 2. ฟังก์ชันช่วยจัดฟอร์แมตเวลา
  const formatTime = (timeStr) => timeStr ? timeStr.substring(0, 5) : '-';

  if (loadingStats) return <div className="p-10 text-center text-gray-500 animate-pulse">กำลังโหลดแผงควบคุมภาพรวม...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      <div>
        <h1 className="text-2xl font-bold text-gray-800">ภาพรวมระบบ (Dashboard)</h1>
        <p className="text-gray-500 mt-1">ยินดีต้อนรับสู่ระบบจัดการ PUN-IQ Academy</p>
      </div>

      {/* โซน 1: Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4 border-l-4 border-l-blue-500">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg></div>
          <div><p className="text-xs font-bold text-gray-500 uppercase">นักเรียนทั้งหมด</p><p className="text-2xl font-black text-gray-800">{stats.totalStudents}</p></div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4 border-l-4 border-l-indigo-500">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></div>
          <div><p className="text-xs font-bold text-gray-500 uppercase">คุณครูในระบบ</p><p className="text-2xl font-black text-gray-800">{stats.totalTutors}</p></div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4 border-l-4 border-l-emerald-500">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg></div>
          <div><p className="text-xs font-bold text-gray-500 uppercase">กลุ่มเรียนคอร์ส</p><p className="text-2xl font-black text-gray-800">{stats.totalGroups}</p></div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4 border-l-4 border-l-amber-500">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
          <div><p className="text-xs font-bold text-gray-500 uppercase">ชั่วโมงสอนเดือนนี้</p><p className="text-2xl font-black text-gray-800">{stats.thisMonthHours}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        
        {/* โซน 2: ความเคลื่อนไหวล่าสุด พร้อมระบบ Pagination */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h2 className="font-bold text-gray-800">คลาสเรียนล่าสุดที่มีการบันทึก</h2>
          </div>
          
          <div className="overflow-x-auto flex-1 relative min-h-[300px]">
            {loadingLogs && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10">
                <span className="text-indigo-600 font-medium">กำลังโหลด...</span>
              </div>
            )}
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-white text-gray-500 text-xs uppercase">
                <tr>
                  <th className="p-4 font-semibold border-b whitespace-nowrap">วันที่สอน</th>
                  <th className="p-4 font-semibold border-b text-center whitespace-nowrap">เวลา</th> {/* 🔴 เพิ่มหัวตารางเวลา */}
                  <th className="p-4 font-semibold border-b">คุณครู</th>
                  <th className="p-4 font-semibold border-b">นักเรียน</th>
                  <th className="p-4 font-semibold border-b">วิชา (ระดับชั้น)</th> {/* 🔴 เพิ่มวงเล็บระดับชั้น */}
                  <th className="p-4 font-semibold text-center border-b">ชม.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentLogs.length === 0 ? (
                  <tr><td colSpan="6" className="p-6 text-center text-gray-400">ยังไม่มีการบันทึกเวลา</td></tr>
                ) : (
                  recentLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition">
                      <td className="p-4 text-gray-600 font-medium whitespace-nowrap">
                        {new Date(log.teaching_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                      </td>
                      {/* 🔴 เพิ่มคอลัมน์แสดงเวลาเริ่ม-สิ้นสุด */}
                      <td className="p-4 text-center text-gray-500 text-xs whitespace-nowrap">
                        {log.start_time && log.end_time ? `${formatTime(log.start_time)} - ${formatTime(log.end_time)}` : '-'}
                      </td>
                      <td className="p-4 font-medium text-gray-800">{log.tutor?.name || '-'}</td>
                      <td className="p-4 text-indigo-600 font-bold">{log.users?.name || log.users?.username}</td>
                      {/* 🔴 ปรับปรุงเงื่อนไขให้แสดงป้ายประเภท และวงเล็บระดับชั้น */}
                      <td className="p-4 text-gray-700">
                        {log.learning_type === 'course' ? (
                          <span className="font-semibold text-amber-700 text-xs">
                            🏆 {log.custom_courses?.course_name || 'คอร์สพิเศษ'} 
                            <span className="text-gray-500 font-normal ml-1">({log.custom_courses?.grade_level || '-'})</span>
                          </span>
                        ) : (
                          <div className="flex items-center space-x-1.5 whitespace-nowrap">
                            <span className={`text-[10px] px-1 rounded font-bold ${log.learning_type === 'advanced' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              {log.learning_type === 'advanced' ? 'Adv' : 'Gen'}
                            </span>
                            <span className="font-medium text-gray-800">
                              {log.subjects?.subject_name || '-'} 
                              <span className="text-gray-500 font-normal text-xs ml-1">({log.grade_level || '-'})</span>
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center font-bold">{log.duration_hours}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">
              หน้าที่ {currentPage}
            </span>
            <div className="flex space-x-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={currentPage === 1 || loadingLogs}
                className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                ก่อนหน้า
              </button>
              <button 
                onClick={() => setCurrentPage(p => p + 1)} 
                disabled={!hasMoreLogs || loadingLogs}
                className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                ถัดไป
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}