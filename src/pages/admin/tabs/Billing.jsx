import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import StudentInvoiceModal from '../modals/StudentInvoiceModal';
import TutorPayslipModal from '../modals/TutorPayslipModal';

// 🔴 1. นำเข้าไลบรารี ZIP และ File Saver เพิ่มเติม
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import StudentInvoice from '../StudentInvoice';
import TutorPayslip from '../TutorPayslip';
import { toJpeg } from 'html-to-image';

export default function Billing() {
  const [activeTab, setActiveTab] = useState('tutor');
  const [tutors, setTutors] = useState([]);
  const [students, setStudents] = useState([]);
  const [companyAccounts, setCompanyAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showTutorModal, setShowTutorModal] = useState(false);
  
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [expandedGroups, setExpandedGroups] = useState([]);
  const [expandedLogs, setExpandedLogs] = useState([]);

  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const [batchRenderData, setBatchRenderData] = useState(null);

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]);
  };

  const toggleRow = (logId) => {
    setExpandedLogs(prev => prev.includes(logId) ? prev.filter(id => id !== logId) : [...prev, logId]);
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      const [tutorsRes, studentsRes, accountsRes] = await Promise.all([
        supabase.from('users').select('id, name, username, bank_name, account_name, account_number, qr_code_url').eq('role', 'tutor').order('name'),
        supabase.from('users').select('id, name, username, grade, company_account_id').eq('role', 'student').order('grade'),
        supabase.from('company_accounts').select('*').eq('is_active', true)
      ]);
      
      if (tutorsRes.data) setTutors(tutorsRes.data);
      if (studentsRes.data) setStudents(studentsRes.data);
      if (accountsRes.data) {
        setCompanyAccounts(accountsRes.data);
        if (accountsRes.data.length > 0) setSelectedAccountId(accountsRes.data[0].id);
      }
    };
    fetchInitialData();
  }, []);

  const filteredUsers = useMemo(() => {
    const list = activeTab === 'tutor' ? tutors : students;
    if (!searchQuery) return list.slice(0, 10); 
    return list.filter(u => 
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase()))
    ).slice(0, 10); 
  }, [searchQuery, tutors, students, activeTab]);

  useEffect(() => {
    setSelectedUserId('');
    setSearchQuery(''); 
    setLogs([]);
    setExpandedGroups([]);
    setExpandedLogs([]);
  }, [activeTab]);

  useEffect(() => {
    if (!selectedUserId || !selectedMonth) {
      setLogs([]);
      return;
    }

    const fetchBillingLogs = async () => {
      setLoading(true);
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

      let query = supabase.from('teaching_logs');
      if (activeTab === 'tutor') {
        query = query.select('*, users!teaching_logs_student_id_fkey(name, username, grade), subjects(subject_name), custom_courses(course_name, grade_level)').eq('tutor_id', selectedUserId);
      } else {
        query = query.select('*, users!teaching_logs_tutor_id_fkey(name, username), subjects(subject_name), custom_courses(course_name, grade_level)').eq('student_id', selectedUserId);
      }

      query = query.gte('teaching_date', startDate).lte('teaching_date', endDate).order('teaching_date', { ascending: true });

      const { data, error } = await query;
      if (!error && data) setLogs(data);
      setLoading(false);
    };

    fetchBillingLogs();
  }, [selectedUserId, selectedMonth]);

  const selectedUserDetails = useMemo(() => {
    const list = activeTab === 'tutor' ? tutors : students;
    return list.find(u => u.id === selectedUserId);
  }, [selectedUserId, activeTab, tutors, students]);

  const selectedAccountDetails = companyAccounts.find(acc => acc.id === selectedAccountId);

  const { totalHrs, totalAmt, logsWithCalculation, groupedLogs } = useMemo(() => {
    let tHrs = 0;
    let tAmt = 0;
    const groupedObj = {};
    const computedLogs = []; 

    logs.forEach(log => {
      const ratePerHour = activeTab === 'tutor' ? (log.applied_tutor_rate || 0) : (log.applied_student_rate || 0);
      const grade = log.learning_type === 'course' ? log.custom_courses?.grade_level : log.grade_level;
      const amount = Math.round(Number(log.duration_hours) * ratePerHour * 100) / 100;
      
      tHrs += Number(log.duration_hours);
      tAmt += amount;

      const processedLog = { ...log, grade, ratePerHour, amount };
      computedLogs.push(processedLog); 

      const counterpartyId = activeTab === 'tutor' ? log.student_id : log.tutor_id;
      
      const groupKey = `${counterpartyId}_${log.learning_type}_${log.subject_id || 'no-subj'}_${log.custom_course_id || 'no-crs'}_${ratePerHour}_${grade || 'no-grade'}`;

      if (!groupedObj[groupKey]) {
        groupedObj[groupKey] = {
          id: groupKey,
          users: log.users,
          learning_type: log.learning_type,
          subjects: log.subjects,
          custom_courses: log.custom_courses,
          grade: grade,
          ratePerHour: ratePerHour,
          total_duration: 0,
          total_amount: 0,
          sessions: []
        };
      }
      groupedObj[groupKey].total_duration += Number(log.duration_hours);
      groupedObj[groupKey].total_amount += amount;
      groupedObj[groupKey].sessions.push(processedLog);
    });

    return { totalHrs: tHrs, totalAmt: tAmt, logsWithCalculation: computedLogs, groupedLogs: Object.values(groupedObj) };
  }, [logs, activeTab]);

  const handleBatchDownload = async () => {
    setIsBatchDownloading(true);
    const [year, month] = selectedMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    let query = supabase.from('teaching_logs');
    if (activeTab === 'tutor') {
      query = query.select('*, users!teaching_logs_student_id_fkey(name, username, grade), subjects(subject_name), custom_courses(course_name, grade_level)');
    } else {
      query = query.select('*, users!teaching_logs_tutor_id_fkey(name, username), subjects(subject_name), custom_courses(course_name, grade_level)');
    }
    query = query.gte('teaching_date', startDate).lte('teaching_date', endDate);

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      alert('ไม่พบประวัติการสอนในเดือนนี้');
      setIsBatchDownloading(false);
      return;
    }

    const userGroups = {};
    data.forEach(log => {
      const keyId = activeTab === 'tutor' ? log.tutor_id : log.student_id;
      if (!userGroups[keyId]) {
        const userObj = activeTab === 'tutor' ? tutors.find(t => t.id === keyId) : students.find(s => s.id === keyId);
        if (userObj) {
          userGroups[keyId] = { user: userObj, logs: [], totalAmount: 0 };
        }
      }

      if (userGroups[keyId]) {
        const ratePerHour = activeTab === 'tutor' ? (log.applied_tutor_rate || 0) : (log.applied_student_rate || 0);
        const grade = log.learning_type === 'course' ? log.custom_courses?.grade_level : log.grade_level;
        const amount = Math.round(Number(log.duration_hours) * ratePerHour * 100) / 100;

        const processedLog = { ...log, grade, ratePerHour, amount };
        userGroups[keyId].logs.push(processedLog);
        userGroups[keyId].totalAmount += amount;
      }
    });

    const preparedData = Object.values(userGroups).filter(g => g.logs.length > 0);
    if (preparedData.length === 0) {
      alert('ไม่มีข้อมูลในเดือนนี้');
      setIsBatchDownloading(false);
      return;
    }

    setBatchRenderData(preparedData);
  };

  // 🔴 4. Effect ดักรอถ่ายรูปและมัดรวมเป็น ZIP (เวอร์ชันแก้ไขบั๊ครูปขาดบน iOS Safari)
  useEffect(() => {
    if (batchRenderData && batchRenderData.length > 0) {
      const generateImages = async () => {
        // สั่งให้ทั้งหน้าจอเตรียมพร้อมกาง UI ห้องลับออกมาให้เสร็จก่อนในรอบแรก
        await new Promise(resolve => setTimeout(resolve, 2500));
        
        const zip = new JSZip();
        const folderName = activeTab === 'tutor' ? `Payslips_${selectedMonth}` : `Invoices_${selectedMonth}`;
        const imgFolder = zip.folder(folderName);
        
        for (const userData of batchRenderData) {
          const el = document.getElementById(`batch-slip-${userData.user.id}`);
          if (el) {
            try {
              // 💡 ปรับปรุงจุดที่ 1: หน่วงเวลาก่อนถ่ายแต่ละใบเพิ่มขึ้นเล็กน้อย เพื่อให้ iOS Safari วาดตารางทัน
              await new Promise(resolve => setTimeout(resolve, 600));

              // 💡 ปรับปรุงจุดที่ 2 (ท่าไม้ตาย iOS): สั่งเรนเดอร์รอบแรกทิ้ง เพื่อบีบให้ Safari โหลดภาพเข้าแคช
              await toJpeg(el, { quality: 0.1, backgroundColor: '#ffffff' });
              
              // สั่งเรนเดอร์รอบสองเพื่อดึงข้อมูลภาพที่แท้จริงที่สมบูรณ์แบบ
              const dataUrl = await toJpeg(el, { 
                quality: 0.95, // 💡 ปรับปรุงจุดที่ 3: ลดเหลือ 95% เพื่อเซฟแรมมือถือ ไม่ให้เครื่องค้าง
                backgroundColor: '#ffffff', 
                pixelRatio: 2 
              });
              
              // ตัดข้อความส่วนหัวออกเพื่อเอาข้อมูลภาพเพียวๆ
              const base64Data = dataUrl.split(',')[1];
              
              const prefix = activeTab === 'tutor' ? 'Payslip' : 'Invoice';
              const fileName = `${prefix}_${userData.user.username}_${selectedMonth}.jpg`;
              
              imgFolder.file(fileName, base64Data, { base64: true });
            } catch (e) {
              console.error('Error generating image for', userData.user.username, e);
            }
          }
        }
        
        try {
          // สั่งแพ็กไฟล์ ZIP แล้วดาวน์โหลดลงเครื่อง
          const content = await zip.generateAsync({ type: 'blob' });
          saveAs(content, `${folderName}.zip`);
          alert(`ดาวน์โหลดไฟล์ ${folderName}.zip เรียบร้อยแล้ว!`);
        } catch (err) {
          console.error('Error creating ZIP:', err);
          alert('เกิดข้อผิดพลาดในการสร้างไฟล์ ZIP');
        }
        
        // เคลียร์ข้อมูลและปิดสถานะโหลด
        setBatchRenderData(null);
        setIsBatchDownloading(false);
      };
      
      generateImages();
    }
  }, [batchRenderData, activeTab, selectedMonth]);

  return (
    <div className="max-w-6xl mx-auto pb-20 relative">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">ระบบการเงินและบิลลิ่ง (Billing)</h1>
        <p className="text-gray-500 mt-1">สรุปยอดชั่วโมงการสอนและคำนวณค่าตอบแทน/ค่าเรียนอัตโนมัติ</p>
      </div>

      <div className="flex justify-between items-center border-b border-gray-200 mb-6">
        <div className="flex">
          <button onClick={() => setActiveTab('tutor')} className={`py-3 px-6 font-bold text-sm border-b-2 transition-colors ${activeTab === 'tutor' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>สรุปค่าตอบแทนคุณครู</button>
          <button onClick={() => setActiveTab('student')} className={`py-3 px-6 font-bold text-sm border-b-2 transition-colors ${activeTab === 'student' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>สรุปค่าเรียนนักเรียน</button>
        </div>
        
        <button 
          onClick={handleBatchDownload} 
          disabled={isBatchDownloading}
          className={`py-2 px-4 rounded-lg font-bold text-xs sm:text-sm flex items-center space-x-2 transition-all shadow-sm ${activeTab === 'tutor' ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'} disabled:opacity-50`}
        >
          {isBatchDownloading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <span>กำลังประมวลผล...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              <span>โหลดบิล{activeTab === 'tutor' ? 'ครู' : 'เด็ก'}ทั้งหมด (ZIP)</span>
            </>
          )}
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
              
              <div className="relative">
                <label className="block text-xs font-bold text-gray-600 mb-1">ค้นหา {activeTab === 'tutor' ? 'คุณครู' : 'นักเรียน'}</label>
                <input 
                  type="text" 
                  placeholder="พิมพ์ Username หรือคลิกเพื่อเลือก..." 
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {showDropdown && (
                  <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map(u => (
                        <div key={u.id} className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-50 last:border-0" onClick={() => { setSelectedUserId(u.id); setSearchQuery(u.username); setShowDropdown(false); }}>
                          <p className="text-sm font-bold text-gray-800">{u.username}</p>
                          <p className="text-xs text-gray-500">{u.name || '-'}</p>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-gray-400 text-xs">ไม่พบรายชื่อที่ค้นหา</div>
                    )}
                  </div>
                )}
                {showDropdown && <div className="fixed inset-0 z-20" onClick={() => setShowDropdown(false)}></div>}
              </div>

              {activeTab === 'student' && companyAccounts.length > 0 && (
                <div className="pt-3 border-t border-gray-100 mt-2">
                  <label className="block text-xs font-bold text-gray-600 mb-1 text-amber-700">บัญชีรับเงิน (แสดงบนบิล)</label>
                  <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="w-full px-3 py-2 border border-amber-300 bg-amber-50 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 font-medium text-gray-700">
                    {companyAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.bank_name} - {acc.account_number}</option>)}
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
                  <span className="text-sm text-gray-600 font-bold">เวลาทั้งหมด:</span>
                  <span className="font-bold text-lg">{totalHrs} ชม.</span>
                </div>
                <div className="pt-2 border-t border-gray-200/50">
                  <span className="block text-xs font-bold text-gray-500 mb-1">ยอดสุทธิรวม:</span>
                  <span className={`block text-3xl font-black ${activeTab === 'tutor' ? 'text-indigo-700' : 'text-amber-600'}`}>฿{totalAmt.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[500px]">
            {!selectedUserId ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20">
                <div className="bg-gray-50 p-6 rounded-full mb-4">🔍</div>
                <p>กรุณาค้นหาและเลือก {activeTab === 'tutor' ? 'คุณครู' : 'นักเรียน'} เพื่อดูรายละเอียด</p>
              </div>
            ) : loading ? (
              <div className="text-center py-20 text-gray-400 animate-pulse">กำลังคำนวณยอดเงิน...</div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-6 border-b pb-4">
                  <div>
                    <div className="flex items-center space-x-4">
                      <h2 className="text-xl font-bold text-gray-800">แจ้งยอด {activeTab === 'tutor' ? 'ค่าตอบแทน' : 'ค่าเรียน'} : {selectedUserDetails?.username}</h2>
                      {groupedLogs.length > 0 && (
                        <button onClick={() => activeTab === 'tutor' ? setShowTutorModal(true) : setShowInvoiceModal(true)} className={`font-semibold py-1.5 px-4 rounded-lg text-sm shadow-sm transition flex items-center space-x-2 text-white ${activeTab === 'tutor' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          <span>ดูบิลฉบับสมบูรณ์</span>
                        </button>
                      )}
                    </div>
                    <p className="text-gray-500 mt-1">ประจำเดือน {new Date(selectedMonth + '-01').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>

                {groupedLogs.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">ไม่มีประวัติการสอนในเดือนนี้</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse table-auto">
                      <thead className="bg-gray-100 text-gray-600 border-b-2 border-gray-200">
                        <tr>
                          <th className="p-3 w-10"></th> 
                          <th className="p-3 font-bold whitespace-nowrap">จำนวน</th>
                          <th className="p-3 font-bold">{activeTab === 'tutor' ? 'สอนนักเรียน' : 'สอนโดยคุณครู'}</th>
                          <th className="p-3 font-bold">วิชา / คอร์ส</th>
                          <th className="p-3 font-bold">ระดับ</th>
                          <th className="p-3 font-bold text-center">รวมชม.</th>
                          <th className="p-3 font-bold text-right">เรท</th>
                          <th className="p-3 font-bold text-right">รวมเงิน</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {groupedLogs.map(group => (
                          <React.Fragment key={group.id}>
                            <tr onClick={() => toggleGroup(group.id)} className={`cursor-pointer transition-colors ${expandedGroups.includes(group.id) ? 'bg-indigo-50/50' : 'hover:bg-gray-50'}`}>
                              <td className="p-3 text-center">
                                <svg className={`w-4 h-4 text-gray-400 inline-block transition-transform ${expandedGroups.includes(group.id) ? 'rotate-90 text-indigo-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                              </td>
                              <td className="p-3 whitespace-nowrap font-bold text-indigo-600">{group.sessions.length} ครั้ง</td>
                              <td className="p-3 font-bold text-gray-900">{group.users?.name || group.users?.username}</td>
                              <td className="p-3">
                                {group.learning_type === 'course' ? <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">🏆 {group.custom_courses?.course_name}</span> : 
                                <div className="flex items-center gap-1.5"><span className={`text-[10px] px-1 rounded font-bold ${group.learning_type === 'advanced' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{group.learning_type === 'advanced' ? 'Adv' : 'Gen'}</span><span className="text-gray-800 font-medium">{group.subjects?.subject_name}</span></div>}
                              </td>
                              <td className="p-3 text-gray-600">{group.grade || '-'}</td>
                              <td className="p-3 text-center font-black text-gray-800">{group.total_duration}</td>
                              <td className="p-3 text-right text-gray-500">฿{group.ratePerHour}</td>
                              <td className="p-3 text-right font-black text-gray-800">฿{group.total_amount.toLocaleString()}</td>
                            </tr>
                            {expandedGroups.includes(group.id) && group.sessions.map((session, index) => (
                              <React.Fragment key={session.id}>
                                <tr onClick={() => toggleRow(session.id)} className="bg-slate-50/50 hover:bg-slate-100 cursor-pointer border-l-4 border-indigo-300">
                                  <td className="p-2 border-r border-gray-200"></td>
                                  <td colSpan="4" className="p-2.5 px-4 text-gray-600 font-medium">
                                    <div className="flex items-center gap-2">
                                      <svg className={`w-3 h-3 transition-transform ${expandedLogs.includes(session.id) ? 'rotate-90 text-blue-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                      <span>ครั้งที่ {index + 1} : {new Date(session.teaching_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long' })}{session.grade ? ` (${session.grade})` : ''}</span>
                                    </div>
                                  </td>
                                  <td className="p-2.5 text-center font-bold text-gray-700">{session.duration_hours}</td>
                                  <td className="p-2.5 text-right text-gray-400 text-xs">฿{session.ratePerHour}</td>
                                  <td className="p-2.5 text-right font-bold text-gray-700">฿{session.amount.toLocaleString()}</td>
                                </tr>
                                {expandedLogs.includes(session.id) && (
                                  <tr className="bg-white border-b border-gray-100 border-l-4 border-indigo-300">
                                    <td className="border-r border-gray-200"></td>
                                    <td colSpan="7" className="p-3 px-10 text-sm">
                                      <div className="flex flex-col space-y-1.5 text-gray-700 bg-gray-50 p-3 rounded border border-gray-100 shadow-sm">
                                        <div className="flex items-center gap-2"><span className="font-bold text-blue-800 text-xs">เวลา:</span><span className="text-gray-700 text-xs">{session.start_time?.substring(0, 5)} - {session.end_time?.substring(0, 5)} น.</span></div>
                                        <div className="flex items-start gap-2"><span className="font-bold text-blue-800 text-xs shrink-0 mt-0.5">เนื้อหา:</span><span className="text-gray-600 italic text-xs leading-relaxed">{session.topic || '-'}</span></div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
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

      <TutorPayslipModal 
        isOpen={showTutorModal} 
        onClose={() => setShowTutorModal(false)}
        tutor={selectedUserDetails}
        logs={logsWithCalculation}
        totalAmount={totalAmt}
        billingMonth={selectedMonth}
      />

      {batchRenderData && (
        <div className="absolute top-[-9999px] left-[-9999px] z-[-1] opacity-0 pointer-events-none">
          {batchRenderData.map(userData => (
            <div 
              key={userData.user.id} 
              id={`batch-slip-${userData.user.id}`} 
              className="w-[210mm] bg-white p-1"
            >
              {activeTab === 'tutor' ? (
                <TutorPayslip 
                  tutor={userData.user} 
                  logs={userData.logs} 
                  totalAmount={userData.totalAmount} 
                  billingMonth={selectedMonth} 
                />
              ) : (
                <StudentInvoice 
                  student={userData.user} 
                  logs={userData.logs} 
                  totalAmount={userData.totalAmount} 
                  billingMonth={selectedMonth} 
                  companyAccount={companyAccounts.find(acc => acc.id === selectedAccountId)}
                />
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}