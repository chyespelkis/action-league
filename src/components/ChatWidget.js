"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [userStats, setUserStats] = useState({});
  const messagesEndRef = useRef(null);

  useEffect(() => {
    async function initChat() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (profile) setCurrentUser(profile);

      // Load Recent Performance for Streaks
      const { data: recentBets } = await supabase
        .from('bets')
        .select('user_id, status')
        .order('created_at', { ascending: false });
      
      const stats = {};
      recentBets?.forEach(bet => {
        if (!stats[bet.user_id]) stats[bet.user_id] = { streak: 0, type: null, count: 0 };
        
        // Only calculate streak if they have graded bets
        if (stats[bet.user_id].count < 5 && bet.status !== 'pending') {
          if (stats[bet.user_id].type === null) {
            stats[bet.user_id].type = bet.status;
            stats[bet.user_id].streak = 1;
          } else if (stats[bet.user_id].type === bet.status) {
            stats[bet.user_id].streak++;
          } else {
            stats[bet.user_id].count = 5; // Break the streak search
          }
          stats[bet.user_id].count++;
        }
      });
      setUserStats(stats);

      const { data: initialMessages } = await supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(50);
      if (initialMessages) setMessages(initialMessages);
    }
    initChat();

    const channel = supabase.channel('public:messages').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      setMessages((prev) => [...prev, payload.new]);
    }).subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => { if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isOpen]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;
    const text = newMessage;
    setNewMessage('');
    await supabase.from('messages').insert([{ user_id: currentUser.id, author_name: currentUser.display_name, content: text, message_type: 'chat' }]);
  };

  const getMomentumStyles = (userId) => {
    const data = userStats[userId];
    if (!data || data.streak < 2) return { emojis: '', classes: 'bg-white border-gray-200 text-brand-dark' };

    if (data.type === 'won') {
      if (data.streak >= 4) return { emojis: '☄️☄️☄️', classes: 'bg-orange-500 text-white border-yellow-300 shadow-[0_0_15px_rgba(255,165,0,0.6)] animate-pulse' };
      if (data.streak === 3) return { emojis: '🔥🔥🔥', classes: 'bg-red-500 text-white border-orange-400' };
      return { emojis: '🔥', classes: 'bg-red-400 text-white border-red-200' };
    }

    if (data.type === 'lost') {
      if (data.streak >= 4) return { emojis: '🧊🧊🧊', classes: 'bg-cyan-600 text-white border-blue-200 shadow-[0_0_15px_rgba(0,255,255,0.4)]' };
      if (data.streak === 3) return { emojis: '❄️❄️❄️', classes: 'bg-blue-400 text-white border-blue-100' };
      return { emojis: '❄️', classes: 'bg-blue-200 text-blue-800 border-blue-300' };
    }

    return { emojis: '', classes: 'bg-white border-gray-200 text-brand-dark' };
  };

  if (!currentUser) return null;

  return (
    <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50">
      {isOpen && (
        <div className="bg-white border-2 border-brand-dark rounded-3xl shadow-2xl w-80 sm:w-96 flex flex-col mb-4 overflow-hidden h-[550px] animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-brand-dark text-brand-volt p-4 flex justify-between items-center border-b border-brand-volt border-opacity-20">
            <h3 className="font-black uppercase tracking-tighter italic text-sm">Locker Room</h3>
            <button onClick={() => setIsOpen(false)} className="hover:rotate-90 transition-transform"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg></button>
          </div>

          <div className="flex-grow p-4 overflow-y-auto bg-slate-100 space-y-4">
            {messages.map((msg) => {
              const isMe = msg.user_id === currentUser.id;
              const { emojis, classes } = getMomentumStyles(msg.user_id);

              if (msg.message_type === 'system_alert') {
                return (
                  <div key={msg.id} className="flex justify-center"><div className="bg-brand-volt text-brand-dark px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border-2 border-brand-dark">📢 {msg.content}</div></div>
                );
              }

              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1 px-2 mb-1">
                    <span className="text-[10px] font-black uppercase text-gray-400">{isMe ? 'You' : msg.author_name}</span>
                    <span className="text-xs">{emojis}</span>
                  </div>
                  <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm font-medium border-2 shadow-sm ${isMe ? 'bg-brand-violet text-white border-transparent rounded-tr-none' : `rounded-tl-none ${classes}`}`}>
                    {msg.content}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="p-4 bg-white flex gap-2 border-t">
            <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-grow bg-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-violet" />
            <button type="submit" className="bg-brand-dark text-brand-volt p-2 rounded-full hover:scale-110 transition-transform"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" /></svg></button>
          </form>
        </div>
      )}
      // REPLACE THE BUTTON AT THE BOTTOM OF ChatWidget.js
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-brand-dark text-brand-volt h-14 w-14 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-all border-2 border-brand-volt/20"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
        </button>
      )}
    </div>
  );
}