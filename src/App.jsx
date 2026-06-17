import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// 🔴 1. นำเข้า useRef เพิ่มเติมเพื่อใช้เป็นหน่วยความจำ
import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';

import Login from './pages/auth/Login';
import ResetPassword from './pages/auth/ResetPassword';
import AdminLayout from './pages/admin/AdminLayout'; 
import TutorLayout from './pages/tutor/TutorLayout';
import StudentDashboard from './pages/student/StudentDashboard';

const NotFound = () => <div className="p-10 text-xl font-bold text-gray-500">404 - ไม่พบหน้านี้</div>;

// ยามเฝ้าประตู (Protected Route)
const ProtectedRoute = ({ children, allowedRole }) => {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  
  // 🔴 2. สร้างตัวแปรจำ ID ผู้ใช้ เพื่อกันการโหลดซ้ำซ้อน
  const currentUserId = useRef(null);

  useEffect(() => {
    let isMounted = true;

    // 1. ตรวจสอบสิทธิ์ทันทีที่โหลดหน้า
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (isMounted) {
        await handleSession(session);
        setLoading(false);
      }
    };
    checkAuth();

    // 2. ดักฟังการเปลี่ยนแปลง (เช่น โดนเตะออก หรือหมดเวลา)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setAuthenticated(false);
          setUserRole(null);
          currentUserId.current = null; // ล้างความจำเมื่อออกจากระบบ
          setLoading(false);
        } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          await handleSession(session);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // เพิ่มกลไกตรวจสอบ Role ซ้ำทุกๆ 5 นาที ป้องกันการค้าง Session เมื่อแอดมินเปลี่ยนสิทธิ์
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: userData } = await supabase
        .from('users').select('role').eq('id', session.user.id).single();
      
      if (!userData) {
        await supabase.auth.signOut();
        window.location.href = '/login';
        return;
      }
      
      if (allowedRole && userData.role !== allowedRole) {
        // ถ้าระหว่างใช้งานอยู่โดนเปลี่ยน Role ให้เตะกลับไปหน้าที่ถูกต้องทันที
        window.location.href = userData.role === 'admin' 
          ? '/admin' 
          : userData.role === 'tutor' 
            ? '/tutor' 
            : '/student';
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [allowedRole]);

  // 🔴 3. ปรับปรุง handleSession ให้เช็คความจำก่อนดึงข้อมูล DB เสมอ
  const handleSession = async (session) => {
    if (!session) {
      setAuthenticated(false);
      setUserRole(null);
      currentUserId.current = null;
      return;
    }
    
    setAuthenticated(true);
    
    // 🔴 Guard Clause: ถ้ารู้จัก User คนนี้แล้ว ให้ข้ามการดึง Database ไปเลย!
    if (currentUserId.current === session.user.id) {
      return;
    }

    try {
      const { data: userData, error } = await supabase
        .from('users').select('role').eq('id', session.user.id).single();
      
      if (error || !userData) {
        console.error('Failed to fetch user role:', error);
        await supabase.auth.signOut();
        setAuthenticated(false);
        setUserRole(null);
        currentUserId.current = null;
        return;
      }
      
      setUserRole(userData.role);
      currentUserId.current = session.user.id; // บันทึกความจำไว้ว่าโหลด Role คนนี้เสร็จแล้ว
    } catch (err) {
      console.error('Session validation error:', err);
      await supabase.auth.signOut();
      setAuthenticated(false);
      currentUserId.current = null;
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...</div>;
  if (!authenticated) return <Navigate to="/login" replace />;
  if (allowedRole && userRole !== allowedRole) {
     return <Navigate to={userRole === 'admin' ? '/admin/dashboard' : userRole === 'tutor' ? '/tutor/timelog' : '/student'} replace />;
  }
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* โซนสาธารณะ */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* โซนคุณครู */}
        <Route 
          path="/tutor/*" 
          element={
            <ProtectedRoute allowedRole="tutor">
              <TutorLayout />
            </ProtectedRoute>
          } 
        />

        {/* โซนแอดมิน */}
        <Route 
          path="/admin/*" 
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          } 
        />

        {/* โซนนักเรียน */}
        <Route 
          path="/student" 
          element={
            <ProtectedRoute allowedRole="student">
              <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
                <StudentDashboard />
              </div>
            </ProtectedRoute>
          } 
        />

        {/* โซน Error */}
        <Route path="/unauthorized" element={<div className="p-10 text-2xl font-bold text-red-500 text-center mt-20">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;