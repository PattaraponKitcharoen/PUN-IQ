import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// รูปแบบรหัส (Username) ที่ใช้รันอัตโนมัติของแต่ละบทบาท
export const USERNAME_PREFIXES = {
  student: [
    { prefix: 'SPIQH', digits: 3 },
    { prefix: 'SPIQP', digits: 3 },
    { prefix: 'B', digits: 2 },
  ],
  tutor: [
    { prefix: 'K', digits: 2 },
    { prefix: 'P', digits: 2 },
  ],
};

// หาเลขที่มากที่สุดของ prefix นี้ (นับเฉพาะบทบาทเดียวกัน) แล้ว +1
// ตัวอย่าง: มี SPIQH50, SPIQH070 → ได้ SPIQH071 / มี K24ปิง → ได้ K25
export async function fetchNextUsername(role, prefix, digits) {
  const { data, error } = await supabase
    .from('users')
    .select('username')
    .eq('role', role)
    .ilike('username', `${prefix}%`);
  if (error) throw error;

  const pattern = new RegExp(`^${prefix}(\\d+)`, 'i');
  const maxNumber = (data || []).reduce((max, { username }) => {
    const match = (username || '').match(pattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `${prefix}${String(maxNumber + 1).padStart(digits, '0')}`;
}

// ดึงรหัสถัดไปทุกครั้งที่เปิดหน้าต่าง/เปลี่ยน prefix และเรียก refresh() ซ้ำได้ (เช่นตอนรหัสชนกัน)
export function useNextUsername(role, prefixConfig, enabled) {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState({ key: null, value: '', error: '' });
  const key = `${role}|${prefixConfig.prefix}|${reloadToken}`;

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    fetchNextUsername(role, prefixConfig.prefix, prefixConfig.digits)
      .then(value => { if (!cancelled) setResult({ key, value, error: '' }); })
      .catch(err => { if (!cancelled) setResult({ key, value: '', error: err.message }); });
    return () => { cancelled = true; };
  }, [enabled, key, role, prefixConfig.prefix, prefixConfig.digits]);

  const isCurrent = result.key === key;
  return {
    suggestion: isCurrent ? result.value : '',
    loading: enabled && !isCurrent,
    error: isCurrent ? result.error : '',
    refresh: () => setReloadToken(t => t + 1),
  };
}
