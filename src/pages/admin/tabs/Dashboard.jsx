import { useState, useEffect, Fragment } from 'react';
import { supabase } from '../../../lib/supabase';
import { exportMonthlyReport, fetchAllLogs, calcLog, getItemLabel, LEARNING_TYPE_LABEL } from '../../../lib/exportMonthlyReport';

const DASHBOARD_LOG_SELECT = 'teaching_date, start_time, end_time, duration_hours, learning_type, grade_level, topic, applied_student_rate, applied_tutor_rate, student:users!teaching_logs_student_id_fkey(id, name, username), tutor:users!teaching_logs_tutor_id_fkey(id, name, username), subjects(subject_name), custom_courses(course_name, grade_level)';

export default function Dashboard() {
  // 🔴 1. เพิ่ม State เก็บค่าเดือน (ค่าเริ่มต้นคือเดือนปัจจุบัน)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTutors: 0,
    totalGroups: 0,
    thisMonthHours: 0
  });
  
  const [financialStats, setFinancialStats] = useState({ 
    revenue: 0, 
    expense: 0, 
    profit: 0, 
    roomRevenue: 0,
    teachingProfit: 0 
  });
  const [breakdownData, setBreakdownData] = useState({ revenue: [], expense: [], roomRevenue: [] });
  const [activeModal, setActiveModal] = useState(null);
  const [exporting, setExporting] = useState(false);
  // แถวที่กางดูรายละเอียดอยู่ เก็บเป็น `${modal}:${key}` จึงไม่ค้างข้ามหน้าต่าง
  const [expandedRow, setExpandedRow] = useState(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportMonthlyReport(selectedMonth);
    } catch (err) {
      alert(`❌ Export ไม่สำเร็จ: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const [recentLogs, setRecentLogs] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const ITEMS_PER_PAGE = 10;

  // 🔴 2. ให้ดึงข้อมูลใหม่ทุกครั้งที่เดือนเปลี่ยน
  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true);
    
      // 🔴 3. คำนวณวันแรกและวันสุดท้ายจาก selectedMonth
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    
      const [
        { count: studentCount },
        { count: tutorCount },
        { count: groupCount },
        logsData
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'tutor').neq('username', 'Classroom'),
        supabase.from('groups').select('*', { count: 'exact', head: true }),
        fetchAllLogs(startDate, endDate, DASHBOARD_LOG_SELECT).catch(() => [])
      ]);

      let totalHours = 0;
      let totalTeachingRev = 0; 
      let totalExp = 0;
      let totalRoomRental = 0; 
      let revMap = {};
      let expMap = {};
      let roomMap = {}; 

      // เก็บยอดรวมพร้อมรายการย่อยของแต่ละคน (ใช้ id เป็น key กันชื่อซ้ำ)
      const addEntry = (map, key, name, amount, item) => {
        if (!map[key]) map[key] = { key, name, amount: 0, hours: 0, items: [] };
        map[key].amount += amount;
        map[key].hours += item.hours;
        map[key].items.push(item);
      };

      logsData.forEach(log => {
        const c = calcLog(log);
        const studentKey = log.student?.id || 'unknown-student';
        const studentName = log.student?.name || log.student?.username || 'ไม่ระบุชื่อ';
        const tutorName = log.tutor?.name || log.tutor?.username || 'ไม่ระบุชื่อครู';
        const base = {
          date: log.teaching_date,
          start: log.start_time,
          end: log.end_time,
          hours: c.hrs,
          label: getItemLabel(log, c.isClassroom),
          type: c.isClassroom ? 'room' : log.learning_type,
          grade: log.learning_type === 'course' || c.isClassroom ? log.custom_courses?.grade_level : log.grade_level,
          topic: log.topic,
        };

        if (c.isClassroom) {
          totalRoomRental += c.roomRevenue;
          addEntry(roomMap, studentKey, studentName, c.roomRevenue, { ...base, who: `${c.rounds.toLocaleString(undefined, { maximumFractionDigits: 2 })} รอบ`, rate: Number(log.applied_student_rate) || 0, amount: c.roomRevenue });
        } else {
          totalHours += c.hrs;
          totalTeachingRev += c.revenue; 
          totalExp += c.cost;
          addEntry(revMap, studentKey, studentName, c.revenue, { ...base, who: tutorName, rate: Number(log.applied_student_rate) || 0, amount: c.revenue });
          addEntry(expMap, log.tutor?.id || 'unknown-tutor', tutorName, c.cost, { ...base, who: studentName, rate: Number(log.applied_tutor_rate) || 0, amount: c.cost });
        }
      });

      const toSortedArray = (map) => Object.values(map)
        .map(entry => ({ ...entry, items: entry.items.sort((a, b) => `${a.date}${a.start || ''}`.localeCompare(`${b.date}${b.start || ''}`)) }))
        .sort((a, b) => b.amount - a.amount);
      const revArray = toSortedArray(revMap);
      const expArray = toSortedArray(expMap);
      const roomArray = toSortedArray(roomMap);

      const teachingProfit = totalTeachingRev - totalExp;
      const finalProfit = teachingProfit + totalRoomRental; 

      setBreakdownData({ revenue: revArray, expense: expArray, roomRevenue: roomArray });
      setFinancialStats({ 
        revenue: totalTeachingRev, 
        expense: totalExp, 
        teachingProfit: teachingProfit, 
        roomRevenue: totalRoomRental,
        profit: finalProfit
      });

      setStats({
        totalStudents: studentCount || 0,
        totalTutors: tutorCount || 0,
        totalGroups: groupCount || 0,
        thisMonthHours: totalHours
      });
      setLoadingStats(false);
    };

    if (selectedMonth) {
      fetchStats(); 
    }
  }, [selectedMonth]);

  useEffect(() => {
    const fetchRecentLogs = async (page) => {
      setLoadingLogs(true);
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE; 

      // 🔴 4. เพิ่มเงื่อนไขกรองเดือนสำหรับตารางด้วย
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

      const { data } = await supabase
        .from('teaching_logs')
        .select('*, users!teaching_logs_student_id_fkey(name, username), tutor:users!teaching_logs_tutor_id_fkey(name, username), subjects(subject_name), custom_courses(course_name, grade_level)')
        .gte('teaching_date', startDate)
        .lte('teaching_date', endDate)
        .order('teaching_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (data) {
        setHasMoreLogs(data.length > ITEMS_PER_PAGE); 
        setRecentLogs(data.slice(0, ITEMS_PER_PAGE)); 
      }
      setLoadingLogs(false);
    };

    if (selectedMonth) {
      fetchRecentLogs(currentPage); 
    }
  }, [currentPage, selectedMonth]);

  const formatTime = (timeStr) => timeStr ? timeStr.substring(0, 5) : '-';

  const getModalConfig = () => {
    switch (activeModal) {
      case 'revenue':
        return {
          title: 'สรุปยอดเรียกเก็บนักเรียน (เฉพาะค่าคอร์สเรียน)',
          data: breakdownData.revenue,
          total: financialStats.revenue,
          bgHeader: 'bg-green-600',
          textAmount: 'text-green-600',
          colName: 'ชื่อนักเรียน',
          whoLabel: 'ครูผู้สอน'
        };
      case 'expense':
        return {
          title: 'สรุปยอดที่ต้องโอนจ่ายคุณครู',
          data: breakdownData.expense,
          total: financialStats.expense,
          bgHeader: 'bg-red-500',
          textAmount: 'text-red-500',
          colName: 'ชื่อคุณครูผู้สอน',
          whoLabel: 'นักเรียน'
        };
      case 'roomRevenue':
        return {
          title: 'สรุปรายได้ค่าเช่าห้องสถาบัน',
          data: breakdownData.roomRevenue,
          total: financialStats.roomRevenue,
          bgHeader: 'bg-emerald-600',
          textAmount: 'text-emerald-600',
          colName: 'ชื่อผู้เช่า (นักเรียน)',
          whoLabel: 'จำนวนรอบ'
        };
      case 'profit':
        return {
          title: 'สรุปกำไรสุทธิรวมบริษัท',
          isProfit: true, 
          data: [
            { name: 'กำไรจากการสอน', amount: financialStats.teachingProfit },
            { name: 'รายได้จากการปล่อยเช่าสถานที่', amount: financialStats.roomRevenue }
          ],
          total: financialStats.profit,
          bgHeader: 'bg-slate-800',
          textAmount: 'text-slate-800',
          colName: 'ประเภทรายได้'
        };
      default:
        return null;
    }
  };

  const modalConfig = getModalConfig();

  if (loadingStats) return <div className="p-10 text-center text-gray-500 animate-pulse">กำลังโหลดแผงควบคุมภาพรวม...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 relative pb-10">
      
      {/* 🔴 5. เพิ่ม UI สำหรับเลือกเดือนที่ส่วน Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ภาพรวมระบบ (Dashboard)</h1>
          <p className="text-gray-500 mt-1">ยินดีต้อนรับสู่ระบบจัดการ PUN-IQ Academy</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200 flex items-center space-x-3 w-full md:w-auto">
          <span className="text-sm font-bold text-gray-600 uppercase whitespace-nowrap">สรุปยอดประจำเดือน:</span>
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              setCurrentPage(1); // รีเซ็ตกลับไปหน้าที่ 1 เสมอเมื่อเปลี่ยนเดือน
            }} 
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-auto"
          />
          <button
            onClick={handleExport}
            disabled={exporting}
            title="ดาวน์โหลดสรุปนักเรียน ครู ค่าเช่าห้อง และข้อมูลดิบของเดือนนี้เป็นไฟล์ Excel"
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition shadow-sm whitespace-nowrap disabled:opacity-60 disabled:cursor-wait"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            <span>{exporting ? 'กำลังสร้างไฟล์...' : 'Export Excel'}</span>
          </button>
        </div>
      </div>

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => setActiveModal('revenue')}
          className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between cursor-pointer hover:ring-2 hover:ring-green-400 transition group"
        >
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase group-hover:text-green-600 transition">ยอดเก็บค่าเรียน (ไม่รวมห้อง)</p>
            <p className="text-xl font-black text-green-600">฿ {financialStats.revenue.toLocaleString()}</p>
          </div>
          <div className="p-2.5 bg-green-50 text-green-600 rounded-lg group-hover:bg-green-100 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          </div>
        </div>
        
        <div 
          onClick={() => setActiveModal('expense')}
          className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between cursor-pointer hover:ring-2 hover:ring-red-400 transition group"
        >
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase group-hover:text-red-600 transition">รายจ่ายรวม (ยอดโอนครู)</p>
            <p className="text-xl font-black text-red-500">฿ {financialStats.expense.toLocaleString()}</p>
          </div>
          <div className="p-2.5 bg-red-50 text-red-500 rounded-lg group-hover:bg-red-100 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
          </div>
        </div>

        <div 
          onClick={() => setActiveModal('roomRevenue')}
          className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between border-b-4 border-b-emerald-500 cursor-pointer hover:ring-2 hover:ring-emerald-400 transition group"
        >
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase group-hover:text-emerald-600 transition">รายได้เช่าห้องสถานที่</p>
            <p className="text-xl font-black text-emerald-600">฿ {financialStats.roomRevenue.toLocaleString()}</p>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
        </div>

        <div 
          onClick={() => setActiveModal('profit')}
          className="bg-gradient-to-br from-slate-800 to-slate-900 p-5 rounded-xl border border-slate-700 shadow-sm flex items-center justify-between cursor-pointer hover:ring-2 hover:ring-slate-400 transition group"
        >
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase group-hover:text-white transition">กำไรสุทธิรวมบริษัท</p>
            <p className="text-xl font-black text-white">฿ {financialStats.profit.toLocaleString()}</p>
          </div>
          <div className="p-2.5 bg-white/10 text-white rounded-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h2 className="font-bold text-gray-800">รายการบันทึกของเดือนที่เลือก</h2>
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
                  <th className="p-4 font-semibold border-b whitespace-nowrap">วันที่บันทึก</th>
                  <th className="p-4 font-semibold border-b text-center whitespace-nowrap">เวลา</th>
                  <th className="p-4 font-semibold border-b">ผู้สอน / สถานที่</th>
                  <th className="p-4 font-semibold border-b">นักเรียน / ผู้เช่า</th>
                  <th className="p-4 font-semibold border-b">รายการ (ระดับชั้น)</th>
                  <th className="p-4 font-semibold text-center border-b">ชม.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentLogs.length === 0 ? (
                  <tr><td colSpan="6" className="p-6 text-center text-gray-400">ยังไม่มีการบันทึกเวลาในเดือนนี้</td></tr>
                ) : (
                  recentLogs.map((log) => {
                    const isClassroom = log.tutor?.username === 'Classroom';

                    return (
                      <tr key={log.id} className="hover:bg-gray-50 transition">
                        <td className="p-4 text-gray-600 font-medium whitespace-nowrap">
                          {new Date(log.teaching_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="p-4 text-center text-gray-500 text-xs whitespace-nowrap">
                          {log.start_time && log.end_time ? `${formatTime(log.start_time)} - ${formatTime(log.end_time)}` : '-'}
                        </td>
                        <td className="p-4 font-medium">
                          {isClassroom ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">🏠 {log.tutor?.name}</span>
                          ) : (
                            <span className="text-gray-800">{log.tutor?.name || '-'}</span>
                          )}
                        </td>
                        <td className="p-4 text-indigo-600 font-bold">{log.users?.name || log.users?.username}</td>
                        <td className="p-4 text-gray-700 max-w-[220px] truncate">
                          {isClassroom ? (
                            <span className="text-xs text-emerald-700 font-bold truncate block">
                              🏆 {log.custom_courses?.course_name || 'เช่าสถานที่'}
                            </span>
                          ) : log.learning_type === 'course' ? (
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
                        <td className="p-4 text-center font-bold">
                          {log.duration_hours} ชม.
                        </td>
                      </tr>
                    );
                  })
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

      {modalConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className={`p-5 border-b flex justify-between items-center text-white ${modalConfig.bgHeader}`}>
              <div>
                <h3 className="font-bold text-lg">{modalConfig.title}</h3>
                <p className="text-sm opacity-90 mt-0.5">ประจำเดือนที่เลือก{!modalConfig.isProfit && ' · กดที่ชื่อเพื่อดูรายละเอียด'}</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/20 rounded-lg transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-0 overflow-y-auto flex-1 bg-gray-50">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 sticky top-0 shadow-sm">
                  <tr>
                    <th className="p-4 font-semibold text-gray-600">{modalConfig.colName}</th>
                    <th className="p-4 font-semibold text-gray-600 text-right">ยอดรวม (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {modalConfig.data.map((item, index) => {
                    const rowId = `${activeModal}:${item.key ?? index}`;
                    const canExpand = Array.isArray(item.items) && item.items.length > 0;
                    const isExpanded = expandedRow === rowId;
                    return (
                      <Fragment key={rowId}>
                        <tr
                          onClick={canExpand ? () => setExpandedRow(isExpanded ? null : rowId) : undefined}
                          className={`transition ${canExpand ? 'cursor-pointer hover:bg-gray-50' : ''} ${isExpanded ? 'bg-gray-50' : ''}`}
                        >
                          <td className="p-4 font-medium text-gray-800">
                            <div className="flex items-center space-x-2">
                              {canExpand && (
                                <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                              )}
                              <div>
                                <p>
                                  {modalConfig.isProfit && item.name.includes('เช่า') && '🏠 '}
                                  {modalConfig.isProfit && item.name.includes('สอน') && '📚 '}
                                  {item.name}
                                </p>
                                {canExpand && (
                                  <p className="text-xs text-gray-400 font-normal mt-0.5">
                                    {item.items.length} ครั้ง · {item.hours.toLocaleString(undefined, { maximumFractionDigits: 2 })} ชม.
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className={`p-4 text-right font-bold ${modalConfig.textAmount}`}>
                            {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan="2" className="px-4 pb-4 pt-0 bg-gray-50">
                              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                                <table className="w-full text-xs">
                                  <thead className="bg-gray-100 text-gray-500">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">วันที่</th>
                                      <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">เวลา</th>
                                      <th className="px-3 py-2 text-left font-semibold">{modalConfig.whoLabel}</th>
                                      <th className="px-3 py-2 text-left font-semibold">รายการ</th>
                                      <th className="px-3 py-2 text-right font-semibold">ชม.</th>
                                      <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">เรท</th>
                                      <th className="px-3 py-2 text-right font-semibold">เงิน</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {item.items.map((d, i) => (
                                      <tr key={i} className="align-top">
                                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                                          {new Date(d.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                        </td>
                                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                                          {d.start && d.end ? `${formatTime(d.start)}-${formatTime(d.end)}` : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-gray-800 font-medium">{d.who}</td>
                                        <td className="px-3 py-2 text-gray-700">
                                          <span className="font-medium">{d.label}</span>
                                          <span className="text-gray-400 ml-1">
                                            ({d.type === 'room' ? 'เช่าห้อง' : (LEARNING_TYPE_LABEL[d.type] || d.type)}{d.grade ? ` · ${d.grade}` : ''})
                                          </span>
                                          {d.topic && <p className="text-gray-400 mt-0.5 truncate max-w-[220px]" title={d.topic}>{d.topic}</p>}
                                        </td>
                                        <td className="px-3 py-2 text-right text-gray-700">{d.hours.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                        <td className="px-3 py-2 text-right text-gray-500">{d.rate.toLocaleString()}</td>
                                        <td className={`px-3 py-2 text-right font-bold ${modalConfig.textAmount}`}>
                                          {d.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {modalConfig.data.length === 0 && (
                    <tr>
                      <td colSpan="2" className="p-8 text-center text-gray-400">ยังไม่มียอดเงินในเดือนที่เลือก</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 border-t bg-white flex justify-between items-center">
              <span className="font-bold text-gray-600">ยอดรวมทั้งหมด</span>
              <span className={`text-xl font-black ${modalConfig.textAmount}`}>
                ฿ {modalConfig.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}