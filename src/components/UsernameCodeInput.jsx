// ช่อง Username แบบเลือกรูปแบบรหัส + แสดงรหัสถัดไปเป็นตัวสีเทา (เว้นว่าง = ใช้รหัสนั้น)
export default function UsernameCodeInput({ prefixes, selectedPrefix, onPrefixChange, value, onChange, suggestion, loading, error }) {
  return (
    <div>
      <label className="block text-gray-700 text-xs font-bold uppercase mb-2">ชื่อผู้ใช้งาน (Username)</label>

      <div className="flex bg-gray-100 p-1 rounded-lg mb-2 text-xs font-bold">
        {prefixes.map(({ prefix, digits }) => (
          <button
            key={prefix}
            type="button"
            onClick={() => onPrefixChange(prefix)}
            className={`flex-1 py-1.5 rounded-md transition ${selectedPrefix === prefix ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {prefix}{'X'.repeat(digits)}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={loading ? 'กำลังหารหัสถัดไป...' : suggestion}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
      />
      {error ? (
        <p className="text-[11px] text-red-500 mt-1">หารหัสถัดไปไม่สำเร็จ: {error} (กรอก Username เองได้)</p>
      ) : (
        <p className="text-[11px] text-gray-500 mt-1">
          {value.trim()
            ? 'ใช้ Username ที่กรอกเอง'
            : loading ? 'กำลังหารหัสถัดไป...' : <>เว้นว่างไว้ ระบบจะใช้ <span className="font-bold text-gray-700">{suggestion}</span> ให้อัตโนมัติ</>}
        </p>
      )}
    </div>
  );
}
