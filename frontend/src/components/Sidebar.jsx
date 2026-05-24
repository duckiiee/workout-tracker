import { useState } from 'react';
import { NavLink } from 'react-router-dom';
const navItems = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    to: '/schedule',
    label: 'Lịch tập',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    to: '/exercises',
    label: 'Bài tập',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path d="M6.5 6.5h11v11H6.5z" />
        <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
      </svg>
    ),
  },
  {
    to: '/statistics',
    label: 'Thống kê',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path d="M3 3v18h18" />
        <path d="M7 16l4-6 4 3 5-8" />
      </svg>
    ),
  },
  {
    to: '/profile',
    label: 'Hồ sơ',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
      </svg>
    ),
  },
];
export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <aside 
      className={`glass-sidebar relative z-10 flex shrink-0 flex-col transition-all duration-300 ease-in-out ${
        isOpen ? 'w-64' : 'w-20'
      }`}
    >
      {/* Nút Toggle nằm ngay trên thành Sidebar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute -right-3 top-8 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:text-gray-900 hover:shadow-md"
      >
        {isOpen ? (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
          </svg>
        ) : (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>

      {/* Header */}
      <div className="border-b border-gray-300 px-6 py-8 overflow-hidden whitespace-nowrap">
        <p className={`page-kicker ${!isOpen && 'hidden'}`}>FitTrack</p>
        {isOpen && (
          <h1 className="mt-2 text-xl font-bold tracking-tight text-gray-900">
            Workout<span className="font-medium text-gray-400"> Pro</span>
          </h1>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-2 p-4">
        {navItems.map((item) => (
          <NavLink 
            key={item.to} 
            to={item.to} 
            className={({ isActive }) => 
              `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                isActive 
                  ? 'bg-gray-900/90 text-white shadow-md' 
                  : 'text-gray-500 hover:bg-white/50 hover:text-gray-900'
              } ${!isOpen && 'justify-center px-0'}`
            }
          >
            {item.icon}
            {isOpen && <span className="whitespace-nowrap">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Version footer */}
      <div className="border-t border-gray-300 p-4">
        <div className="glass-inset p-3 text-center">
          {isOpen ? (
            <>
              <p className="text-xs font-medium text-gray-500">Phiên bản</p>
              <p className="mt-0.5 text-xs font-semibold text-gray-900">v1.0 — Beta</p>
            </>
          ) : (
            <p className="text-xs font-bold text-gray-400">v1</p>
          )}
        </div>
      </div>
    </aside>
  );
}