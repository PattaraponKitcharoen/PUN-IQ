import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// รูปแบบรหัสตั้งต้น — ใช้เมื่อยังไม่มีตาราง username_prefixes ในฐานข้อมูล
export const DEFAULT_USERNAME_PREFIXES = {
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

// โหลดรูปแบบรหัสของบทบาทนี้จากตาราง username_prefixes (แอดมินเพิ่ม/ลบได้)
// ถ้าอ่านตารางไม่ได้ (ยังไม่ได้สร้าง) จะใช้ชุดตั้งต้นและปิดการเพิ่ม/ลบ (tableReady = false)
export function useUsernamePrefixes(role, enabled) {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState({ key: null, list: null, tableReady: false });
  const key = `${role}|${reloadToken}`;

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    supabase
      .from('username_prefixes')
      .select('id, prefix, digits, sort_order')
      .eq('role', role)
      .order('sort_order')
      .order('prefix')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data || data.length === 0) {
          setResult({ key, list: DEFAULT_USERNAME_PREFIXES[role], tableReady: !error });
        } else {
          setResult({ key, list: data, tableReady: true });
        }
      });
    return () => { cancelled = true; };
  }, [enabled, key, role]);

  const prefixes = result.list || DEFAULT_USERNAME_PREFIXES[role];
  const reload = () => setReloadToken(t => t + 1);

  const add = async (rawPrefix, digits) => {
    const prefix = rawPrefix.trim().toUpperCase();
    if (!/^[A-Z]{1,10}$/.test(prefix)) throw new Error('รหัสต้องเป็นตัวอักษรภาษาอังกฤษ 1-10 ตัว');
    if (!(digits >= 1 && digits <= 5)) throw new Error('จำนวนหลักต้องอยู่ระหว่าง 1-5');
    if (prefixes.some(p => p.prefix === prefix)) throw new Error(`มีรูปแบบ ${prefix} อยู่แล้ว`);
    const sortOrder = Math.max(0, ...prefixes.map(p => p.sort_order || 0)) + 10;
    const { error } = await supabase.from('username_prefixes').insert([{ role, prefix, digits, sort_order: sortOrder }]);
    if (error) throw error;
    reload();
    return prefix;
  };

  const remove = async (id) => {
    const { error } = await supabase.from('username_prefixes').delete().eq('id', id);
    if (error) throw error;
    reload();
  };

  return { prefixes, tableReady: result.tableReady, add, remove };
}

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
