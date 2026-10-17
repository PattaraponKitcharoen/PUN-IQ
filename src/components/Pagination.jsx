import { useState } from 'react';

const SIZES = {
  md: { button: 'p-2', icon: 'w-5 h-5', box: 'text-sm px-4 py-1.5 shadow-sm bg-white', input: 'w-14 text-sm' },
  sm: { button: 'p-1.5', icon: 'w-4 h-4', box: 'text-xs px-3 py-1 bg-gray-50', input: 'w-12 text-xs' },
};

// ช่องพิมพ์เลขหน้า: กด Enter หรือคลิกออกเพื่อไปหน้านั้น (ใช้ key={currentPage} ให้รีเซ็ตค่าเมื่อเปลี่ยนหน้า)
function PageInput({ currentPage, totalPages, onPageChange, className }) {
  const [draft, setDraft] = useState(String(currentPage));

  const commit = () => {
    const page = parseInt(draft, 10);
    if (Number.isNaN(page)) {
      setDraft(String(currentPage));
      return;
    }
    const clamped = Math.min(Math.max(page, 1), totalPages);
    setDraft(String(clamped));
    if (clamped !== currentPage) onPageChange(clamped);
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      max={totalPages}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') setDraft(String(currentPage));
      }}
      onFocus={(e) => e.target.select()}
      title="พิมพ์เลขหน้าแล้วกด Enter"
      className={`${className} px-1.5 py-0.5 border border-gray-300 rounded-md text-center font-semibold text-gray-800 bg-white outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
    />
  );
}

export default function Pagination({ currentPage, totalPages, onPageChange, size = 'md', className = '' }) {
  const s = SIZES[size];
  const buttonCls = `${s.button} bg-white border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm`;

  return (
    <div className={`flex justify-center items-center p-4 space-x-6 ${className}`}>
      <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className={buttonCls} title="หน้าก่อนหน้า">
        <svg className={s.icon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className={`flex items-center font-semibold text-gray-700 rounded-lg border border-gray-200 ${s.box}`}>
        <span className="mr-2">หน้า</span>
        <PageInput key={currentPage} currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} className={s.input} />
        <span className="text-gray-400 font-normal mx-2">จาก</span>
        <span>{totalPages}</span>
      </div>

      <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages} className={buttonCls} title="หน้าถัดไป">
        <svg className={s.icon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
