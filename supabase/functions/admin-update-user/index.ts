import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // 🔴 1. ปรับปรุง CORS ให้รองรับทุกโดเมน ('*') และเพิ่ม Allow-Methods ป้องกันเบราว์เซอร์บล็อก
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  // 🔴 2. ตอบกลับ Preflight Request เพื่อเปิดทางให้คำสั่ง POST วิ่งเข้ามาได้
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. ตรวจสอบว่าผู้เรียกเป็น Admin จริงหรือไม่
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

    // 2. ใช้ Service Role Key อย่างปลอดภัยบน Server เท่านั้น
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { targetUserId, email, name, username, phone, grade, company_account_id } = await req.json()

    // 3. อัปเดตอีเมลใน Auth (ถ้ามีการเปลี่ยน)
    if (email) {
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUserId, { email, email_confirm: true }
      )
      if (updateAuthError) throw updateAuthError
    }

    // 4. อัปเดตข้อมูลในตาราง users
    const updatePayload: any = {}
    if (name) updatePayload.name = name
    if (username) updatePayload.username = username
    if (email) updatePayload.email = email
    if (phone !== undefined) updatePayload.phone = phone
    if (grade !== undefined) updatePayload.grade = grade
    
    // จัดการข้อมูลบัญชีธนาคาร (ถ้าเคลียร์ค่าว่างให้เปลี่ยนเป็น null ป้องกัน Foreign key error)
    if (company_account_id !== undefined) {
      updatePayload.company_account_id = company_account_id === '' ? null : company_account_id;
    }

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