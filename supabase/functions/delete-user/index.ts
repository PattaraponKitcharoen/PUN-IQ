import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// 🔴 บล็อกหัวใจสำคัญ: ตั้งค่า CORS เพื่ออนุญาตให้ Frontend (localhost/Vercel) ยิงเข้าหลังบ้านได้
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // ดักจับจังหวะที่เบราว์เซอร์ยิงมาตรวจสอบความปลอดภัย (Preflight request)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const { userId } = await req.json()

    if (!userId) {
      throw new Error('กรุณาระบุ userId ที่ต้องการลบ')
    }

    // 🔴 สเต็ปที่ 1: ลบข้อมูลในตาราง public.users ก่อน (เพื่อเคลียร์สายสัมพันธ์ Foreign Key)
    const { error: dbError } = await supabaseClient
      .from('users')
      .delete()
      .eq('id', userId)

    if (dbError) throw new Error(`ลบข้อมูลในตารางไม่สำเร็จ: ${dbError.message}`)

    // 🔴 สเต็ปที่ 2: ค่อยลบบัญชีหลักในระบบ Auth
    const { data, error: authError } = await supabaseClient.auth.admin.deleteUser(userId)

    if (authError) throw new Error(`ลบบัญชีล็อกอินไม่สำเร็จ: ${authError.message}`)

    return new Response(
      JSON.stringify({ message: 'ลบบัญชีผู้ใช้สำเร็จ', data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 400 
      }
    )
  }
})