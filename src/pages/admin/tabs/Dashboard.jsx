import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTutors: 0,
    totalGroups: 0,
    thisMonthHours: 0
  });
  
  // 🔴 1. เพิ่ม State สำหรับเก็บข้อมูลการเงินและ Modal
  const [financialStats, setFinancialStats] = useState({ revenue: 0, expense: 0, profit: 0 });
  const [breakdownData, setBreakdownData] = useState({ revenue: [], expense: [] });
  const [activeModal, setActiveModal] = useState(null); // 'revenue' | 'expense' | null

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
    
    // 🔴 2. เพิ่มการดึงเรทราคาของเด็กและครู รวมถึงชื่อเพื่อเอามาแยกกลุ่ม
    const [
      { count: studentCount },
      { count: tutorCount },
      { count: groupCount },
      { data: logsData }
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'tutor'),
      supabase.from('groups').select('*', { count: 'exact', head: true }),
      supabase.from('teaching_logs')
        .select('duration_hours, applied_student_rate, applied_tutor_rate, users!teaching_logs_student_id_fkey(name, username), tutor:tutor_id(name)')
        .gte('teaching_date', startDate)
        .lte('teaching_date', endDate)
    ]);

    let totalHours = 0;
    let totalRev = 0;
    let totalExp = 0;
    let revMap = {};
    let expMap = {};

    // 🔴 3. ลอจิกคำนวณและจัดกลุ่มรายรับ-รายจ่าย
    if (logsData) {
      logsData.forEach(log => {
        const hrs = Number(log.duration_hours) || 0;
        totalHours += hrs;

        const rev = hrs * (Number(log.applied_student_rate) || 0);
        const exp = hrs * (Number(log.applied_tutor_rate) || 0);

        totalRev += rev;
        totalExp += exp;

        // จัดกลุ่มรายรับตามนักเรียน
        const studentName = log.users?.name || log.users?.username || 'ไม่ระบุชื่อนักเรียน';
        if (!revMap[studentName]) revMap[studentName] = 0;
        revMap[studentName] += rev;

        // จัดกลุ่มรายจ่ายตามครู
        const tutorName = log.tutor?.name || 'ไม่ระบุชื่อครู';
        if (!expMap[tutorName]) expMap[tutorName] = 0;
        expMap[tutorName] += exp;
      });
    }

    // แปลง Object ให้เป็น Array และเรียงลำดับจากยอดมากไปน้อย
    const revArray = Object.keys(revMap).map(name => ({ name, amount: revMap[name] })).sort((a,b) => b.amount - a.amount);
    const expArray = Object.keys(expMap).map(name => ({ name, amount: expMap[name] })).sort((a,b) => b.amount - a.amount);

    setBreakdownData({ revenue: revArray, expense: expArray });
    setFinancialStats({ revenue: totalRev, expense: totalExp, profit: totalRev - totalExp });

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
    const to = from + ITEMS_PER_PAGE; 

    const { data } = await supabase
      .from('teaching_logs')
      .select('*, users!teaching_logs_student_id_fkey(name, username), tutor:tutor_id(name), subjects(subject_name), custom_courses(course_name, grade_level)')
      .order('teaching_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (data) {
      setHasMoreLogs(data.length > ITEMS_PER_PAGE); 
      setRecentLogs(data.slice(0, ITEMS_PER_PAGE)); 
    }
    setLoadingLogs(false);
  };

  const formatTime = (timeStr) => timeStr ? timeStr.substring(0, 5) : '-';

  if (loadingStats) return <div className="p-10 text-center text-gray-500 animate-pulse">กำลังโหลดแผงควบคุมภาพรวม...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 relative">
      
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

      {/* 🔴 4. โซนการเงินประจำเดือน (คลิกได้) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div 
          onClick={() => setActiveModal('revenue')}
          className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between cursor-pointer hover:ring-2 hover:ring-green-400 transition group"
        >
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase group-hover:text-green-600 transition">รายรับเดือนนี้ (ยอดโอนเด็ก)</p>
            <p className="text-2xl font-black text-green-600">฿ {financialStats.revenue.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-green-50 text-green-600 rounded-lg group-hover:bg-green-100 transition">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          </div>
        </div>
        
        <div 
          onClick={() => setActiveModal('expense')}
          className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between cursor-pointer hover:ring-2 hover:ring-red-400 transition group"
        >
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase group-hover:text-red-600 transition">รายจ่ายเดือนนี้ (ยอดโอนครู)</p>
            <p className="text-2xl font-black text-red-500">฿ {financialStats.expense.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-red-50 text-red-500 rounded-lg group-hover:bg-red-100 transition">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5 rounded-xl border border-slate-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">กำไรสุทธิคาดการณ์</p>
            <p className="text-2xl font-black text-white">฿ {financialStats.profit.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-white/10 text-white rounded-lg">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
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
                  <th className="p-4 font-semibold border-b text-center whitespace-nowrap">เวลา</th>
                  <th className="p-4 font-semibold border-b">คุณครู</th>
                  <th className="p-4 font-semibold border-b">นักเรียน</th>
                  <th className="p-4 font-semibold border-b">วิชา (ระดับชั้น)</th>
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
                      <td className="p-4 text-center text-gray-500 text-xs whitespace-nowrap">
                        {log.start_time && log.end_time ? `${formatTime(log.start_time)} - ${formatTime(log.end_time)}` : '-'}
                      </td>
                      <td className="p-4 font-medium text-gray-800">{log.tutor?.name || '-'}</td>
                      <td className="p-4 text-indigo-600 font-bold">{log.users?.name || log.users?.username}</td>
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

      {/* 🔴 5. Modal สำหรับแจกแจงยอดเงิน */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className={`p-5 border-b flex justify-between items-center text-white ${activeModal === 'revenue' ? 'bg-green-600' : 'bg-red-500'}`}>
              <div>
                <h3 className="font-bold text-lg">
                  {activeModal === 'revenue' ? 'สรุปยอดที่ต้องเรียกเก็บนักเรียน' : 'สรุปยอดที่ต้องโอนจ่ายคุณครู'}
                </h3>
                <p className="text-sm opacity-90 mt-0.5">ประจำเดือนนี้</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/20 rounded-lg transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-0 overflow-y-auto flex-1 bg-gray-50">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 sticky top-0 shadow-sm">
                  <tr>
                    <th className="p-4 font-semibold text-gray-600">{activeModal === 'revenue' ? 'ชื่อนักเรียน' : 'ชื่อคุณครูผู้สอน'}</th>
                    <th className="p-4 font-semibold text-gray-600 text-right">ยอดรวม (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {(activeModal === 'revenue' ? breakdownData.revenue : breakdownData.expense).map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition">
                      <td className="p-4 font-medium text-gray-800">{item.name}</td>
                      <td className={`p-4 text-right font-bold ${activeModal === 'revenue' ? 'text-green-600' : 'text-red-500'}`}>
                        {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {(activeModal === 'revenue' ? breakdownData.revenue : breakdownData.expense).length === 0 && (
                    <tr>
                      <td colSpan="2" className="p-8 text-center text-gray-400">ยังไม่มียอดเงินในเดือนนี้</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 border-t bg-white flex justify-between items-center">
              <span className="font-bold text-gray-600">ยอดรวมทั้งหมด</span>
              <span className={`text-xl font-black ${activeModal === 'revenue' ? 'text-green-600' : 'text-red-500'}`}>
                ฿ {(activeModal === 'revenue' ? financialStats.revenue : financialStats.expense).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}