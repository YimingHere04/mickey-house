/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { supabase, IS_DEMO_MODE } from '../lib/supabase';
import { Home, Mail, Lock, User, ShieldCheck, Zap } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formattedUserId = userId.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_-]+$/.test(formattedUserId)) {
      setError('User ID must contain only letters, numbers, underscores (_), or hyphens (-). No spaces allowed.');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const { error: signUpErr } = await supabase.auth.signUp({
          userId: formattedUserId,
          email: `${formattedUserId}@house.com`,
          password,
          options: {
            data: {
              name: name || formattedUserId,
              role,
            },
          },
        });
        if (signUpErr) throw signUpErr;
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          userId: formattedUserId,
          email: `${formattedUserId}@house.com`,
          password,
        });
        if (signInErr) throw signInErr;
      }
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  // Quick Switch logins for preview
  const handleQuickLogin = async (username: string) => {
    setLoading(true);
    setError(null);
    try {
      if (IS_DEMO_MODE) {
        // Direct set in demo mode for instant login
        const { data: usersData } = await supabase.from('profiles').select('*');
        const found = usersData?.find((u: any) => 
          u.id.toLowerCase() === username.toLowerCase() || 
          u.email.toLowerCase() === username.toLowerCase() ||
          u.email.split('@')[0].toLowerCase() === username.toLowerCase()
        );
        if (found) {
          supabase.auth.setDemoUser(found);
          onLoginSuccess();
          return;
        }
      }
      
      // Fallback or production real sign-in
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        userId: username,
        email: username.includes('@') ? username : `${username}@house.com`,
        password: 'password123', // Demo accounts share a dummy password
      });
      if (signInErr) throw signInErr;
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Quick login failed. Ensure demo mode is active or user profile exists.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-6">
      {/* Header Info */}
      <div className="flex flex-col items-center mt-8 text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 text-white mb-4">
          <Home className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Mickey House</h1>
        <p className="text-sm text-slate-500 mt-1">Shared House Expense & Utility Manager</p>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-md mx-auto my-auto bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex border-b border-slate-100 pb-4 mb-6">
          <button
            onClick={() => { setIsSignUp(false); setError(null); }}
            className={`flex-1 text-center py-2 text-sm font-semibold transition-colors duration-200 ${
              !isSignUp ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'
            }`}
            id="login-tab-btn"
          >
            Sign In
          </button>
          <button
            onClick={() => { setIsSignUp(true); setError(null); }}
            className={`flex-1 text-center py-2 text-sm font-semibold transition-colors duration-200 ${
              isSignUp ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'
            }`}
            id="signup-tab-btn"
          >
            Register
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 text-xs rounded-xl p-3 mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ahmad Fauzi"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700 placeholder-slate-400"
                    id="signup-name-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Email</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    disabled
                    value={userId.trim() ? `${userId.trim().toLowerCase()}@house.com` : ''}
                    placeholder="Will be generated from User ID"
                    className="w-full pl-10 pr-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">System Access Role</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('member')}
                    className={`py-3 px-4 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                      role === 'member'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-600'
                        : 'border-slate-100 bg-slate-50 text-slate-500'
                    }`}
                    id="role-member-btn"
                  >
                    <User className="w-4 h-4" />
                    Member
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    className={`py-3 px-4 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                      role === 'admin'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-600'
                        : 'border-slate-100 bg-slate-50 text-slate-500'
                    }`}
                    id="role-admin-btn"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Admin
                  </button>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">User ID</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                required
                placeholder="e.g. ahmad123"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700 placeholder-slate-400"
                id="userid-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700 placeholder-slate-400"
                id="password-input"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold tracking-wide shadow-lg shadow-blue-500/15 active:scale-[0.98] transition-all disabled:bg-blue-400 flex items-center justify-center gap-2 mt-2 cursor-pointer h-12"
            id="submit-auth-btn"
          >
            {loading ? 'Authenticating...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>
      </div>

      {/* Demo quick toggle accounts (Very convenient for app preview) */}
      <div className="w-full max-w-md mx-auto mt-6 bg-slate-100/80 rounded-2xl p-4 border border-slate-200/50">
        <div className="flex items-center gap-1.5 text-slate-600 font-semibold text-xs mb-3 uppercase tracking-wider">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span>Demo Quick Access (Local Simulator)</span>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => handleQuickLogin('Admin')}
            className="w-full flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200/60 hover:border-blue-300 transition-all text-left group cursor-pointer"
            id="demo-login-admin"
          >
            <div>
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <span>Admin</span>
                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[9px] font-semibold">ADMIN</span>
              </p>
              <p className="text-[10px] text-slate-400">User ID: Admin</p>
            </div>
            <span className="text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">Tap to enter &rarr;</span>
          </button>
 
          <button
            type="button"
            onClick={() => handleQuickLogin('user1')}
            className="w-full flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200/60 hover:border-blue-300 transition-all text-left group cursor-pointer"
            id="demo-login-member-1"
          >
            <div>
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <span>Hong</span>
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-semibold">Member</span>
              </p>
              <p className="text-[10px] text-slate-400">User ID: user1</p>
            </div>
            <span className="text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">Tap to enter &rarr;</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickLogin('user2')}
            className="w-full flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200/60 hover:border-blue-300 transition-all text-left group cursor-pointer"
            id="demo-login-member-2"
          >
            <div>
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <span>Yiming</span>
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-semibold">Member</span>
              </p>
              <p className="text-[10px] text-slate-400">User ID: user2</p>
            </div>
            <span className="text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">Tap to enter &rarr;</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickLogin('user3')}
            className="w-full flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200/60 hover:border-blue-300 transition-all text-left group cursor-pointer"
            id="demo-login-member-3"
          >
            <div>
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <span>Baoyi</span>
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-semibold">Member</span>
              </p>
              <p className="text-[10px] text-slate-400">User ID: user3</p>
            </div>
            <span className="text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">Tap to enter &rarr;</span>
          </button>
        </div>
      </div>
    </div>
  );
}
