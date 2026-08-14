import React, { useRef, useState } from 'react';
import TutorPayslip from '../TutorPayslip';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export default function TutorPayslipModal({ isOpen, onClose, tutor, logs, totalAmount, billingMonth }) {
  const payslipRef = useRef(null);
  const [isDownloadingPng, setIsDownloadingPng] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  if (!isOpen || !tutor) return null;

  const handleDownloadPng = async () => {
    const node = payslipRef.current;
    if (!node) return;

    setIsDownloadingPng(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));

      const captureOptions = {
        backgroundColor: '#ffffff',
        width: node.scrollWidth,
        height: node.scrollHeight,
        pixelRatio: 2,
        style: { overflow: 'visible', margin: '0' }
      };

      await toPng(node, captureOptions);
      await new Promise(resolve => setTimeout(resolve, 300));

      const dataUrl = await toPng(node, captureOptions);

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `Payslip_${tutor.username}_${billingMonth}.png`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error('Error saving PNG:', error);
      alert(`เกิดข้อผิดพลาดในการบันทึกภาพ: ${error.message}`);
    } finally {
      setIsDownloadingPng(false);
    }
  };

  // 🔴 ปรับฟังก์ชัน PDF ให้ใช้ toPng
  const handleDownloadPdf = async () => {
    const node = payslipRef.current;
    if (!node) return;

    setIsDownloadingPdf(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));

      const captureOptions = {
        backgroundColor: '#ffffff',
        width: node.scrollWidth,
        height: node.scrollHeight,
        pixelRatio: 2,
        style: { overflow: 'visible', margin: '0' }
      };

      await toPng(node, captureOptions);
      await new Promise(resolve => setTimeout(resolve, 300));

      const imgData = await toPng(node, captureOptions);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (node.scrollHeight * pdfWidth) / node.scrollWidth;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Payslip_${tutor.username}_${billingMonth}.pdf`);
    } catch (error) {
      console.error('Error saving PDF:', error);
      alert(`เกิดข้อผิดพลาดในการบันทึก PDF: ${error.message}`);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const isDownloading = isDownloadingPng || isDownloadingPdf;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden">

        <div className="p-4 border-b flex justify-between items-center bg-slate-900 text-white shrink-0">
          <h3 className="font-bold">พรีวิวใบสรุปเงินเดือน (Tutor Payslip)</h3>
          <button onClick={onClose} disabled={isDownloading} className="text-gray-400 hover:text-white transition disabled:opacity-50">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-100 p-4 sm:p-8 flex justify-center">
          <div ref={payslipRef} className="w-full max-w-[210mm] bg-white shadow-sm border border-gray-200 p-1">
            <TutorPayslip tutor={tutor} logs={logs} totalAmount={totalAmount} billingMonth={billingMonth} />
          </div>
        </div>

        <div className="p-4 border-t flex flex-wrap justify-end gap-3 bg-white shrink-0">
          <button onClick={onClose} disabled={isDownloading} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition disabled:opacity-50 w-full sm:w-auto">
            ปิดหน้าต่าง
          </button>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition flex items-center justify-center space-x-2 shadow-sm disabled:opacity-70"
            >
              {isDownloadingPdf ? (
                <><svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></>
              ) : (
                <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><span>PDF</span></>
              )}
            </button>

            <button
              onClick={handleDownloadPng}
              disabled={isDownloading}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition flex items-center justify-center space-x-2 shadow-sm disabled:opacity-70"
            >
              {isDownloadingPng ? (
                <><svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></>
              ) : (
                <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg><span>PNG</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}