"use client";

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');

  async function handleUpdate(e) {
    e.preventDefault();
    setMessage('Updating...');

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Password updated successfully!');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    }
  }

  return (
    <main className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      <div className="bg-brand-panel p-8 rounded-2xl shadow-2xl max-w-sm w-full border-b-8 border-brand-volt">
        <h1 className="text-3xl font-black italic uppercase text-white mb-2">New Password</h1>
        <p className="text-xs text-brand-violet font-bold mb-6 uppercase tracking-wider">Lock in your new credentials</p>
        
        <form onSubmit={handleUpdate} className="space-y-4">
          <input 
            type="password" 
            required 
            value={newPassword} 
            onChange={(e) => setNewPassword(e.target.value)} 
            className="w-full bg-brand-dark border-2 border-brand-violet rounded-xl p-3 text-white font-bold focus:border-brand-volt outline-none" 
            placeholder="New Password" 
          />
          <button type="submit" className="w-full bg-brand-volt text-brand-dark font-black py-4 rounded-xl hover:bg-white transition-all shadow-[0_0_15px_rgba(57,255,20,0.5)] uppercase tracking-widest">
            Update Password
          </button>
        </form>
        
        {message && <p className="mt-4 text-center font-bold text-brand-volt text-sm">{message}</p>}
      </div>
    </main>
  );
}