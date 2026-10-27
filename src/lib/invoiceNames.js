// ชื่อที่แสดงในบิลนักเรียน: "SPIQH001 - สมชาย" (ไม่มีชื่อ = ใช้รหัสอย่างเดียว)
export const getStudentDisplayName = (student) => {
  const code = student?.username || '';
  const name = student?.name || '';
  if (code && name) return `${code} - ${name}`;
  return code || name;
};

// ชื่อไฟล์บิลนักเรียน: Invoice_SPIQH001-สมชาย_2026-10 (ตัดอักขระที่ใช้ในชื่อไฟล์ไม่ได้ออก)
export const getInvoiceFileBase = (student, billingMonth) => {
  const code = student?.username || '';
  const name = student?.name || '';
  const label = [code, name].filter(Boolean).join('-');
  const safe = label.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  return `Invoice_${safe}_${billingMonth}`;
};
