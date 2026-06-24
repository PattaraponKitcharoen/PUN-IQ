import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';

export default function TimeLog() {
  const [myStudents, setMyStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  
  const [pricingRates, setPricingRates] = useState([]);
  const [customCourses, setCustomCourses] = useState([]);

  const [tutorProfile, setTutorProfile] = useState(null);
  const [tutorUsername, setTutorUsername] = useState('');

  const [currentTutorId, setCurrentTutorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const isSubmitting = useRef(false);

  // logType: 'individual' | 'group' | 'bulk' (ลงเวลาต่อเนื่อง)
  const [logType, setLogType] = useState('individual'); 

  const [studentId, setStudentId] = useState('');
  const [groupId, setGroupId] = useState('');
  
  const [learningType, setLearningType] = useState('general');
  const [selectedCourseId, setSelectedCourseId] = useState('');

  const [selectedGrade, setSelectedGrade] = useState('');
  const gradeOptions = ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];

  const getLocalTodayDate = () => {
    const d = new Date();
    return d.toLocaleDateString('en-CA'); 
  };

  // State สำหรับฟอร์มแบบปกติ (Individual / Group)
  const [selectedDate, setSelectedDate] = useState(getLocalTodayDate());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [durationHours, setDurationHours] = useState('');
  const [topic, setTopic] = useState('');
  
  // 🔴 1. State สำหรับระบบลงเวลาต่อเนื่อง (Bulk Rows)
  const [bulkRows, setBulkRows] = useState([
    { teaching_date: getLocalTodayDate(), start_time: '', end_time: '', duration_hours: '', topic: '' }
  ]);

  const [presentStudentIds, setPresentStudentIds] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);
  const [subjectId, setSubjectId] = useState('');

  const isClassroomTutor = tutorUsername === 'Classroom';

  // คำนวณเวลาสำหรับโหมดปกติ
  useEffect(() => {
    if (startTime && endTime) {
      const start = new Date(`2000-01-01T${startTime}`);
      const end = new Date(`2000-01-01T${endTime}`);
      let diff = (end - start) / (1000 * 60 * 60);
      if (diff < 0) diff += 24; 
      if (diff > 0) {
        setDurationHours(Number.isInteger(diff) ? diff.toString() : diff.toFixed(2));
      }
    }
  }, [startTime, endTime]);

  // บังคับโหมดคอร์สพิเศษอัตโนมัติหากเป็นสถาบันเข้าใช้งาน
  useEffect(() => {
    if (isClassroomTutor) {
      setLearningType('course');
      if (logType === 'group') setLogType('individual'); // ป้องกันกรณีหลุดไปแท็บกลุ่ม
    }
  }, [isClassroomTutor, logType]);

  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const tutorId = session?.user?.id;
    setCurrentTutorId(tutorId);

    if (tutorId) {
      const { data: profile } = await supabase
        .from('users')
        .select('username, is_vip')
        .eq('id', tutorId)
        .single();
      setTutorProfile(profile);
      setTutorUsername(profile?.username || '');
    }

    const { data: subsData } = await supabase.from('subjects').select('*').order('subject_name');
    if (subsData) setSubjectsList(subsData);

    if (tutorId) {
      const [ratesRes, customCoursesRes] = await Promise.all([
        supabase.from('pricing_rates').select('*'),
        supabase.from('custom_courses').select('*').eq('tutor_id', tutorId).eq('is_active', true)
      ]);

      if (ratesRes.data) setPricingRates(ratesRes.data);
      if (customCoursesRes.data) setCustomCourses(customCoursesRes.data);

      const { data: indMap } = await supabase.from('tutor_students').select('student_id').eq('tutor_id', tutorId);
      const indStudentIds = indMap?.map(m => m.student_id) || [];

      const { data: grpMap } = await supabase.from('tutor_groups').select('group_id').eq('tutor_id', tutorId);
      const myGroupIds = grpMap?.map(g => g.group_id) || [];

      let grpStudentIds = [];
      if (myGroupIds.length > 0) {
        const { data: myGroupsData } = await supabase.from('groups').select('*').in('id', myGroupIds).order('group_name');
        setGroups(myGroupsData || []);

        const { data: membersData } = await supabase.from('group_members').select('*').in('group_id', myGroupIds);
        setGroupMembers(membersData || []);
        grpStudentIds = (membersData || []).map(m => m.student_id);
      } else {
        setGroups([]);
        setGroupMembers([]);
      }

      const allStudentIds = [...new Set([...indStudentIds, ...grpStudentIds])];
      if (allStudentIds.length > 0) {
        const { data: studentsData } = await supabase.from('users').select('id, name, username, grade').in('id', allStudentIds);
        setMyStudents(studentsData || []);
      } else {
        setMyStudents([]);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (logType === 'group' && groupId) {
      const studentsInGroup = groupMembers.filter(m => m.group_id === groupId).map(m => m.student_id);
      setPresentStudentIds(studentsInGroup);
    } else {
      setPresentStudentIds([]);
    }
  }, [groupId, logType, groupMembers]);

  const filteredCustomCourses = customCourses.filter(course => {
    if (logType === 'group') {
      return course.group_id === groupId;
    } else {
      const studentGroupIds = groupMembers.filter(m => m.student_id === studentId).map(m => m.group_id);
      return String(course.student_id) === String(studentId) || studentGroupIds.includes(course.group_id);
    }
  });

  const handleTogglePresent = (id) => {
    setPresentStudentIds(prev => prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    const studentsInGroup = groupMembers.filter(m => m.group_id === groupId).map(m => m.student_id);
    const allSelected = studentsInGroup.length > 0 && studentsInGroup.every(id => presentStudentIds.includes(id));
    setPresentStudentIds(allSelected ? [] : studentsInGroup);
  };

  // 🔴 2. ฟังก์ชันจัดการระบบเพิ่ม/ลดแถว สำหรับโหมดลงเวลาต่อเนื่อง
  const handleAddBulkRow = () => {
    setBulkRows([...bulkRows, { teaching_date: getLocalTodayDate(), start_time: '', end_time: '', duration_hours: '', topic: '' }]);
  };

  const handleRemoveBulkRow = (index) => {
    if (bulkRows.length === 1) return;
    setBulkRows(bulkRows.filter((_, i) => i !== index));
  };

  const handleBulkRowChange = (index, field, value) => {
    const updatedRows = [...bulkRows];
    updatedRows[index][field] = value;

    // คำนวณเวลาอัตโนมัติประจำแถวเมื่อมีการแก้ไขเวลาเข้าออก
    if (field === 'start_time' || field === 'end_time') {
      const startTimeVal = updatedRows[index].start_time;
      const endTimeVal = updatedRows[index].end_time;
      
      if (startTimeVal && endTimeVal) {
        const start = new Date(`2000-01-01T${startTimeVal}`);
        const end = new Date(`2000-01-01T${endTimeVal}`);
        let diff = (end - start) / (1000 * 60 * 60);
        if (diff < 0) diff += 24;
        updatedRows[index].duration_hours = Number(diff.toFixed(2));
      }
    }
    setBulkRows(updatedRows);
  };

  // ฟังก์ชันบันทึกข้อมูลหลัก (Hybrid รองรับทั้ง 3 โหมดในปุ่มเดียว)
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting.current) return;

    if (logType !== 'group' && !studentId) { setMessage('❌ กรุณาเลือกนักเรียน'); return; }
    if (logType === 'group' && !groupId) { setMessage('❌ กรุณาเลือกกลุ่ม'); return; }
    if (logType === 'group' && presentStudentIds.length === 0) { setMessage('❌ กรุณาเลือกผู้ใช้งานอย่างน้อย 1 คน'); return; }
    if (learningType === 'course' && !selectedCourseId) { setMessage('❌ กรุณาเลือกแพ็กเกจ/คอร์ส'); return; }
    if (learningType !== 'course' && !selectedGrade) { setMessage('❌ กรุณาเลือกระดับชั้นของเนื้อหา'); return; }
    if (learningType !== 'course' && !subjectId) { setMessage('❌ กรุณาเลือกรายวิชา'); return; }

    // ตรวจสอบข้อมูลในแถวโหมดต่อเนื่อง
    if (logType === 'bulk') {
      for (let i = 0; i < bulkRows.length; i++) {
        const row = bulkRows[i];
        if (!row.teaching_date || !row.start_time || !row.end_time || !row.duration_hours) {
          setMessage(`❌ กรุณากรอกข้อมูล วันที่และเวลา ในแถวที่ ${i + 1} ให้ครบถ้วน`);
          return;
        }
      }
    } else {
      if (!selectedDate || !durationHours || !startTime || !endTime) return;
    }

    isSubmitting.current = true;
    setSaving(true);
    setMessage('');

    try {
      // ค้นหาเรทราคาตั้งต้น
      let appliedStudentRate = 0;
      let appliedTutorRate = 0;
      let ruleText = "";

      if (learningType === 'course') {
        const targetCourse = customCourses.find(c => String(c.id) === String(selectedCourseId));
        if (targetCourse) {
          appliedStudentRate = targetCourse.student_hourly_rate;
          appliedTutorRate = targetCourse.tutor_hourly_rate;
          const ruleMatch = targetCourse.course_name.match(/\(([\d.]+ ชม\.\/รอบ = [\d.]+ บาท)\)/);
          if (ruleMatch) ruleText = `[เกณฑ์: ${ruleMatch[1]}]`;
        }
      } else {
        const rateTypeLabel = learningType === 'advanced' ? 'Advanced' : 'General';
        const matchedRate = pricingRates.find(r => r.grade_level === selectedGrade && r.rate_type === rateTypeLabel);
        if (matchedRate) {
          appliedStudentRate = matchedRate.student_hourly_rate;
          appliedTutorRate = matchedRate.tutor_hourly_rate;
        }
      }

      if (tutorProfile?.is_vip) {
        appliedTutorRate = appliedStudentRate;
      }

      let inserts = [];

      // 🔴 3. จัดสัดส่วนการประกอบโครงสร้างข้อมูลสำหรับการเซฟเข้าฐานข้อมูล Supabase
      if (logType === 'bulk') {
        // แตกแถว Array ออกมาเซฟกรณีเป็นโหมดต่อเนื่อง
        bulkRows.forEach(row => {
          let finalTopic = row.topic;
          if (isClassroomTutor && learningType === 'course') {
            finalTopic = `${ruleText ? ruleText + ' ' : ''}${row.topic ? row.topic + ' ' : ''}(เวลาจริง: ${Number(row.duration_hours).toFixed(2)} ชม.)`;
          }

          inserts.push({
            tutor_id: currentTutorId,
            student_id: studentId,
            subject_id: learningType === 'course' ? null : subjectId, 
            teaching_date: row.teaching_date,
            start_time: row.start_time,
            end_time: row.end_time,
            duration_hours: parseFloat(row.duration_hours), 
            topic: finalTopic,
            learning_type: learningType,
            custom_course_id: learningType === 'course' ? selectedCourseId : null,
            grade_level: learningType === 'course' ? null : selectedGrade,
            applied_student_rate: appliedStudentRate,
            applied_tutor_rate: appliedTutorRate 
          });
        });
      } else {
        // การเซฟแบบแถวเดี่ยวโหมดปกติ (Individual / Group)
        const targets = logType === 'individual' ? [studentId] : presentStudentIds;
        targets.forEach(sId => {
          let finalTopic = topic;
          if (isClassroomTutor && learningType === 'course') {
            finalTopic = `${ruleText ? ruleText + ' ' : ''}${topic ? topic + ' ' : ''}(เวลาจริง: ${durationHours} ชม.)`;
          }

          inserts.push({
            tutor_id: currentTutorId,
            student_id: sId,
            subject_id: learningType === 'course' ? null : subjectId, 
            teaching_date: selectedDate,
            start_time: startTime,
            end_time: endTime,
            duration_hours: parseFloat(durationHours), 
            topic: finalTopic,
            learning_type: learningType,
            custom_course_id: learningType === 'course' ? selectedCourseId : null,
            grade_level: learningType === 'course' ? null : selectedGrade,
            applied_student_rate: appliedStudentRate,
            applied_tutor_rate: appliedTutorRate 
          });
        });
      }

      const { error } = await supabase.from('teaching_logs').insert(inserts);
      if (error) throw new Error(error.message);

      setMessage(`✅ บันทึกเวลา${isClassroomTutor ? 'ใช้งานสถานที่' : 'สอน'}สำเร็จเรียบร้อย! (บันทึกทั้งหมด ${inserts.length} รายการ)`);
      
      // ล้างค่าฟอร์มกลับสู่ค่าเริ่มต้น
      setStudentId('');
      setGroupId('');
      setStartTime('');
      setEndTime('');
      setDurationHours('');
      setTopic('');
      setSubjectId('');
      setSelectedCourseId('');
      setSelectedGrade('');
      setBulkRows([{ teaching_date: getLocalTodayDate(), start_time: '', end_time: '', duration_hours: '', topic: '' }]);
      setLearningType(isClassroomTutor ? 'course' : 'general');
    } catch (err) {
      setMessage(`❌ เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setSaving(false);
      isSubmitting.current = false;
    }
  };

  const studentsInThisGroupDetails = myStudents.filter(s => groupMembers.filter(m => m.group_id === groupId).map(m => m.student_id).includes(s.id));
  const isTargetSelected = logType === 'group' ? groupId : studentId;

  if (loading) return <div className="p-10 text-center text-gray-500">กำลังโหลดข้อมูล...</div>;

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {isClassroomTutor ? 'ระบบลงเวลาใช้งานสถานที่' : 'ระบบลงเวลาสอน'}
        </h1>
        <p className="text-gray-500 mt-1">
          {isClassroomTutor ? 'บันทึกเวลาการเช่าห้องเรียนสถาบันแบบฟอร์มปกติหรือแบบฟอร์มรอบต่อเนื่อง' : 'บันทึกชั่วโมงการสอนสำหรับนักเรียนรายบุคคล คลาสกลุ่ม หรือลงเวลาย้อนหลังหลายรอบ'}
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-semibold shadow-sm border ${message.includes('สำเร็จ') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 h-fit">
        
        {/* 🔴 4. แถบเมนูแท็บสลับโหมด ปรับเปลี่ยนจำนวนปุ่มตามสถานะคุณครู / Classroom อัตโนมัติ */}
        <div className="flex bg-gray-100 p-1 rounded-lg mb-6 text-center text-sm font-semibold">
          <button type="button" onClick={() => { setLogType('individual'); setMessage(''); }} className={`flex-1 py-2 rounded-md transition ${logType === 'individual' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>รายบุคคล</button>
          {!isClassroomTutor && (
            <button type="button" onClick={() => { setLogType('group'); setMessage(''); }} className={`flex-1 py-2 rounded-md transition ${logType === 'group' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>รายกลุ่ม</button>
          )}
          <button type="button" onClick={() => { setLogType('bulk'); setMessage(''); }} className={`flex-1 py-2 rounded-md transition ${logType === 'bulk' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>⏱️ ลงเวลาต่อเนื่อง (หลายรอบ)</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {logType !== 'group' ? (
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">{isClassroomTutor ? 'เลือกผู้เช่าสถานที่' : 'เลือกนักเรียน'}</label>
              <select value={studentId} onChange={(e) => { setStudentId(e.target.value); if(!isClassroomTutor) setLearningType('general'); }} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium" required={logType !== 'group'}>
                <option value="">-- เลือกรายชื่อ --</option>
                {myStudents.map(s => <option key={s.id} value={s.id}>{s.name || s.username} ({s.grade || '-'})</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">เลือกกลุ่มนักเรียน</label>
              <select value={groupId} onChange={(e) => { setGroupId(e.target.value); setLearningType('general'); }} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required={logType === 'group'}>
                <option value="">-- เลือกกลุ่ม --</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
              </select>

              {groupId && (
                <div className="mt-4 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                  <div className="flex justify-between items-center mb-3 border-b border-indigo-100 pb-2">
                    <span className="text-xs font-bold text-indigo-900 uppercase">มาเรียน {presentStudentIds.length} คน</span>
                    <button type="button" onClick={handleSelectAll} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline">
                      {presentStudentIds.length === studentsInThisGroupDetails.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                    {studentsInThisGroupDetails.map(student => (
                      <label key={student.id} className={`flex items-center space-x-2 cursor-pointer p-2.5 rounded-lg border transition ${presentStudentIds.includes(student.id) ? 'bg-white border-indigo-300 shadow-sm' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                        <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" checked={presentStudentIds.includes(student.id)} onChange={() => handleTogglePresent(student.id)} />
                        <span className="text-sm text-gray-700 truncate">{student.name || student.username}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {!isClassroomTutor && isTargetSelected && (
            <div className="pt-3 border-t border-gray-100 animate-fadeIn">
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">รูปแบบคลาสเรียนในวันนี้</label>
              <div className="grid grid-cols-3 gap-2 bg-gray-100 p-1.5 rounded-lg border border-gray-200">
                <button type="button" onClick={() => { setLearningType('general'); setSelectedCourseId(''); }} className={`py-2 rounded-md text-[11px] sm:text-xs font-bold transition-all text-center ${learningType === 'general' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>📚 ทั่วไป</button>
                <button type="button" onClick={() => { setLearningType('advanced'); setSelectedCourseId(''); }} className={`py-2 rounded-md text-[11px] sm:text-xs font-bold transition-all text-center ${learningType === 'advanced' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>✨ แอดวานซ์</button>
                <button type="button" onClick={() => { setLearningType('course'); setSelectedGrade(''); setSubjectId(''); }} className={`py-2 rounded-md text-[11px] sm:text-xs font-bold transition-all text-center ${learningType === 'course' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>🏆 คอร์สพิเศษ</button>
              </div>
            </div>
          )}

          {isTargetSelected && learningType !== 'course' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">ระดับชั้นเนื้อหาที่สอน</label>
                <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-800" required>
                  <option value="">-- เลือกระดับชั้น --</option>
                  {gradeOptions.map(grade => <option key={grade} value={grade}>{grade}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">รายวิชาเรียนทั่วไป</label>
                <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required>
                  <option value="">-- เลือกวิชา --</option>
                  {subjectsList.map(sub => <option key={sub.id} value={sub.id}>{sub.subject_name}</option>)}
                </select>
              </div>
            </div>
          )}

          {isTargetSelected && learningType === 'course' && (
            <div className="animate-fadeIn">
              <label className={`block text-xs font-bold uppercase mb-1 ${isClassroomTutor ? 'text-emerald-800' : 'text-amber-800'}`}>
                {isClassroomTutor ? 'เลือกแพ็กเกจสิทธิ์เช่าสถานที่' : 'เลือกคอร์สพิเศษของนักเรียน'}
              </label>
              <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 outline-none font-semibold ${isClassroomTutor ? 'bg-emerald-50/50 border-emerald-300 text-emerald-950 focus:ring-emerald-500' : 'border-amber-300 bg-amber-50/50 text-amber-950 focus:ring-amber-500'}`} required>
                <option value="">-- {isClassroomTutor ? 'เลือกแพ็กเกจสิทธิ์สถานที่' : 'เลือกคอร์สพิเศษ'} --</option>
                {filteredCustomCourses.map(course => (
                  <option key={course.id} value={course.id}>{course.course_name} {course.grade_level !== 'สถานที่' ? `(${course.grade_level})` : ''}</option>
                ))}
              </select>
              {filteredCustomCourses.length === 0 && (
                <p className="text-[10px] text-red-500 mt-1">⚠️ ไม่พบ{isClassroomTutor ? 'สิทธิ์แพ็กเกจสถานที่' : 'วิชาในระบบคอร์สพิเศษ'}ของรายชื่อนี้</p>
              )}
            </div>
          )}

          {/* 🔴 5. ส่วนควบคุมสลับอินเทอร์เฟซฟอร์ม (โหมดปกติ VS โหมดบันทึกต่อเนื่องหลายรอบ) */}
          {isTargetSelected && logType !== 'bulk' ? (
            // แผงอินพุตเดี่ยวโหมดปกติ
            <div className="space-y-4 pt-2 border-t border-dashed">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">{isClassroomTutor ? 'วันที่ใช้งาน' : 'วันที่สอน'}</label>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">เวลาเริ่ม</label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">เวลาสิ้นสุด</label>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex justify-between">
                  <span>{isClassroomTutor ? 'เวลาใช้งานจริง (ชั่วโมง)' : 'จำนวนชั่วโมง'}</span>
                  <span className="text-[10px] text-gray-400 font-normal">*คำนวณอัตโนมัติ</span>
                </label>
                <input type="number" step="0.25" min="0.5" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none font-bold" required readOnly={isClassroomTutor} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">{isClassroomTutor ? 'บันทึกช่วยจำ' : 'รายละเอียด / เนื้อหาที่สอน'}</label>
                <textarea rows="2" placeholder={isClassroomTutor ? "โน้ตเพิ่มเติม..." : "บทเรียนที่สอนวันนี้..."} value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"></textarea>
              </div>
            </div>
          ) : isTargetSelected && (
            // 🔴 แผงอินพุตรูปแบบตารางยืดหยุ่น สำหรับโหมดบันทึกต่อเนื่องหลายรอบ
            <div className="space-y-4 pt-3 border-t border-dashed">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-indigo-900 uppercase tracking-wider">รายการคลาส/รอบเวลาใช้งานย้อนหลัง ({bulkRows.length} รอบ)</span>
                <button type="button" onClick={handleAddBulkRow} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center space-x-1">
                  <span>➕ เพิ่มรอบเวลา</span>
                </button>
              </div>

              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {bulkRows.map((row, index) => (
                  <div key={index} className="p-4 bg-slate-50 border rounded-xl relative space-y-3 group transition-all hover:bg-slate-100/70">
                    <div className="absolute top-3 right-3 flex items-center space-x-2">
                      <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded">แถวที่ {index + 1}</span>
                      {bulkRows.length > 1 && (
                        <button type="button" onClick={() => handleRemoveBulkRow(index)} className="text-red-500 hover:text-red-700 font-bold text-xs" title="ลบแถวนี้">❌ ลบ</button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">วันที่</label>
                        <input type="date" value={row.teaching_date} onChange={(e) => handleBulkRowChange(index, 'teaching_date', e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none" required />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">เวลาเริ่ม</label>
                        <input type="time" value={row.start_time} onChange={(e) => handleBulkRowChange(index, 'start_time', e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none" required />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">เวลาสิ้นสุด</label>
                        <input type="time" value={row.end_time} onChange={(e) => handleBulkRowChange(index, 'end_time', e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none" required />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                      <div className="sm:col-span-1">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">ชั่วโมงจริง</label>
                        <input type="number" value={row.duration_hours} className="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-gray-100 font-bold text-gray-700 outline-none" readOnly placeholder="0.00" />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{isClassroomTutor ? 'บันทึกช่วยจำ' : 'เนื้อหาการสอน / หมายเหตุช่วยจำ'}</label>
                        <input type="text" placeholder={isClassroomTutor ? "โน้ตกำกับ..." : "หัวข้อที่สอนย้อนหลัง..."} value={row.topic} onChange={(e) => handleBulkRowChange(index, 'topic', e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button type="submit" disabled={saving || !isTargetSelected} className={`w-full text-white font-bold py-3 rounded-lg transition shadow-sm disabled:opacity-50 mt-2 ${isClassroomTutor ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            {saving ? 'กำลังบันทึกประวัติ...' : isClassroomTutor ? '💾 บันทึกเวลาใช้งานทั้งหมด' : '💾 บันทึกประวัติการสอนทั้งหมด'}
          </button>
        </form>
      </div>
    </div>
  );
}