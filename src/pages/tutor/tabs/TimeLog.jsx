import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';

export default function TimeLog() {
  const [myStudents, setMyStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  
  const [pricingRates, setPricingRates] = useState([]);
  const [customCourses, setCustomCourses] = useState([]);

  // 🔴 1. State สำหรับเก็บข้อมูล Profile และสิทธิ์ VIP
  const [tutorProfile, setTutorProfile] = useState(null);

  const [currentTutorId, setCurrentTutorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const isSubmitting = useRef(false);

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

    // 🔴 2. ดึงค่า is_vip จากฐานข้อมูลเมื่อครูล็อกอิน
    if (tutorId) {
      const { data: profile } = await supabase
        .from('users')
        .select('is_vip')
        .eq('id', tutorId)
        .single();
      setTutorProfile(profile);
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
    const allSelected = studentsInGroup.length > 0 && studentsInGroup.every(id => presentStudentIds.includes(id));
    setPresentStudentIds(allSelected ? [] : studentsInGroup);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting.current) return;

    if (logType === 'individual' && !studentId) { setMessage('❌ กรุณาเลือกนักเรียน'); return; }
    if (logType === 'group' && !groupId) { setMessage('❌ กรุณาเลือกกลุ่ม'); return; }
    if (logType === 'group' && presentStudentIds.length === 0) { setMessage('❌ กรุณาเลือกนักเรียนอย่างน้อย 1 คน'); return; }
    if (learningType === 'course' && !selectedCourseId) { setMessage('❌ กรุณาเลือกคอร์สเรียนพิเศษ'); return; }
    if (learningType !== 'course' && !selectedGrade) { setMessage('❌ กรุณาเลือกระดับชั้นของเนื้อหา'); return; }
    if (learningType !== 'course' && !subjectId) { setMessage('❌ กรุณาเลือกรายวิชา'); return; }
    if (!selectedDate || !durationHours || !startTime || !endTime) return;

    isSubmitting.current = true;
    setSaving(true);
    setMessage('');

    try {
      if (learningType !== 'course') {
        const rateTypeLabel = learningType === 'advanced' ? 'Advanced' : 'General';
        const matchedRate = pricingRates.find(r => r.grade_level === selectedGrade && r.rate_type === rateTypeLabel);
        if (!matchedRate) {
          const confirmSave = window.confirm(`⚠️ ไม่พบเรทราคาสำหรับ "${selectedGrade} (${rateTypeLabel})" ในระบบ ยอดเงินจะถูกบันทึกเป็น ฿0 ต้องการดำเนินการต่อหรือไม่?`);
          if (!confirmSave) {
            setSaving(false);
            isSubmitting.current = false;
            return;
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

        // 🔴 3. ถ้าระบบพบว่าครูคนนี้ถูกตั้งเป็น VIP (is_vip = true) ให้เรทค่าสอนเท่ากับค่าเรียนทันที
        if (tutorProfile?.is_vip) {
          appliedTutorRate = appliedStudentRate;
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
    } catch (err) {
      setMessage(`❌ เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setSaving(false);
      isSubmitting.current = false;
    }
  };

  const studentsInThisGroupDetails = myStudents.filter(s => groupMembers.filter(m => m.group_id === groupId).map(m => m.student_id).includes(s.id));
  const isTargetSelected = logType === 'individual' ? studentId : groupId;

  if (loading) return <div className="p-10 text-center text-gray-500">กำลังโหลดข้อมูล...</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">ระบบลงเวลาสอน</h1>
        <p className="text-gray-500 mt-1">บันทึกชั่วโมงการสอนสำหรับนักเรียนแต่ละคน หรือคลาสแบบกลุ่ม</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-semibold shadow-sm border ${message.includes('สำเร็จ') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 h-fit">
        <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
          <button type="button" onClick={() => { setLogType('individual'); setStudentId(''); setGroupId(''); setMessage(''); }} className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${logType === 'individual' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>รายบุคคล</button>
          <button type="button" onClick={() => { setLogType('group'); setStudentId(''); setGroupId(''); setMessage(''); }} className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${logType === 'group' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>รายกลุ่ม</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {logType === 'individual' ? (
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">เลือกนักเรียน</label>
              <select value={studentId} onChange={(e) => { setStudentId(e.target.value); setLearningType('general'); }} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required={logType === 'individual'}>
                <option value="">-- เลือกนักเรียน --</option>
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
          
          {isTargetSelected && (
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
            <div className="animate-fadeIn">
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">ระดับชั้นเนื้อหาที่สอน</label>
              <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-800" required>
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
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required>
                <option value="">-- เลือกวิชา --</option>
                {subjectsList.map(sub => <option key={sub.id} value={sub.id}>{sub.subject_name}</option>)}
              </select>
            </div>
          )}

          {isTargetSelected && learningType === 'course' && (
            <div className="animate-fadeIn">
              <label className="block text-xs font-bold text-amber-800 uppercase mb-1">เลือกคอร์สพิเศษของนักเรียน</label>
              <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="w-full px-4 py-2.5 border border-amber-300 bg-amber-50/50 text-amber-950 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none font-semibold" required>
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
              <span>จำนวนชั่วโมง</span>
              <span className="text-[10px] text-gray-400 font-normal">*คำนวณอัตโนมัติ</span>
            </label>
            <input type="number" step="0.25" min="0.5" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none" required />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">รายละเอียด / เนื้อหาที่สอน</label>
            <textarea rows="3" placeholder="บทเรียนที่สอนวันนี้ หรือความคืบหน้า..." value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"></textarea>
          </div>

          <button type="submit" disabled={saving || !isTargetSelected} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition shadow-sm disabled:opacity-50 mt-2">
            {saving ? 'กำลังบันทึก...' : 'บันทึกเวลาสอน'}
          </button>
        </form>
      </div>
    </div>
  );
}