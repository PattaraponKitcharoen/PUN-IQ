import React, { useState, useMemo } from 'react';

export default function StudentInvoice({ student, logs, totalAmount, billingMonth, issueDate = new Date(), companyAccount }) {
  const [expandedGroups, setExpandedGroups] = useState([]);
  const [expandedLogs, setExpandedLogs] = useState([]);
  
  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => prev.includes(groupId) ? prev.filter(i => i !== groupId) : [...prev, groupId]);
  };

  const toggleRow = (logId) => {
    setExpandedLogs(prev => prev.includes(logId) ? prev.filter(itemId => itemId !== logId) : [...prev, logId]);
  };

  const groupedLogs = useMemo(() => {
    const groupedObj = {};
    
    logs.forEach(log => {
      const groupKey = `${log.tutor_id}_${log.learning_type}_${log.subject_id || 'no-subj'}_${log.custom_course_id || 'no-crs'}_${log.ratePerHour}_${log.grade || 'no-grade'}`;

      if (!groupedObj[groupKey]) {
        groupedObj[groupKey] = {
          id: groupKey,
          tutorData: log.tutor || log.users, 
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
  }, [logs]);

  if (!student) return null;

  return (
    <div className="bg-white w-full h-auto flex flex-col p-3 sm:p-4 mx-auto text-gray-900 font-sans text-[10px] sm:text-[11px] select-none leading-tight">
      
      <div className="shrink-0">
        <div className="flex flex-col items-center mb-2">
          <img 
            src="/logo.png" 
            alt="PUN-IQ Academy" 
            crossOrigin="anonymous"
            loading="eager" // 💡 บังคับโหลดทันที
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
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 items-center">
            {/* 🔴 ปรับโค้ดบรรทัดนี้ ให้ชื่อเด็กมีไฮไลต์สีฟ้าธีมเดียวกับบิล */}
            <p className="flex items-center">
              <span className="text-gray-600 w-16 shrink-0">ชื่อผู้เรียน</span> 
              <span className="font-semibold bg-[#dcebf8] px-2 py-0.5 rounded-full text-[#1b4379] truncate">{student.name || student.username}</span>
            </p>
            <p className="text-right"><span className="text-gray-600 mr-2">ระดับชั้น</span> <span className="font-semibold">{student.grade || '-'}</span></p>
            <p className="flex items-center"><span className="text-gray-600 w-16 shrink-0">วันที่</span> <span className="font-semibold">{issueDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'numeric', year: 'numeric' })}</span></p>
            <p className="text-right"><span className="text-gray-600 mr-2">ประจำเดือน</span> <span className="font-semibold">{new Date(billingMonth + '-01').toLocaleDateString('th-TH', { month: 'long', year: '2-digit' })}</span></p>
          </div>
        </div>
        
        <h2 className="text-xs font-bold text-[#1b4379] mb-0.5">รายการค่าเรียน (กดที่แถวเพื่อดูรายละเอียด)</h2>
        <div className="w-full h-px bg-[#dcebf8] mb-1"></div>
      </div>

      <div className="my-1 border border-gray-200 rounded">
        <div className="w-full">
          <table className="w-full text-left border-collapse table-auto">
            <thead className="bg-[#1b4379] text-white">
              <tr>
                <th className="py-1 px-1 w-6"></th>
                <th className="py-1 px-1.5 font-semibold text-center whitespace-nowrap">ครั้ง</th>
                <th className="py-1 px-1.5 font-semibold text-center">ครูผู้สอน</th>
                <th className="py-1 px-1.5 font-semibold text-center">วิชา/คอร์ส</th>
                <th className="py-1 px-1.5 font-semibold text-center whitespace-nowrap">ชม.</th>
                <th className="py-1 px-1.5 font-semibold text-center whitespace-nowrap">อัตรา</th>
                <th className="py-1 px-1.5 font-semibold text-center whitespace-nowrap">รวม(฿)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {groupedLogs.map((group) => (
                <React.Fragment key={group.id}>
                  <tr onClick={() => toggleGroup(group.id)} className="hover:bg-blue-50/50 cursor-pointer transition-colors border-b border-gray-100">
                    <td className="py-1.5 px-1 text-center">
                      <svg className={`w-3 h-3 transition-transform ${expandedGroups.includes(group.id) ? 'rotate-90 text-[#1b4379]' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </td>
                    <td className="py-1.5 px-1 text-center font-bold text-[#1b4379]">
                      {group.sessions.length}
                    </td>
                    
                    <td className="py-1.5 px-1 text-center font-semibold text-[#1b4379] break-words leading-tight">
                      {group.tutorData?.name || group.tutorData?.username || '-'}
                    </td>
                    <td className="py-1.5 px-1 text-center break-words leading-tight">
                      {group.learning_type === 'course' ? (
                        <span className="font-bold text-amber-700">🏆 {group.custom_courses?.course_name || 'คอร์สพิเศษ'}</span>
                      ) : (
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {group.learning_type === 'advanced' && <span className="text-[9px] px-1 rounded font-bold bg-purple-100 text-purple-700">Adv</span>}
                          <span>{group.subjects?.subject_name || '-'}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 px-1 text-center font-bold text-gray-800">{group.total_duration}</td>
                    <td className="py-1.5 px-1 text-center text-gray-500">฿{group.ratePerHour?.toLocaleString()}</td>
                    <td className="py-1.5 px-1 text-center text-[#1b4379] font-bold">฿{group.total_amount.toLocaleString()}</td>
                  </tr>

                  {expandedGroups.includes(group.id) && group.sessions.map((session, index) => (
                    <React.Fragment key={session.id}>
                      <tr onClick={() => toggleRow(session.id)} className="bg-slate-50/50 hover:bg-slate-100 cursor-pointer border-l-2 border-[#1b4379]">
                        <td className="py-1 px-1 border-r border-gray-200"></td>
                        <td colSpan="3" className="py-1 px-2 text-gray-600 font-medium">
                          <div className="flex items-center">
                            <svg className={`w-2.5 h-2.5 mr-1.5 transition-transform shrink-0 ${expandedLogs.includes(session.id) ? 'rotate-90 text-[#1b4379]' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            <span className="truncate">
                              ครั้งที่ {index + 1} : {new Date(session.teaching_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                              {session.grade ? ` (${session.grade})` : group.grade ? ` (${group.grade})` : ''}
                            </span>
                          </div>
                        </td>
                        <td className="py-1 px-1 text-center font-bold text-gray-700">{session.duration_hours}</td>
                        <td className="py-1 px-1 text-center text-gray-400">฿{session.ratePerHour}</td>
                        <td className="py-1 px-1 text-center font-bold text-gray-800">฿{session.amount.toLocaleString()}</td>
                      </tr>

                      {expandedLogs.includes(session.id) && (
                        <tr className="bg-white border-b border-gray-100 border-l-2 border-[#1b4379]">
                          <td className="border-r border-gray-200"></td>
                          <td colSpan="6" className="py-1.5 px-4 sm:px-6 text-left">
                            <div className="flex flex-col space-y-1 text-[10px] bg-[#f8fbff] p-2 rounded border border-[#dcebf8]">
                              <div className="flex items-start">
                                <span className="font-bold text-[#1b4379] mr-2 shrink-0">เวลา:</span> 
                                <span className="text-gray-700">
                                  {session.start_time ? session.start_time.substring(0, 5) : '-'} น. - {session.end_time ? session.end_time.substring(0, 5) : '-'} น.
                                </span>
                              </div>
                              <div className="flex items-start mt-0.5">
                                <span className="font-bold text-[#1b4379] mr-2 shrink-0">เนื้อหา:</span> 
                                <span className="text-gray-600 italic break-words whitespace-pre-wrap leading-tight">
                                  {session.topic || '-'}
                                </span>
                              </div>
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
        
        <div className="bg-[#dcebf8] flex justify-between items-center py-2 px-4 border-t border-gray-300 shrink-0">
          <span className="font-bold text-[#1b4379] text-[11px]">รวมทั้งหมด</span>
          <span className="font-bold text-gray-900 text-sm">{totalAmount.toLocaleString()} บาท</span>
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
                  <img 
                    src={companyAccount.qr_code_url} 
                    alt="QR Code" 
                    crossOrigin="anonymous" 
                    loading="eager" // 💡 บังคับโหลดทันที
                    className="w-full h-full object-contain" 
                  />
               ) : (
                  <div className="w-full h-full border border-dashed border-gray-300 flex items-center justify-center text-[10px] text-gray-400 font-bold bg-gray-50">NO QR</div>
               )}
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-500 font-bold mt-2">
          ขอบคุณที่ไว้วางใจ Pun-IQ Academy / ปันความรู้ ปั้นอนาคต
        </p>
      </div>

    </div>
  );
}