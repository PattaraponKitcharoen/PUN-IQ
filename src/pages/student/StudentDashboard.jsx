import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
// 🔴 นำเข้า Modal ใบเสร็จ (ปรับ path ให้ตรงกับโครงสร้างโฟลเดอร์ของคุณ หากไม่ตรง)
import StudentInvoiceModal from '../admin/modals/StudentInvoiceModal';

export default function StudentDashboard() {
  const [sessionUser, setSessionUser] = useState(null);
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState([]);
  
  // 🔴 State สำหรับระบบใบแจ้งหนี้
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [companyAccount, setCompanyAccount] = useState(null);

  // 🔴 แก้บัคหน้าขาว: เปลี่ยนชื่อตัวแปรเป็น itemId
  const toggleRow = (logId) => {
    setExpandedLogs(prev => prev.includes(logId) ? prev.filter(itemId => itemId !== logId) : [...prev, logId]);
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      // 1. ดึงข้อมูล User Session
      const { data: { session } } = await supabase.auth.getSession();
      let currentUser = session?.user;
      
      if (currentUser) {
        const { data: profile } = await supabase
          .from('users')
          // 🔴 1. เพิ่มการดึง company_account_id
          .select('id, name, username, grade, company_account_id') 
          .eq('id', currentUser.id)
          .single();
          
        if (profile) currentUser = profile;
        setSessionUser(currentUser);
      }

      // 2. ดึงข้อมูลบัญชีธนาคารทั้งหมดที่ Active อยู่
      const { data: accountsData } = await supabase
        .from('company_accounts')
        .select('*')
        .eq('is_active', true);
      
      if (accountsData && accountsData.length > 0) {
        // 🔴 2. เลือกว่าจะโชว์บัญชีไหน (บัญชีที่ผูกไว้ หรือ บัญชี Default)
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
      // 🔴 แก้ไขการคำนวณวันสิ้นเดือน ไม่ให้โดน Timezone เลื่อนวัน
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

  const calculateSummary = () => {
    let totalHrs = 0;
    let totalAmt = 0;

    const logsWithCalculation = logs.map(log => {
      const ratePerHour = log.applied_student_rate || 0;
      
      // 🔴 ตรวจสอบการดึงระดับชั้นให้ครอบคลุมคอร์สพิเศษ
      const grade = log.learning_type === 'course'
        ? log.custom_courses?.grade_level
        : log.grade_level;
      
      const amount = Math.round(Number(log.duration_hours) * ratePerHour * 100) / 100;
      totalHrs += Number(log.duration_hours);
      totalAmt = Math.round((totalAmt + amount) * 100) / 100;

      return { ...log, grade, ratePerHour, amount };
    });

    return { totalHrs, totalAmt, logsWithCalculation };
  };

  const { totalHrs, totalAmt, logsWithCalculation } = calculateSummary();
  const formatTime = (timeStr) => timeStr ? timeStr.substring(0, 5) : '-';

  const handleOpenInvoice = () => {
    const today = new Date();
    // สร้าง String เดือนปัจจุบันในรูปแบบ YYYY-MM
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    if (selectedMonth === currentMonthStr) {
      window.alert('⏳ ยังไม่ถึงกำหนดชำระเงินของเดือนนี้\n\nระบบจะเปิดให้ออกใบแจ้งหนี้และดู QR Code ชำระเงินได้เมื่อสิ้นสุดเดือนครับ');
    } else {
      setShowInvoiceModal(true);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-8 text-white shadow-lg">
        <h1 className="text-3xl font-bold mb-2">สวัสดี, {sessionUser?.name || sessionUser?.username || 'นักเรียน'} 👋</h1>
        <p className="text-blue-100 opacity-90">ยินดีต้อนรับสู่ระบบประวัติการเรียนและการชำระเงิน คุณสามารถตรวจสอบรายละเอียดคลาสเรียนได้ที่นี่</p>
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
            <h2 className="text-sm font-bold uppercase mb-4 text-amber-800">สรุปยอดค่าเรียนเดือนนี้</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white/60 p-3 rounded-lg border border-amber-100">
                <span className="text-sm text-amber-900 font-medium">รวมเวลาเรียนทั้งหมด:</span>
                <span className="font-bold text-lg text-amber-700">{totalHrs} ชม.</span>
              </div>
              <div className="pt-2 border-t border-amber-200/50">
                <span className="block text-xs font-bold text-amber-700/70 mb-1 uppercase tracking-wider">ยอดรวมที่ต้องชำระ:</span>
                <span className="block text-4xl font-black text-amber-600 tracking-tight">
                  ฿{totalAmt.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ขวา: ตารางประวัติการสอน */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[400px]">
            
            {/* 🔴 เพิ่มปุ่มดูใบแจ้งหนี้ */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b pb-4 space-y-4 sm:space-y-0">
              <h2 className="text-xl font-bold text-gray-800">
                รายละเอียดการเรียน ประจำเดือน {new Date(selectedMonth + '-01').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
              </h2>
              {logsWithCalculation.length > 0 && (
                <button 
                  onClick={handleOpenInvoice}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg text-sm shadow-sm transition flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  <span>ดูใบแจ้งหนี้ / พิมพ์บิล</span>
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-20 text-gray-400 animate-pulse flex flex-col items-center">
                 <svg className="w-10 h-10 text-gray-300 mb-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 <p>กำลังดึงข้อมูลประวัติการเรียนของคุณ...</p>
              </div>
            ) : logsWithCalculation.length === 0 ? (
              <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center">
                 <span className="text-4xl mb-3">📅</span>
                 <p className="font-medium text-gray-600">ไม่มีประวัติการเรียนในเดือนนี้</p>
                 <p className="text-xs text-gray-400 mt-1">ลองเปลี่ยนเดือนที่ตัวกรองด้านซ้ายมือดูสิ</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-3 w-10 text-center">ดู</th> 
                      <th className="p-3 font-bold whitespace-nowrap">วันที่เรียน</th>
                      <th className="p-3 font-bold">วิชา / คอร์ส</th>
                      <th className="p-3 font-bold">สอนโดย</th>
                      <th className="p-3 font-bold text-center">ชม.</th>
                      <th className="p-3 font-bold text-right">เรท/ชม.</th>
                      <th className="p-3 font-bold text-right">จำนวนเงิน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {logsWithCalculation.map(log => (
                      <React.Fragment key={log.id}>
                        <tr onClick={() => toggleRow(log.id)} className="hover:bg-blue-50/30 cursor-pointer transition-colors group">
                          <td className="p-3 text-center">
                            <svg className={`w-4 h-4 text-gray-400 inline-block transition-transform ${expandedLogs.includes(log.id) ? 'rotate-90 text-blue-600' : 'group-hover:text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          </td>
                          <td className="p-3 whitespace-nowrap text-gray-700 font-medium">
                            {new Date(log.teaching_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                          </td>
                          <td className="p-3">
                            {log.learning_type === 'course' ? (
                              <span className="font-bold text-amber-700 text-xs">
                                🏆 {log.custom_courses?.course_name || 'คอร์สพิเศษ'} 
                                {/* 🔴 บังคับแสดงระดับชั้นให้แม่นยำ */}
                                <span className="text-gray-500 font-normal ml-1">({log.custom_courses?.grade_level || log.grade || '-'})</span>
                              </span>
                            ) : (
                              <div className="flex items-center space-x-1.5 whitespace-nowrap">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${log.learning_type === 'advanced' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {log.learning_type === 'advanced' ? 'Adv' : 'Gen'}
                                </span>
                                <span className="font-medium text-gray-800">
                                  {log.subjects?.subject_name || '-'} 
                                  <span className="text-gray-500 font-normal text-[11px] ml-1">({log.grade || '-'})</span>
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="p-3 font-medium text-gray-700">
                            {log.tutor?.name || log.tutor?.username}
                          </td>
                          <td className="p-3 text-center font-bold text-gray-800">{log.duration_hours}</td>
                          <td className="p-3 text-right text-gray-400 text-xs">฿{log.ratePerHour}</td>
                          <td className="p-3 text-right font-bold text-gray-900">฿{log.amount.toLocaleString()}</td>
                        </tr>
                        
                        {/* ส่วนขยายแสดงรายละเอียดเพิ่มเติม */}
                        {expandedLogs.includes(log.id) && (
                          <tr className="bg-blue-50/40 border-b border-blue-100">
                            <td colSpan="7" className="p-4 px-12 text-sm shadow-inner">
                              <div className="flex flex-col space-y-2 text-gray-700">
                                <div className="flex items-center">
                                  <span className="font-bold text-blue-800 w-16">เวลา:</span>
                                  <span className="text-gray-700 font-medium bg-white px-2 py-0.5 rounded border border-gray-200">
                                    {formatTime(log.start_time)} น. - {formatTime(log.end_time)} น.
                                  </span>
                                </div>
                                <div className="flex items-start">
                                  <span className="font-bold text-blue-800 w-16 shrink-0 mt-0.5">เนื้อหา:</span>
                                  <span className="text-gray-600 italic bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm w-full leading-relaxed">
                                    {log.topic || <span className="text-gray-400">คุณครูไม่ได้ระบุรายละเอียดเนื้อหาในคลาสนี้</span>}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🔴 เรียกใช้งาน Modal แจ้งหนี้ */}
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