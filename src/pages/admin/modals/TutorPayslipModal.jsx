import React, { useRef } from 'react';
// นำเข้าบิลของคุณครูที่เราเพิ่งสร้าง
import TutorPayslip from '../TutorPayslip'; 

export default function TutorPayslipModal({ isOpen, onClose, tutor, logs, totalAmount, billingMonth }) {
  
  if (!isOpen || !tutor) return null;

  // ฟังก์ชันสั่งพิมพ์เฉพาะส่วนของบิล
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm print:p-0 print:bg-white print:block">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden print:shadow-none print:max-h-none print:w-full print:rounded-none">
        
        {/* แถบหัว Modal (จะถูกซ่อนตอนสั่งพิมพ์) */}
        <div className="p-4 border-b flex justify-between items-center bg-slate-900 text-white shrink-0 print:hidden">
          <h3 className="font-bold">พรีวิวใบสรุปเงินเดือน (Tutor Payslip)</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* พื้นที่แสดงบิล */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-4 sm:p-8 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          <div className="w-full max-w-[210mm] bg-white shadow-sm border border-gray-200 print:border-none print:shadow-none">
            {/* เรียกใช้งาน Component บิลครูตรงนี้ */}
            <TutorPayslip 
              tutor={tutor} 
              logs={logs} 
              totalAmount={totalAmount} 
              billingMonth={billingMonth} 
            />
          </div>
        </div>

        {/* แถบปุ่มกดด้านล่าง (จะถูกซ่อนตอนสั่งพิมพ์) */}
        <div className="p-4 border-t flex justify-end space-x-3 bg-white shrink-0 print:hidden">
          <button onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition">
            ปิดหน้าต่าง
          </button>
          <button onClick={handlePrint} className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition flex items-center space-x-2 shadow-sm">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            <span>พิมพ์ / Save เป็น PDF</span>
          </button>
        </div>
        
      </div>
    </div>
  );
}