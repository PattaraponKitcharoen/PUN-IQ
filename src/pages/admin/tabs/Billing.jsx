import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import StudentInvoiceModal from '../modals/StudentInvoiceModal';

export default function Billing() {
  const [activeTab, setActiveTab] = useState('tutor');
  
  const [tutors, setTutors] = useState([]);
  const [students, setStudents] = useState([]);
  
  const [companyAccounts, setCompanyAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState([]);

  // 🔴 แก้บัค: เปลี่ยนชื่อตัวแปรเป็น itemId เพื่อป้องกันการตีกันของ ReferenceError id
  const toggleRow = (logId) => {
    setExpandedLogs(prev => prev.includes(logId) ? prev.filter(itemId => itemId !== logId) : [...prev, logId]);
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      const [
        { data: tutorsData },
        { data: studentsData },
        { data: accountsData }
      ] = await Promise.all([
        supabase.from('users').select('id, name, username').eq('role', 'tutor').order('name'),
        // 🔴 1. เพิ่มการดึง company_account_id ออกมาด้วย
        supabase.from('users').select('id, name, username, grade, company_account_id').eq('role', 'student').order('grade'),
        supabase.from('company_accounts').select('*').eq('is_active', true)
      ]);
      
      if (tutorsData) setTutors(tutorsData);
      if (studentsData) setStudents(studentsData);
      if (accountsData) {
        setCompanyAccounts(accountsData);
        if (accountsData.length > 0) setSelectedAccountId(accountsData[0].id);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'student' && selectedUserId && companyAccounts.length > 0) {
      const student = students.find(s => s.id === selectedUserId);
      if (student && student.company_account_id) {
        const matchedAccount = companyAccounts.find(acc => acc.id === student.company_account_id);
        setSelectedAccountId(matchedAccount ? matchedAccount.id : companyAccounts[0].id);
      } else {
        setSelectedAccountId(companyAccounts[0].id);
      }
    }
  }, [selectedUserId, activeTab, students, companyAccounts]);

  useEffect(() => {
    setSelectedUserId('');
    setLogs([]);
    setExpandedLogs([]);
  }, [activeTab]);

  useEffect(() => {
    if (!selectedUserId || !selectedMonth) {
      setLogs([]);
      return;
    }

    const fetchBillingLogs = async () => {
      setLoading(true);
      // 🔴 แก้ไขการคำนวณวันสิ้นเดือน ไม่ให้โดน Timezone เลื่อนวัน
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

      let query = supabase.from('teaching_logs');

      if (activeTab === 'tutor') {
        query = query
          .select('*, users!teaching_logs_student_id_fkey(name, username, grade), subjects(subject_name), custom_courses(course_name, grade_level)')
          .eq('tutor_id', selectedUserId);
      } else {
        query = query
          .select('*, users!teaching_logs_tutor_id_fkey(name, username), subjects(subject_name), custom_courses(course_name, grade_level)')
          .eq('student_id', selectedUserId);
      }

      query = query
        .gte('teaching_date', startDate)
        .lte('teaching_date', endDate)
        .order('teaching_date', { ascending: true });

      const { data, error } = await query;
      if (!error && data) setLogs(data);
      setLoading(false);
    };

    fetchBillingLogs();
  }, [selectedUserId, selectedMonth, activeTab]);

  const selectedUserDetails = activeTab === 'tutor' 
    ? tutors.find(t => t.id === selectedUserId)
    : students.find(s => s.id === selectedUserId);

  const selectedAccountDetails = companyAccounts.find(acc => acc.id === selectedAccountId);

  const calculateBilling = () => {
    let totalHrs = 0;
    let totalAmt = 0;

    const logsWithCalculation = logs.map(log => {
      const ratePerHour = activeTab === 'tutor' 
        ? (log.applied_tutor_rate || 0) 
        : (log.applied_student_rate || 0);
      
      // 🔴 ปรับปรุง: ดึงระดับชั้นจากล็อกการสอนที่ครูเลือกโดยตรง (log.grade_level)
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

  const { totalHrs, totalAmt, logsWithCalculation } = calculateBilling();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">ระบบการเงินและบิลลิ่ง (Billing)</h1>
        <p className="text-gray-500 mt-1">สรุปยอดชั่วโมงการสอนและคำนวณค่าตอบแทน/ค่าเรียนตามอัตราตั้งต้นอัตโนมัติ</p>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('tutor')}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-colors ${activeTab === 'tutor' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          สรุปค่าตอบแทนคุณครู (Tutor)
        </button>
        <button
          onClick={() => setActiveTab('student')}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-colors ${activeTab === 'student' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          สรุปค่าเรียนนักเรียน (Student)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-800 uppercase mb-3 border-b pb-2">ตัวกรองข้อมูล</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">ประจำเดือน</label>
                <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  {activeTab === 'tutor' ? 'เลือกคุณครู' : 'เลือกนักเรียน'}
                </label>
                <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-gray-50">
                  <option value="">-- กรุณาเลือก --</option>
                  {activeTab === 'tutor' 
                    ? tutors.map(t => <option key={t.id} value={t.id}>{t.name || t.username}</option>)
                    : students.map(s => <option key={s.id} value={s.id}>{s.name || s.username} ({s.grade || '-'})</option>)
                  }
                </select>
              </div>

              {activeTab === 'student' && companyAccounts.length > 0 && (
                <div className="pt-3 border-t border-gray-100 mt-2">
                  <label className="block text-xs font-bold text-gray-600 mb-1 text-amber-700">เลือกบัญชีรับเงิน (แสดงบนบิล)</label>
                  <select 
                    value={selectedAccountId} 
                    onChange={(e) => setSelectedAccountId(e.target.value)} 
                    className="w-full px-3 py-2 border border-amber-300 bg-amber-50 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 font-medium text-gray-700"
                  >
                    {companyAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.bank_name} - {acc.account_number}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {selectedUserId && (
            <div className={`rounded-xl shadow-sm border p-5 ${activeTab === 'tutor' ? 'bg-indigo-50 border-indigo-200' : 'bg-amber-50 border-amber-200'}`}>
              <h2 className={`text-sm font-bold uppercase mb-4 ${activeTab === 'tutor' ? 'text-indigo-800' : 'text-amber-800'}`}>สรุปยอดเงินเดือนนี้</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-white/60 p-3 rounded-lg">
                  <span className="text-sm text-gray-600 font-bold">รวมเวลาทั้งหมด:</span>
                  <span className="font-bold text-lg">{totalHrs} ชม.</span>
                </div>
                <div className="pt-2 border-t border-gray-200/50">
                  <span className="block text-xs font-bold text-gray-500 mb-1">ยอดสุทธิที่ต้องชำระ:</span>
                  <span className={`block text-3xl font-black ${activeTab === 'tutor' ? 'text-indigo-700' : 'text-amber-600'}`}>
                    ฿{totalAmt.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[500px]">
            {!selectedUserId ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20">
                <p>กรุณาเลือก{activeTab === 'tutor' ? 'คุณครู' : 'นักเรียน'}เพื่อดูรายละเอียดบิลลิ่ง</p>
              </div>
            ) : loading ? (
              <div className="text-center py-20 text-gray-400 animate-pulse">กำลังคำนวณยอดเงิน...</div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-6 border-b pb-4">
                  <div>
                    <div className="flex items-center space-x-4">
                      <h2 className="text-xl font-bold text-gray-800">
                        ใบแจ้งยอด {activeTab === 'tutor' ? 'ค่าตอบแทนผู้สอน' : 'ค่าธรรมเนียมการเรียน'}
                      </h2>
                      {activeTab === 'student' && logsWithCalculation.length > 0 && (
                        <button 
                          onClick={() => setShowInvoiceModal(true)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1.5 px-4 rounded-lg text-sm shadow-sm transition flex items-center space-x-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          <span>ดูบิลฉบับสมบูรณ์</span>
                        </button>
                      )}
                    </div>
                    <p className="text-gray-500 mt-1">ประจำเดือน {new Date(selectedMonth + '-01').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>

                {logsWithCalculation.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    ไม่มีประวัติการสอนในเดือนนี้
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead className="bg-gray-100 text-gray-600 border-b-2 border-gray-200">
                        <tr>
                          <th className="p-3 w-10"></th> 
                          <th className="p-3 font-bold">วันที่</th>
                          <th className="p-3 font-bold">{activeTab === 'tutor' ? 'สอนนักเรียน' : 'สอนโดยคุณครู'}</th>
                          <th className="p-3 font-bold">วิชา / คอร์ส</th>
                          <th className="p-3 font-bold">ระดับชั้น</th>
                          <th className="p-3 font-bold text-center">ชม.</th>
                          <th className="p-3 font-bold text-right">เรท/ชม.</th>
                          <th className="p-3 font-bold text-right">จำนวนเงิน</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {logsWithCalculation.map(log => (
                          <React.Fragment key={log.id}>
                            <tr onClick={() => toggleRow(log.id)} className="hover:bg-gray-50 cursor-pointer transition-colors group">
                              <td className="p-3 text-center">
                                <svg className={`w-4 h-4 text-gray-400 inline-block transition-transform ${expandedLogs.includes(log.id) ? 'rotate-90 text-blue-500' : 'group-hover:text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                              </td>
                              <td className="p-3 whitespace-nowrap text-gray-600">
                                {new Date(log.teaching_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                              </td>
                              <td className="p-3 font-semibold text-gray-800">
                                {log.users?.name || log.users?.username}
                              </td>
                              <td className="p-3">
                                {log.learning_type === 'course' ? (
                                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    🏆 {log.custom_courses?.course_name || 'คอร์สพิเศษ'}
                                  </span>
                                ) : (
                                  <div className="flex items-center space-x-1.5">
                                    <span className={`text-[10px] px-1 rounded font-bold ${log.learning_type === 'advanced' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                      {log.learning_type === 'advanced' ? 'Adv' : 'Gen'}
                                    </span>
                                    <span className="text-gray-800 font-medium">{log.subjects?.subject_name || '-'}</span>
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-gray-600 font-medium">{log.grade || '-'}</td>
                              <td className="p-3 text-center font-bold">{log.duration_hours}</td>
                              <td className="p-3 text-right text-gray-500">฿{log.ratePerHour}</td>
                              <td className="p-3 text-right font-bold text-gray-800">฿{log.amount.toLocaleString()}</td>
                            </tr>
                            
                            {expandedLogs.includes(log.id) && (
                              <tr className="bg-blue-50/40 border-b border-blue-100">
                                <td colSpan="8" className="p-4 px-12 text-sm">
                                  <div className="flex flex-col space-y-2 text-gray-700">
                                    <div className="flex items-center">
                                      <span className="font-bold text-blue-800 w-16">เวลา:</span>
                                      <span className="text-gray-700 font-medium">
                                        {log.start_time ? log.start_time.substring(0, 5) : '-'} น. ถึง {log.end_time ? log.end_time.substring(0, 5) : '-'} น.
                                      </span>
                                    </div>
                                    <div className="flex items-start">
                                      <span className="font-bold text-blue-800 w-16 shrink-0 mt-0.5">เนื้อหา:</span>
                                      <span className="text-gray-600 italic bg-white px-3 py-1.5 rounded border border-gray-100 shadow-sm w-full">
                                        {log.topic || 'ไม่ได้ระบุรายละเอียดเนื้อหา'}
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
              </>
            )}
          </div>
        </div>

      <StudentInvoiceModal 
        isOpen={showInvoiceModal} 
        onClose={() => setShowInvoiceModal(false)}
        student={selectedUserDetails}
        logs={logsWithCalculation}
        totalAmount={totalAmt}
        billingMonth={selectedMonth}
        companyAccount={selectedAccountDetails}
      />

      </div>
    </div>
  );
}