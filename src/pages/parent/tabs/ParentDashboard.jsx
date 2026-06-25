import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';

export default function ParentDashboard() {
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔴 1. เพิ่ม State สำหรับการเปิด/ปิด Dropdown ในตาราง
  const [expandedGroups, setExpandedGroups] = useState([]);
  const [expandedLogs, setExpandedLogs] = useState([]);

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]);
  };

  const toggleRow = (logId) => {
    setExpandedLogs(prev => prev.includes(logId) ? prev.filter(itemId => itemId !== logId) : [...prev, logId]);
  };

  useEffect(() => {
    const fetchChildren = async () => {
      const session = JSON.parse(localStorage.getItem('custom_user_session') || '{}');
      if (!session.id) return;

      const { data, error } = await supabase
        .from('parent_children')
        .select('student:users!parent_children_student_id_fkey(id, name, username, grade)')
        .eq('parent_id', session.id);

      if (!error && data) {
        const mappedChildren = data.map(d => d.student).filter(Boolean);
        setChildren(mappedChildren);
        if (mappedChildren.length > 0) {
          setSelectedChildId(mappedChildren[0].id); 
        }
      }
      setLoading(false);
    };
    fetchChildren();
  }, []);

  useEffect(() => {
    if (!selectedChildId || !selectedMonth) {
        setLogs([]);
        return;
    }

    const fetchLogs = async () => {
      setLoading(true);
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('teaching_logs')
        .select('*, tutor:tutor_id(name, username), subjects(subject_name), custom_courses(course_name, grade_level)')
        .eq('student_id', selectedChildId)
        .gte('teaching_date', startDate)
        .lte('teaching_date', endDate)
        .order('teaching_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (!error) setLogs(data || []);
      setLoading(false);
    };

    fetchLogs();
  }, [selectedChildId, selectedMonth]);

  // 🔴 2. คำนวณยอดเงินและรอบเพื่อนำมาแสดงผลในตาราง
  const { totalHrs, totalAmt, logsWithCalculation } = useMemo(() => {
    let tHrs = 0;
    let tAmt = 0;

    const computedLogs = logs.map(log => {
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

      tHrs += Number(log.duration_hours);
      tAmt += amount;

      return { ...log, grade, ratePerHour, amount, roundsForDisplay };
    });

    return { totalHrs: tHrs, totalAmt: tAmt, logsWithCalculation: computedLogs };
  }, [logs]);

  const formatTime = (timeStr) => timeStr ? timeStr.substring(0, 5) : '-';

  // 🔴 3. จัดกลุ่มประวัติตามวิชา/คอร์ส เพื่อสร้างหัวข้อ Dropdown
  const groupedLogs = useMemo(() => {
    const groupedObj = {};
    
    logsWithCalculation.forEach(log => {
      const groupKey = `${log.tutor_id}_${log.learning_type}_${log.subject_id || 'no-subj'}_${log.custom_course_id || 'no-crs'}_${log.ratePerHour}`;

      if (!groupedObj[groupKey]) {
        groupedObj[groupKey] = {
          id: groupKey,
          tutor: log.tutor, 
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
  }, [logsWithCalculation]);

  if (loading && children.length === 0) return <div className="p-10 text-center text-gray-400">กำลังโหลดรายชื่อนักเรียน...</div>;

  if (children.length === 0) {
      return (
          <div className="p-10 text-center bg-white rounded-2xl shadow-sm border border-red-100">
              <span className="text-4xl">🚷</span>
              <h2 className="text-lg font-bold text-gray-800 mt-4">ยังไม่มีนักเรียนในความดูแล</h2>
              <p className="text-gray-500 mt-1">กรุณาติดต่อแอดมินเพื่อผูกบัญชีนักเรียนเข้ากับบัญชีผู้ปกครองของคุณครับ</p>
          </div>
      );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
         <h1 className="text-2xl font-bold text-indigo-900 mb-6">📅 ประวัติการเข้าเรียน</h1>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
               <label className="block text-xs font-bold text-gray-500 uppercase mb-2">เลือกนักเรียน (บุตรหลาน)</label>
               <select 
                  value={selectedChildId} 
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  className="w-full px-4 py-3 border border-indigo-200 bg-indigo-50/50 rounded-xl font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500"
               >
                  {children.map(child => (
                      <option key={child.id} value={child.id}>👦 {child.name || child.username} ({child.grade || '-'})</option>
                  ))}
               </select>
            </div>
            <div>
               <label className="block text-xs font-bold text-gray-500 uppercase mb-2">เลือกเดือนที่ต้องการดู</label>
               <input 
                  type="month" 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(e.target.value)} 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
               />
            </div>
         </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 gap-3">
            <h2 className="font-bold text-gray-800">รายการเข้าเรียนทั้งหมด</h2>
            <div className="flex space-x-3">
                <span className="text-sm font-bold bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg shadow-sm">
                    รวมเวลา: {totalHrs} ชม.
                </span>
                <span className="text-sm font-bold bg-indigo-100 border border-indigo-200 text-indigo-800 px-3 py-1.5 rounded-lg shadow-sm">
                    ยอดรวม: ฿{totalAmt.toLocaleString()}
                </span>
            </div>
        </div>

        {loading ? (
           <div className="p-16 text-center text-gray-400 animate-pulse">กำลังดึงข้อมูลประวัติการสอน...</div>
        ) : groupedLogs.length === 0 ? (
           <div className="p-16 text-center text-gray-400">ไม่มีประวัติการเข้าเรียนในเดือนที่เลือก</div>
        ) : (
           <div className="overflow-x-auto">
             {/* 🔴 4. โครงสร้างตารางแบบ Dropdown (เหมือนของเด็ก) */}
             <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-white text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                   <tr>
                      <th className="p-4 w-10 text-center">ดู</th>
                      <th className="p-4 font-bold">จำนวนครั้ง</th>
                      <th className="p-4 font-bold">ผู้สอน / สถานที่</th>
                      <th className="p-4 font-bold">วิชา / รายการ</th>
                      <th className="p-4 font-bold text-center">รวม ชม.</th>
                      <th className="p-4 font-bold text-right">เรทราคา</th>
                      <th className="p-4 font-bold text-right">รวมเป็นเงิน</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                   {groupedLogs.map((group) => {
                      const isRoomGroup = group.tutor?.username === 'Classroom';
                      
                      return (
                        <React.Fragment key={group.id}>
                          {/* แถวสรุปกลุ่มวิชา */}
                          <tr onClick={() => toggleGroup(group.id)} className="hover:bg-indigo-50/40 cursor-pointer transition-colors group">
                            <td className="p-4 text-center">
                              <svg className={`w-4 h-4 text-gray-400 inline-block transition-transform duration-200 ${expandedGroups.includes(group.id) ? 'rotate-90 text-indigo-600' : 'group-hover:text-indigo-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </td>
                            <td className="p-4 whitespace-nowrap text-indigo-800 font-bold">{group.sessions.length} ครั้ง</td>
                            <td className="p-4 font-semibold text-gray-800">
                              {isRoomGroup ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">🏠 {group.tutor?.name}</span>
                              ) : (
                                <span>{group.tutor?.name || '-'}</span>
                              )}
                            </td>
                            <td className="p-4">
                              {isRoomGroup ? (
                                <span className="font-bold text-emerald-700 text-xs">🏆 {group.custom_courses?.course_name}</span>
                              ) : group.learning_type === 'course' ? (
                                <span className="font-bold text-amber-700 text-xs block truncate">
                                  🏆 {group.custom_courses?.course_name || 'คอร์สพิเศษ'} 
                                  <span className="text-gray-500 font-normal ml-1">({group.grade || '-'})</span>
                                </span>
                              ) : (
                                <div className="flex items-center space-x-1.5 whitespace-nowrap">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${group.learning_type === 'advanced' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{group.learning_type === 'advanced' ? 'Adv' : 'Gen'}</span>
                                  <span className="font-medium text-gray-800">{group.subjects?.subject_name} <span className="text-gray-500 font-normal text-[11px] ml-1">({group.grade || '-'})</span></span>
                                </div>
                              )}
                            </td>
                            <td className="p-4 text-center font-bold text-gray-800">{group.total_duration}</td>
                            <td className="p-4 text-right text-gray-400 text-xs">฿{group.ratePerHour?.toLocaleString()}</td>
                            <td className="p-4 text-right font-bold text-indigo-700">฿{group.total_amount.toLocaleString()}</td>
                          </tr>

                          {/* แถวรายละเอียดแต่ละครั้ง (แสดงเมื่อกดขยาย) */}
                          {expandedGroups.includes(group.id) && group.sessions.map((session, index) => (
                            <React.Fragment key={session.id}>
                              <tr onClick={() => toggleRow(session.id)} className="bg-slate-50/80 hover:bg-slate-100 cursor-pointer border-l-4 border-indigo-400">
                                <td className="p-2 border-r border-gray-200"></td>
                                <td colSpan="3" className="p-3 text-gray-600 font-medium pl-6">
                                  <div className="flex items-center">
                                    <svg className={`w-3.5 h-3.5 mr-2 transition-transform duration-200 ${expandedLogs.includes(session.id) ? 'rotate-90 text-indigo-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    ครั้งที่ {index + 1} : วันที่ {new Date(session.teaching_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                                  </div>
                                </td>
                                <td className="p-3 text-center font-bold text-gray-700">
                                  {session.duration_hours} ชม.
                                  {session.roundsForDisplay && <span className="block text-[10px] text-emerald-600 font-bold mt-0.5">({session.roundsForDisplay} รอบ)</span>}
                                </td>
                                <td className="p-3 text-right text-gray-400 text-xs">฿{session.ratePerHour}</td>
                                <td className="p-3 text-right font-bold text-gray-800">฿{session.amount.toLocaleString()}</td>
                              </tr>
                              
                              {/* แถวโน้ตเนื้อหาการเรียน (แสดงเมื่อกดขยายครั้งที่เรียน) */}
                              {expandedLogs.includes(session.id) && (
                                <tr className="bg-indigo-50/40 border-b border-gray-100 border-l-4 border-indigo-400">
                                  <td className="border-r border-gray-200"></td>
                                  <td colSpan="6" className="p-4 px-12 text-sm shadow-inner">
                                    <div className="flex flex-col space-y-2 text-gray-700">
                                      <div className="flex items-center">
                                        <span className="font-bold text-indigo-800 w-20">เวลาเรียน:</span>
                                        <span className="text-gray-700 font-medium bg-white px-2.5 py-1 rounded-md border border-indigo-100 shadow-sm">
                                          {formatTime(session.start_time)} น. - {formatTime(session.end_time)} น.
                                        </span>
                                      </div>
                                      <div className="flex items-start mt-2">
                                        <span className="font-bold text-indigo-800 w-20 shrink-0 mt-1">{isRoomGroup ? 'บันทึกช่วยจำ:' : 'เนื้อหา:'}</span>
                                        <span className="text-gray-600 bg-white px-3 py-2 rounded-lg border border-indigo-100 shadow-sm w-full leading-relaxed">
                                          {session.topic || <span className="text-gray-400 italic">ไม่ได้ระบุรายละเอียดเพิ่มเติม</span>}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </React.Fragment>
                      );
                   })}
                </tbody>
             </table>
           </div>
        )}
      </div>
    </div>
  );
}