import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
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

    // 🔴 1. ลบข้อมูลในตาราง public.users ก่อนเพื่อเคลียร์หน้าเว็บ
    const { error: dbError } = await supabaseClient
      .from('users')
      .delete()
      .eq('id', userId)

    if (dbError) throw new Error(`ลบข้อมูลในตารางไม่สำเร็จ: ${dbError.message}`)

    // 🔴 2. พยายามลบบัญชีหลักในระบบ Auth
    const { error: authError } = await supabaseClient.auth.admin.deleteUser(userId)

    // 🔴 3. ลอจิกพระเอก: ถ้าลบ Auth ไม่ผ่านเพราะ "หาไม่เจอ" ให้ถือว่าสำเร็จไปเลย!
    if (authError) {
      if (authError.message.toLowerCase().includes('not found')) {
        console.log('ผู้ใช้นี้ไม่มีในระบบ Auth อยู่แล้ว ข้ามการลบ Auth...')
      } else {
        // แต่ถ้าพังเพราะสาเหตุอื่น ให้ฟ้อง Error ตามปกติ
        throw new Error(`ลบบัญชีล็อกอินไม่สำเร็จ: ${authError.message}`)
      }
    }

    return new Response(
      JSON.stringify({ message: 'ลบบัญชีผู้ใช้สำเร็จ' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})