"use client";

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else window.location.href = '/';
    setLoading(false);
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setMessage(error.message);
    else setMessage('Check your email for the confirmation link!');
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      <div className="bg-brand-panel p-8 rounded-2xl shadow-2xl max-w-sm w-full border-b-8 border-brand-volt relative overflow-hidden">
        
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-volt opacity-5 rounded-full blur-2xl -mr-10 -mt-10"></div>
        
        <div className="text-center mb-8 relative z-10">
          <img src="/logo.png" alt="Action League" className="h-16 w-16 mx-auto mb-4 object-contain" />
          <h1 className="text-3xl font-black italic uppercase text-white tracking-tighter drop-shadow-md">
            Action <span className="text-brand-volt">League</span>
          </h1>
          <p className="text-xs text-brand-violet font-bold mt-1 uppercase tracking-widest">Locker Room Access</p>
        </div>
        
        <form className="space-y-4 relative z-10">
          <input 
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)} 
            className="w-full bg-brand-dark border-2 border-brand-violet rounded-xl p-3 text-white font-bold focus:border-brand-volt outline-none transition-colors" 
            placeholder="Email Address" 
          />
          <input 
            type="password" required value={password} onChange={(e) => setPassword(e.target.value)} 
            className="w-full bg-brand-dark border-2 border-brand-violet rounded-xl p-3 text-white font-bold focus:border-brand-volt outline-none transition-colors" 
            placeholder="Password" 
          />
          
          <div className="flex gap-4 pt-2">
            <button onClick={handleLogin} disabled={loading} className="flex-1 bg-brand-volt text-brand-dark font-black py-3 rounded-xl hover:bg-white transition-all shadow-[0_0_10px_rgba(57,255,20,0.4)] uppercase tracking-widest">
              {loading ? '...' : 'Log In'}
            </button>
            <button onClick={handleSignUp} disabled={loading} className="flex-1 bg-brand-dark text-white border-2 border-brand-violet font-black py-3 rounded-xl hover:border-brand-volt hover:text-brand-volt transition-colors uppercase tracking-widest">
              Sign Up
            </button>
          </div>
        </form>

        {/* THE FORGOT PASSWORD LINK IS PLACED HERE */}
        <div className="mt-6 text-center relative z-10">
          <a href="/forgot-password" className="text-xs text-gray-400 hover:text-brand-volt uppercase font-bold tracking-widest transition-colors">
            Forgot Password?
          </a>
        </div>
        
        {message && <p className="mt-4 text-center font-bold text-brand-volt text-sm relative z-10">{message}</p>}
      </div>
    </main>
  );
}