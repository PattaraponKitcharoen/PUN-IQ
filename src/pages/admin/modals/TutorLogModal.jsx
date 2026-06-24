import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabase';

export default function TutorLogModal({ isOpen, onClose, tutor }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [subjectsList, setSubjectsList] = useState([]);
  
  const [customCoursesList, setCustomCoursesList] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groups, setGroups] = useState([]);

  const [tutorIsVip, setTutorIsVip] = useState(false);

  const [isAdding, setIsAdding] = useState(false);
  const [allStudents, setAllStudents] = useState([]);
  
  // 🔴 1. State สำหรับระบบ 3 โหมด (รายบุคคล, รายกลุ่ม, ต่อเนื่อง)
  const [logType, setLogType] = useState('individual'); 
  const [addStudentId, setAddStudentId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [presentStudentIds, setPresentStudentIds] = useState([]);
  
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [editingLog, setEditingLog] = useState(null);
  
  const getLocalTodayDate = () => {
    const d = new Date();
    return d.toLocaleDateString('en-CA'); 
  };

  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editHours, setEditHours] = useState('');
  const [editTopic, setEditTopic] = useState('');
  
  // 🔴 2. State สำหรับระบบบันทึกต่อเนื่องแบบแถว (Bulk Rows)
  const [bulkRows, setBulkRows] = useState([
    { teaching_date: getLocalTodayDate(), start_time: '', end_time: '', duration_hours: '', topic: '' }
  ]);

  const [editSubjectId, setEditSubjectId] = useState('');
  const [editLearningType, setEditLearningType] = useState('general');
  const [editCustomCourseId, setEditCustomCourseId] = useState('');
  const [editGradeLevel, setEditGradeLevel] = useState('');
  
  const gradeOptions = ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];

  const [saving, setSaving] = useState(false);

  const [filterMonth, setFilterMonth] = useState('');
  const [filterStudent, setFilterStudent] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  const [pricingRates, setPricingRates] = useState([]);

  const isClassroomTutor = tutor?.username === 'Classroom';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsStudentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // คำนวณเวลาอัตโนมัติของโหมดปกติ
  useEffect(() => {
    if (editStartTime && editEndTime) {
      const start = new Date(`2000-01-01T${editStartTime}`);
      const end = new Date(`2000-01-01T${editEndTime}`);
      let diff = (end - start) / (1000 * 60 * 60);
      if (diff < 0) diff += 24;
      setEditHours(diff.toFixed(2));
    } else {
      if (!editingLog) setEditHours('');
    }
  }, [editStartTime, editEndTime, editingLog]);

  useEffect(() => {
    if (isAdding && isClassroomTutor) {
      setEditLearningType('course');
      if (logType === 'group') setLogType('individual');
    }
  }, [isAdding, isClassroomTutor, logType]);

  useEffect(() => {
    if (logType === 'group' && groupId) {
      const studentsInGroup = groupMembers.filter(m => m.group_id === groupId).map(m => m.student_id);
      setPresentStudentIds(studentsInGroup);
    } else {
      setPresentStudentIds([]);
    }
  }, [groupId, logType, groupMembers]);

  useEffect(() => {
    if (isOpen && tutor) {
      fetchLogs();
      resetFormState();
    }
  }, [isOpen, tutor]);

  const resetFormState = () => {
    setEditingLog(null);
    setIsAdding(false);
    setActionMessage('');
    setFilterMonth('');
    setFilterStudent('');
    setFilterSubject('');
    setSortOrder('desc');

    setLogType('individual');
    setAddStudentId('');
    setGroupId('');
    setPresentStudentIds([]);
    setStudentSearchTerm(''); 
    setIsStudentDropdownOpen(false);
    setEditDate(getLocalTodayDate());
    setEditStartTime('');
    setEditEndTime('');
    setEditHours('');
    setEditTopic('');
    setEditSubjectId('');
    setEditLearningType(tutor?.username === 'Classroom' ? 'course' : 'general');
    setEditCustomCourseId('');
    setEditGradeLevel('');
    setBulkRows([{ teaching_date: getLocalTodayDate(), start_time: '', end_time: '', duration_hours: '', topic: '' }]);
  };

  const fetchLogs = async () => {
    setLoading(true);
    const [subsRes, coursesRes, membersRes, ratesRes, studentsRes, grpMapRes, groupsRes, tutorProfileRes] = await Promise.all([
      supabase.from('subjects').select('*').order('subject_name'),
      supabase.from('custom_courses').select('id, course_name, grade_level, student_id, group_id, student_hourly_rate, tutor_hourly_rate').eq('tutor_id', tutor.id),
      supabase.from('group_members').select('group_id, student_id'),
      supabase.from('pricing_rates').select('*'),
      supabase.from('users').select('id, name, username, grade').eq('role', 'student').order('username'),
      supabase.from('tutor_groups').select('group_id').eq('tutor_id', tutor.id),
      supabase.from('groups').select('*').order('group_name'),
      supabase.from('users').select('is_vip').eq('id', tutor.id).single()
    ]);
    
    if (subsRes.data) setSubjectsList(subsRes.data);
    if (coursesRes.data) setCustomCoursesList(coursesRes.data);
    if (membersRes.data) setGroupMembers(membersRes.data);
    if (ratesRes.data) setPricingRates(ratesRes.data);
    if (studentsRes.data) setAllStudents(studentsRes.data);
    if (tutorProfileRes.data) setTutorIsVip(tutorProfileRes.data.is_vip);

    if (grpMapRes.data && groupsRes.data) {
      const mappedGrpIds = grpMapRes.data.map(g => g.group_id);
      setGroups(groupsRes.data.filter(g => mappedGrpIds.includes(g.id)));
    }

    const { data, error } = await supabase
      .from('teaching_logs')
      .select('*, users!teaching_logs_student_id_fkey(name, username), subjects(id, subject_name), custom_courses(course_name, grade_level)')
      .eq('tutor_id', tutor.id)
      .order('teaching_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && data) setLogs(data);
    setLoading(false);
  };

  const filteredStudents = useMemo(() => {
    if (!studentSearchTerm) return allStudents;
    return allStudents.filter(s => 
      s.username?.toLowerCase().includes(studentSearchTerm.toLowerCase()) || 
      s.name?.toLowerCase().includes(studentSearchTerm.toLowerCase())
    );
  }, [allStudents, studentSearchTerm]);

  const studentsInThisGroupDetails = allStudents.filter(s => groupMembers.filter(m => m.group_id === groupId).map(m => m.student_id).includes(s.id));

  const handleTogglePresent = (id) => {
    setPresentStudentIds(prev => prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    const studentsInGroup = groupMembers.filter(m => m.group_id === groupId).map(m => m.student_id);
    const allSelected = studentsInGroup.length > 0 && studentsInGroup.every(id => presentStudentIds.includes(id));
    setPresentStudentIds(allSelected ? [] : studentsInGroup);
  };

  // 🔴 3. ฟังก์ชันควบคุมการลงเวลาต่อเนื่อง
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

  const filterOptions = useMemo(() => {
    const studentsMap = new Map();
    const subjectsMap = new Map();

    logs.forEach(log => {
      if (log.users) studentsMap.set(log.student_id, log.users.name || log.users.username);
      if (log.learning_type === 'course' && log.custom_courses) subjectsMap.set(log.custom_course_id, log.custom_courses.course_name);
      else if (log.subjects) subjectsMap.set(log.subject_id, log.subjects.subject_name);
    });

    return {
      students: Array.from(studentsMap.entries()).map(([id, name]) => ({ id, name })),
      subjects: Array.from(subjectsMap.entries()).map(([id, name]) => ({ id, name }))
    };
  }, [logs]);

  const filteredAndSortedLogs = useMemo(() => {
    let result = [...logs];
    if (filterMonth) result = result.filter(log => log.teaching_date.startsWith(filterMonth));
    if (filterStudent) result = result.filter(log => log.student_id === filterStudent);
    if (filterSubject) result = result.filter(log => log.subject_id === filterSubject || log.custom_course_id === filterSubject);

    result.sort((a, b) => {
      const dateA = new Date(a.teaching_date);
      const dateB = new Date(b.teaching_date);
      if (dateA - dateB !== 0) return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      return sortOrder === 'asc' ? new Date(a.created_at) - new Date(b.created_at) : new Date(b.created_at) - new Date(a.created_at);
    });
    return result;
  }, [logs, filterMonth, filterStudent, filterSubject, sortOrder]);

  const handleDelete = async (logId) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ที่จะลบประวัติการสอนนี้? ข้อมูลจะหายไปถาวร')) return;
    setActionMessage('');
    try {
      const { error } = await supabase.from('teaching_logs').delete().eq('id', logId);
      if (error) throw new Error(error.message);
      setActionMessage('🗑️ ลบประวัติสำเร็จ');
      fetchLogs();
    } catch (error) {
      setActionMessage(`❌ ลบไม่สำเร็จ: ${error.message}`);
    }
  };

  const handleEditClick = (log) => {
    setIsAdding(false);
    setEditingLog(log);
    setEditDate(log.teaching_date);
    setEditStartTime(log.start_time ? log.start_time.substring(0, 5) : '');
    setEditEndTime(log.end_time ? log.end_time.substring(0, 5) : '');
    setEditHours(log.duration_hours);
    
    let cleanTopic = log.topic || '';
    if (tutor?.username === 'Classroom') {
      cleanTopic = cleanTopic.replace(/\[เกณฑ์: .*?\]\s*/g, '');
      cleanTopic = cleanTopic.replace(/\s*\((เวลาจริง|เวลาที่ใช้): [\d.]+ ชม\.\)/g, '');
    }
    setEditTopic(cleanTopic.trim());
    
    setEditLearningType(log.learning_type || 'general');
    setEditSubjectId(log.subject_id || '');
    setEditCustomCourseId(log.custom_course_id || '');
    setEditGradeLevel(log.grade_level || '');
    
    setActionMessage('');
  };

  const handleCreateLog = async (e) => {
    e.preventDefault();

    if (logType !== 'group' && !addStudentId) { setActionMessage('❌ กรุณาเลือกนักเรียน'); return; }
    if (logType === 'group' && !groupId) { setActionMessage('❌ กรุณาเลือกกลุ่ม'); return; }
    if (logType === 'group' && presentStudentIds.length === 0) { setActionMessage('❌ กรุณาเลือกผู้ใช้งานอย่างน้อย 1 คน'); return; }
    if (editLearningType === 'course' && !editCustomCourseId) { setActionMessage('❌ กรุณาเลือกแพ็กเกจ/คอร์สเรียนพิเศษ'); return; }
    if (editLearningType !== 'course' && (!editSubjectId || !editGradeLevel)) { setActionMessage('❌ กรุณาเลือกระดับชั้นและรายวิชา'); return; }

    if (logType === 'bulk') {
      for (let i = 0; i < bulkRows.length; i++) {
        const row = bulkRows[i];
        if (!row.teaching_date || !row.start_time || !row.end_time || !row.duration_hours) {
          setActionMessage(`❌ กรุณากรอกข้อมูล วันที่และเวลา ในแถวที่ ${i + 1} ให้ครบถ้วน`);
          return;
        }
      }
    } else {
      if (!editDate || !editHours || !editStartTime || !editEndTime) return;
    }

    setSaving(true);
    setActionMessage('');

    try {
      let newStudentRate = 0;
      let newTutorRate = 0;
      let ruleText = "";

      if (editLearningType === 'course') {
        const targetCourse = customCoursesList.find(c => String(c.id) === String(editCustomCourseId));
        if (targetCourse) {
          newStudentRate = targetCourse.student_hourly_rate;
          newTutorRate = targetCourse.tutor_hourly_rate;
          const ruleMatch = targetCourse.course_name.match(/\(([\d.]+ ชม\.\/รอบ = [\d.]+ บาท)\)/);
          if (ruleMatch) ruleText = `[เกณฑ์: ${ruleMatch[1]}]`;
        }
      } else {
        const matchedRate = pricingRates.find(r => r.grade_level === editGradeLevel && r.rate_type === (editLearningType === 'advanced' ? 'Advanced' : 'General'));
        if (matchedRate) {
          newStudentRate = matchedRate.student_hourly_rate;
          newTutorRate = matchedRate.tutor_hourly_rate;
        }
      }

      if (tutorIsVip) {
        newTutorRate = newStudentRate;
      }

      let inserts = [];

      // 🔴 4. โลจิกรองรับการบันทึกฐานข้อมูลพร้อมกัน 3 โหมด
      if (logType === 'bulk') {
        bulkRows.forEach(row => {
          let finalTopic = row.topic;
          if (isClassroomTutor && editLearningType === 'course') {
            finalTopic = `${ruleText ? ruleText + ' ' : ''}${row.topic ? row.topic + ' ' : ''}(เวลาจริง: ${Number(row.duration_hours).toFixed(2)} ชม.)`;
          }

          inserts.push({
            tutor_id: tutor.id,
            student_id: addStudentId,
            teaching_date: row.teaching_date,
            start_time: row.start_time || null,
            end_time: row.end_time || null,
            duration_hours: parseFloat(row.duration_hours),
            topic: finalTopic,
            learning_type: editLearningType,
            subject_id: editLearningType === 'course' ? null : editSubjectId,
            custom_course_id: editLearningType === 'course' ? editCustomCourseId : null,
            grade_level: editLearningType === 'course' ? null : editGradeLevel,
            applied_student_rate: newStudentRate,
            applied_tutor_rate: newTutorRate
          });
        });
      } else {
        const targets = logType === 'individual' ? [addStudentId] : presentStudentIds;
        targets.forEach(sId => {
          let finalTopic = editTopic;
          if (isClassroomTutor && editLearningType === 'course') {
            finalTopic = `${ruleText ? ruleText + ' ' : ''}${editTopic ? editTopic + ' ' : ''}(เวลาจริง: ${Number(editHours).toFixed(2)} ชม.)`;
          }

          inserts.push({
            tutor_id: tutor.id,
            student_id: sId,
            teaching_date: editDate,
            start_time: editStartTime || null,
            end_time: editEndTime || null,
            duration_hours: parseFloat(editHours),
            topic: finalTopic,
            learning_type: editLearningType,
            subject_id: editLearningType === 'course' ? null : editSubjectId,
            custom_course_id: editLearningType === 'course' ? editCustomCourseId : null,
            grade_level: editLearningType === 'course' ? null : editGradeLevel,
            applied_student_rate: newStudentRate,
            applied_tutor_rate: newTutorRate
          });
        });
      }

      const { error } = await supabase.from('teaching_logs').insert(inserts);
      if (error) throw new Error(error.message);

      setActionMessage(`✅ เพิ่มประวัติใหม่สำเร็จ! (จำนวน ${inserts.length} รายการ)`);
      resetFormState();
      fetchLogs();
    } catch (error) {
      setActionMessage(`❌ เพิ่มข้อมูลไม่สำเร็จ: ${error.message}`);
    } finally {
      setSaving(false);
    }
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
      let newStudentRate = 0;
      let newTutorRate = 0;
      let ruleText = "";

      if (editLearningType === 'course') {
        const targetCourse = customCoursesList.find(c => String(c.id) === String(editCustomCourseId));
        if (targetCourse) {
          newStudentRate = targetCourse.student_hourly_rate;
          newTutorRate = targetCourse.tutor_hourly_rate;
          const ruleMatch = targetCourse.course_name.match(/\(([\d.]+ ชม\.\/รอบ = [\d.]+ บาท)\)/);
          if (ruleMatch) ruleText = `[เกณฑ์: ${ruleMatch[1]}]`;
        }
      } else {
        const matchedRate = pricingRates.find(r => r.grade_level === editGradeLevel && r.rate_type === (editLearningType === 'advanced' ? 'Advanced' : 'General'));
        if (matchedRate) {
          newStudentRate = matchedRate.student_hourly_rate;
          newTutorRate = matchedRate.tutor_hourly_rate;
        }
      }

      if (tutorIsVip) {
        newTutorRate = newStudentRate;
      }

      let finalTopic = editTopic;
      if (isClassroomTutor) {
        finalTopic = `${ruleText ? ruleText + ' ' : ''}${editTopic ? editTopic + ' ' : ''}(เวลาจริง: ${Number(editHours).toFixed(2)} ชม.)`;
      }

      const { error } = await supabase
        .from('teaching_logs')
        .update({
          teaching_date: editDate,
          start_time: editStartTime || null,
          end_time: editEndTime || null,
          duration_hours: parseFloat(editHours),
          topic: finalTopic,
          learning_type: editLearningType,
          subject_id: editLearningType === 'course' ? null : editSubjectId,
          custom_course_id: editLearningType === 'course' ? (editCustomCourseId || null) : null,
          grade_level: editLearningType === 'course' ? null : editGradeLevel,
          applied_student_rate: newStudentRate,
          applied_tutor_rate: newTutorRate
        })
        .eq('id', editingLog.id);

      if (error) throw new Error(error.message);

      setActionMessage('✅ แก้ไขประวัติข้อมูลสำเร็จ!');
      resetFormState();
      fetchLogs();
    } catch (error) {
      setActionMessage(`❌ แก้ไขไม่สำเร็จ: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const activeStudentId = editingLog ? editingLog.student_id : addStudentId;
  const sGroupIds = groupMembers.filter(m => String(m.student_id) === String(activeStudentId)).map(m => m.group_id);
    
  const studentCustomCourses = customCoursesList.filter(course => {
    if (isAdding && logType === 'group') {
      return String(course.group_id) === String(groupId);
    }
    return String(course.student_id) === String(activeStudentId) || sGroupIds.includes(course.group_id);
  });

  const isTargetSelected = logType === 'group' ? groupId : addStudentId;

  if (!isOpen || !tutor) return null;

  const formatTime = (timeStr) => timeStr ? timeStr.substring(0, 5) : '-';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      {/* 🔴 ปรับความสูง: ใช้ h-auto เพื่อให้ยืดตามเนื้อหา และใช้ min-h สำหรับความสูงขั้นต่ำ */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl h-auto min-h-[60vh] max-h-[90vh] overflow-hidden flex flex-col">
        
        <div className="bg-indigo-900 text-white p-6 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold">
            {isAdding ? (isClassroomTutor ? 'บันทึกการเช่าสถานที่ใหม่' : 'เพิ่มประวัติการสอนใหม่') : 
             editingLog ? 'แก้ไขประวัติ' : 
             (isClassroomTutor ? 'ประวัติการใช้งานสถานที่' : `ประวัติการสอน: ${tutor.name || tutor.username}`)}
          </h3>
          <button onClick={onClose} className="text-indigo-200 hover:text-white transition">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        {/* 🔴 ใส่ p-8 รอบเนื้อหา เพื่อให้มีพื้นที่หายใจในแนวตั้ง */}
        <div className="p-8 overflow-y-auto flex-1">
          {actionMessage && <div className={`mb-6 p-4 rounded-xl text-sm font-semibold text-center ${actionMessage.includes('สำเร็จ') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{actionMessage}</div>}

          {loading && !editingLog && !isAdding ? (
            <div className="text-center py-10 text-gray-500 animate-pulse">กำลังโหลดข้อมูล...</div>
          ) : (editingLog || isAdding) ? (
            
            <form onSubmit={editingLog ? handleUpdate : handleCreateLog} className="space-y-6">
              
              {isAdding && (
                <div className="flex bg-gray-100 p-1 rounded-lg mb-6 text-center text-sm font-semibold">
                  <button type="button" onClick={() => { setLogType('individual'); setActionMessage(''); }} className={`flex-1 py-2 rounded-md transition ${logType === 'individual' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>รายบุคคล</button>
                  {!isClassroomTutor && (
                    <button type="button" onClick={() => { setLogType('group'); setActionMessage(''); }} className={`flex-1 py-2 rounded-md transition ${logType === 'group' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>รายกลุ่ม</button>
                  )}
                  <button type="button" onClick={() => { setLogType('bulk'); setActionMessage(''); }} className={`flex-1 py-2 rounded-md transition ${logType === 'bulk' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>⏱️ หลายรอบ</button>
                </div>
              )}

              {isAdding ? (
                logType !== 'group' ? (
                  <div className="relative" ref={dropdownRef}>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">{isClassroomTutor ? 'ค้นหาผู้เช่า (นักเรียน)' : 'ค้นหาและเลือกนักเรียน'}</label>
                    <input 
                      type="text" 
                      placeholder="พิมพ์ชื่อ หรือ รหัสประจำตัว..." 
                      value={studentSearchTerm}
                      onChange={(e) => {
                        setStudentSearchTerm(e.target.value);
                        setIsStudentDropdownOpen(true);
                        setAddStudentId(''); 
                      }}
                      onFocus={() => setIsStudentDropdownOpen(true)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-800"
                    />
                    {isStudentDropdownOpen && (
                      <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredStudents.length > 0 ? (
                          filteredStudents.map(s => (
                            <li 
                              key={s.id} 
                              onClick={() => {
                                setAddStudentId(s.id);
                                setStudentSearchTerm(`${s.username} ${s.name ? `(${s.name})` : ''}`);
                                setIsStudentDropdownOpen(false);
                              }}
                              className="px-3 py-2.5 text-sm cursor-pointer hover:bg-indigo-50 font-medium text-gray-700 border-b border-gray-50 last:border-0"
                            >
                              {s.username} {s.name ? `(${s.name})` : ''}
                            </li>
                          ))
                        ) : (
                          <li className="px-3 py-2 text-sm text-gray-500 text-center">ไม่พบรายชื่อ</li>
                        )}
                      </ul>
                    )}
                    <input type="text" required value={addStudentId} className="h-0 w-0 opacity-0 absolute" onChange={() => {}}/>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">เลือกกลุ่มนักเรียน</label>
                    <select value={groupId} onChange={(e) => { setGroupId(e.target.value); setEditLearningType('general'); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required>
                      <option value="">-- เลือกกลุ่ม --</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
                    </select>

                    {groupId && (
                      <div className="mt-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                        <div className="flex justify-between items-center mb-2 border-b border-indigo-100 pb-2">
                          <span className="text-[10px] font-bold text-indigo-900 uppercase">มาเรียน {presentStudentIds.length} คน</span>
                          <button type="button" onClick={handleSelectAll} className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold underline">
                            {presentStudentIds.length === studentsInThisGroupDetails.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-1">
                          {studentsInThisGroupDetails.map(student => (
                            <label key={student.id} className={`flex items-center space-x-2 cursor-pointer p-2 rounded-lg border transition ${presentStudentIds.includes(student.id) ? 'bg-white border-indigo-300 shadow-sm' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                              <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5" checked={presentStudentIds.includes(student.id)} onChange={() => handleTogglePresent(student.id)} />
                              <span className="text-xs text-gray-700 truncate">{student.name || student.username}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4">
                  <p className="text-xs text-gray-500 font-bold uppercase">{isClassroomTutor ? 'ผู้เช่า (นักเรียน)' : 'นักเรียนที่สอน'}</p>
                  <p className="font-semibold text-indigo-700">{editingLog.users?.name || editingLog.users?.username}</p>
                </div>
              )}

              {/* ซ่อนปุ่มเลือกรูปแบบหากเป็น Classroom */}
              {!isClassroomTutor && (!isAdding || isTargetSelected) && (
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">รูปแบบคลาสเรียน</label>
                  <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
                    <button type="button" onClick={() => { setEditLearningType('general'); setEditCustomCourseId(''); }} className={`py-1.5 rounded-md text-[11px] font-bold transition-all ${editLearningType === 'general' ? 'bg-white text-blue-600 shadow-2xs' : 'text-gray-500'}`}>📚 ทั่วไป</button>
                    <button type="button" onClick={() => { setEditLearningType('advanced'); setEditCustomCourseId(''); }} className={`py-1.5 rounded-md text-[11px] font-bold transition-all ${editLearningType === 'advanced' ? 'bg-white text-purple-600 shadow-2xs' : 'text-gray-500'}`}>✨ แอดวานซ์</button>
                    <button type="button" onClick={() => { setEditLearningType('course'); setEditSubjectId(''); setEditGradeLevel(''); }} className={`py-1.5 rounded-md text-[11px] font-bold transition-all ${editLearningType === 'course' ? 'bg-white text-amber-600 shadow-2xs' : 'text-gray-500'}`}>🏆 คอร์สพิเศษ</button>
                  </div>
                </div>
              )}

              {(!isAdding || isTargetSelected) && editLearningType !== 'course' ? (
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
              ) : (!isAdding || isTargetSelected) && (
                  <div>
                    <label className="block text-xs font-bold text-amber-800 uppercase mb-1">{isClassroomTutor ? 'สิทธิ์แพ็กเกจเช่าห้อง' : 'เลือกคอร์สพิเศษ'}</label>
                    <select value={editCustomCourseId} onChange={(e) => setEditCustomCourseId(e.target.value)} className="w-full px-3 py-2 border border-amber-300 bg-amber-50 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none font-semibold text-amber-950" required>
                      <option value="">-- {isClassroomTutor ? 'เลือกแพ็กเกจสถานที่' : 'เลือกคอร์สพิเศษ'} --</option>
                      {studentCustomCourses.map(course => <option key={course.id} value={course.id}>{course.course_name} {course.grade_level !== 'สถานที่' ? `(${course.grade_level})` : ''}</option>)}
                    </select>
                  </div>
              )}

              {/* ส่วนตารางลงเวลา */}
              {(!isAdding || isTargetSelected) && logType !== 'bulk' ? (
                <div className="space-y-4 pt-2 border-t border-dashed">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">{isClassroomTutor ? 'วันที่ใช้งาน' : 'วันที่สอน'}</label>
                    <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">เวลาเริ่ม</label>
                      <input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">เวลาสิ้นสุด</label>
                      <input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-indigo-700 uppercase mb-1">
                      {isClassroomTutor ? 'เวลาใช้งานจริง (ชั่วโมง)' : 'จำนวนชั่วโมง'}
                    </label>
                    <input type="number" step="0.01" min="0" value={editHours} onChange={(e) => setEditHours(e.target.value)} className={`w-full px-3 py-2 border rounded-lg text-sm font-bold outline-none ${isClassroomTutor ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900 cursor-not-allowed' : 'border-gray-300 bg-gray-50 focus:ring-2 focus:ring-indigo-500'}`} required readOnly={isClassroomTutor} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">บันทึกช่วยจำ (ไม่บังคับ)</label>
                    <textarea rows="2" value={editTopic} onChange={(e) => setEditTopic(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"></textarea>
                  </div>
                </div>
              ) : (!isAdding || isTargetSelected) && (
                <div className="space-y-4 pt-3 border-t border-dashed">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-black text-indigo-900 uppercase tracking-wider">รายการคลาส/รอบเวลาใช้งาน ({bulkRows.length} รอบ)</span>
                    <button type="button" onClick={handleAddBulkRow} className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg shadow-sm transition-all">
                      ➕ เพิ่มรอบเวลา
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {bulkRows.map((row, index) => (
                      <div key={index} className="p-3 bg-slate-50 border rounded-xl relative space-y-2 group">
                        <div className="absolute top-2 right-2 flex items-center space-x-2">
                          <span className="text-[9px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded">แถว {index + 1}</span>
                          {bulkRows.length > 1 && (
                            <button type="button" onClick={() => handleRemoveBulkRow(index)} className="text-red-500 hover:text-red-700 font-bold text-[10px]">❌ ลบ</button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                          <div>
                            <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">วันที่</label>
                            <input type="date" value={row.teaching_date} onChange={(e) => handleBulkRowChange(index, 'teaching_date', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none" required />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">เวลาเริ่ม</label>
                            <input type="time" value={row.start_time} onChange={(e) => handleBulkRowChange(index, 'start_time', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none" required />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">เวลาสิ้นสุด</label>
                            <input type="time" value={row.end_time} onChange={(e) => handleBulkRowChange(index, 'end_time', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none" required />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                          <div className="sm:col-span-1">
                            <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">ชั่วโมงจริง</label>
                            <input type="number" value={row.duration_hours} className="w-full px-2 py-1.5 border rounded-lg text-xs bg-gray-100 font-bold text-gray-700 outline-none" readOnly placeholder="0.00" />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">{isClassroomTutor ? 'บันทึกช่วยจำ' : 'เนื้อหาการสอน / หมายเหตุ'}</label>
                            <input type="text" placeholder={isClassroomTutor ? "โน้ตกำกับ..." : "หัวข้อที่สอนย้อนหลัง..."} value={row.topic} onChange={(e) => handleBulkRowChange(index, 'topic', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!isAdding || isTargetSelected) && (
                <div className="flex space-x-3 pt-4">
                  <button type="button" onClick={resetFormState} className="w-1/2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-lg transition text-sm">ยกเลิก</button>
                  <button type="submit" disabled={saving} className="w-1/2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg transition text-sm disabled:opacity-50 shadow-sm">
                    {saving ? 'กำลังบันทึก...' : editingLog ? 'บันทึกการแก้ไข' : 'บันทึกลงระบบ'}
                  </button>
                </div>
              )}
            </form>

          ) : (
            
            <>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">รายการข้อมูลบันทึกทั้งหมด</h4>
                <button 
                  type="button" 
                  onClick={() => setIsAdding(true)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5"
                >
                  <span>{isClassroomTutor ? 'ลงเวลาใช้งานห้องใหม่' : 'เพิ่มประวัติการสอน'}</span>
                </button>
              </div>

              {logs.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">กรองเดือน/ปี</label>
                    <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-indigo-500 bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">กรองรายชื่อ</label>
                    <select value={filterStudent} onChange={(e) => setFilterStudent(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-indigo-500 bg-white font-medium text-gray-700">
                      <option value="">-- {isClassroomTutor ? 'ผู้เช่าทั้งหมด' : 'นักเรียนทุกคน'} --</option>
                      {filterOptions.students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">กรองรายการ</label>
                    <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-indigo-500 bg-white font-medium text-gray-700">
                      <option value="">-- รายการทั้งหมด --</option>
                      {filterOptions.subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {filteredAndSortedLogs.length === 0 ? (
                <div className="text-center py-10 text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                  {logs.length > 0 ? '❌ ไม่พบข้อมูลที่ตรงตามเงื่อนไขการกรอง' : 'ยังไม่มีข้อมูลบันทึก'}
                </div>
              ) : (
                // 🔴 ปรับตารางให้ยืดเต็มและจัดการคอลัมน์ใหม่
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-left text-sm border-collapse table-auto">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="p-4 font-bold w-24">วันที่</th>
                        <th className="p-4 font-bold text-center w-36">เวลา</th>
                        <th className="p-4 font-bold">รายการ</th>
                        <th className="p-4 font-bold">นักเรียน</th>
                        <th className="p-4 font-bold text-center w-28">เวลา / รอบ</th>
                        <th className="p-4 font-bold text-center w-24">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredAndSortedLogs.map(log => {
                        let roundsDisplay = null;
                        if (isClassroomTutor && log.custom_courses?.course_name) {
                           const match = log.custom_courses.course_name.match(/([\d.]+)\s*ชม\.\/รอบ/);
                           if (match) {
                             const rounds = Number(log.duration_hours) / Number(match[1]);
                             roundsDisplay = <span className="block text-[10px] text-emerald-600 font-bold">({rounds.toFixed(1)} รอบ)</span>;
                           }
                        }

                        return (
                          <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-4 text-gray-700 font-bold">
                              {new Date(log.teaching_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                            </td>
                            <td className="p-4 text-center text-gray-500 text-xs">
                              {log.start_time && log.end_time ? `${formatTime(log.start_time)}-${formatTime(log.end_time)}` : '-'}
                            </td>
                            <td className="p-4 truncate max-w-[200px]">
                                {log.learning_type === 'course' ? (
                                    <span className="font-bold text-amber-700 text-xs truncate">🏆 {log.custom_courses?.course_name || 'คอร์สพิเศษ'}</span>
                                ) : (
                                    <div className="flex items-center space-x-1.5">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${log.learning_type === 'advanced' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                          {log.learning_type === 'advanced' ? 'Adv' : 'Gen'}
                                        </span>
                                        <span className="text-gray-800 font-medium truncate">{log.subjects?.subject_name || '-'}</span>
                                    </div>
                                )}
                            </td>
                            <td className="p-4 text-indigo-700 font-semibold truncate">{log.users?.name || log.users?.username}</td>
                            <td className="p-4 text-center font-bold text-gray-800 bg-gray-50/50">
                              {log.duration_hours} ชม.
                              {roundsDisplay}
                            </td>
                            <td className="p-4 flex items-center justify-center space-x-2">
                              <button onClick={() => handleEditClick(log)} className="p-1.5 text-amber-500 hover:bg-amber-50 rounded"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                              <button onClick={() => handleDelete(log.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                            </td>
                          </tr>
                        );
                      })}
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