import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';

export default function TutorLogModal({ isOpen, onClose, tutor }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [subjectsList, setSubjectsList] = useState([]);
  
  // 🔴 เพิ่ม State สำหรับดึงรายชื่อคอร์สพิเศษของครูมาเก็บไว้ใช้ตอนแก้ไข
  const [customCoursesList, setCustomCoursesList] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);

  const [editingLog, setEditingLog] = useState(null);
  const [editDate, setEditDate] = useState('');
  
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editHours, setEditHours] = useState('');
  
  const [editTopic, setEditTopic] = useState('');
  const [editSubjectId, setEditSubjectId] = useState('');
  
  // 🔴 เพิ่ม State สำหรับคุมการแก้ไขประเภทคลาสและระดับชั้น
  const [editLearningType, setEditLearningType] = useState('general');
  const [editCustomCourseId, setEditCustomCourseId] = useState('');
  const [editGradeLevel, setEditGradeLevel] = useState('');
  
  const gradeOptions = ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];

  const [saving, setSaving] = useState(false);

  const [filterMonth, setFilterMonth] = useState('');
  const [filterStudent, setFilterStudent] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  // 🔴 1. เพิ่ม State สำหรับเก็บเรทราคากลาง
  const [pricingRates, setPricingRates] = useState([]);

  useEffect(() => {
    if (editStartTime && editEndTime) {
      const start = new Date(`2000-01-01T${editStartTime}`);
      const end = new Date(`2000-01-01T${editEndTime}`);
      let diff = (end - start) / (1000 * 60 * 60);
      if (diff < 0) diff += 24;
      if (diff > 0) setEditHours(Number.isInteger(diff) ? diff.toString() : diff.toFixed(2));
    }
  }, [editStartTime, editEndTime]);

  useEffect(() => {
    if (isOpen && tutor) {
      fetchLogs();
      setEditingLog(null);
      setActionMessage('');
      setFilterMonth('');
      setFilterStudent('');
      setFilterSubject('');
      setSortOrder('desc');

      setEditDate('');
      setEditStartTime('');
      setEditEndTime('');
      setEditHours('');
      setEditTopic('');
      setEditSubjectId('');
      setEditLearningType('general');
      setEditCustomCourseId('');
      setEditGradeLevel('');
    }
  }, [isOpen, tutor]);

  const fetchLogs = async () => {
    setLoading(true);
    // 🔴 2. เพิ่ม pricing_rates และดึงคอลัมน์ราคาของ custom_courses มาด้วย
    const [subsRes, coursesRes, membersRes, ratesRes] = await Promise.all([
      supabase.from('subjects').select('*').order('subject_name'),
      supabase.from('custom_courses').select('id, course_name, grade_level, student_id, group_id, student_hourly_rate, tutor_hourly_rate').eq('tutor_id', tutor.id),
      supabase.from('group_members').select('group_id, student_id'),
      supabase.from('pricing_rates').select('*')
    ]);
    
    if (subsRes.data) setSubjectsList(subsRes.data);
    if (coursesRes.data) setCustomCoursesList(coursesRes.data);
    if (membersRes.data) setGroupMembers(membersRes.data);
    if (ratesRes.data) setPricingRates(ratesRes.data);

    const { data, error } = await supabase
      .from('teaching_logs')
      .select('*, users!teaching_logs_student_id_fkey(name, username), subjects(id, subject_name), custom_courses(course_name, grade_level)')
      .eq('tutor_id', tutor.id)
      .order('teaching_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && data) setLogs(data);
    setLoading(false);
  };

  const filterOptions = useMemo(() => {
    const studentsMap = new Map();
    const subjectsMap = new Map();

    logs.forEach(log => {
      if (log.users) {
        studentsMap.set(log.student_id, log.users.name || log.users.username);
      }
      // ดึงทั้งชื่อวิชาปกติและคอร์สพิเศษมารวมใน Filter
      if (log.learning_type === 'course' && log.custom_courses) {
        subjectsMap.set(log.custom_course_id, log.custom_courses.course_name);
      } else if (log.subjects) {
        subjectsMap.set(log.subject_id, log.subjects.subject_name);
      }
    });

    return {
      students: Array.from(studentsMap.entries()).map(([id, name]) => ({ id, name })),
      subjects: Array.from(subjectsMap.entries()).map(([id, name]) => ({ id, name }))
    };
  }, [logs]);

  const filteredAndSortedLogs = useMemo(() => {
    let result = [...logs];

    if (filterMonth) {
      result = result.filter(log => log.teaching_date.startsWith(filterMonth));
    }
    if (filterStudent) {
      result = result.filter(log => log.student_id === filterStudent);
    }
    if (filterSubject) {
      result = result.filter(log => log.subject_id === filterSubject || log.custom_course_id === filterSubject);
    }

    result.sort((a, b) => {
      const dateA = new Date(a.teaching_date);
      const dateB = new Date(b.teaching_date);
      if (dateA - dateB !== 0) {
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }
      return sortOrder === 'asc' 
        ? new Date(a.created_at) - new Date(b.created_at)
        : new Date(b.created_at) - new Date(a.created_at);
    });

    return result;
  }, [logs, filterMonth, filterStudent, filterSubject, sortOrder]);

  const handleDelete = async (logId) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ที่จะลบประวัติการสอนนี้? ข้อมูลจะหายไปถาวร')) return;
    setActionMessage('');
    try {
      const { error } = await supabase.from('teaching_logs').delete().eq('id', logId);
      if (error) throw new Error(error.message);
      setActionMessage('🗑️ ลบประวัติการสอนสำเร็จ');
      fetchLogs();
    } catch (error) {
      setActionMessage(`❌ ลบไม่สำเร็จ: ${error.message}`);
    }
  };

  const handleEditClick = (log) => {
    setEditingLog(log);
    setEditDate(log.teaching_date);
    setEditStartTime(log.start_time ? log.start_time.substring(0, 5) : '');
    setEditEndTime(log.end_time ? log.end_time.substring(0, 5) : '');
    setEditHours(log.duration_hours);
    setEditTopic(log.topic || '');
    
    // 🔴 กำหนดค่าเริ่มต้นให้กับฟอร์มประเภทการเรียนใหม่
    setEditLearningType(log.learning_type || 'general');
    setEditSubjectId(log.subject_id || '');
    setEditCustomCourseId(log.custom_course_id || '');
    setEditGradeLevel(log.grade_level || '');
    
    setActionMessage('');
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editDate || !editHours) return;
    if (editLearningType === 'course' && !editCustomCourseId) {
        setActionMessage('❌ กรุณาเลือกคอร์สเรียนพิเศษ'); return;
    }
    if (editLearningType !== 'course' && (!editSubjectId || !editGradeLevel)) {
        setActionMessage('❌ กรุณาเลือกระดับชั้นและรายวิชา'); return;
    }

    setSaving(true);
    setActionMessage('');

    try {
      // 🔴 3. คำนวณราคาสแนปช็อตใหม่ ตามประเภทคลาสและระดับชั้นที่แอดมินเพิ่งแก้ไข
      let newStudentRate = 0;
      let newTutorRate = 0;

      if (editLearningType === 'course') {
        const targetCourse = customCoursesList.find(c => c.id === editCustomCourseId);
        if (targetCourse) {
          newStudentRate = targetCourse.student_hourly_rate;
          newTutorRate = targetCourse.tutor_hourly_rate;
        }
      } else {
        const rateTypeLabel = editLearningType === 'advanced' ? 'Advanced' : 'General';
        const matchedRate = pricingRates.find(r => r.grade_level === editGradeLevel && r.rate_type === rateTypeLabel);
        if (matchedRate) {
          newStudentRate = matchedRate.student_hourly_rate;
          newTutorRate = matchedRate.tutor_hourly_rate;
        }
      }

      // 🔴 แนบราคาใหม่ไปอัปเดตด้วย
      const { error } = await supabase
        .from('teaching_logs')
        .update({
          teaching_date: editDate,
          start_time: editStartTime || null,
          end_time: editEndTime || null,
          duration_hours: parseFloat(editHours),
          topic: editTopic,
          learning_type: editLearningType,
          subject_id: editLearningType === 'course' ? null : editSubjectId,
          custom_course_id: editLearningType === 'course' ? editCustomCourseId : null,
          grade_level: editLearningType === 'course' ? null : editGradeLevel,
          applied_student_rate: newStudentRate, // บันทึกเรทเด็กใหม่
          applied_tutor_rate: newTutorRate      // บันทึกเรทครูใหม่
        })
        .eq('id', editingLog.id);

      if (error) throw new Error(error.message);

      setActionMessage('✅ แก้ไขและคำนวณราคาบิลลิ่งใหม่สำเร็จ!');
      setEditingLog(null);
      fetchLogs();
    } catch (error) {
      setActionMessage(`❌ แก้ไขไม่สำเร็จ: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // 🔴 ฟิลเตอร์คอร์สพิเศษให้ครอบคลุมทั้งแบบรายบุคคลและแบบกลุ่มที่เด็กคนนี้สังกัดอยู่
  const studentGroupIds = groupMembers
    .filter(m => m.student_id === editingLog?.student_id)
    .map(m => m.group_id);
    
  const studentCustomCourses = customCoursesList.filter(course => 
    course.student_id === editingLog?.student_id || studentGroupIds.includes(course.group_id)
  );

  if (!isOpen || !tutor) return null;

  const formatTime = (timeStr) => timeStr ? timeStr.substring(0, 5) : '-';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="bg-indigo-900 text-white p-5 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold">{editingLog ? 'แก้ไขประวัติการสอน' : `ประวัติการสอน: ${tutor.name || tutor.username}`}</h3>
          <button onClick={onClose} className="text-indigo-200 hover:text-white transition">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          {actionMessage && <div className={`mb-4 p-3 rounded-lg text-sm font-semibold text-center ${actionMessage.includes('สำเร็จ') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{actionMessage}</div>}

          {loading && !editingLog ? (
            <div className="text-center py-10 text-gray-500 animate-pulse">กำลังโหลดประวัติการสอน...</div>
          ) : editingLog ? (
            
            <form onSubmit={handleUpdate} className="space-y-4 max-w-lg mx-auto">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4">
                <p className="text-xs text-gray-500 font-bold uppercase">นักเรียนที่สอน</p>
                <p className="font-semibold text-indigo-700">{editingLog.users?.name || editingLog.users?.username}</p>
              </div>

              {/* 🔴 เพิ่มฟอร์มสลับประเภทการเรียน */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">รูปแบบคลาสเรียน</label>
                <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
                  <button type="button" onClick={() => { setEditLearningType('general'); setEditCustomCourseId(''); }} className={`py-1.5 rounded-md text-[11px] font-bold transition-all ${editLearningType === 'general' ? 'bg-white text-blue-600 shadow-2xs' : 'text-gray-500'}`}>📚 ทั่วไป</button>
                  <button type="button" onClick={() => { setEditLearningType('advanced'); setEditCustomCourseId(''); }} className={`py-1.5 rounded-md text-[11px] font-bold transition-all ${editLearningType === 'advanced' ? 'bg-white text-purple-600 shadow-2xs' : 'text-gray-500'}`}>✨ แอดวานซ์</button>
                  <button type="button" onClick={() => { setEditLearningType('course'); setEditSubjectId(''); setEditGradeLevel(''); }} className={`py-1.5 rounded-md text-[11px] font-bold transition-all ${editLearningType === 'course' ? 'bg-white text-amber-600 shadow-2xs' : 'text-gray-500'}`}>🏆 คอร์สพิเศษ</button>
                </div>
              </div>

              {editLearningType !== 'course' ? (
                  <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">รายวิชา</label>
                        <select value={editSubjectId} onChange={(e) => setEditSubjectId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required>
                          <option value="">-- เลือกวิชา --</option>
                          {subjectsList.map(sub => <option key={sub.id} value={sub.id}>{sub.subject_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">ระดับชั้น</label>
                        <select value={editGradeLevel} onChange={(e) => setEditGradeLevel(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required>
                          <option value="">-- ระดับชั้น --</option>
                          {gradeOptions.map(grade => <option key={grade} value={grade}>{grade}</option>)}
                        </select>
                      </div>
                  </div>
              ) : (
                  <div>
                    <label className="block text-xs font-bold text-amber-800 uppercase mb-1">เลือกคอร์สพิเศษของนักเรียน</label>
                    <select value={editCustomCourseId} onChange={(e) => setEditCustomCourseId(e.target.value)} className="w-full px-3 py-2 border border-amber-300 bg-amber-50 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none font-semibold text-amber-950" required>
                      <option value="">-- เลือกคอร์สพิเศษ --</option>
                      {studentCustomCourses.map(course => <option key={course.id} value={course.id}>{course.course_name} ({course.grade_level})</option>)}
                    </select>
                  </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">วันที่สอน</label>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">เวลาเริ่ม</label>
                  <input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">เวลาสิ้นสุด</label>
                  <input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">จำนวนชั่วโมง</label>
                <input type="number" step="0.25" min="0.5" value={editHours} onChange={(e) => setEditHours(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none" required />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">เนื้อหาที่สอน</label>
                <textarea rows="2" value={editTopic} onChange={(e) => setEditTopic(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"></textarea>
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => setEditingLog(null)} className="w-1/2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-lg transition text-sm">ยกเลิก</button>
                <button type="submit" disabled={saving} className="w-1/2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg transition text-sm disabled:opacity-50 shadow-sm">
                  {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </form>

          ) : (
            
            <>
              {logs.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">กรองเดือน/ปีที่สอน</label>
                    <input 
                      type="month" 
                      value={filterMonth} 
                      onChange={(e) => setFilterMonth(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-indigo-500 bg-white" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">กรองตามรายชื่อนักเรียน</label>
                    <select 
                      value={filterStudent} 
                      onChange={(e) => setFilterStudent(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-indigo-500 bg-white font-medium text-gray-700"
                    >
                      <option value="">-- นักเรียนทุกคน --</option>
                      {filterOptions.students.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">กรองตามรายวิชา</label>
                    <select 
                      value={filterSubject} 
                      onChange={(e) => setFilterSubject(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-indigo-500 bg-white font-medium text-gray-700"
                    >
                      <option value="">-- ทุกวิชาเรียน --</option>
                      {filterOptions.subjects.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {filteredAndSortedLogs.length === 0 ? (
                <div className="text-center py-10 text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                  {logs.length > 0 ? '❌ ไม่พบข้อมูลประวัติที่ตรงตามเงื่อนไขการกรอง' : 'ยังไม่มีประวัติการสอน'}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th 
                          onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                          className="p-3 font-bold text-gray-700 whitespace-nowrap cursor-pointer hover:bg-gray-100 transition select-none group w-28"
                        >
                          <div className="flex items-center space-x-1">
                            <span>วันที่</span>
                            <span className="text-gray-400 group-hover:text-indigo-600 text-xs">
                              {sortOrder === 'asc' ? '↑ เก่าไปใหม่' : '↓ ใหม่ไปเก่า'}
                            </span>
                          </div>
                        </th>
                        <th className="p-3 font-bold text-gray-700 text-center">เวลา</th>
                        <th className="p-3 font-bold text-gray-700">วิชา</th>
                        <th className="p-3 font-bold text-gray-700">นักเรียน</th>
                        <th className="p-3 font-bold text-gray-700 text-center">ระดับชั้น</th> {/* 🔴 เพิ่มระดับชั้น */}
                        <th className="p-3 font-bold text-gray-700 text-center">ชม.</th>
                        <th className="p-3 font-bold text-gray-700 text-center w-20">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredAndSortedLogs.map(log => (
                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-3 text-gray-600 whitespace-nowrap font-medium">
                            {new Date(log.teaching_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </td>
                          <td className="p-3 text-center text-gray-500 text-xs whitespace-nowrap">
                            {log.start_time && log.end_time ? `${formatTime(log.start_time)}-${formatTime(log.end_time)}` : '-'}
                          </td>
                          {/* 🔴 ตรรกะแสดงผลป้าย Badge ตามประเภทคลาส (General / Advanced / Course) */}
                          <td className="p-3 truncate max-w-[120px]">
                              {log.learning_type === 'course' ? (
                                  <span className="font-bold text-amber-700 text-xs truncate">🏆 {log.custom_courses?.course_name || 'คอร์สพิเศษ'}</span>
                              ) : (
                                  <div className="flex items-center space-x-1.5">
                                      <span className={`text-[9px] px-1 rounded font-bold ${log.learning_type === 'advanced' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                          {log.learning_type === 'advanced' ? 'Adv' : 'Gen'}
                                      </span>
                                      <span className="text-gray-800 font-medium truncate">{log.subjects?.subject_name || '-'}</span>
                                  </div>
                              )}
                          </td>
                          <td className="p-3 text-indigo-700 font-semibold">{log.users?.name || log.users?.username}</td>
                          {/* 🔴 ดึงระดับชั้นจากตารางคอร์สพิเศษ หากเป็นรูปแบบคอร์สเรียน */}
                          {/* 🔴 เปลี่ยนโค้ดคอลัมน์ระดับชั้นให้เป็นแบบนี้ครับ */}
                          <td className="p-3 text-center text-gray-600 font-medium text-xs">
                          {log.learning_type === 'course' 
                              ? (log.custom_courses?.grade_level || '-') 
                              : (log.grade_level || '-')}
                          </td>
                          <td className="p-3 text-center font-bold text-gray-800 bg-gray-50/50">{log.duration_hours}</td>
                          <td className="p-3 flex items-center justify-center space-x-1">
                            <button onClick={() => handleEditClick(log)} className="p-1.5 text-amber-500 hover:bg-amber-50 rounded"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                            <button onClick={() => handleDelete(log.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                          </td>
                        </tr>
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
  );
}