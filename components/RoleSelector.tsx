import React, { useState } from 'react';
import { signInWithGoogle } from '../services/supabaseService';

export const RoleSelector: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      await signInWithGoogle();
      // The OAuth flow will redirect, so we don't need to handle the response here
    } catch (error) {
      console.error('Failed to sign in with Google:', error);
      alert('Failed to sign in with Google. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        
        <div className="bg-iim-green p-8 md:w-2/5 flex flex-col justify-center text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
          <h2 className="text-3xl font-bold mb-4 relative z-10">IIM Lucknow</h2>
          <p className="text-green-100 mb-8 relative z-10">Gate Entry Management System</p>
          <div className="border-t border-green-700 pt-6 mt-auto relative z-10">
            <p className="text-xs text-green-300">Secure • Efficient • Digital</p>
          </div>
        </div>

        <div className="p-8 md:w-3/5">
          <h3 className="text-xl font-bold text-slate-800 mb-6">Sign In</h3>
          
          {/* Google OAuth Login Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 p-4 mb-6 bg-white border-2 border-slate-300 rounded-xl hover:border-iim-green hover:bg-green-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="font-medium text-slate-700">
              {isLoading ? 'Signing in...' : 'Sign in with Google'}
            </span>
          </button>

          <p className="text-sm text-slate-500 text-center">
            Use your IIML Google account to access your dashboard. You will be automatically routed based on your role.
          </p>
        </div>

      </div>
    </div>
  );
};
