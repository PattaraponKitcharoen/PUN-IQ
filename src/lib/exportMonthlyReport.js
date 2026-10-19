import { supabase } from './supabase';

const LOG_SELECT = '*, student:users!teaching_logs_student_id_fkey(id, name, username, grade, phone, school_name, parent_name), tutor:users!teaching_logs_tutor_id_fkey(id, name, username), subjects(subject_name), custom_courses(course_name, grade_level)';

// Supabase คืนได้สูงสุด 1,000 แถวต่อครั้ง จึงต้องดึงทีละหน้าจนครบ
const PAGE_SIZE = 1000;

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const formatTime = (t) => (t ? t.substring(0, 5) : '');

export const LEARNING_TYPE_LABEL = {
  general: 'ทั่วไป',
  advanced: 'แอดวานซ์',
  course: 'คอร์สพิเศษ',
};

export const getMonthRange = (selectedMonth) => {
  const [year, month] = selectedMonth.split('-');
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  return {
    startDate: `${year}-${month}-01`,
    endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
  };
};

export const fetchAllLogs = async (startDate, endDate, select = LOG_SELECT) => {
  const all = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('teaching_logs')
      .select(select)
      .gte('teaching_date', startDate)
      .lte('teaching_date', endDate)
      .order('teaching_date', { ascending: true })
      .order('start_time', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < PAGE_SIZE) return all;
  }
};

// คำนวณเงินของแต่ละรายการ (ใช้ร่วมกับหน้า Dashboard)
export const calcLog = (log) => {
  const hrs = Number(log.duration_hours) || 0;
  const isClassroom = log.tutor?.username === 'Classroom';

  if (isClassroom) {
    const courseName = log.custom_courses?.course_name || '';
    const match = courseName.match(/([\d.]+)\s*ชม\.\/รอบ/);
    const rounds = match ? hrs / Number(match[1]) : 1;
    return { hrs, isClassroom, rounds, revenue: 0, cost: 0, roomRevenue: rounds * (Number(log.applied_student_rate) || 0) };
  }

  return {
    hrs,
    isClassroom,
    rounds: 0,
    revenue: hrs * (Number(log.applied_student_rate) || 0),
    cost: hrs * (Number(log.applied_tutor_rate) || 0),
    roomRevenue: 0,
  };
};

export const getItemLabel = (log, isClassroom) => {
  if (isClassroom) return log.custom_courses?.course_name || 'เช่าสถานที่';
  if (log.learning_type === 'course') return log.custom_courses?.course_name || 'คอร์สพิเศษ';
  return log.subjects?.subject_name || '-';
};

const byUsername = (a, b) => String(a.username || '').localeCompare(String(b.username || ''), 'th');

export async function exportMonthlyReport(selectedMonth) {
  const { startDate, endDate } = getMonthRange(selectedMonth);

  const [XLSX, logs, { data: parentLinks, error: parentErr }] = await Promise.all([
    import('xlsx'),
    fetchAllLogs(startDate, endDate),
    supabase.from('parent_children').select('student_id, parent:users!parent_children_parent_id_fkey(name, username, phone)'),
  ]);
  if (parentErr) throw parentErr;

  const parentsByStudent = {};
  (parentLinks || []).forEach(({ student_id, parent }) => {
    if (!parent) return;
    (parentsByStudent[student_id] ||= []).push(parent);
  });

  const studentMap = {};
  const tutorMap = {};
  const roomMap = {};
  const lineMap = {};
  const totals = { hours: 0, revenue: 0, cost: 0, roomRevenue: 0 };
  const rawRows = [];

  logs.forEach((log) => {
    const c = calcLog(log);
    const item = getItemLabel(log, c.isClassroom);
    const student = log.student || {};
    const studentKey = student.id || log.student_id || 'unknown';

    rawRows.push({
      'วันที่': log.teaching_date,
      'เวลาเริ่ม': formatTime(log.start_time),
      'เวลาสิ้นสุด': formatTime(log.end_time),
      'ชม.': round2(c.hrs),
      'ครู / สถานที่': c.isClassroom ? `🏠 ${log.tutor?.name || 'Classroom'}` : (log.tutor?.name || log.tutor?.username || '-'),
      'รหัสนักเรียน': student.username || '-',
      'ชื่อนักเรียน': student.name || '-',
      'ประเภท': c.isClassroom ? 'เช่าห้อง' : (LEARNING_TYPE_LABEL[log.learning_type] || log.learning_type || '-'),
      'วิชา / คอร์ส': item,
      'ระดับชั้นเนื้อหา': log.learning_type === 'course' || c.isClassroom ? (log.custom_courses?.grade_level || '-') : (log.grade_level || '-'),
      'หัวข้อ / หมายเหตุ': log.topic || '',
      'เรทนักเรียน': round2(log.applied_student_rate),
      'เรทครู': round2(log.applied_tutor_rate),
      'ค่าเรียน': round2(c.revenue),
      'ค่าครู': round2(c.cost),
      'ค่าเช่าห้อง': round2(c.roomRevenue),
    });

    // รวมแบบเดียวกับบิล: นักเรียน + ครู + ประเภท + วิชา/คอร์ส + เรท + ระดับชั้น
    const contentGrade = log.learning_type === 'course' || c.isClassroom ? (log.custom_courses?.grade_level || '') : (log.grade_level || '');
    const lineKey = [studentKey, log.tutor_id, c.isClassroom ? 'room' : log.learning_type, log.subject_id || '', log.custom_course_id || '', log.applied_student_rate, contentGrade].join('|');
    if (!lineMap[lineKey]) {
      lineMap[lineKey] = { student, tutor: log.tutor || {}, isClassroom: c.isClassroom, learningType: log.learning_type, item, contentGrade, studentRate: Number(log.applied_student_rate) || 0, tutorRate: Number(log.applied_tutor_rate) || 0, dates: [], sessions: 0, hours: 0, rounds: 0, amount: 0, cost: 0 };
    }
    const line = lineMap[lineKey];
    line.dates.push(log.teaching_date);
    line.sessions += 1;
    line.hours += c.hrs;
    line.rounds += c.rounds;
    line.amount += c.isClassroom ? c.roomRevenue : c.revenue;
    line.cost += c.cost;

    if (!studentMap[studentKey]) {
      studentMap[studentKey] = { student, subjects: new Set(), sessions: 0, hours: 0, revenue: 0, roomRevenue: 0 };
    }
    const s = studentMap[studentKey];
    s.subjects.add(item);
    s.sessions += 1;

    if (c.isClassroom) {
      s.roomRevenue += c.roomRevenue;
      totals.roomRevenue += c.roomRevenue;
      if (!roomMap[studentKey]) roomMap[studentKey] = { student, packages: new Set(), sessions: 0, hours: 0, rounds: 0, amount: 0 };
      const r = roomMap[studentKey];
      r.packages.add(item);
      r.sessions += 1;
      r.hours += c.hrs;
      r.rounds += c.rounds;
      r.amount += c.roomRevenue;
      return;
    }

    s.hours += c.hrs;
    s.revenue += c.revenue;
    totals.hours += c.hrs;
    totals.revenue += c.revenue;
    totals.cost += c.cost;

    const tutorKey = log.tutor?.id || log.tutor_id || 'unknown';
    if (!tutorMap[tutorKey]) tutorMap[tutorKey] = { tutor: log.tutor || {}, students: new Set(), sessions: 0, hours: 0, amount: 0 };
    const t = tutorMap[tutorKey];
    t.students.add(studentKey);
    t.sessions += 1;
    t.hours += c.hrs;
    t.amount += c.cost;
  });

  const studentRows = Object.values(studentMap)
    .sort((a, b) => byUsername(a.student, b.student))
    .map(({ student, subjects, sessions, hours, revenue, roomRevenue }) => {
      const parents = parentsByStudent[student.id] || [];
      return {
        'รหัสนักเรียน': student.username || '-',
        'ชื่อเล่น': student.name || '-',
        'ระดับชั้น': student.grade || '-',
        'โรงเรียน': student.school_name || '',
        'วิชาเรียน': [...subjects].join(', '),
        'จำนวนครั้ง': sessions,
        'รวมชม.เรียน': round2(hours),
        'ค่าเรียน': round2(revenue),
        'ค่าเช่าห้อง': round2(roomRevenue),
        'รวมเป็นเงิน': round2(revenue + roomRevenue),
        'เบอร์โทรนักเรียน': student.phone || '',
        'ชื่อผู้ปกครอง': student.parent_name || parents.map(p => p.name || p.username).join(', '),
        'เบอร์โทรผู้ปกครอง': parents.map(p => p.phone).filter(Boolean).join(', '),
      };
    });

  const tutorRows = Object.values(tutorMap)
    .sort((a, b) => byUsername(a.tutor, b.tutor))
    .map(({ tutor, students, sessions, hours, amount }) => ({
      'รหัสครู': tutor.username || '-',
      'ชื่อครู': tutor.name || '-',
      'จำนวนครั้งที่สอน': sessions,
      'จำนวนนักเรียน': students.size,
      'รวมชม.สอน': round2(hours),
      'ยอดที่ต้องโอน': round2(amount),
    }));

  const roomRows = Object.values(roomMap)
    .sort((a, b) => byUsername(a.student, b.student))
    .map(({ student, packages, sessions, hours, rounds, amount }) => ({
      'รหัสผู้เช่า': student.username || '-',
      'ชื่อผู้เช่า': student.name || '-',
      'แพ็กเกจ': [...packages].join(', '),
      'จำนวนครั้ง': sessions,
      'รวมชม.ใช้งาน': round2(hours),
      'จำนวนรอบ': round2(rounds),
      'ยอดค่าเช่า': round2(amount),
    }));

  const lineRows = Object.values(lineMap)
    .sort((a, b) => byUsername(a.student, b.student) || a.dates[0].localeCompare(b.dates[0]))
    .map((l) => ({
      'รหัสนักเรียน': l.student.username || '-',
      'ชื่อเล่น': l.student.name || '-',
      'ประเภท': l.isClassroom ? 'เช่าห้อง' : (LEARNING_TYPE_LABEL[l.learningType] || l.learningType || '-'),
      'วิชา / คอร์ส': l.item,
      'ระดับชั้นเนื้อหา': l.contentGrade || '-',
      'ครูผู้สอน': l.isClassroom ? '🏠 Classroom' : (l.tutor.name || l.tutor.username || '-'),
      'จำนวนครั้ง': l.sessions,
      'รวมชม.': round2(l.hours),
      'จำนวนรอบ (เช่าห้อง)': l.isClassroom ? round2(l.rounds) : '',
      'เรท': round2(l.studentRate),
      'เป็นเงิน': round2(l.amount),
      'เรทครู': l.isClassroom ? '' : round2(l.tutorRate),
      'ค่าครู': round2(l.cost),
      'วันที่เรียน': [...new Set(l.dates.map(d => Number(d.slice(8, 10))))].join(', '),
    }));

  const sum = (rows, key) => round2(rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0));
  const withTotal = (rows, labelKey, sumKeys) => rows.length === 0 ? rows : [
    ...rows,
    { [labelKey]: 'รวมทั้งหมด', ...Object.fromEntries(sumKeys.map(k => [k, sum(rows, k)])) },
  ];

  const teachingProfit = totals.revenue - totals.cost;
  const overviewRows = [
    { 'หัวข้อ': 'เดือน', 'ค่า': selectedMonth },
    { 'หัวข้อ': 'จำนวนรายการบันทึกทั้งหมด', 'ค่า': logs.length },
    { 'หัวข้อ': 'ชั่วโมงสอนรวม (ไม่รวมเช่าห้อง)', 'ค่า': round2(totals.hours) },
    { 'หัวข้อ': 'ยอดเก็บค่าเรียน (ไม่รวมห้อง)', 'ค่า': round2(totals.revenue) },
    { 'หัวข้อ': 'รายจ่ายรวม (ยอดโอนครู)', 'ค่า': round2(totals.cost) },
    { 'หัวข้อ': 'กำไรจากการสอน', 'ค่า': round2(teachingProfit) },
    { 'หัวข้อ': 'รายได้เช่าห้องสถานที่', 'ค่า': round2(totals.roomRevenue) },
    { 'หัวข้อ': 'กำไรสุทธิรวมบริษัท', 'ค่า': round2(teachingProfit + totals.roomRevenue) },
    { 'หัวข้อ': 'วันเวลาที่ export', 'ค่า': new Date().toLocaleString('th-TH') },
  ];

  const makeSheet = (rows, emptyHeader) => {
    const ws = rows.length > 0
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.aoa_to_sheet([emptyHeader, ['ไม่มีข้อมูลในเดือนนี้']]);
    const header = rows.length > 0 ? Object.keys(rows[0]) : emptyHeader;
    // ความกว้างคอลัมน์ตามข้อความที่ยาวที่สุด (จำกัดไม่เกิน 50 ตัวอักษร)
    ws['!cols'] = header.map(key => ({
      wch: Math.min(50, Math.max(String(key).length, ...rows.map(r => String(r[key] ?? '').length)) + 2),
    }));
    if (rows.length > 0) ws['!autofilter'] = { ref: ws['!ref'] };
    return ws;
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, makeSheet(overviewRows, ['หัวข้อ', 'ค่า']), 'ภาพรวม');
  XLSX.utils.book_append_sheet(wb, makeSheet(
    withTotal(studentRows, 'รหัสนักเรียน', ['จำนวนครั้ง', 'รวมชม.เรียน', 'ค่าเรียน', 'ค่าเช่าห้อง', 'รวมเป็นเงิน']),
    ['รหัสนักเรียน', 'ชื่อเล่น', 'ระดับชั้น', 'โรงเรียน', 'วิชาเรียน', 'จำนวนครั้ง', 'รวมชม.เรียน', 'ค่าเรียน', 'ค่าเช่าห้อง', 'รวมเป็นเงิน', 'เบอร์โทรนักเรียน', 'ชื่อผู้ปกครอง', 'เบอร์โทรผู้ปกครอง'],
  ), 'สรุปนักเรียน');
  XLSX.utils.book_append_sheet(wb, makeSheet(
    withTotal(tutorRows, 'รหัสครู', ['จำนวนครั้งที่สอน', 'รวมชม.สอน', 'ยอดที่ต้องโอน']),
    ['รหัสครู', 'ชื่อครู', 'จำนวนครั้งที่สอน', 'จำนวนนักเรียน', 'รวมชม.สอน', 'ยอดที่ต้องโอน'],
  ), 'สรุปครู');
  XLSX.utils.book_append_sheet(wb, makeSheet(
    withTotal(roomRows, 'รหัสผู้เช่า', ['จำนวนครั้ง', 'รวมชม.ใช้งาน', 'จำนวนรอบ', 'ยอดค่าเช่า']),
    ['รหัสผู้เช่า', 'ชื่อผู้เช่า', 'แพ็กเกจ', 'จำนวนครั้ง', 'รวมชม.ใช้งาน', 'จำนวนรอบ', 'ยอดค่าเช่า'],
  ), 'ค่าเช่าห้อง');
  XLSX.utils.book_append_sheet(wb, makeSheet(
    withTotal(lineRows, 'รหัสนักเรียน', ['จำนวนครั้ง', 'รวมชม.', 'เป็นเงิน', 'ค่าครู']),
    ['รหัสนักเรียน', 'ชื่อเล่น', 'ประเภท', 'วิชา / คอร์ส', 'ระดับชั้นเนื้อหา', 'ครูผู้สอน', 'จำนวนครั้ง', 'รวมชม.', 'จำนวนรอบ (เช่าห้อง)', 'เรท', 'เป็นเงิน', 'เรทครู', 'ค่าครู', 'วันที่เรียน'],
  ), 'ข้อมูลดิบแบบสรุป');
  XLSX.utils.book_append_sheet(wb, makeSheet(rawRows,
    ['วันที่', 'เวลาเริ่ม', 'เวลาสิ้นสุด', 'ชม.', 'ครู / สถานที่', 'รหัสนักเรียน', 'ชื่อนักเรียน', 'ประเภท', 'วิชา / คอร์ส', 'ระดับชั้นเนื้อหา', 'หัวข้อ / หมายเหตุ', 'เรทนักเรียน', 'เรทครู', 'ค่าเรียน', 'ค่าครู', 'ค่าเช่าห้อง'],
  ), 'ข้อมูลดิบ');

  XLSX.writeFile(wb, `PUN-IQ_รายงานประจำเดือน_${selectedMonth}.xlsx`);
  return { logCount: logs.length };
}
