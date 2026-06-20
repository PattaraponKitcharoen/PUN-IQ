import React, { useState } from 'react';

export default function StudentInvoice({ student, logs, totalAmount, billingMonth, issueDate = new Date(), companyAccount }) {
  const [expandedLogs, setExpandedLogs] = useState([]);
  
  // 🔴 ปรับชื่อพารามิเตอร์ให้เป็น logId เพื่อความชัดเจน
  const toggleRow = (logId) => {
    setExpandedLogs(prev => prev.includes(logId) ? prev.filter(i => i !== logId) : [...prev, logId]);
  };

  if (!student) return null;

  return (
    <div className="bg-white w-full h-full flex flex-col p-3 sm:p-4 mx-auto text-gray-900 font-sans text-[10px] sm:text-[11px] select-none leading-tight justify-between">
      
      <div className="shrink-0">
        <div className="flex flex-col items-center mb-2">
          <img 
            src="/logo.png" 
            alt="PUN-IQ Academy" 
            className="h-14 mb-1 object-contain"
            onError={(e) => {
              e.target.onerror = null; 
              const div = document.createElement('div');
              div.className = "h-14 w-28 mb-1 flex items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded";
              div.innerHTML = '<span class="text-gray-400 font-bold text-[9px]">LOGO PUN-IQ</span>';
              e.target.parentNode.replaceChild(div, e.target);
            }}
          />
          <div className="w-full bg-[#dcebf8] py-1 flex justify-center items-center">
            <span className="font-bold text-[#1b4379] tracking-wide text-xs">ใบแจ้งค่าเรียน / Invoice</span>
          </div>
        </div>

        <div className="mb-2">
          <h2 className="text-xs font-bold text-[#1b4379] mb-0.5">ข้อมูลนักเรียน</h2>
          <div className="w-full h-px bg-[#dcebf8] mb-1"></div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            <p><span className="text-gray-600 inline-block w-16">ชื่อผู้เรียน</span> <span className="font-semibold">{student.name || student.username}</span></p>
            <p className="text-right"><span className="text-gray-600 mr-2">ระดับชั้น</span> <span className="font-semibold">ดูในรายละเอียดคลาส</span></p>
            <p><span className="text-gray-600 inline-block w-16">วันที่</span> <span className="font-semibold">{issueDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'numeric', year: 'numeric' })}</span></p>
            <p className="text-right"><span className="text-gray-600 mr-2">ประจำเดือน</span> <span className="font-semibold">{new Date(billingMonth + '-01').toLocaleDateString('th-TH', { month: 'long', year: '2-digit' })}</span></p>
          </div>
        </div>
        
        <h2 className="text-xs font-bold text-[#1b4379] mb-0.5">รายการค่าเรียน (กดที่รายวิชาเพื่อดูเวลา/เนื้อหา)</h2>
        <div className="w-full h-px bg-[#dcebf8] mb-1"></div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden my-1 flex flex-col border border-gray-200 rounded">
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#1b4379] text-white sticky top-0 z-10">
              <tr>
                <th className="py-1 px-1 w-6"></th>
                <th className="py-1 px-1.5 font-semibold text-center w-1/3">วิชา / คอร์สเรียน</th>
                <th className="py-1 px-1.5 font-semibold text-center">ครู</th>
                <th className="py-1 px-1.5 font-semibold text-center">ระดับชั้น</th>
                <th className="py-1 px-1.5 font-semibold text-center">ชม.</th>
                <th className="py-1 px-1.5 font-semibold text-center">รวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.map((log) => (
                <React.Fragment key={log.id}>
                    <tr onClick={() => toggleRow(log.id)} className="hover:bg-blue-50/50 cursor-pointer transition-colors group">
                    <td className="py-1.5 px-1 text-center">
                      {/* 🔴 แก้ไข: เปลี่ยนจาก index เป็น log.id ตรงนี้ */}
                      <svg className={`w-3 h-3 text-gray-400 inline-block transition-transform ${expandedLogs.includes(log.id) ? 'rotate-90 text-[#1b4379]' : 'group-hover:text-[#1b4379]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </td>
                    <td className="py-1.5 px-1.5 text-left truncate max-w-[120px]">
                      {log.learning_type === 'course' ? (
                        <span className="font-bold text-amber-700 truncate">🏆 {log.custom_courses?.course_name || 'คอร์สพิเศษ'}</span>
                      ) : (
                        <span className="font-semibold text-[#1b4379] truncate">
                          {log.learning_type === 'advanced' ? '✨ ' : ''}{log.subjects?.subject_name || '-'}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-1 text-center truncate max-w-[65px]">{log.tutor?.name || log.tutor?.username || log.users?.name || log.users?.username || '-'}</td>
                    <td className="py-1.5 px-1 text-center text-gray-600 font-medium">{log.grade || '-'}</td>
                    <td className="py-1.5 px-1 text-center font-semibold">{log.duration_hours}</td>
                    <td className="py-1.5 px-1 text-center text-gray-800 font-bold">฿{log.amount.toLocaleString()}</td>
                  </tr>

                  {/* 🔴 แก้ไข: เปลี่ยนจาก index เป็น log.id ตรงนี้ด้วย */}
                  {expandedLogs.includes(log.id) && (
                    <tr className="bg-[#f8fbff] border-b border-[#dcebf8]">
                      <td colSpan="6" className="py-2 px-8 text-left border-l-2 border-[#1b4379]">
                        <div className="flex flex-col space-y-1 text-[10px]">
                          <div>
                            <span className="font-bold text-[#1b4379] mr-2">เวลาและเรทคลาส:</span> 
                            <span className="text-gray-700">
                              {log.start_time ? log.start_time.substring(0, 5) : '-'} น. - {log.end_time ? log.end_time.substring(0, 5) : '-'} น. (฿{log.ratePerHour}/ชม.)
                            </span>
                          </div>
                          <div className="flex mt-0.5 items-start">
                            <span className="font-bold text-[#1b4379] mr-2 shrink-0">เนื้อหา:</span> 
                            <span className="text-gray-600 italic break-words whitespace-pre-wrap leading-tight">
                              {log.topic || '-'}
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
        
        <div className="bg-[#dcebf8] flex justify-between items-center py-1.5 px-3 border-t border-gray-300 shrink-0">
          <span className="font-bold text-[#1b4379] text-[10px]">รวมทั้งหมด</span>
          <span className="font-bold text-gray-900 text-xs">{totalAmount.toLocaleString()} บาท</span>
        </div>
      </div>

      <div className="shrink-0 mt-1">
        <div className="bg-[#fffdf0] border border-[#d2b48c] p-1.5 mb-2 text-black text-[9px] sm:text-[10px]">
          <p className="font-bold text-[#8b6508] mb-0.5">การชำระเงิน</p>
          <p>-กรุณาชำระเงินภายใน 3 วัน</p>
          <p>-หากมีข้อสงสัยติดต่อ 096-9569625 (ครูลิ)</p>
        </div>

        <h2 className="text-xs font-bold text-[#1b4379] mb-0.5">ช่องทางการชำระเงิน</h2>
        <div className="w-full h-px bg-[#dcebf8] mb-1"></div>
        
        <div className="flex border border-gray-300 bg-gray-50/50 rounded-xs overflow-hidden h-24 sm:h-28">
          <div className="w-1/2 p-2 border-r border-gray-300 flex flex-col justify-center leading-tight">
            <p className="text-gray-400 mb-0.5 text-[9px] sm:text-[10px]">ธนาคาร / ช่องทาง</p>
            <p className="font-bold text-blue-900 mb-0.5 text-[11px] sm:text-xs">
              {companyAccount?.bank_name || 'ไม่ได้ระบุธนาคาร'}
            </p>
            <p className="text-gray-500 text-[8px] sm:text-[9px] uppercase mt-1">เลขที่บัญชี / หมายเลข</p>
            <p className="font-bold text-xs sm:text-sm mb-0.5 text-gray-900 tracking-wider">
              {companyAccount?.account_number || '-'}
            </p>
            <p className="font-semibold text-gray-700 text-[10px] sm:text-[11px]">
              {companyAccount?.account_name || '-'}
            </p>
          </div>
          <div className="w-1/2 p-2 flex justify-between items-center">
            <div className="leading-tight flex flex-col justify-center">
              <p className="text-gray-400 mb-0.5 text-[9px] sm:text-[10px]">สแกนชำระเงิน</p>
              <p className="font-semibold text-gray-800 text-[10px] sm:text-[11px]">
                {companyAccount?.account_name || '-'}
              </p>
            </div>
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white flex items-center justify-center p-1 shrink-0 ml-1 border border-gray-200 rounded shadow-sm">
               {companyAccount?.qr_code_url ? (
                  <img src={companyAccount.qr_code_url} alt="QR Code" className="w-full h-full object-contain" />
               ) : (
                  <div className="w-full h-full border border-dashed border-gray-300 flex items-center justify-center text-[10px] text-gray-400 font-bold bg-gray-50">NO QR</div>
               )}
            </div>
          </div>
        </div>

        <p className="text-center text-[9px] sm:text-[10px] text-[#1b4379] font-bold italic mt-2">
          ขอขอบคุณที่ไว้วางใจ Pun-IQ Academe
        </p>
      </div>

    </div>
  );
}