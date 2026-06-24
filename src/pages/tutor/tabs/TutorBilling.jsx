import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';

export default function TutorEarnings() {
  const [sessionUser, setSessionUser] = useState(null);
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [expandedGroups, setExpandedGroups] = useState([]);
  const [expandedLogs, setExpandedLogs] = useState([]);

  // 🔴 1. ตรวจจับสถานะว่าเป็นไอดีสถาบันสำหรับห้องเช่าหรือไม่
  const isClassroomTutor = sessionUser?.username === 'Classroom';

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => prev.includes(groupId) ? prev.filter(i => i !== groupId) : [...prev, groupId]);
  };

  const toggleRow = (logId) => {
    setExpandedLogs(prev => prev.includes(logId) ? prev.filter(i => i !== logId) : [...prev, logId]);
  };

  useEffect(() => {
    const fetchUserSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('id, name, username') 
          .eq('id', session.user.id)
          .single();
        setSessionUser(profile || session.user);
      }
    };
    fetchUserSession();
  }, []);

  useEffect(() => {
    if (!sessionUser?.id || !selectedMonth) return;

    const fetchMyTeachingLogs = async () => {
      setLoading(true);
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('teaching_logs')
        .select('*, users!teaching_logs_student_id_fkey(name, username), subjects(subject_name), custom_courses(course_name, grade_level)')
        .eq('tutor_id', sessionUser.id)
        .gte('teaching_date', startDate)
        .lte('teaching_date', endDate)
        .order('teaching_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (!error && data) {
        setLogs(data);
      }
      setLoading(false);
    };

    fetchMyTeachingLogs();
  }, [sessionUser?.id, selectedMonth]);

  const calculateEarnings = () => {
    let totalHrs = 0;
    let totalEarnings = 0;

    const logsWithCalculation = logs.map(log => {
      const ratePerHour = log.applied_tutor_rate || 0;
      const grade = log.learning_type === 'course'
        ? log.custom_courses?.grade_level
        : log.grade_level;
      
      // 🔴 2. ปรับตรรกะคณิตศาสตร์สำหรับคำนวณยอดเงินเช่าห้องให้ลงตัวถูกต้องตามเกณฑ์รอบบิล
      let amount = 0;
      let roundsForDisplay = null;

      if (isClassroomTutor) {
        let rounds = 1;
        const courseName = log.custom_courses?.course_name || '';
        const match = courseName.match(/([\d.]+)\s*ชม\.\/รอบ/);
        if (match) {
          rounds = Number(log.duration_hours) / Number(match[1]); // เวลาจริง หาร เกณฑ์รอบ
          roundsForDisplay = rounds;
        }
        amount = Math.round(rounds * ratePerHour * 100) / 100;
      } else {
        amount = Math.round(Number(log.duration_hours) * ratePerHour * 100) / 100;
      }

      totalHrs += Number(log.duration_hours);
      totalEarnings = Math.round((totalEarnings + amount) * 100) / 100;

      return { ...log, grade, ratePerHour, amount, roundsForDisplay };
    });

    return { totalHrs, totalEarnings, logsWithCalculation };
  };

  const { totalHrs, totalEarnings, logsWithCalculation } = calculateEarnings();
  const formatTime = (timeStr) => timeStr ? timeStr.substring(0, 5) : '-';

  const groupedLogs = useMemo(() => {
    const groupedObj = {};
    
    logsWithCalculation.forEach(log => {
      const groupKey = `${log.student_id}_${log.learning_type}_${log.subject_id || 'no-subj'}_${log.custom_course_id || 'no-crs'}_${log.ratePerHour}`;

      if (!groupedObj[groupKey]) {
        groupedObj[groupKey] = {
          id: groupKey,
          users: log.users,
          learning_type: log.learning_type,
          custom_courses: log.custom_courses,
          subjects: log.subjects,
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

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      
      {/* 🔴 3. ปรับเปลี่ยนข้อความต้อนรับและคำอธิบาย Header ด้านบนตามสถานะผู้ใช้ */}
      <div className={`bg-gradient-to-r rounded-2xl p-8 text-white shadow-lg ${isClassroomTutor ? 'from-emerald-600 to-teal-800' : 'from-indigo-600 to-slate-800'}`}>
        <h1 className="text-3xl font-bold mb-2">
          {isClassroomTutor ? `สรุปรายได้สุทธิค่าเช่าสถานที่` : `สรุปรายได้การสอน, ${sessionUser?.name || sessionUser?.username || ''} 💼`}
        </h1>
        <p className="text-emerald-100 opacity-90">
          {isClassroomTutor ? 'ระบบสรุปเวลาใช้งานพื้นที่และคำนวณยอดจัดเก็บค่าเช่าสถาบันรายเดือน' : 'ระบบสรุปชั่วโมงสอนและคำนวณค่าตอบแทนประจำเดือนของคุณครู'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* ซ้าย: ตัวกรองและสรุปยอด */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-800 uppercase mb-3 border-b pb-2">เลือกเดือนที่ต้องการดู</h2>
            <div>
              <input 
                type="month" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)} 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 font-medium text-gray-700 bg-gray-50 hover:bg-white transition" 
              />
            </div>
          </div>

          <div className="bg-emerald-50 rounded-xl shadow-sm border border-emerald-200 p-5">
            <h2 className="text-sm font-bold uppercase mb-4 text-emerald-800">
              {isClassroomTutor ? 'สรุปงบค่าเช่าเดือนนี้' : 'สรุปรายได้เดือนนี้'}
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white/60 p-3 rounded-lg border border-emerald-100">
                <span className="text-sm text-emerald-900 font-medium">
                  {isClassroomTutor ? 'เวลาใช้ห้องรวมทั้งสิ้น:' : 'รวมเวลาสอนทั้งหมด:'}
                </span>
                <span className="font-bold text-lg text-emerald-700">{totalHrs} ชม.</span>
              </div>
              <div className="pt-2 border-t border-emerald-200/50">
                <span className="block text-xs font-bold text-emerald-700/70 mb-1 uppercase tracking-wider">
                  {isClassroomTutor ? 'ยอดเงินสุทธิเข้าบริษัท:' : 'ค่าตอบแทนรวมโดยประมาณ:'}
                </span>
                <span className="block text-4xl font-black text-emerald-600 tracking-tight">
                  ฿{totalEarnings.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ขวา: ตารางประวัติการสอน */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[400px]">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {isClassroomTutor ? 'รายละเอียดการใช้งานสถานที่' : 'รายละเอียดการสอน'} ประจำเดือน {new Date(selectedMonth + '-01').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
              </h2>
            </div>

            {loading ? (
              <div className="text-center py-20 text-gray-400 animate-pulse Trio flex flex-col items-center">
                 <svg className="w-10 h-10 text-emerald-300 mb-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 <p>กำลังประมวลผลข้อมูลยอดเงิน...</p>
              </div>
            ) : groupedLogs.length === 0 ? (
              <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center">
                 <span className="text-4xl mb-3">📅</span>
                 <p className="font-medium text-gray-600">
                   {isClassroomTutor ? 'ยังไม่มีประวัติการเช่าสถานที่ในเดือนนี้' : 'ไม่มีประวัติการสอนในเดือนนี้'}
                 </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-3 w-10 text-center"></th> 
                      <th className="p-3 font-bold whitespace-nowrap">จำนวนครั้ง</th>
                      {/* 🔴 4. สลับคำศัพท์ตรงหัวคอลัมน์ตารางให้ตรงความเหมาะสม */}
                      <th className="p-3 font-bold">{isClassroomTutor ? 'ผู้เช่าสถานที่ / นักเรียน' : 'สอนนักเรียน'}</th>
                      <th className="p-3 font-bold">{isClassroomTutor ? 'รายละเอียดห้องที่กำหนด' : 'วิชา / คอร์ส'}</th>
                      <th className="p-3 font-bold text-center">{isClassroomTutor ? 'เวลาใช้งาน' : 'รวม ชม.'}</th>
                      <th className="p-3 font-bold text-right">{isClassroomTutor ? 'เรท (รอบละ)' : 'เรท/ชม.'}</th>
                      <th className="p-3 font-bold text-right">{isClassroomTutor ? 'เงินสุทธิ' : 'รวมรายได้'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groupedLogs.map((group) => (
                      <React.Fragment key={group.id}>
                        {/* ชั้นที่ 1: แถวสรุปกลุ่มวิชา */}
                        <tr onClick={() => toggleGroup(group.id)} className="hover:bg-emerald-50/50 cursor-pointer transition-colors group border-b border-gray-100">
                          <td className="p-3 text-center">
                            <svg className={`w-4 h-4 text-gray-400 inline-block transition-transform ${expandedGroups.includes(group.id) ? 'rotate-90 text-emerald-600' : 'group-hover:text-emerald-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          </td>
                          <td className="p-3 whitespace-nowrap text-emerald-800 font-bold">
                            {group.sessions.length} ครั้ง
                          </td>
                          <td className="p-3 font-semibold text-indigo-700">
                            {group.users?.name || group.users?.username || '-'}
                          </td>
                          <td className="p-3">
                            {group.learning_type === 'course' ? (
                              <span className="font-bold text-amber-700 text-xs">
                                🏆 {group.custom_courses?.course_name || 'คอร์สพิเศษ'} 
                                {group.custom_courses?.grade_level !== 'สถานที่' && (
                                  <span className="text-gray-500 font-normal ml-1">({group.custom_courses?.grade_level || group.grade || '-'})</span>
                                )}
                              </span>
                            ) : (
                              <div className="flex items-center space-x-1.5 whitespace-nowrap">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${group.learning_type === 'advanced' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {group.learning_type === 'advanced' ? 'Adv' : 'Gen'}
                                </span>
                                <span className="font-medium text-gray-800">
                                  {group.subjects?.subject_name || '-'} 
                                  <span className="text-gray-500 font-normal text-[11px] ml-1">({group.grade || '-'})</span>
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center font-bold text-gray-800">{group.total_duration} ชม.</td>
                          <td className="p-3 text-right text-gray-400 text-xs">฿{group.ratePerHour?.toLocaleString()}</td>
                          <td className="p-3 text-right font-bold text-emerald-700">฿{group.total_amount.toLocaleString()}</td>
                        </tr>

                        {/* ชั้นที่ 2: แถวรายละเอียดรายวัน */}
                        {expandedGroups.includes(group.id) && group.sessions.map((session, index) => (
                          <React.Fragment key={session.id}>
                            <tr onClick={() => toggleRow(session.id)} className="bg-slate-50/50 hover:bg-slate-100 cursor-pointer border-l-2 border-emerald-500 group">
                              <td className="p-2 border-r border-gray-200"></td>
                              <td colSpan="3" className="p-3 text-gray-600 font-medium">
                                <div className="flex items-center">
                                  <svg className={`w-3.5 h-3.5 mr-2 transition-transform ${expandedLogs.includes(session.id) ? 'rotate-90 text-emerald-600' : 'text-gray-400 group-hover:text-emerald-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                  ครั้งที่ {index + 1} : วันที่ {new Date(session.teaching_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </div>
                              </td>
                              {/* 🔴 5. ปรับให้แถวรายวัน แสดงจำนวนรอบควบคู่ไปด้วยกันอย่างละเอียดโปร่งใส */}
                              <td className="p-3 text-center font-bold text-gray-700">
                                {session.duration_hours} ชม.
                                {session.roundsForDisplay && <span className="block text-[10px] text-emerald-600 font-bold">({session.roundsForDisplay} รอบ)</span>}
                              </td>
                              <td className="p-3 text-right text-gray-400 text-xs">฿{session.ratePerHour}</td>
                              <td className="p-3 text-right font-bold text-gray-800">฿{session.amount.toLocaleString()}</td>
                            </tr>

                            {/* ชั้นที่ 3: แถวรายละเอียดเวลาและเนื้อหา */}
                            {expandedLogs.includes(session.id) && (
                              <tr className="bg-emerald-50/20 border-b border-gray-100 border-l-2 border-emerald-500">
                                <td className="border-r border-gray-200"></td>
                                <td colSpan="6" className="p-4 px-10 text-sm shadow-inner">
                                  <div className="flex flex-col space-y-2 text-gray-700">
                                    <div className="flex items-center">
                                      <span className="font-bold text-emerald-800 w-16">เวลา:</span>
                                      <span className="text-gray-700 font-medium bg-white px-2 py-0.5 rounded border border-emerald-100">
                                        {formatTime(session.start_time)} น. - {formatTime(session.end_time)} น.
                                      </span>
                                    </div>
                                    <div className="flex items-start">
                                      <span className="font-bold text-emerald-800 w-16 shrink-0 mt-0.5">หมายเหตุ:</span>
                                      <span className="text-gray-600 italic bg-white px-3 py-2 rounded-lg border border-emerald-100 shadow-sm w-full leading-relaxed">
                                        {session.topic || <span className="text-gray-400">ไม่มีบันทึกช่วยจำเพิ่มเติม</span>}
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
            )}
          </div>
        </div>
      </div>

    </div>
  );
}