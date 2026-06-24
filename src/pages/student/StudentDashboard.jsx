import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import StudentInvoiceModal from '../admin/modals/StudentInvoiceModal';

export default function StudentDashboard() {
  const [sessionUser, setSessionUser] = useState(null);
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [expandedGroups, setExpandedGroups] = useState([]);
  const [expandedLogs, setExpandedLogs] = useState([]);
  
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [companyAccount, setCompanyAccount] = useState(null);

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]);
  };

  const toggleRow = (logId) => {
    setExpandedLogs(prev => prev.includes(logId) ? prev.filter(itemId => itemId !== logId) : [...prev, logId]);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      let currentUser = session?.user;
      
      if (currentUser) {
        const { data: profile } = await supabase
          .from('users')
          .select('id, name, username, grade, company_account_id') 
          .eq('id', currentUser.id)
          .single();
          
        if (profile) currentUser = profile;
        setSessionUser(currentUser);
      }

      const { data: accountsData } = await supabase
        .from('company_accounts')
        .select('*')
        .eq('is_active', true);
      
      if (accountsData && accountsData.length > 0) {
        const targetAccount = accountsData.find(acc => acc.id === currentUser?.company_account_id);
        setCompanyAccount(targetAccount || accountsData[0]);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!sessionUser?.id || !selectedMonth) return;

    const fetchMyLogs = async () => {
      setLoading(true);
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('teaching_logs')
        .select('*, tutor:tutor_id(name, username), subjects(subject_name), custom_courses(course_name, grade_level)')
        .eq('student_id', sessionUser.id)
        .gte('teaching_date', startDate)
        .lte('teaching_date', endDate)
        .order('teaching_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (!error && data) {
        setLogs(data);
      }
      setLoading(false);
    };

    fetchMyLogs();
  }, [sessionUser?.id, selectedMonth]);

  const { totalHrs, totalAmt, logsWithCalculation } = useMemo(() => {
    let tHrs = 0;
    let tAmt = 0;

    const computedLogs = logs.map(log => {
      const ratePerHour = log.applied_student_rate || 0;
      const grade = log.learning_type === 'course'
        ? log.custom_courses?.grade_level
        : log.grade_level;
      
      let amount = 0;
      let roundsForDisplay = null;
      const isClassroom = log.tutor?.username === 'Classroom';

      if (isClassroom) {
        let rounds = 1;
        const courseName = log.custom_courses?.course_name || '';
        const match = courseName.match(/([\d.]+)\s*ชม\.\/รอบ/);
        if (match) {
          const hrsPerRound = Number(match[1]);
          rounds = Number(log.duration_hours) / hrsPerRound;
          roundsForDisplay = rounds;
        }
        amount = Math.round(rounds * ratePerHour * 100) / 100;
      } else {
        amount = Math.round(Number(log.duration_hours) * ratePerHour * 100) / 100;
      }

      tHrs += Number(log.duration_hours);
      tAmt = Math.round((tAmt + amount) * 100) / 100;

      return { ...log, grade, ratePerHour, amount, roundsForDisplay };
    });

    return { totalHrs: tHrs, totalAmt: tAmt, logsWithCalculation: computedLogs };
  }, [logs]);

  const formatTime = (timeStr) => timeStr ? timeStr.substring(0, 5) : '-';

  const groupedLogs = useMemo(() => {
    const groupedObj = {};
    
    logsWithCalculation.forEach(log => {
      const groupKey = `${log.tutor_id}_${log.learning_type}_${log.subject_id || 'no-subj'}_${log.custom_course_id || 'no-crs'}_${log.ratePerHour}`;

      if (!groupedObj[groupKey]) {
        groupedObj[groupKey] = {
          id: groupKey,
          tutor: log.tutor, 
          learning_type: log.learning_type,
          subjects: log.subjects,
          custom_courses: log.custom_courses,
          grade: log.grade,
          ratePerHour: log.ratePerHour,
          total_duration: 0,
          total_amount: 0,
          sessions: []
        };
      }
      
      groupedObj[groupKey].total_duration += Number(log.duration_hours);
      groupedObj[groupKey].total_amount += Number(log.amount);
      groupedObj[groupKey].sessions.push(log);
    });

    return Object.values(groupedObj);
  }, [logsWithCalculation]);

  const handleOpenInvoice = () => {
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    if (selectedMonth === currentMonthStr) {
      window.alert('⏳ ยังไม่ถึงกำหนดชำระเงินของเดือนนี้\n\nระบบจะเปิดให้ออกบิลและดู QR Code ชำระเงินได้เมื่อสิ้นสุดเดือนครับ');
    } else {
      setShowInvoiceModal(true);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-8 text-white shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-5">
          {/* 🔴 ปรับขนาดโลโก้ให้ใหญ่ขึ้นและดูพรีเมียมขึ้น */}
          <img 
            src="/logo.svg" 
            alt="PUN-IQ Logo" 
            className="w-16 h-16 sm:w-20 sm:h-20 object-contain bg-white/10 rounded-2xl p-2 shadow-sm border border-white/20" 
          />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">สวัสดี, {sessionUser?.name || sessionUser?.username || 'นักเรียน'} 👋</h1>
            <p className="text-blue-100 opacity-90 text-xs sm:text-sm">ยินดีต้อนรับสู่ระบบประวัติการเรียนและการชำระเงิน ตรวจสอบรายละเอียดได้ที่นี่</p>
          </div>
        </div>
        
        <button 
          onClick={handleLogout}
          className="bg-white/20 hover:bg-white/30 text-white font-semibold py-2.5 px-5 rounded-xl text-sm backdrop-blur-sm transition flex items-center space-x-2 whitespace-nowrap border border-white/10 shadow-sm mt-2 sm:mt-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>ออกจากระบบ</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* ซ้าย: ตัวกรองและสรุปยอด */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-800 uppercase mb-3 border-b pb-2">เลือกเดือนที่ต้องการดู</h2>
            <div>
              <input 
                type="month" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)} 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-medium text-gray-700 bg-gray-50 hover:bg-white transition" 
              />
            </div>
          </div>

          <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 p-5">
            <h2 className="text-sm font-bold uppercase mb-4 text-amber-800">สรุปยอดค่าใช้จ่ายเดือนนี้</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white/60 p-3 rounded-lg border border-amber-100">
                <span className="text-sm text-amber-900 font-medium">รวมระยะเวลาเข้าเรียน/ห้อง:</span>
                <span className="font-bold text-lg text-amber-700">{totalHrs} ชม.</span>
              </div>
              <div className="pt-2 border-t border-amber-200/50">
                <span className="block text-xs font-bold text-amber-700/70 mb-1 uppercase tracking-wider">ยอดรวมที่ต้องชำระสุทธิ:</span>
                <span className="block text-4xl font-black text-amber-600 tracking-tight">
                  ฿{totalAmt.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ขวา: ตารางประวัติ */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[400px]">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b pb-4 space-y-4 sm:space-y-0">
              <h2 className="text-xl font-bold text-gray-800">
                รายละเอียดประจำเดือน {new Date(selectedMonth + '-01').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
              </h2>
              {groupedLogs.length > 0 && (
                <button 
                  onClick={handleOpenInvoice}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg text-sm shadow-sm transition flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  <span>ดูบิลฉบับสมบูรณ์</span>
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-20 text-gray-400 animate-pulse flex flex-col items-center">
                 <svg className="w-10 h-10 text-gray-300 mb-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 <p>กำลังรวบรวมประวัติและคำนวณยอดบิลของคุณ...</p>
              </div>
            ) : groupedLogs.length === 0 ? (
              <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center">
                 <span className="text-4xl mb-3">📅</span>
                 <p className="font-medium text-gray-600">ไม่มีข้อมูลบันทึกในเดือนนี้</p>
                 <p className="text-xs text-gray-400 mt-1">สามารถเปลี่ยนเดือนเพื่อตรวจสอบข้อมูลย้อนหลังได้จากเมนูด้านซ้ายมือ</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-3 w-10 text-center">ดู</th> 
                      <th className="p-3 font-bold whitespace-nowrap">จำนวนครั้ง</th>
                      <th className="p-3 font-bold">ผู้สอน / สถานที่</th>
                      <th className="p-3 font-bold">รายการวิชา / แพ็กเกจห้อง</th>
                      <th className="p-3 font-bold text-center">เวลาสุทธิ</th>
                      <th className="p-3 font-bold text-right">เรทราคา</th>
                      <th className="p-3 font-bold text-right">รวมเป็นเงิน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groupedLogs.map((group) => {
                      const isRoomGroup = group.tutor?.username === 'Classroom';
                      
                      return (
                        <React.Fragment key={group.id}>
                          <tr onClick={() => toggleGroup(group.id)} className="hover:bg-blue-50/50 cursor-pointer transition-colors group border-b border-gray-100">
                            <td className="p-3 text-center">
                              <svg className={`w-4 h-4 text-gray-400 inline-block transition-transform ${expandedGroups.includes(group.id) ? 'rotate-90 text-blue-600' : 'group-hover:text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </td>
                            <td className="p-3 whitespace-nowrap text-blue-800 font-bold">{group.sessions.length} ครั้ง</td>
                            <td className="p-3 font-semibold text-gray-800">
                              {isRoomGroup ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">🏠 {group.tutor?.name}</span>
                              ) : (
                                <span>{group.tutor?.name || '-'}</span>
                              )}
                            </td>
                            <td className="p-3">
                              {isRoomGroup ? (
                                <span className="font-bold text-emerald-700 text-xs">🏆 {group.custom_courses?.course_name}</span>
                              ) : group.learning_type === 'course' ? (
                                <span className="font-bold text-amber-700 text-xs">
                                  🏆 {group.custom_courses?.course_name || 'คอร์สพิเศษ'} 
                                  <span className="text-gray-500 font-normal ml-1">({group.custom_courses?.grade_level || group.grade || '-'})</span>
                                </span>
                              ) : (
                                <div className="flex items-center space-x-1.5 whitespace-nowrap">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${group.learning_type === 'advanced' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{group.learning_type === 'advanced' ? 'Adv' : 'Gen'}</span>
                                  <span className="font-medium text-gray-800">{group.subjects?.subject_name} <span className="text-gray-500 font-normal text-[11px] ml-1">({group.grade || '-'})</span></span>
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center font-bold text-gray-800">{group.total_duration} ชม.</td>
                            <td className="p-3 text-right text-gray-400 text-xs">฿{group.ratePerHour?.toLocaleString()}</td>
                            <td className="p-3 text-right font-bold text-[#1b4379]">฿{group.total_amount.toLocaleString()}</td>
                          </tr>

                          {expandedGroups.includes(group.id) && group.sessions.map((session, index) => (
                            <React.Fragment key={session.id}>
                              <tr onClick={() => toggleRow(session.id)} className="bg-slate-50/50 hover:bg-slate-100 cursor-pointer border-l-4 border-blue-400 group">
                                <td className="p-2 border-r border-gray-200"></td>
                                <td colSpan="3" className="p-3 text-gray-600 font-medium">
                                  <div className="flex items-center">
                                    <svg className={`w-3.5 h-3.5 mr-2 transition-transform ${expandedLogs.includes(session.id) ? 'rotate-90 text-blue-600' : 'text-gray-400 group-hover:text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    ครั้งที่ {index + 1} : วันที่ {new Date(session.teaching_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                                  </div>
                                </td>
                                <td className="p-3 text-center font-bold text-gray-700">
                                  {session.duration_hours} ชม.
                                  {session.roundsForDisplay && (
                                    <span className="block text-[10px] text-emerald-600 font-bold mt-0.5">({session.roundsForDisplay} รอบ)</span>
                                  )}
                                </td>
                                <td className="p-3 text-right text-gray-400 text-xs">฿{session.ratePerHour}</td>
                                <td className="p-3 text-right font-bold text-gray-800">฿{session.amount.toLocaleString()}</td>
                              </tr>

                              {expandedLogs.includes(session.id) && (
                                <tr className="bg-blue-50/30 border-b border-gray-100 border-l-4 border-blue-400">
                                  <td className="border-r border-gray-200"></td>
                                  <td colSpan="6" className="p-4 px-10 text-sm shadow-inner">
                                    <div className="flex flex-col space-y-2 text-gray-700">
                                      <div className="flex items-center">
                                        <span className="font-bold text-blue-800 w-16">ช่วงเวลา:</span>
                                        <span className="text-gray-700 font-medium bg-white px-2 py-0.5 rounded border border-blue-100">
                                          {formatTime(session.start_time)} น. - {formatTime(session.end_time)} น.
                                        </span>
                                      </div>
                                      <div className="flex items-start">
                                        <span className="font-bold text-blue-800 w-16 shrink-0 mt-0.5">{isRoomGroup ? 'บันทึกช่วยจำ:' : 'เนื้อหา:'}</span>
                                        <span className="text-gray-600 italic bg-white px-3 py-2 rounded-lg border border-blue-100 shadow-sm w-full leading-relaxed">
                                          {session.topic || <span className="text-gray-400">ไม่ได้ระบุรายละเอียดเพิ่มเติม</span>}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <StudentInvoiceModal 
        isOpen={showInvoiceModal} 
        onClose={() => setShowInvoiceModal(false)}
        student={sessionUser}
        logs={logsWithCalculation}
        totalAmount={totalAmt}
        billingMonth={selectedMonth}
        companyAccount={companyAccount} 
      />

    </div>
  );
}