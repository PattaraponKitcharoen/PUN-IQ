import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 1. ตรวจสอบสิทธิ์การเป็น Admin ผู้เรียกใช้งาน
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) throw new Error('Unauthorized')

    const { data: callerData } = await supabase
      .from('users').select('role').eq('id', user.id).single()
      
    if (callerData?.role !== 'admin') throw new Error('Forbidden: Admin only')

    // 2. เรียกใช้สิทธิ์สูงสุด Service Role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 🔴 ปรับปรุงจุดที่ 1: เพิ่มตัวแปรธนาคารทั้ง 3 ตัวเข้าไปในวงรับข้อมูลจาก req.json()
    const { 
      targetUserId, 
      email, 
      name, 
      username, 
      phone, 
      grade, 
      company_account_id, 
      qr_code_url,
      bank_name,
      account_name,
      account_number
    } = await req.json()

    if (!targetUserId) throw new Error('ไม่พบข้อมูลไอดีผู้ใช้งานที่ต้องการแก้ไข')

    // 3. ดึงข้อมูลอีเมลปัจจุบันของยูสเซอร์คนนี้มาตรวจสอบก่อน
    const { data: currentUserData, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', targetUserId)
      .single()

    if (fetchError) throw new Error('ไม่พบข้อมูลผู้ใช้งานนี้ในระบบตารางหลัก')

    // 4. ลоจิกจัดการระบบอีเมล: ตรวจสอบการเปลี่ยนแปลงและดักจับข้อมูลซ้ำซ้อน
    if (email && email.toLowerCase() !== currentUserData.email?.toLowerCase()) {
      
      const { data: emailCheck } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (emailCheck) {
        throw new Error('อีเมลใหม่นี้ถูกใช้งานโดยผู้ใช้อื่นในระบบแล้ว ไม่สามารถเปลี่ยนซ้ำได้')
      }

      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUserId, 
        { email: email, email_confirm: true }
      )
      if (updateAuthError) throw new Error(`เปลี่ยนอีเมลในระบบล็อกอินหลักไม่สำเร็จ: ${updateAuthError.message}`)
    }

    // 5. จัดเตรียมข้อมูลเพื่ออัปเดตลงตาราง public.users ตามปกติ
    const updatePayload: any = {}
    if (name) updatePayload.name = name
    if (username) updatePayload.username = username
    if (email) updatePayload.email = email 
    if (phone !== undefined) updatePayload.phone = phone
    if (grade !== undefined) updatePayload.grade = grade
    if (company_account_id !== undefined) {
      updatePayload.company_account_id = company_account_id === '' ? null : company_account_id;
    }
    if (qr_code_url !== undefined) updatePayload.qr_code_url = qr_code_url
    
    // 🔴 ปรับปรุงจุดที่ 2: ผูกข้อมูลธนาคารเข้า Payload เพื่อสั่งอัปเดตลงตาราง users
    if (bank_name !== undefined) updatePayload.bank_name = bank_name
    if (account_name !== undefined) updatePayload.account_name = account_name
    if (account_number !== undefined) updatePayload.account_number = account_number

    const { error: dbError } = await supabaseAdmin
      .from('users').update(updatePayload).eq('id', targetUserId)
      
    if (dbError) throw dbError

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
    })
  }
})