import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // ตั้งค่า CORS ให้ React เรียกใช้งานได้
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    
    // 1. สร้าง Client ธรรมดาเพื่อเช็คว่าคนที่เรียก API นี้คือใคร
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader?.replace('Bearer ', ''))
    if (authError || !user) throw new Error('Unauthorized')

    // 2. ตรวจสอบว่าคนเรียกมีสิทธิ์เป็น 'admin' หรือไม่
    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (userData?.role !== 'admin') throw new Error('Forbidden: Admins only')

    // 3. 🔴 เรียกใช้ Service Role Key อย่างปลอดภัยบน Server เท่านั้น
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { email, password, name, username, role, phone, grade } = await req.json()

    // 4. สร้างบัญชีผู้ใช้ใหม่
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })
    if (createError) throw createError

    // 5. บันทึกข้อมูลลงตาราง users
    const { error: insertError } = await supabaseAdmin.from('users').insert([{
       id: authData.user.id, email, name, username, role, phone, grade
    }])
    if (insertError) throw insertError

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})