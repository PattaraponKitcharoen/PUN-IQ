import { useState } from 'react';

// ช่องค้นหาแบบมีรายการแนะนำเด้งลงมาให้เลือก
export default function SearchPicker({ items, value, onChange, matches, renderItem, onSelect, placeholder, emptyText }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const keyword = value.trim().toLowerCase();
  const results = keyword ? items.filter(item => matches(item, keyword)).slice(0, 10) : [];

  const choose = (item) => {
    onSelect(item);
    onChange('');
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!open || !keyword) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[activeIndex]) choose(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative mb-2">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActiveIndex(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        translate="no"
        lang="th"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-sans bg-white"
      />
      {open && keyword && (
        <ul className="absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg text-sm" translate="no">
          {results.length === 0 ? (
            <li className="px-4 py-2.5 text-gray-400">{emptyText}</li>
          ) : results.map((item, index) => (
            <li
              key={item.id}
              // ใช้ onMouseDown เพื่อให้เลือกได้ก่อนที่ input จะ blur แล้วปิดกล่อง
              onMouseDown={(e) => { e.preventDefault(); choose(item); }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`px-4 py-2.5 cursor-pointer ${index === activeIndex ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'}`}
            >
              {renderItem(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
