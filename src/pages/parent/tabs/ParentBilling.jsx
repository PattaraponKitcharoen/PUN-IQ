import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import StudentInvoiceModal from '../../admin/modals/StudentInvoiceModal';

export default function ParentBilling() {
  const [children, setChildren] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  const [loading, setLoading] = useState(true);
  
  // State สำหรับโยนให้ Modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedStudentForInvoice, setSelectedStudentForInvoice] = useState(null);
  const [invoiceLogs, setInvoiceLogs] = useState([]);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [companyAccount, setCompanyAccount] = useState(null);

  useEffect(() => {
    const fetchChildrenAndAccount = async () => {
      const session = JSON.parse(localStorage.getItem('custom_user_session') || '{}');
      if (!session.id) return;

      const [parentRes, accountRes] = await Promise.all([
          supabase.from('parent_children')
            .select('student:users!parent_children_student_id_fkey(id, name, username, grade, company_account_id)')
            .eq('parent_id', session.id),
          supabase.from('company_accounts').select('*').eq('is_active', true)
      ]);

      if (parentRes.data) {
          setChildren(parentRes.data.map(d => d.student).filter(Boolean));
      }
      
      if (accountRes.data && accountRes.data.length > 0) {
          setCompanyAccount(accountRes.data[0]); // เก็บไว้เป็นค่าสำรอง
      }
      setLoading(false);
    };
    fetchChildrenAndAccount();
  }, []);

  const handleOpenInvoice = async (child) => {
    // 🔴 1. เพิ่มการเช็คดักจับเดือนปัจจุบันตรงนี้
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    if (selectedMonth === currentMonthStr) {
      window.alert('⏳ ยังไม่ถึงกำหนดชำระเงินของเดือนนี้\n\nระบบจะเปิดให้ออกบิลและดู QR Code ชำระเงินได้เมื่อสิ้นสุดเดือนครับ\n(กรุณาเลือกดูบิลของเดือนก่อนหน้า)');
      return; // หยุดการทำงานทันที ไม่เปิด Modal
    }

    // 2. ดึง Log ของเด็กคนนี้ในเดือนที่เลือกมาคำนวณ
    const [year, month] = selectedMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    const { data: logs } = await supabase
      .from('teaching_logs')
      .select('*, tutor:tutor_id(name, username), subjects(subject_name), custom_courses(course_name, grade_level)')
      .eq('student_id', child.id)
      .gte('teaching_date', startDate)
      .lte('teaching_date', endDate)
      .order('teaching_date', { ascending: true })
      .order('start_time', { ascending: true });

    let tAmt = 0;
    const computedLogs = (logs || []).map(log => {
      const ratePerHour = log.applied_student_rate || 0;
      const grade = log.learning_type === 'course' ? log.custom_courses?.grade_level : log.grade_level;
      let amount = 0;
      let roundsForDisplay = null;
      const isClassroom = log.tutor?.username === 'Classroom';

      if (isClassroom) {
        let rounds = 1;
        const match = (log.custom_courses?.course_name || '').match(/([\d.]+)\s*ชม\.\/รอบ/);
        if (match) {
          rounds = Number(log.duration_hours) / Number(match[1]);
          roundsForDisplay = rounds;
        }
        amount = Math.round(rounds * ratePerHour * 100) / 100;
      } else {
        amount = Math.round(Number(log.duration_hours) * ratePerHour * 100) / 100;
      }
      tAmt += amount;
      return { ...log, grade, ratePerHour, amount, roundsForDisplay };
    });

    // 3. ถ้าเด็กมีบัญชีผูกไว้ ให้ใช้บัญชีนั้น ถ้าไม่มีใช้บัญชีกลาง
    let activeAccount = companyAccount;
    if (child.company_account_id) {
       const { data: accData } = await supabase.from('company_accounts').select('*').eq('id', child.company_account_id).single();
       if (accData) activeAccount = accData;
    }

    setInvoiceLogs(computedLogs);
    setInvoiceTotal(tAmt);
    setSelectedStudentForInvoice(child);
    setCompanyAccount(activeAccount);
    setShowInvoiceModal(true);
  };

  if (loading) return <div className="p-10 text-center text-gray-400">กำลังโหลดข้อมูล...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
         <h1 className="text-2xl font-bold text-emerald-900 mb-6">🧾 สรุปบิลค่าใช้จ่าย</h1>
         
         <div className="w-full md:w-1/2">
             <label className="block text-xs font-bold text-gray-500 uppercase mb-2">เลือกเดือนที่ต้องการออกบิล</label>
             <input 
                type="month" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)} 
                className="w-full px-4 py-3 border border-emerald-200 bg-emerald-50/50 rounded-xl font-bold text-emerald-900 outline-none focus:ring-2 focus:ring-emerald-500"
             />
         </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {children.length === 0 ? (
              <div className="col-span-full p-10 text-center text-gray-400 bg-white rounded-xl border border-dashed">
                 ไม่มีนักเรียนในการดูแล
              </div>
          ) : (
              children.map(child => (
                  <div key={child.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col items-center text-center hover:shadow-md transition">
                      <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4">
                          {child.name ? child.name.charAt(0) : '👶'}
                      </div>
                      <h3 className="text-lg font-bold text-gray-800">{child.name || child.username}</h3>
                      <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full mt-1 mb-6">ระดับชั้น: {child.grade || '-'}</span>
                      
                      <button 
                          onClick={() => handleOpenInvoice(child)}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition flex justify-center items-center space-x-2"
                      >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2-2v4h10z" /></svg>
                          <span>ตรวจสอบบิลเดือนนี้</span>
                      </button>
                  </div>
              ))
          )}
      </div>

      <StudentInvoiceModal 
        isOpen={showInvoiceModal} 
        onClose={() => setShowInvoiceModal(false)}
        student={selectedStudentForInvoice}
        logs={invoiceLogs}
        totalAmount={invoiceTotal}
        billingMonth={selectedMonth}
        companyAccount={companyAccount} 
      />
    </div>
  );
}