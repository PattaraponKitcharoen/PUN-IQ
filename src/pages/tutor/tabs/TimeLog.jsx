import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';

export default function TimeLog() {
  const [myStudents, setMyStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [logs, setLogs] = useState([]);
  
  const [pricingRates, setPricingRates] = useState([]);
  const [customCourses, setCustomCourses] = useState([]);

  const [currentTutorId, setCurrentTutorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // 🔴 สร้างตัวแปร Guard ป้องกันการกดปุ่มบันทึกรัวๆ
  const isSubmitting = useRef(false);

  const [logType, setLogType] = useState('individual'); 

  const [studentId, setStudentId] = useState('');
  const [groupId, setGroupId] = useState('');
  
  const [learningType, setLearningType] = useState('general');
  const [selectedCourseId, setSelectedCourseId] = useState('');

  const [selectedGrade, setSelectedGrade] = useState('');
  const gradeOptions = ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];

  // 🔴 ปรับปรุง: สร้างฟังก์ชันดึงวันที่ปัจจุบันตามโซนเวลาของเครื่องผู้ใช้งาน (Local Time)
  const getLocalTodayDate = () => {
    const d = new Date();
    // 'en-CA' จะให้ฟอร์แมต YYYY-MM-DD เสมอ โดยไม่อิงตาม UTC
    return d.toLocaleDateString('en-CA'); 
  };

  const [selectedDate, setSelectedDate] = useState(getLocalTodayDate());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [durationHours, setDurationHours] = useState('');
  
  const [topic, setTopic] = useState('');
  const [presentStudentIds, setPresentStudentIds] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);
  const [subjectId, setSubjectId] = useState('');

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

  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const tutorId = session?.user?.id;
    setCurrentTutorId(tutorId);

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

      fetchLogs(tutorId);
    }
    setLoading(false);
  };

  const fetchLogs = async (tutorId) => {
    const { data, error } = await supabase
      .from('teaching_logs')
      .select('*, users!teaching_logs_student_id_fkey(name, username), subjects(subject_name), custom_courses(course_name)')
      .eq('tutor_id', tutorId)
      .order('teaching_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && data) setLogs(data);
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
    if (logType === 'individual') {
      const studentGroupIds = groupMembers.filter(m => m.student_id === studentId).map(m => m.group_id);
      return course.student_id === studentId || studentGroupIds.includes(course.group_id);
    } else {
      return course.group_id === groupId;
    }
  });

  const handleTogglePresent = (id) => {
    setPresentStudentIds(prev => prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    const studentsInGroup = groupMembers.filter(m => m.group_id === groupId).map(m => m.student_id);
    
    // 🔴 เปลี่ยนจากเช็คความยาว มาเช็คว่า "มี ID ของนักเรียนครบทุกคนใน array จริงๆ ใช่ไหม?"
    const allSelected = studentsInGroup.length > 0 && 
        studentsInGroup.every(id => presentStudentIds.includes(id));
    
    // ถ้าเลือกครบแล้วให้เคลียร์ออก แต่ถ้ายังไม่ครบ ให้เลือกทุกคนในกลุ่ม
    setPresentStudentIds(allSelected ? [] : studentsInGroup);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 🔴 ถ้าระบบกำลังบันทึกข้อมูลอยู่ ให้ยกเลิกคำสั่งนี้ทันที (กันกดปุ่มรัวๆ)
    if (isSubmitting.current) return;

    if (logType === 'individual' && !studentId) { setMessage('❌ กรุณาเลือกนักเรียน'); return; }
    if (logType === 'group' && !groupId) { setMessage('❌ กรุณาเลือกกลุ่ม'); return; }
    if (logType === 'group' && presentStudentIds.length === 0) { setMessage('❌ กรุณาเลือกนักเรียนอย่างน้อย 1 คน'); return; }
    if (learningType === 'course' && !selectedCourseId) { setMessage('❌ กรุณาเลือกคอร์สเรียนพิเศษ'); return; }
    if (learningType !== 'course' && !selectedGrade) { setMessage('❌ กรุณาเลือกระดับชั้นของเนื้อหา'); return; }
    if (learningType !== 'course' && !subjectId) { setMessage('❌ กรุณาเลือกรายวิชา'); return; }
    if (!selectedDate || !durationHours || !startTime || !endTime) return;

    // 🔴 ล็อกประตูเพื่อระบุว่ากำลังส่งข้อมูล
    isSubmitting.current = true;
    setSaving(true);
    setMessage('');

    try {
      // 🔴 เพิ่มตัวเช็คเรทราคา หากเป็นคลาสทั่วไปแล้วไม่มีเรท ให้เด้งเตือนก่อนบันทึก
      if (learningType !== 'course') {
        const rateTypeLabel = learningType === 'advanced' ? 'Advanced' : 'General';
        const matchedRate = pricingRates.find(r => r.grade_level === selectedGrade && r.rate_type === rateTypeLabel);
        if (!matchedRate) {
          const confirmSave = window.confirm(`⚠️ ไม่พบเรทราคาสำหรับ "${selectedGrade} (${rateTypeLabel})" ในระบบ ยอดเงินจะถูกบันทึกเป็น ฿0 ต้องการดำเนินการต่อหรือไม่?`);
          if (!confirmSave) {
            setSaving(false);
            isSubmitting.current = false;
            return; // ยกเลิกการบันทึกถ้าผู้ใช้เปลี่ยนใจ
          }
        }
      }

      let inserts = [];
      const targets = logType === 'individual' ? [studentId] : presentStudentIds;

      for (const sId of targets) {
        let appliedStudentRate = 0;
        let appliedTutorRate = 0;

        if (learningType === 'course') {
          const targetCourse = customCourses.find(c => c.id === selectedCourseId);
          if (targetCourse) {
            appliedStudentRate = targetCourse.student_hourly_rate;
            appliedTutorRate = targetCourse.tutor_hourly_rate;
          }
        } else {
          const rateTypeLabel = learningType === 'advanced' ? 'Advanced' : 'General';
          const matchedRate = pricingRates.find(r => r.grade_level === selectedGrade && r.rate_type === rateTypeLabel);
          if (matchedRate) {
            appliedStudentRate = matchedRate.student_hourly_rate;
            appliedTutorRate = matchedRate.tutor_hourly_rate;
          }
        }

        inserts.push({
          tutor_id: currentTutorId,
          student_id: sId,
          subject_id: learningType === 'course' ? null : subjectId, 
          teaching_date: selectedDate,
          start_time: startTime,
          end_time: endTime,
          duration_hours: parseFloat(durationHours),
          topic: topic,
          learning_type: learningType,
          custom_course_id: learningType === 'course' ? selectedCourseId : null,
          grade_level: learningType === 'course' ? null : selectedGrade,
          applied_student_rate: appliedStudentRate,
          applied_tutor_rate: appliedTutorRate
        });
      }

      const { error } = await supabase.from('teaching_logs').insert(inserts);
      if (error) throw new Error(error.message);

      setMessage(`✅ บันทึกเวลาสอนสำเร็จ! (คำนวณลิงก์เรทราคาระดับชั้น ${selectedGrade || 'คอร์ส'} เรียบร้อย)`);
      
      setStudentId('');
      setGroupId('');
      setStartTime('');
      setEndTime('');
      setDurationHours('');
      setTopic('');
      setSubjectId('');
      setSelectedCourseId('');
      setSelectedGrade('');
      setLearningType('general');
      fetchLogs(currentTutorId);
    } catch (err) {
      setMessage(`❌ เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      // 🔴 ปลดล็อกประตูเสมอไม่ว่าจะสำเร็จหรือเกิด Error
      setSaving(false);
      isSubmitting.current = false;
    }
  };

  const studentsInThisGroupDetails = myStudents.filter(s => groupMembers.filter(m => m.group_id === groupId).map(m => m.student_id).includes(s.id));
  const isTargetSelected = logType === 'individual' ? studentId : groupId;

  const formatTime = (timeStr) => timeStr ? timeStr.substring(0, 5) : '-';

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">ระบบลงเวลาสอน</h1>
        <p className="text-gray-500 mt-1">บันทึกชั่วโมงการสอนสำหรับนักเรียนแต่ละคน หรือคลาสแบบกลุ่มพร้อมระบบล็อกราคาเข้าบิล</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-semibold shadow-sm border ${message.includes('สำเร็จ') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-1 h-fit">
          <h2 className="text-lg font-bold text-indigo-900 mb-4 border-b pb-2">บันทึกคลาสเรียน</h2>
          
          <div className="flex bg-gray-100 p-1 rounded-lg mb-5">
            <button type="button" onClick={() => { setLogType('individual'); setStudentId(''); setGroupId(''); setMessage(''); }} className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition ${logType === 'individual' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>รายบุคคล</button>
            <button type="button" onClick={() => { setLogType('group'); setStudentId(''); setGroupId(''); setMessage(''); }} className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition ${logType === 'group' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>รายกลุ่ม</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {logType === 'individual' ? (
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">เลือกนักเรียน</label>
                <select value={studentId} onChange={(e) => { setStudentId(e.target.value); setLearningType('general'); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required={logType === 'individual'}>
                  <option value="">-- เลือกนักเรียน --</option>
                  {myStudents.map(s => <option key={s.id} value={s.id}>{s.name || s.username} ({s.grade || '-'})</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">เลือกกลุ่มนักเรียน</label>
                <select value={groupId} onChange={(e) => { setGroupId(e.target.value); setLearningType('general'); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required={logType === 'group'}>
                  <option value="">-- เลือกกลุ่ม --</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
                </select>

                {groupId && (
                  <div className="mt-3 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                    <div className="flex justify-between items-center mb-2 border-b border-indigo-100 pb-2">
                      <span className="text-xs font-bold text-indigo-900 uppercase">มาเรียน {presentStudentIds.length} คน</span>
                      <button type="button" onClick={handleSelectAll} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline">
                        {presentStudentIds.length === studentsInThisGroupDetails.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto pr-1">
                      {studentsInThisGroupDetails.map(student => (
                        <label key={student.id} className={`flex items-center space-x-2 cursor-pointer p-2 rounded border transition ${presentStudentIds.includes(student.id) ? 'bg-white border-indigo-300 shadow-sm' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                          <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" checked={presentStudentIds.includes(student.id)} onChange={() => handleTogglePresent(student.id)} />
                          <span className="text-sm text-gray-700 truncate">{student.name || student.username}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {isTargetSelected && (
              <div className="pt-2 border-t border-gray-100 animate-fadeIn">
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">รูปแบบคลาสเรียนในวันนี้</label>
                <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
                  <button type="button" onClick={() => { setLearningType('general'); setSelectedCourseId(''); }} className={`py-1.5 rounded-md text-[11px] font-bold transition-all text-center ${learningType === 'general' ? 'bg-white text-blue-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}>📚 ทั่วไป</button>
                  <button type="button" onClick={() => { setLearningType('advanced'); setSelectedCourseId(''); }} className={`py-1.5 rounded-md text-[11px] font-bold transition-all text-center ${learningType === 'advanced' ? 'bg-white text-purple-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}>✨ แอดวานซ์</button>
                  <button type="button" onClick={() => { setLearningType('course'); setSelectedGrade(''); setSubjectId(''); }} className={`py-1.5 rounded-md text-[11px] font-bold transition-all text-center ${learningType === 'course' ? 'bg-white text-amber-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}>🏆 คอร์สพิเศษ</button>
                </div>
              </div>
            )}

            {isTargetSelected && learningType !== 'course' && (
              <div className="animate-fadeIn">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">ระดับชั้นเนื้อหาที่สอน</label>
                <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-800" required>
                  <option value="">-- เลือกระดับชั้น (ป.1 - ม.6) --</option>
                  {gradeOptions.map(grade => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
              </div>
            )}

            {isTargetSelected && learningType !== 'course' && (
              <div className="animate-fadeIn">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">รายวิชาเรียนทั่วไป</label>
                <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required>
                  <option value="">-- เลือกวิชา --</option>
                  {subjectsList.map(sub => <option key={sub.id} value={sub.id}>{sub.subject_name}</option>)}
                </select>
              </div>
            )}

            {isTargetSelected && learningType === 'course' && (
              <div className="animate-fadeIn">
                <label className="block text-xs font-bold text-amber-800 uppercase mb-1">เลือกคอร์สพิเศษของนักเรียน</label>
                <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="w-full px-3 py-2 border border-amber-300 bg-amber-50/50 text-amber-950 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none font-semibold" required>
                  <option value="">-- เลือกคอร์สพิเศษที่มีสิทธิ์เรียน --</option>
                  {filteredCustomCourses.map(course => (
                    <option key={course.id} value={course.id}>{course.course_name} ({course.grade_level})</option>
                  ))}
                </select>
                {filteredCustomCourses.length === 0 && (
                  <p className="text-[10px] text-red-500 mt-1">⚠️ ไม่พบวิชาในระบบคอร์สพิเศษของนักเรียนคนนี้</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">วันที่สอน</label>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">เวลาเริ่ม</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">เวลาสิ้นสุด</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex justify-between">
                <span>จำนวนชั่วโมง</span>
                <span className="text-[10px] text-gray-400 font-normal">*คำนวณอัตโนมัติ</span>
              </label>
              <input type="number" step="0.25" min="0.5" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none" required />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">รายละเอียด / เนื้อหาที่สอน</label>
              <textarea rows="2" placeholder="บทเรียนที่สอนวันนี้..." value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"></textarea>
            </div>

            <button type="submit" disabled={saving || !isTargetSelected} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg transition shadow-sm disabled:opacity-50">
              {saving ? 'กำลังบันทึก...' : 'บันทึกเวลาสอน'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <h2 className="text-lg font-bold text-indigo-900 mb-4 border-b pb-2">ประวัติการลงเวลาของคุณ</h2>
          {logs.length === 0 ? (
            <div className="text-center py-10 text-gray-400">ยังไม่มีประวัติการสอน</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs uppercase tracking-wider">
                    <th className="p-3">วันที่</th>
                    <th className="p-3 text-center">เวลา</th>
                    <th className="p-3">ประเภทคลาส / รายวิชา</th>
                    <th className="p-3">นักเรียน</th>
                    <th className="p-3 text-center">ชม.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 text-sm transition-colors">
                      <td className="p-3 whitespace-nowrap text-gray-600 font-medium">
                        {new Date(log.teaching_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="p-3 text-center text-gray-500 text-xs whitespace-nowrap">
                        {log.start_time && log.end_time ? `${formatTime(log.start_time)} - ${formatTime(log.end_time)}` : '-'}
                      </td>
                      <td className="p-3">
                        {log.learning_type === 'course' ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            🏆 {log.custom_courses?.course_name || 'คอร์สพิเศษ'}
                          </span>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              log.learning_type === 'advanced' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                            }`}>
                              {log.learning_type === 'advanced' ? 'Advanced' : 'General'}
                            </span>
                            <span className="text-gray-800 font-medium">{log.subjects?.subject_name || '-'}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-indigo-700 font-semibold">{log.users?.name || log.users?.username}</td>
                      <td className="p-3 text-center font-bold text-gray-800 bg-gray-50/50">{log.duration_hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}