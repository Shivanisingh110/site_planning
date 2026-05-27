import React from 'react';
import { User, Calendar, RefreshCw, LogOut, HardHat, Search, X } from 'lucide-react';

interface HeaderProps {
  currentEmail: string;
  currentRole: string;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onSync: () => void;
  isSyncing: boolean;
  onLogout: () => void;
}

export default function Header({ 
  currentEmail, 
  currentRole, 
  searchTerm, 
  setSearchTerm,
  onSync,
  isSyncing,
  onLogout
}: HeaderProps) {
  // Get formatted current date
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // Determine if the user is a field doer / supervisor
  const isDoerOrSupervisor = 
    currentRole === 'Site Supervisor' || 
    ['ganesh', 'suraj', 'mangesh', 'sunil'].some(name => 
      String(currentEmail || '').toLowerCase().includes(name)
    );

  return (
    <header className="sticky top-0 z-45 flex h-16 w-full items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm md:px-6">
      
      {/* LEFT: Company Logo, Dashboard Title & Current Date */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
          <HardHat className="h-5.5 w-5.5" />
        </div>
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-wider uppercase text-indigo-700">REMIX Enterprise</span>
            <span className="h-1 w-1 rounded-full bg-gray-300"></span>
            <span className="text-[10px] font-bold text-gray-400">v4.2</span>
          </div>
          <h1 className="text-sm font-black tracking-tight text-gray-900 sm:text-base">
            Site Planning Dashboard
          </h1>
        </div>
        <div className="hidden h-5 w-[1px] bg-gray-200 sm:block"></div>
        <div className="hidden items-center gap-1 text-2xs font-bold text-gray-500 sm:flex">
          <Calendar className="h-3 w-3 text-indigo-500" />
          <span>{today}</span>
        </div>
      </div>

      {/* CENTER: Empty spacing since top search bar is removed as requested */}
      <div className="mx-4 hidden max-w-sm flex-1 md:block"></div>

      {/* RIGHT: Notifications, Sync, Profile & Logout */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Sync Button (Not available to supervisors/doers) */}
        {!isDoerOrSupervisor && (
          <button
            onClick={onSync}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 hover:shadow-xs transition cursor-pointer ${
              isSyncing ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            title="Sync sheet database with Google Sheets"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-indigo-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>
        )}

        {/* Divider */}
        <div className="h-5 w-[1px] bg-gray-200"></div>

        {/* User Card */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 font-extrabold text-xs">
            {currentEmail ? currentEmail.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="hidden max-w-[120px] leading-tight text-left lg:block">
            <p className="truncate text-xs font-bold text-gray-800" title={currentEmail}>
              {currentEmail || 'Anonymous'}
            </p>
            <p className="text-[9px] font-black tracking-widest text-indigo-600 uppercase">
              {currentRole || 'Guest'}
            </p>
          </div>
        </div>

        {/* Logout Button */}
        <button 
          onClick={onLogout}
          className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100 hover:text-red-700 transition cursor-pointer"
          title="Logout of site session"
          id="btn-logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
