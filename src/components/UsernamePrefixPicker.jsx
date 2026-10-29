import { useState } from 'react';

// ปุ่มเลือกรูปแบบรหัส + เพิ่ม/ลบรูปแบบใหม่ (ใช้ทั้งหน้าต่างเพิ่มนักเรียนและเพิ่มครู)
export default function UsernamePrefixPicker({ prefixes, selectedPrefix, onSelect, tableReady, onAdd, onRemove }) {
  const [adding, setAdding] = useState(false);
  const [newPrefix, setNewPrefix] = useState('');
  const [newDigits, setNewDigits] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selected = prefixes.find(p => p.prefix === selectedPrefix);
  const previewPrefix = newPrefix.trim().toUpperCase();

  const resetForm = () => {
    setAdding(false);
    setNewPrefix('');
    setNewDigits(3);
    setError('');
  };

  const handleAdd = async () => {
    setBusy(true);
    setError('');
    try {
      const prefix = await onAdd(newPrefix, Number(newDigits));
      onSelect(prefix);
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (target) => {
    if (!target?.id) return;
    if (!window.confirm(`ลบรูปแบบรหัส ${target.prefix} ออกจากตัวเลือก?\n\n• ผู้ใช้ที่ใช้รหัสนี้อยู่แล้วยังใช้งานได้ตามเดิม\n• ถ้าเพิ่มกลับมาภายหลัง เลขจะรันต่อจากรหัสเดิมที่มีอยู่`)) return;
    setBusy(true);
    setError('');
    try {
      await onRemove(target.id);
      if (selected?.prefix === target.prefix) {
        onSelect(prefixes.find(p => p.prefix !== target.prefix)?.prefix || '');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {/* แถวละ 3 ช่อง ขนาดเท่ากันทุกช่อง ไม่ขยายตามจำนวน */}
      <div className="grid grid-cols-3 gap-1.5 bg-gray-100 p-1.5 rounded-lg text-xs font-bold">
        {prefixes.map((p) => {
          const isSelected = selectedPrefix === p.prefix;
          const canRemove = tableReady && p.id && prefixes.length > 1;
          return (
            <div
              key={p.prefix}
              className={`group relative min-w-0 flex rounded-md transition ${isSelected ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <button type="button" onClick={() => onSelect(p.prefix)} title={`${p.prefix}${'X'.repeat(p.digits)}`} className="flex-1 min-w-0 py-1.5 px-2 truncate">
                {p.prefix}{'X'.repeat(p.digits)}
              </button>
              {canRemove && (
                <button
                  type="button"
                  onClick={() => handleRemove(p)}
                  disabled={busy}
                  title={`ลบรูปแบบ ${p.prefix}`}
                  aria-label={`ลบรูปแบบ ${p.prefix}`}
                  // มุมขวาบนของปุ่ม ไม่บังตัวรหัส · แสดงตอนเลือกอยู่ หรือเอาเมาส์ชี้
                  className={`absolute -top-1.5 -right-1.5 z-10 w-4 h-4 flex items-center justify-center rounded-full bg-white border border-gray-300 text-[10px] leading-none text-gray-500 shadow-sm hover:bg-red-500 hover:border-red-500 hover:text-white transition ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        {tableReady && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            title="เพิ่มรูปแบบรหัสใหม่"
            className="py-1.5 rounded-md border border-dashed border-gray-300 text-gray-500 hover:text-blue-700 hover:border-blue-300 hover:bg-white transition"
          >
            + เพิ่ม
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-2 p-3 border border-blue-200 bg-blue-50/50 rounded-lg space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newPrefix}
              onChange={(e) => setNewPrefix(e.target.value.toUpperCase())}
              placeholder="ตัวอักษรนำหน้า เช่น SPIQS"
              maxLength={10}
              className="flex-1 min-w-0 px-3 py-1.5 border border-gray-300 rounded-md text-sm uppercase outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={newDigits}
              onChange={(e) => setNewDigits(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
              title="จำนวนหลักของตัวเลข"
            >
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} หลัก</option>)}
            </select>
          </div>
          {previewPrefix && (
            <p className="text-[11px] text-gray-600">
              ตัวอย่าง: <span className="font-bold">{previewPrefix}{'1'.padStart(Number(newDigits), '0')}</span>, {previewPrefix}{'2'.padStart(Number(newDigits), '0')}, …
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForm} className="px-3 py-1 text-xs font-bold text-gray-600 bg-white border border-gray-300 rounded-md">ยกเลิก</button>
            <button type="button" onClick={handleAdd} disabled={busy || !previewPrefix} className="px-3 py-1 text-xs font-bold text-white bg-blue-600 rounded-md disabled:opacity-50">
              {busy ? 'กำลังบันทึก...' : 'บันทึกรูปแบบ'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}
