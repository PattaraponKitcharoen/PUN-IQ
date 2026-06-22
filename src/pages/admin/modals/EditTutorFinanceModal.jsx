import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function EditTutorFinanceModal({ isOpen, onClose, tutor, onSuccess }) {
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  
  const [qrFile, setQrFile] = useState(null);
  const [qrPreview, setQrPreview] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tutor && isOpen) {
      // โหลดข้อมูลธนาคารจากฐานข้อมูล (ถ้าเคยสร้างคอลัมน์ไว้แล้ว)
      setBankName(tutor.bank_name || '');
      setAccountName(tutor.account_name || '');
      setAccountNumber(tutor.account_number || '');
      setQrPreview(tutor.qr_code_url || '');
      setQrFile(null);
      setError('');
    }
  }, [tutor, isOpen]);

  if (!isOpen || !tutor) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('ขนาดไฟล์รูปภาพต้องไม่เกิน 2MB');
        return;
      }
      setQrFile(file);
      setQrPreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('กรุณาล็อกอินใหม่');

      let finalQrUrl = tutor.qr_code_url;

      if (qrFile) {
        const fileExt = qrFile.name.split('.').pop();
        const fileName = `qr_${tutor.id}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('tutor-qrs')
          .upload(fileName, qrFile, { upsert: true });

        if (uploadError) throw new Error(`อัปโหลดรูป QR Code ไม่สำเร็จ: ${uploadError.message}`);

        const { data: publicUrlData } = supabase.storage
          .from('tutor-qrs')
          .getPublicUrl(fileName);

        finalQrUrl = publicUrlData.publicUrl;
      }
  
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            targetUserId: tutor.id,
            bank_name: bankName,
            account_name: accountName,
            account_number: accountNumber,
            qr_code_url: finalQrUrl
          })
        }
      );
  
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
  
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-emerald-700 text-white p-5 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            จัดการบัญชีรับเงิน
          </h3>
          <button onClick={onClose} className="text-emerald-200 hover:text-white transition">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto">
          <form onSubmit={handleUpdate} className="p-6 space-y-4">
            {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm break-words">{error}</div>}

            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-4">
              <p className="text-xs text-emerald-800 font-medium mb-3">คุณครู: <span className="font-bold">{tutor.name || tutor.username}</span></p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-emerald-900 text-[10px] font-bold uppercase tracking-wider mb-1">ชื่อธนาคาร</label>
                  <input type="text" placeholder="เช่น กสิกรไทย, พร้อมเพย์" value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-emerald-900 text-[10px] font-bold uppercase tracking-wider mb-1">ชื่อบัญชี</label>
                  <input type="text" placeholder="นาย รักเรียน ขยันยิ่ง" value={accountName} onChange={(e) => setAccountName(e.target.value)} className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-emerald-900 text-[10px] font-bold uppercase tracking-wider mb-1">เลขที่บัญชี</label>
                  <input type="text" placeholder="XXX-X-XXXXX-X" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-3">
                รูปภาพ QR Code รับเงิน
              </label>
              
              {qrPreview && (
                <div className="mb-4 bg-white p-2 border border-slate-200 rounded-lg inline-block shadow-sm">
                  <img src={qrPreview} alt="QR Preview" className="h-32 object-contain" />
                </div>
              )}
              
              <input 
                type="file" 
                accept="image/png, image/jpeg, image/jpg" 
                onChange={handleFileChange} 
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer" 
              />
            </div>

            <div className="flex space-x-3 pt-2">
              <button type="button" onClick={onClose} className="w-1/2 bg-gray-100 text-gray-700 font-bold py-2 rounded-lg text-sm hover:bg-gray-200 transition">ยกเลิก</button>
              <button type="submit" disabled={loading} className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-sm transition">
                {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลการเงิน'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}