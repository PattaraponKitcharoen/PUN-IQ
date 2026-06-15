import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function ManageCompanyAccount() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Form States
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [qrFile, setQrFile] = useState(null);
  
  // 🔴 1. เพิ่ม State เพื่อเช็คว่ากำลังอยู่ในโหมดแก้ไขบัญชีไหน
  const [editingAccountId, setEditingAccountId] = useState(null);

  const fetchAccounts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('company_accounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setAccounts(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setQrFile(e.target.files[0]);
    }
  };

  // 🔴 2. ฟังก์ชันโหลดข้อมูลเข้าฟอร์มเมื่อกดปุ่ม "แก้ไข"
  const handleEditClick = (account) => {
    setEditingAccountId(account.id);
    setBankName(account.bank_name);
    setAccountName(account.account_name);
    setAccountNumber(account.account_number);
    setQrFile(null); // เคลียร์ไฟล์รูปที่อาจจะค้างอยู่
    setMessage('');
    
    // เลื่อนหน้าจอกลับขึ้นไปหาฟอร์มด้านบน
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 🔴 3. ฟังก์ชันรีเซ็ตฟอร์มให้กลับเป็นโหมดเพิ่มข้อมูลใหม่
  const handleCancelEdit = () => {
    setEditingAccountId(null);
    setBankName('');
    setAccountName('');
    setAccountNumber('');
    setQrFile(null);
    setMessage('');
    // ล้างค่าอินพุตไฟล์ (ถ้ามี)
    const fileInput = document.getElementById('qr-file-input');
    if (fileInput) fileInput.value = '';
  };

  // 🔴 4. ปรับปรุงฟังก์ชันบันทึก ให้รองรับทั้งการ "เพิ่ม" และ "อัปเดต"
  const handleSubmitAccount = async (e) => {
    e.preventDefault();
    if (!bankName.trim() || !accountName.trim() || !accountNumber.trim()) return;

    setSaving(true);
    setMessage('');
    let qrCodeUrl = null;

    try {
      // ขั้นตอน A: อัปโหลดรูปภาพใหม่ (ถ้าผู้ใช้เลือกรูปใหม่มา)
      if (qrFile) {
        const fileExt = qrFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `public/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('qr_codes')
          .upload(filePath, qrFile);

        if (uploadError) throw new Error(`อัปโหลดรูปภาพไม่สำเร็จ: ${uploadError.message}`);

        const { data: urlData } = supabase.storage.from('qr_codes').getPublicUrl(filePath);
        qrCodeUrl = urlData.publicUrl;
      }

      // ขั้นตอน B: ทำการแยกเคสว่า บันทึกใหม่ หรือ อัปเดตของเดิม
      if (editingAccountId) {
        // === โหมดอัปเดตบัญชีเดิม ===
        const updatePayload = {
          bank_name: bankName.trim(),
          account_name: accountName.trim(),
          account_number: accountNumber.trim(),
        };

        // ถ้ามีการอัปโหลดรูปใหม่ด้วย ให้เพิ่มลิงก์ใหม่เข้าไป และสั่งลบรูปเก่าใน Storage ทิ้งเพื่อประหยัดพื้นที่
        if (qrCodeUrl) {
          updatePayload.qr_code_url = qrCodeUrl;
          
          const oldAccount = accounts.find(a => a.id === editingAccountId);
          if (oldAccount && oldAccount.qr_code_url) {
            const urlParts = oldAccount.qr_code_url.split('/qr_codes/');
            if (urlParts.length > 1) {
              await supabase.storage.from('qr_codes').remove([urlParts[1]]);
            }
          }
        }

        const { error: updateError } = await supabase
          .from('company_accounts')
          .update(updatePayload)
          .eq('id', editingAccountId);

        if (updateError) throw new Error(updateError.message);
        setMessage('✅ อัปเดตข้อมูลบัญชีสำเร็จ!');

      } else {
        // === โหมดเพิ่มบัญชีใหม่ ===
        const { error: insertError } = await supabase
          .from('company_accounts')
          .insert([{
            bank_name: bankName.trim(),
            account_name: accountName.trim(),
            account_number: accountNumber.trim(),
            qr_code_url: qrCodeUrl,
            is_active: true
          }]);

        if (insertError) throw new Error(insertError.message);
        setMessage('🎉 เพิ่มบัญชีรับเงินของบริษัทสำเร็จ!');
      }

      // ล้างฟอร์มเมื่อเสร็จสิ้น
      handleCancelEdit();
      fetchAccounts();

    } catch (error) {
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      const { error } = await supabase.from('company_accounts').update({ is_active: !currentStatus }).eq('id', id);
      if (error) throw error;
      fetchAccounts();
    } catch (error) {
      alert(`ไม่สามารถเปลี่ยนสถานะได้: ${error.message}`);
    }
  };

  const handleDeleteAccount = async (id, qrCodeUrl) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ที่จะลบบัญชีนี้อย่างถาวร?')) return;
    setMessage('');

    try {
      if (qrCodeUrl) {
        const urlParts = qrCodeUrl.split('/qr_codes/');
        if (urlParts.length > 1) await supabase.storage.from('qr_codes').remove([urlParts[1]]);
      }
      const { error } = await supabase.from('company_accounts').delete().eq('id', id);
      if (error) throw error;
      
      setMessage('🗑️ ลบบัญชีเรียบร้อยแล้ว!');
      // ถ้าลบบัญชีที่กำลังกดแก้ไขอยู่ ให้ล้างฟอร์มด้วย
      if (editingAccountId === id) handleCancelEdit();
      fetchAccounts();
    } catch (error) {
      setMessage(`❌ เกิดข้อผิดพลาดในการลบ: ${error.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">จัดการบัญชีรับเงินบริษัท (Company Accounts)</h1>
        <p className="text-gray-500 mt-1">ตั้งค่าและเปิดปิดบัญชีธนาคารของโรงเรียน เพื่อนำไปใช้เลือกสลับในบิลใบแจ้งหนี้ของนักเรียน</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-semibold shadow-sm border ${
          message.includes('สำเร็จ') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ฟอร์มด้านซ้าย */}
        <div className={`bg-white rounded-xl shadow-sm border p-6 lg:col-span-1 h-fit transition-colors ${editingAccountId ? 'border-amber-400 ring-4 ring-amber-50' : 'border-gray-200'}`}>
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h2 className={`text-base font-bold ${editingAccountId ? 'text-amber-600' : 'text-gray-800'}`}>
              {editingAccountId ? '✏️ แก้ไขข้อมูลบัญชี' : 'เพิ่มบัญชีบริษัทใหม่'}
            </h2>
            {editingAccountId && (
              <button onClick={handleCancelEdit} className="text-xs text-gray-500 hover:text-gray-700 font-semibold bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">
                ยกเลิกแก้ไข
              </button>
            )}
          </div>

          <form onSubmit={handleSubmitAccount} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">ชื่อธนาคาร / ช่องทาง</label>
              <input
                type="text"
                placeholder="เช่น กสิกรไทย, ไทยพาณิชย์, พร้อมเพย์"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">ชื่อบัญชี</label>
              <input
                type="text"
                placeholder="ชื่อบริษัท หรือ ชื่อเจ้าของบัญชี"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">เลขที่บัญชี / หมายเลข</label>
              <input
                type="text"
                placeholder="เลขบัญชี หรือ เบอร์พร้อมเพย์"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                อัปโหลดรูปภาพ QR Code {editingAccountId && <span className="text-amber-500 font-normal">(อัปโหลดเฉพาะเมื่อต้องการเปลี่ยนรูปใหม่)</span>}
              </label>
              <input
                id="qr-file-input"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 file:cursor-pointer hover:file:bg-blue-100"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className={`w-full text-white font-bold py-2.5 px-4 rounded-lg transition text-sm shadow-sm disabled:opacity-50 ${
                editingAccountId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {saving ? 'กำลังบันทึกข้อมูล...' : editingAccountId ? '💾 อัปเดตข้อมูลบัญชี' : '+ บันทึกบัญชีใหม่'}
            </button>
          </form>
        </div>

        {/* ตารางฝั่งขวา */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <h2 className="text-base font-bold text-gray-800 mb-4 border-b pb-2">รายการบัญชีรับเงินทั้งหมด ({accounts.length})</h2>
          
          {loading ? (
            <div className="p-8 text-center text-gray-400 animate-pulse">กำลังโหลดข้อมูลบัญชี...</div>
          ) : accounts.length === 0 ? (
            <div className="p-8 text-center text-gray-400">ยังไม่มีข้อมูลบัญชีบริษัทในระบบ</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accounts.map((acc) => (
                <div key={acc.id} className={`p-4 border rounded-xl flex gap-4 transition-all bg-white relative ${
                  editingAccountId === acc.id ? 'border-amber-400 ring-2 ring-amber-100' : 
                  acc.is_active ? 'border-gray-200 shadow-xs hover:border-blue-300' : 'border-gray-200 bg-gray-50/50 opacity-60'
                }`}>
                  
                  <div className="w-20 h-20 bg-gray-100 rounded-lg border border-gray-200 shrink-0 overflow-hidden flex items-center justify-center">
                    {acc.qr_code_url ? (
                      <img src={acc.qr_code_url} alt="QR Code" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-[10px] text-gray-400 text-center px-1">ไม่มีรูป QR</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[10px] mb-1">{acc.bank_name}</span>
                    <h4 className="font-bold text-sm text-gray-800 truncate">{acc.account_name}</h4>
                    <p className="text-xs text-gray-600 font-mono mt-0.5 select-all">{acc.account_number}</p>
                    
                    <div className="flex items-center space-x-4 mt-3">
                      <label className="flex items-center cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={acc.is_active} 
                          onChange={() => handleToggleStatus(acc.id, acc.is_active)}
                          className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
                        />
                        <span className="ml-1 text-xs text-gray-500 font-medium">{acc.is_active ? 'เปิดใช้งาน' : 'ปิดชั่วคราว'}</span>
                      </label>

                      {/* 🔴 ปุ่มแก้ไข และ ปุ่มลบ */}
                      <button 
                        onClick={() => handleEditClick(acc)}
                        className="text-xs text-amber-500 hover:text-amber-700 font-bold"
                      >
                        แก้ไข
                      </button>

                      <button 
                        onClick={() => handleDeleteAccount(acc.id, acc.qr_code_url)}
                        className="text-xs text-red-500 hover:text-red-700 font-bold"
                      >
                        ลบ
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}