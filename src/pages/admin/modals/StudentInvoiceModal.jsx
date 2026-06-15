import React from 'react';
import StudentInvoice from '../StudentInvoice';

export default function StudentInvoiceModal({ isOpen, onClose, student, logs, totalAmount, billingMonth, companyAccount }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm overflow-hidden">
      
      <button 
        onClick={onClose} 
        className="absolute top-3 right-3 text-white hover:text-gray-300 transition z-50 bg-black/40 rounded-full p-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>

      <div className="w-full max-w-md md:max-w-lg bg-white rounded-xl shadow-2xl flex flex-col max-h-[95vh] h-full overflow-hidden">
         <div className="flex-1 h-full">
            <StudentInvoice 
              student={student} 
              logs={logs} 
              totalAmount={totalAmount} 
              billingMonth={billingMonth} 
              companyAccount={companyAccount}
            />
         </div>
      </div>
    </div>
  );
}