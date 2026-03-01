"use client";

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  async function handleReset(e) {
    e.preventDefault();
    setMessage('Sending reset link...');
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Check your email for the reset link!');
    }
  }

  return (
    <main className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      <div className="bg-brand-panel p-8 rounded-2xl shadow-2xl max-w-sm w-full border-b-8 border-brand-volt">
        <h1 className="text-3xl font-black italic uppercase text-white mb-2">Recover Account</h1>
        <p className="text-xs text-brand-violet font-bold mb-6 uppercase tracking-wider">Enter your email to reset</p>
        
        <form onSubmit={handleReset} className="space-y-4">
          <input 
            type="email" 
            required 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            className="w-full bg-brand-dark border-2 border-brand-violet rounded-xl p-3 text-white font-bold focus:border-brand-volt outline-none" 
            placeholder="Email Address" 
          />
          <button type="submit" className="w-full bg-brand-volt text-brand-dark font-black py-4 rounded-xl hover:bg-white transition-all shadow-[0_0_15px_rgba(57,255,20,0.5)] uppercase tracking-widest">
            Send Link
          </button>
        </form>
        
        {message && <p className="mt-4 text-center font-bold text-brand-volt text-sm">{message}</p>}
        
        <div className="mt-6 text-center">
          <a href="/login" className="text-xs text-gray-400 hover:text-white uppercase font-bold tracking-widest transition-colors">← Back to Login</a>
        </div>
      </div>
    </main>
  );
}