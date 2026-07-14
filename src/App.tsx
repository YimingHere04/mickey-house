/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { supabase, IS_DEMO_MODE } from './lib/supabase';
import { UserProfile } from './types';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';
import { Users, ShieldAlert } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [switchedProfile, setSwitchedProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Monitor auth status
  useEffect(() => {
    let authSubscription: any = null;

    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        
        if (initialSession?.user) {
          await fetchUserProfile(initialSession.user.id);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Setup listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.user) {
        await fetchUserProfile(currentSession.user.id);
      } else {
        setProfile(null);
        setSwitchedProfile(null);
      }
      setLoading(false);
    });

    authSubscription = subscription;

    return () => {
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  // Fetch profiles table record
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setProfile(data[0] as UserProfile);
      } else {
        // Fallback profile if record not synced yet
        setProfile({
          id: userId,
          email: session?.user?.email || '',
          name: session?.user?.user_metadata?.name || 'Resident',
          role: session?.user?.user_metadata?.role || 'member'
        });
      }
    } catch (err) {
      console.error('Error fetching custom profile info:', err);
    }
  };

  const handleSwitchAccount = async () => {
    if (!profile) return;
    
    if (switchedProfile) {
      setSwitchedProfile(null);
      return;
    }

    if (profile.role === 'admin' && profile.linked_user_id) {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', profile.linked_user_id)
          .single();
        
        if (error) throw error;
        if (data) {
          setSwitchedProfile(data as UserProfile);
        }
      } catch (err) {
        console.error('Switching failed:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setSwitchedProfile(null);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-bold mt-4">Setting up Mickey House...</p>
      </div>
    );
  }

  const activeProfile = switchedProfile || profile;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* 2. ROOT BODY CONTAINER */}
      <main className="flex-1 flex flex-col relative">
        {!session || !profile || !activeProfile ? (
          <Login onLoginSuccess={initAuthAfterLogin} />
        ) : activeProfile.role === 'admin' ? (
          <AdminDashboard 
            currentProfile={activeProfile} 
            onLogout={handleLogout} 
            isSwitched={!!switchedProfile}
            onToggleAccount={handleSwitchAccount}
          />
        ) : (
          <UserDashboard 
            currentProfile={activeProfile} 
            onLogout={handleLogout} 
            isSwitched={!!switchedProfile}
            onToggleAccount={handleSwitchAccount}
          />
        )}
      </main>
    </div>
  );

  // Helper utility to refresh state after successful auth callback
  async function initAuthAfterLogin() {
    setLoading(true);
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    setSession(currentSession);
    if (currentSession?.user) {
      await fetchUserProfile(currentSession.user.id);
    }
    setLoading(false);
  }
}
