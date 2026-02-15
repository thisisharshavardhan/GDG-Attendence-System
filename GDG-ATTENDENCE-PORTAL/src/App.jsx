import { Routes, Route, Navigate } from 'react-router-dom'

// Route Protection Components
import ProtectedRoute from './components/ProtectedRoute'
import PublicRoute from './components/PublicRoute'
import RoleBasedRoute from './components/RoleBasedRoute'
import AppLayout from './components/AppLayout'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NotFound from './pages/NotFound'

// Admin pages
import ManageMembers from './pages/admin/ManageMembers'
import ManageMeetings from './pages/admin/ManageMeetings'
import GenerateQR from './pages/admin/GenerateQR'
import Reports from './pages/admin/Reports'

// PR pages
import SelectMeeting from './pages/pr/SelectMeeting'
import DisplayQR from './pages/pr/DisplayQR'
import DisplayLink from './pages/pr/DisplayLink'

// Member pages
import ScanQR from './pages/member/ScanQR'
import AttendanceSuccess from './pages/member/AttendanceSuccess'
import AttendOnline from './pages/member/AttendOnline'

function App() {
  return (
    <Routes>
      {/* Public routes - no app shell */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

      {/* Authenticated routes — wrapped in Google-style AppLayout */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        {/* Dashboard - all authenticated users */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Admin routes */}
        <Route
          path="/admin/members"
          element={<RoleBasedRoute allowedRoles={['admin']}><ManageMembers /></RoleBasedRoute>}
        />
        <Route
          path="/admin/meetings"
          element={<RoleBasedRoute allowedRoles={['admin']}><ManageMeetings /></RoleBasedRoute>}
        />
        <Route
          path="/admin/generate-qr"
          element={<RoleBasedRoute allowedRoles={['admin']}><GenerateQR /></RoleBasedRoute>}
        />
        <Route
          path="/admin/reports"
          element={<RoleBasedRoute allowedRoles={['admin']}><Reports /></RoleBasedRoute>}
        />

        {/* PR routes */}
        <Route
          path="/pr/select-meeting"
          element={<RoleBasedRoute allowedRoles={['pr', 'admin']}><SelectMeeting /></RoleBasedRoute>}
        />
        <Route
          path="/pr/display-qr/:meetingId"
          element={<RoleBasedRoute allowedRoles={['pr', 'admin']}><DisplayQR /></RoleBasedRoute>}
        />
        <Route
          path="/pr/display-link/:meetingId"
          element={<RoleBasedRoute allowedRoles={['pr', 'admin']}><DisplayLink /></RoleBasedRoute>}
        />

        {/* Member routes */}
        <Route path="/member/scan-qr" element={<ScanQR />} />
        <Route path="/member/attendance-success" element={<AttendanceSuccess />} />
        <Route path="/attend/:token" element={<AttendOnline />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
