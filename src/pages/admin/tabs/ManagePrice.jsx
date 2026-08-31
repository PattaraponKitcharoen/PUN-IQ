import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

const ALL_GRADES = [
  'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6',
  'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6',
  'ปี 1', 'ปี 2', 'ปี 3', 'ปี 4'
];

export default function ManagePrice() {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [activeTab, setActiveTab] = useState('General');

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pricing_rates')
      .select('*');

    if (!error && data) {
      const expectedTypes = ['General', 'Advanced'];
      let completeRates = [];

      expectedTypes.forEach(type => {
        ALL_GRADES.forEach(grade => {
          const existingRow = data.find(r => r.grade_level === grade && r.rate_type === type);
          if (existingRow) {
            completeRates.push(existingRow);
          } else {
            completeRates.push({
              id: `temp_${type}_${grade}`,
              grade_level: grade,
              rate_type: type,
              student_hourly_rate: 0,
              tutor_hourly_rate: 0,
              isNew: true
            });
          }
        });
      });

      setRates(completeRates);
    }
    setLoading(false);
  };

  const handleRateChange = (id, field, value) => {
    setRates(prevRates => prevRates.map(rate =>
      rate.id === id ? { ...rate, [field]: value === '' ? '' : Number(value) } : rate
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      // 🔴 1. แยกกองข้อมูลเก่าที่มี ID จริงๆ ออกมา
      const existingRates = rates
        .filter(rate => !rate.isNew && !String(rate.id).startsWith('temp_'))
        .map(rate => ({
          id: rate.id,
          grade_level: rate.grade_level,
          rate_type: rate.rate_type,
          student_hourly_rate: Number(rate.student_hourly_rate),
          tutor_hourly_rate: Number(rate.tutor_hourly_rate),
          updated_at: new Date().toISOString()
        }));

      // 🔴 2. แยกกองข้อมูลใหม่ที่เพิ่งจำลองขึ้นมา (ปี 1 - 4) ไม่ต้องส่ง ID ไป
      const newRates = rates
        .filter(rate => rate.isNew || String(rate.id).startsWith('temp_'))
        .map(rate => ({
          grade_level: rate.grade_level,
          rate_type: rate.rate_type,
          student_hourly_rate: Number(rate.student_hourly_rate),
          tutor_hourly_rate: Number(rate.tutor_hourly_rate),
          updated_at: new Date().toISOString()
        }));

      // 🔴 3. สั่งอัปเดตข้อมูลเก่า
      if (existingRates.length > 0) {
        const { error: updateError } = await supabase.from('pricing_rates').upsert(existingRates);
        if (updateError) throw updateError;
      }

      // 🔴 4. สั่งสร้างข้อมูลใหม่ 
      if (newRates.length > 0) {
        const { error: insertError } = await supabase.from('pricing_rates').insert(newRates);
        if (insertError) throw insertError;
      }

      setMessage('✅ บันทึกเรทราคาสำเร็จ! ข้อมูลทั้งหมดถูกอัปเดตลงระบบเรียบร้อยแล้ว');
      fetchRates();
    } catch (error) {
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const filteredRates = rates.filter(rate => rate.rate_type === activeTab);

  if (loading) return <div className="p-10 text-center text-gray-500 animate-pulse">กำลังโหลดข้อมูลราคา...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">จัดการเรทราคา (Manage Price)</h1>
          <p className="text-gray-500 mt-1">กำหนดเรทราคาเก็บนักเรียนและจ่ายคุณครูแยกตามระดับชั้น</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-6 rounded-lg transition shadow-sm disabled:opacity-50 text-sm"
        >
          {saving ? 'กำลังบันทึก...' : '💾 บันทึกราคาทั้งหมด'}
        </button>
      </div>

      <div className="mb-6 flex justify-center sm:justify-start">
        <div className="bg-gray-200/80 p-1 rounded-xl flex space-x-1 border border-gray-300 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('General')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'General'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100/50'
              }`}
          >
            📚 Normal Rate (ทั่วไป)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('Advanced')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'Advanced'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100/50'
              }`}
          >
            ✨ Advance Rate (แอดวานซ์)
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-semibold shadow-sm border ${message.includes('สำเร็จ') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
          }`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-700">
            <tr>
              <th className="p-4 font-bold text-center w-32">ระดับชั้น</th>
              <th className="p-4 font-bold">ราคาเก็บนักเรียน (บาท/ชม.)</th>
              <th className="p-4 font-bold">ราคาจ่ายคุณครู (บาท/ชม.)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRates.map(rate => (
              <tr key={rate.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="p-4 font-bold text-gray-800 text-center bg-gray-50/50 border-r border-gray-100">
                  {rate.grade_level}
                </td>
                <td className="p-4">
                  <div className="relative max-w-xs">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 font-medium">฿</span>
                    <input
                      type="number"
                      min="0"
                      value={rate.student_hourly_rate}
                      onChange={(e) => handleRateChange(rate.id, 'student_hourly_rate', e.target.value)}
                      className={`w-full pl-8 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-800 font-medium ${activeTab === 'Advanced' ? 'border-purple-200 focus:ring-purple-500' : 'border-gray-300 focus:ring-blue-500'
                        }`}
                    />
                  </div>
                </td>
                <td className="p-4">
                  <div className="relative max-w-xs">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 font-medium">฿</span>
                    <input
                      type="number"
                      min="0"
                      value={rate.tutor_hourly_rate}
                      onChange={(e) => handleRateChange(rate.id, 'tutor_hourly_rate', e.target.value)}
                      className={`w-full pl-8 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-800 font-medium ${activeTab === 'Advanced' ? 'border-purple-200 focus:ring-purple-500' : 'border-gray-300 focus:ring-blue-500'
                        }`}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}