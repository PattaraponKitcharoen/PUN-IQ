import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';

const GRADE_OPTIONS = [
  'อ.1', 'อ.2', 'อ.3',
  'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6',
  'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6',
  'ปวช.1', 'ปวช.2', 'ปวช.3', 'ปวส.1', 'ปวส.2',
  'ปี 1', 'ปี 2', 'ปี 3', 'ปี 4',
  'วัยทำงาน',
];
const OTHER_GRADE = '__other__';

export default function MyStudents() {
  const [myStudents, setMyStudents] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  const [name, setName] = useState('');
  const [gradeChoice, setGradeChoice] = useState('');
  const [customGrade, setCustomGrade] = useState('');
  const grade = gradeChoice === OTHER_GRADE ? customGrade : gradeChoice;

  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null); // null = ยังไม่ได้ค้นหา
  const [addingId, setAddingId] = useState(null);
  const [message, setMessage] = useState('');

  const loadMyStudents = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const tutorId = session?.user?.id;
    if (!tutorId) { setLoadingList(false); return; }

    const { data: links } = await supabase.from('tutor_students').select('student_id').eq('tutor_id', tutorId);
    const ids = (links || []).map(l => l.student_id);
    if (ids.length === 0) {
      setMyStudents([]);
    } else {
      const { data } = await supabase.from('users').select('id, name, username, grade').in('id', ids).order('username');
      setMyStudents(data || []);
    }
    setLoadingList(false);
  }, []);

  useEffect(() => {
    const load = async () => { await loadMyStudents(); };
    load();
  }, [loadMyStudents]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!name.trim() || !grade.trim()) {
      setMessage('❌ กรุณากรอกชื่อและเลือกระดับชั้นให้ครบ');
      return;
    }
    setSearching(true);
    setMessage('');
    setResults(null);
    const { data, error } = await supabase.rpc('tutor_find_student', { p_name: name, p_grade: grade });
    if (error) {
      setMessage(`❌ ค้นหาไม่สำเร็จ: ${error.message}`);
    } else {
      setResults(data || []);
    }
    setSearching(false);
  };

  const handleAdd = async (student) => {
    setAddingId(student.id);
    setMessage('');
    const { data, error } = await supabase.rpc('tutor_add_student', { p_student_id: student.id });
    if (error) {
      setMessage(`❌ เพิ่มไม่สำเร็จ: ${error.message}`);
    } else {
      setMessage(data === 'exists'
        ? `ℹ️ ${student.username} - ${student.name} อยู่ในความดูแลของคุณอยู่แล้ว`
        : `✅ เพิ่ม ${student.username} - ${student.name} เข้าความดูแลแล้ว (เลือกได้ในหน้าลงเวลา)`);
      setResults(null);
      setName('');
      setGradeChoice('');
      setCustomGrade('');
      await loadMyStudents();
    }
    setAddingId(null);
  };

  const renderResultRow = (s) => (
    <div key={s.id} className="flex items-center justify-between gap-3 p-3 bg-white border border-gray-200 rounded-lg">
      <div className="min-w-0">
        <p className="font-bold text-gray-800 truncate" translate="no">{s.username}</p>
        <p className="text-sm text-gray-600 truncate" translate="no">{s.name} · {s.grade}</p>
      </div>
      {s.already_mine ? (
        <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">✓ อยู่ในความดูแลแล้ว</span>
      ) : (
        <button
          type="button"
          onClick={() => handleAdd(s)}
          disabled={addingId !== null}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition whitespace-nowrap disabled:opacity-50"
        >
          {addingId === s.id ? 'กำลังเพิ่ม...' : '+ เพิ่มเข้าความดูแล'}
        </button>
      )}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto pb-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">นักเรียนในความดูแล</h1>
        <p className="text-gray-500 mt-1">เพิ่มนักเรียนรายบุคคลเข้าความดูแลของคุณ เพื่อเลือกได้ในหน้าลงเวลา</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-sm font-semibold border ${message.startsWith('❌') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="font-bold text-gray-800 mb-1">เพิ่มนักเรียน</h2>
        <p className="text-xs text-gray-500 mb-4">กรอกชื่อและระดับชั้นให้ตรงกับในระบบทุกตัวอักษร (ระบบไม่แสดงรายชื่อให้เลือกจากการพิมพ์บางส่วน)</p>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">ชื่อนักเรียน (ตามในระบบ)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setResults(null); }}
                translate="no"
                lang="th"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="พิมพ์ชื่อให้ตรงกับในระบบ"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">ระดับชั้น</label>
              <select
                value={gradeChoice}
                onChange={(e) => { setGradeChoice(e.target.value); setResults(null); }}
                translate="no"
                lang="th"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                <option value="">-- เลือกระดับชั้น --</option>
                {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                <option value={OTHER_GRADE}>อื่นๆ (พิมพ์เอง)</option>
              </select>
              {gradeChoice === OTHER_GRADE && (
                <input
                  type="text"
                  value={customGrade}
                  onChange={(e) => { setCustomGrade(e.target.value); setResults(null); }}
                  className="w-full mt-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="พิมพ์ระดับชั้นตามในระบบ"
                />
              )}
            </div>
          </div>

          <button type="submit" disabled={searching} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg transition text-sm disabled:opacity-50">
            {searching ? 'กำลังค้นหา...' : '🔍 ค้นหา'}
          </button>
        </form>

        {results && (
          <div className="mt-5">
            {results.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                ไม่พบนักเรียนที่ชื่อและระดับชั้นตรงกัน กรุณาตรวจสอบตัวสะกด หรือติดต่อแอดมิน
              </div>
            ) : results.length === 1 ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-600">พบนักเรียน — ตรวจสอบรหัสก่อนเพิ่ม</p>
                {renderResultRow(results[0])}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-bold text-amber-700">⚠️ พบ {results.length} คนที่ชื่อและระดับชั้นซ้ำกัน — เลือกตามรหัสนักเรียน</p>
                {results.map(renderResultRow)}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="font-bold text-gray-800 mb-4">นักเรียนรายบุคคลของฉัน ({myStudents.length} คน)</h2>
        {loadingList ? (
          <p className="text-sm text-gray-400">กำลังโหลด...</p>
        ) : myStudents.length === 0 ? (
          <p className="text-sm text-gray-400">ยังไม่มีนักเรียนรายบุคคลในความดูแล</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {myStudents.map(s => (
              <div key={s.id} className="py-2.5 flex justify-between text-sm" translate="no">
                <span className="font-semibold text-gray-800">{s.username} - {s.name}</span>
                <span className="text-gray-500">{s.grade || '-'}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-gray-400 mt-3">* นักเรียนในกลุ่มเรียนจะไม่แสดงในรายการนี้ (แอดมินเป็นผู้จัดการกลุ่ม) · หากต้องการนำนักเรียนออก กรุณาติดต่อแอดมิน</p>
      </div>
    </div>
  );
}
