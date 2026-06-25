import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function ManageParent() {
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [editingId, setEditingId] = useState(null);

  const fetchParents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'parent')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching parents:', error);
    } else {
      setParents(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchParents();
  }, []);

  const handleEditClick = (parent) => {
    setEditingId(parent.id);
    setUsername(parent.username || '');
    setPassword(''); // เว้นว่างไว้เสมอตอนแก้ไข เผื่อไม่ต้องการเปลี่ยนรหัส
    setName(parent.name || '');
    setPhone(parent.phone || '');
    setEmail(parent.email || '');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setUsername('');
    setPassword('');
    setName('');
    setPhone('');
    setEmail('');
    setMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || (!editingId && !password.trim())) {
      setMessage('❌ กรุณากรอกชื่อผู้ใช้งาน และรหัสผ่านให้ครบถ้วน');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      if (editingId) {
        // อัปเดตข้อมูลบัญชีเดิม
        const payload = {
          username: username.trim(),
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
        };

        // ถ้ามีการพิมพ์รหัสผ่านใหม่ ให้ส่งไปอัปเดตด้วย (ระบบอาจจะต้องมี Edge Function หรือ Trigger จัดการ Auth)
        if (password.trim()) {
          payload.password = password.trim(); 
        }

        const { error } = await supabase.from('users').update(payload).eq('id', editingId);
        if (error) throw error;
        setMessage('✅ อัปเดตข้อมูลผู้ปกครองสำเร็จ!');
      } else {
        // สร้างบัญชีผู้ปกครองใหม่
        const payload = {
          username: username.trim(),
          password: password.trim(), // ในระบบจริง ควรเข้ารหัสหรือส่งผ่าน API สร้าง Auth
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          role: 'parent'
        };

        const { error } = await supabase.from('users').insert([payload]);
        if (error) throw error;
        setMessage('🎉 สร้างบัญชีผู้ปกครองใหม่สำเร็จ!');
      }

      handleCancelEdit();
      fetchParents();
    } catch (error) {
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, parentName) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ที่จะลบบัญชีผู้ปกครอง "${parentName}" ถาวร?\n(การกระทำนี้จะลบการเชื่อมต่อกับนักเรียนทั้งหมดด้วย)`)) return;
    
    setMessage('');
    try {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      
      setMessage('🗑️ ลบบัญชีผู้ปกครองสำเร็จ');
      if (editingId === id) handleCancelEdit();
      fetchParents();
    } catch (error) {
      setMessage(`❌ ลบไม่สำเร็จ: ${error.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">👨‍👩‍👧‍👦 จัดการบัญชีผู้ปกครอง (Manage Parents)</h1>
        <p className="text-gray-500 mt-1">สร้างและแก้ไขบัญชีสำหรับผู้ปกครอง เพื่อใช้ในการล็อกอินเข้าดูข้อมูลของนักเรียน</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-semibold shadow-sm border ${
          message.includes('สำเร็จ') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      <div className="flex flex-col space-y-6">
        
        {/* ส่วนฟอร์มเพิ่ม/แก้ไข */}
        <div className={`bg-white rounded-xl shadow-sm border p-6 w-full transition-all ${editingId ? 'border-amber-400 ring-4 ring-amber-50' : 'border-gray-200'}`}>
          <h2 className={`text-base font-bold mb-4 border-b pb-2 ${editingId ? 'text-amber-600' : 'text-gray-800'}`}>
            {editingId ? '✏️ แก้ไขข้อมูลผู้ปกครอง' : '➕ สร้างบัญชีผู้ปกครองใหม่'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">ชื่อผู้ใช้งาน (Username) <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="เช่น parent_somchai" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">รหัสผ่าน (Password) {editingId && <span className="text-gray-400 font-normal">(เว้นว่างถ้าไม่เปลี่ยน)</span>}</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder={editingId ? "********" : "ตั้งรหัสผ่าน..."} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                  required={!editingId} 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">ชื่อ-นามสกุล (แสดงผล)</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="เช่น คุณพ่อสมชาย" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">เบอร์โทรศัพท์ (ถ้ามี)</label>
                <input 
                  type="text" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  placeholder="08X-XXX-XXXX" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              {editingId && (
                <button type="button" onClick={handleCancelEdit} className="px-5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-lg transition text-sm">
                  ยกเลิก
                </button>
              )}
              <button type="submit" disabled={saving} className={`font-bold py-2.5 px-6 rounded-lg transition text-sm shadow-sm disabled:opacity-50 ${editingId ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                {saving ? 'กำลังบันทึก...' : editingId ? '💾 อัปเดตข้อมูลบัญชี' : '+ สร้างบัญชีผู้ปกครอง'}
              </button>
            </div>
          </form>
        </div>

        {/* ส่วนตารางแสดงข้อมูล */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 w-full overflow-hidden">
          <h2 className="text-base font-bold text-gray-800 mb-4 border-b pb-2">รายชื่อบัญชีผู้ปกครอง ({parents.length})</h2>
          
          {loading ? (
            <div className="p-10 text-center text-gray-400 animate-pulse">กำลังดึงข้อมูลบัญชีผู้ปกครอง...</div>
          ) : parents.length === 0 ? (
            <div className="p-10 text-center text-gray-400">ยังไม่มีบัญชีผู้ปกครองในระบบ</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase">
                  <tr>
                    <th className="p-4 w-1/4">ชื่อผู้ใช้งาน (Username)</th>
                    <th className="p-4 w-1/3">ชื่อ-นามสกุล</th>
                    <th className="p-4 w-1/5">เบอร์โทรศัพท์</th>
                    <th className="p-4 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parents.map(parent => (
                    <tr key={parent.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 font-bold text-blue-700 text-sm">
                        {parent.username}
                      </td>
                      <td className="p-4 text-gray-800 font-medium text-sm">
                        {parent.name || '-'}
                      </td>
                      <td className="p-4 text-gray-600 font-medium text-sm">
                        {parent.phone || '-'}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center space-x-3">
                          <button onClick={() => handleEditClick(parent)} className="text-amber-500 hover:text-amber-700 font-bold text-sm bg-amber-50 px-3 py-1 rounded-md transition">แก้ไข</button>
                          <button onClick={() => handleDelete(parent.id, parent.username)} className="text-red-500 hover:text-red-700 font-bold text-sm bg-red-50 px-3 py-1 rounded-md transition">ลบ</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}