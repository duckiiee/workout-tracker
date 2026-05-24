import { Navigate, Route, Routes } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ExerciseList from './pages/ExerciseList';
import Profile from './pages/Profile';
import Statistics from './pages/Statistics';
import WorkoutSchedule from './pages/WorkoutSchedule';

export default function App() {
  return (
    <div className="relative flex min-h-screen bg-[#F5F5F7] text-gray-900">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(52,211,153,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_left,_rgba(56,189,248,0.1),_transparent_50%),radial-gradient(ellipse_at_center,_rgba(255,255,255,0.8),_transparent_70%)]"
        aria-hidden
      />

      <Sidebar />

      <main className="relative flex flex-1 flex-col overflow-hidden">
        <header className="glass-header flex h-16 shrink-0 items-center px-10">
          <p className="text-sm font-medium text-gray-500">
            Chào mừng trở lại —{' '}
            <span className="font-semibold text-gray-900">sẵn sàng tập hôm nay?</span>
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-10 py-10">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/schedule" element={<WorkoutSchedule />} />
            <Route path="/exercises" element={<ExerciseList />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
