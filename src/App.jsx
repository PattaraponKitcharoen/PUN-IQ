import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';

import Login from './pages/auth/Login';
import ResetPassword from './pages/auth/ResetPassword';
import AdminLayout from './pages/admin/AdminLayout'; 
import TutorLayout from './pages/tutor/TutorLayout';
import StudentDashboard from './pages/student/StudentDashboard';
import ParentLayout from './pages/parent/ParentLayout';

const NotFound = () => <div className="p-10 text-xl font-bold text-gray-500">404 - ไม่พบหน้านี้</div>;

// ยามเฝ้าประตู (Protected Route)
const ProtectedRoute = ({ children, allowedRole }) => {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  
  const currentUserId = useRef(null);

  // ตรวจสอบบัตร: ทุกบทบาทล็อกอินผ่าน Supabase Auth แล้วอ่าน role จากตาราง users
  const handleSession = async (session) => {
    if (!session) {
      setAuthenticated(false);
      setUserRole(null);
      currentUserId.current = null;
      return;
    }
    
    setAuthenticated(true);

    if (currentUserId.current === session.user.id) return;

    try {
      const { data: userData, error } = await supabase
        .from('users').select('role').eq('id', session.user.id).single();
      
      if (error || !userData) {
        await supabase.auth.signOut();
        setAuthenticated(false);
        setUserRole(null);
        currentUserId.current = null;
        return;
      }
      
      setUserRole(userData.role);
      currentUserId.current = session.user.id;
    } catch {
      await supabase.auth.signOut();
      setAuthenticated(false);
      currentUserId.current = null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    // 1. ตรวจสอบสิทธิ์ทันทีที่โหลดหน้า
    const checkAuth = async () => {
      // session แบบเก่าของเด็ก/ผู้ปกครอง (เก็บในเครื่อง) ใช้ไม่ได้แล้ว — ลบทิ้ง ให้ล็อกอินใหม่ 1 ครั้ง
      localStorage.removeItem('custom_user_session');

      const { data: { session } } = await supabase.auth.getSession();

      if (isMounted) {
        await handleSession(session);
        setLoading(false);
      }
    };
    checkAuth();

    // 2. ดักฟังการเปลี่ยนแปลงของ Supabase Auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setAuthenticated(false);
          setUserRole(null);
          currentUserId.current = null;
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

  // 3. ตรวจสอบ Role ซ้ำทุกๆ 5 นาที
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentId = session?.user?.id;
      if (!currentId) return;
      
      const { data: userData } = await supabase
        .from('users').select('role').eq('id', currentId).single();
      
      // ถ้าโดนลบบัญชีทิ้ง ให้เตะออก
      if (!userData) {
        await supabase.auth.signOut();
        window.location.href = '/login';
        return;
      }
      
      // ถ้าสิทธิ์เปลี่ยน ให้พากลับไปหน้าที่ถูก
      if (allowedRole && userData.role !== allowedRole) {
        window.location.href = userData.role === 'admin' 
          ? '/admin' 
          : userData.role === 'tutor' 
            ? '/tutor' 
            : userData.role === 'parent'
              ? '/parent'
              : '/student';
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [allowedRole]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...</div>;
  if (!authenticated) return <Navigate to="/login" replace />;
  
  if (allowedRole && userRole !== allowedRole) {
     return <Navigate to={
       userRole === 'admin' ? '/admin/dashboard' : 
       userRole === 'tutor' ? '/tutor/timelog' : 
       userRole === 'parent' ? '/parent' : 
       '/student'
     } replace />;
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

        {/* โซนผู้ปกครอง (แก้ให้มี /* ตามหลังเพื่อเรียก Layout ที่มีเมนู) */}
        <Route 
          path="/parent/*" 
          element={
            <ProtectedRoute allowedRole="parent">
               <ParentLayout />
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