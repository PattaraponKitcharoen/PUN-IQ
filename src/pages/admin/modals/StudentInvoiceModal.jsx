import React from 'react';
import StudentInvoice from '../StudentInvoice';

export default function StudentInvoiceModal({ isOpen, onClose, student, logs, totalAmount, billingMonth, companyAccount }) {
  if (!isOpen || !student) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    // 🔴 แก้ไข Wrapper: เพิ่ม print:!flex (บังคับแสดง) และ print:!h-auto (ไม่จำกัดความสูง)
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm print:!fixed print:!inset-0 print:!p-0 print:!bg-white print:!block">
      
      {/* 🔴 แก้ไข Modal Box: เพิ่ม print:!max-w-none (ขยายเต็มหน้ากระดาษ) และ print:!shadow-none */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden print:!w-full print:!max-w-none print:!max-h-none print:!rounded-none print:!overflow-visible print:!block print:!border-none print:!shadow-none">
        
        {/* แถบหัว Modal (ซ่อนตอนพิมพ์) */}
        <div className="p-4 border-b flex justify-between items-center bg-slate-900 text-white shrink-0 print:hidden">
          <h3 className="font-bold">พรีวิวใบแจ้งค่าเรียน (Student Invoice)</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* 🔴 แก้ไขเนื้อหาบิล: เพิ่ม print:!block เพื่อให้มั่นใจว่าเบราว์เซอร์จะไม่ซ่อนเนื้อหาตัวนี้ */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-4 sm:p-8 flex justify-center print:!p-0 print:!bg-white print:!overflow-visible print:!block">
          <div className="w-full max-w-[210mm] bg-white">
            <StudentInvoice 
              student={student} 
              logs={logs} 
              totalAmount={totalAmount} 
              billingMonth={billingMonth} 
              companyAccount={companyAccount}
            />
          </div>
        </div>

        {/* ปุ่มพิมพ์ (ซ่อนตอนพิมพ์) */}
        <div className="p-4 border-t flex justify-end space-x-3 bg-white shrink-0 print:hidden">
          <button onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition">
            ปิดหน้าต่าง
          </button>
          <button onClick={handlePrint} className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition flex items-center space-x-2 shadow-sm">
            <span>พิมพ์ / Save เป็น PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}