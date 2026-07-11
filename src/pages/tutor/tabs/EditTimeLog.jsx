import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';

export default function EditTimeLog() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const log = location.state?.log; 

  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [topic, setTopic] = useState('');
  
  // 🔴 1. เพิ่ม State สำหรับข้อมูลวิชา ระดับชั้น และเรทราคา
  const [learningType, setLearningType] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [customCourses, setCustomCourses] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [subjectsList, setSubjectsList] = useState([]);
  const [pricingRates, setPricingRates] = useState([]);

  const gradeOptions = ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [isClassroomTutor, setIsClassroomTutor] = useState(false);
  const [tutorProfile, setTutorProfile] = useState(null); // ไว้เช็ค VIP

  // 🔴 2. โหลดข้อมูลที่จำเป็น (วิชา, เรทราคา, โปรไฟล์)
  useEffect(() => {
    const fetchDependencies = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('username, is_vip')
          .eq('id', session.user.id)
          .single();
        
        if (profile) setTutorProfile(profile);
        if (profile?.username === 'Classroom') setIsClassroomTutor(true);
      }

      const { data: subsData } = await supabase.from('subjects').select('*').order('subject_name');
      if (subsData) setSubjectsList(subsData);

      const { data: ratesData } = await supabase.from('pricing_rates').select('*');
      if (ratesData) setPricingRates(ratesData);
    };
    fetchDependencies();
  }, []);

  // 🔴 3. เซ็ตค่าเริ่มต้นจาก Log เดิม
  useEffect(() => {
    if (!log) {
      navigate('/tutor/history', { replace: true });
      return;
    }
    setDate(log.teaching_date || '');
    setStartTime(log.start_time ? log.start_time.substring(0, 5) : ''); 
    setEndTime(log.end_time ? log.end_time.substring(0, 5) : '');
    
    setLearningType(log.learning_type || 'general');
    setSelectedCourseId(log.custom_course_id || '');
    setSelectedGrade(log.grade_level || '');
    setSubjectId(log.subject_id || '');

    let cleanTopic = log.topic || '';
    cleanTopic = cleanTopic.replace(/\[เกณฑ์: .*?\]\s*/g, '');
    cleanTopic = cleanTopic.replace(/\s*\((เวลาจริง|เวลาที่ใช้): [\d.]+ ชม\.\)/g, '');
    setTopic(cleanTopic.trim());

    const fetchCourses = async () => {
      if (log.tutor_id) {
        const { data } = await supabase
          .from('course_tutors')
          .select('custom_courses(*)')
          .eq('tutor_id', log.tutor_id);
        
        if (data) {
          const activeCourses = data.map(ct => ct.custom_courses).filter(c => c && c.is_active);
          const filteredForEdit = activeCourses.filter(c => 
             !c.student_id && !c.group_id || 
             String(c.student_id) === String(log.student_id) || 
             String(c.id) === String(log.custom_course_id) 
          );
          setCustomCourses(filteredForEdit);
        }
      }
    };
    fetchCourses();
  }, [log, navigate]);

  if (!log) return null;

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // เช็คความครบถ้วนตามประเภทที่เลือก
    if (learningType === 'course' && !selectedCourseId) {
      setError('กรุณาเลือกแพ็กเกจ/คอร์ส');
      setLoading(false); return;
    }
    if (learningType !== 'course' && (!selectedGrade || !subjectId)) {
      setError('กรุณาเลือกระดับชั้นและรายวิชาให้ครบถ้วน');
      setLoading(false); return;
    }

    try {
      const start = new Date(`2000-01-01T${startTime}:00`);
      const end = new Date(`2000-01-01T${endTime}:00`);
      let diff = (end - start) / (1000 * 60 * 60);
      if (diff < 0) diff += 24;

      if (diff <= 0) throw new Error('เวลาที่ระบุไม่ถูกต้อง');

      const duration_hours = Number(diff.toFixed(2));

      // 🔴 4. คำนวณเรทราคาใหม่กรณีที่คุณครูเปลี่ยนรูปแบบหรือระดับชั้น
      let newAppliedStudentRate = log.applied_student_rate;
      let newAppliedTutorRate = log.applied_tutor_rate;
      let newCourseName = log.custom_courses?.course_name || '';

      if (learningType === 'course' && selectedCourseId) {
        const selectedCourse = customCourses.find(c => String(c.id) === String(selectedCourseId));
        if (selectedCourse) {
          newAppliedStudentRate = selectedCourse.student_hourly_rate;
          newAppliedTutorRate = selectedCourse.tutor_hourly_rate;
          newCourseName = selectedCourse.course_name;
        }
      } else if (learningType !== 'course') {
        const rateTypeLabel = learningType === 'advanced' ? 'Advanced' : 'General';
        const matchedRate = pricingRates.find(r => r.grade_level === selectedGrade && r.rate_type === rateTypeLabel);
        if (matchedRate) {
          newAppliedStudentRate = matchedRate.student_hourly_rate;
          newAppliedTutorRate = matchedRate.tutor_hourly_rate;
        }
      }

      // ปรับเรทให้ตรงตาม VIP
      if (tutorProfile?.is_vip) {
        newAppliedTutorRate = newAppliedStudentRate;
      }

      let finalTopic = topic;
      if (isClassroomTutor && learningType === 'course') {
        let ruleText = "";
        if (newCourseName) {
          const ruleMatch = newCourseName.match(/\(([\d.]+ ชม\.\/รอบ = [\d.]+ บาท)\)/);
          if (ruleMatch) ruleText = `[เกณฑ์: ${ruleMatch[1]}]`;
        }
        finalTopic = `${ruleText ? ruleText + ' ' : ''}${topic ? topic + ' ' : ''}(เวลาจริง: ${duration_hours.toFixed(2)} ชม.)`;
      }

      const { error: updateError } = await supabase
        .from('teaching_logs')
        .update({
          teaching_date: date,
          start_time: startTime,
          end_time: endTime,
          duration_hours: duration_hours,
          topic: finalTopic,
          learning_type: learningType,
          custom_course_id: learningType === 'course' ? selectedCourseId : null,
          grade_level: learningType !== 'course' ? selectedGrade : null,
          subject_id: learningType !== 'course' ? subjectId : null,
          applied_student_rate: newAppliedStudentRate,
          applied_tutor_rate: newAppliedTutorRate
        })
        .eq('id', log.id);

      if (updateError) throw new Error(updateError.message);

      navigate('/tutor/history');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center space-x-4 mb-6">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
          title="ย้อนกลับ"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isClassroomTutor ? 'แก้ไขประวัติการใช้งาน' : 'แก้ไขประวัติการสอน'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isClassroomTutor ? 'อัปเดตเวลา แพ็กเกจ และรายละเอียดการใช้สถานที่' : 'อัปเดตเวลา รูปแบบคลาส และเนื้อหาของคลาสเรียน'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-100 p-4 px-6 flex items-center">
          <svg className="w-5 h-5 text-amber-500 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="text-sm font-medium text-amber-800 truncate">
            กำลังแก้ไขข้อมูลของ{isClassroomTutor ? 'ผู้เช่า: ' : 'นักเรียน: '} 
            <span className="font-bold">{log.users?.name || log.users?.username}</span>
          </span>
        </div>

        <form onSubmit={handleUpdate} className="p-6 md:p-8 space-y-6">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-center"><svg className="w-5 h-5 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{error}</div>}

          {/* 🔴 5. เพิ่ม UI สำหรับสลับประเภทการสอนในหน้าแก้ไข */}
          {!isClassroomTutor && (
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">รูปแบบคลาสเรียนที่ต้องการแก้ไข</label>
              <div className="grid grid-cols-3 gap-2 bg-gray-200 p-1.5 rounded-lg border border-gray-300">
                <button type="button" onClick={() => { setLearningType('general'); setSelectedCourseId(''); }} className={`py-2 rounded-md text-[11px] sm:text-xs font-bold transition-all text-center ${learningType === 'general' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>📚 ทั่วไป</button>
                <button type="button" onClick={() => { setLearningType('advanced'); setSelectedCourseId(''); }} className={`py-2 rounded-md text-[11px] sm:text-xs font-bold transition-all text-center ${learningType === 'advanced' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>✨ แอดวานซ์</button>
                <button type="button" onClick={() => { setLearningType('course'); setSelectedGrade(''); setSubjectId(''); }} className={`py-2 rounded-md text-[11px] sm:text-xs font-bold transition-all text-center ${learningType === 'course' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>🏆 คอร์สพิเศษ</button>
              </div>
            </div>
          )}

          {learningType !== 'course' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">ระดับชั้นเนื้อหาที่สอน</label>
                <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} translate="no" lang="th" className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-sans font-medium text-gray-800 bg-white" required>
                  <option value="" translate="no">-- เลือกระดับชั้น --</option>
                  {gradeOptions.map(grade => <option key={grade} value={grade} translate="no">{grade}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">รายวิชาเรียน</label>
                <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} translate="no" lang="th" className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-sans bg-white" required>
                  <option value="" translate="no">-- เลือกวิชา --</option>
                  {subjectsList.map(sub => <option key={sub.id} value={sub.id} translate="no">{sub.subject_name}</option>)}
                </select>
              </div>
            </div>
          )}

          {learningType === 'course' && (
            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200">
              <label className="block text-amber-900 text-sm font-bold mb-2">
                {isClassroomTutor ? 'แพ็กเกจสถานที่ที่ใช้งาน' : 'คอร์สพิเศษที่ใช้งาน'}
              </label>
              <select 
                value={selectedCourseId} 
                onChange={(e) => setSelectedCourseId(e.target.value)} 
                translate="no"
                lang="th"
                className="w-full px-4 py-3 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none font-sans font-medium bg-white"
                required
              >
                <option value="" translate="no">-- เลือกแพ็กเกจ --</option>
                {customCourses.map(course => (
                  <option key={course.id} value={course.id} translate="no">{course.course_name} {course.grade_level !== 'สถานที่' ? `(${course.grade_level})` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div className="pt-2">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              {isClassroomTutor ? 'วันที่ใช้งาน' : 'วันที่สอน'}
            </label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-gray-50 hover:bg-white transition font-sans" required />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">เวลาเริ่ม</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-gray-50 hover:bg-white transition font-sans" required />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">เวลาสิ้นสุด</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-gray-50 hover:bg-white transition font-sans" required />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              {isClassroomTutor ? 'บันทึกช่วยจำ (เพิ่มเติม)' : 'เนื้อหาที่สอน / รายละเอียด (Topic)'}
            </label>
            <textarea 
              value={topic} 
              onChange={(e) => setTopic(e.target.value)} 
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none h-32 resize-none bg-gray-50 hover:bg-white transition font-sans" 
              placeholder={isClassroomTutor ? "โน้ตเพิ่มเติมสำหรับการใช้งานสถานที่..." : "ระบุเนื้อหาที่สอน ความคืบหน้า หรือการบ้านที่สั่ง..."}
            ></textarea>
          </div>

          <div className="pt-4 flex items-center justify-end space-x-3">
            <button type="button" onClick={() => navigate(-1)} className="px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition">
              ยกเลิก
            </button>
            <button type="submit" disabled={loading} className="px-8 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition shadow-lg shadow-amber-500/30 disabled:opacity-50 flex items-center">
              {loading ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}