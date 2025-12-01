import React from 'react';
import { User, UserRole } from '../types';

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ user, onLogout, children }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Sidebar / Topbar */}
      <aside className="bg-iim-green text-white w-full md:w-64 md:fixed md:inset-y-0 md:left-0 flex-shrink-0 flex flex-col shadow-xl">
        <div className="p-6 flex items-center gap-3 border-b border-green-800">
          <div className="bg-white p-1 rounded-full">
            <div className="h-8 w-8 bg-iim-green rounded-full flex items-center justify-center font-bold text-xs">
              IIML
            </div>
          </div>
          <h1 className="text-xl font-bold tracking-tight">GateKeeper</h1>
        </div>
        
        <div className="p-6 flex-grow">
          <div className="mb-8">
            <p className="text-green-200 text-xs uppercase tracking-wider font-semibold mb-2">Current User</p>
            {user ? (
              <div className="flex items-center gap-3">
                 <div className="h-10 w-10 rounded-full bg-green-700 flex items-center justify-center text-lg font-bold shadow-inner">
                   {user.name.charAt(0)}
                 </div>
                 <div>
                   <p className="font-medium text-sm">{user.name}</p>
                   <p className="text-xs text-green-300">{user.role.replace('_', ' ')}</p>
                 </div>
              </div>
            ) : (
              <p className="text-sm opacity-50">Not logged in</p>
            )}
          </div>

          <nav className="space-y-2">
            <div className="block px-4 py-2 bg-green-800/50 rounded-lg text-sm font-medium border-l-4 border-iim-gold">
              Dashboard
            </div>
            {/* Future nav items could go here */}
          </nav>
        </div>

        <div className="p-4 border-t border-green-800">
          <button 
            onClick={onLogout}
            className="flex items-center gap-2 text-sm text-green-100 hover:text-white transition-colors w-full px-4 py-2 hover:bg-green-800 rounded-lg"
          >
            <i className="fa-solid fa-right-from-bracket"></i>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-4 md:p-8 overflow-y-auto md:ml-64">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
