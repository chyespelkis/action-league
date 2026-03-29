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
  const messagesEndRef = useRef(null);

  // Load user and subscribe to live messages
  useEffect(() => {
    async function initChat() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (profile) setCurrentUser(profile);

      // Grab the last 50 messages so the room isn't empty when you log in
      const { data: initialMessages } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);
      if (initialMessages) setMessages(initialMessages);
    }
    initChat();

    // The Real-Time Listener
    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Auto-scroll to the newest message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;

    const textToSubmit = newMessage;
    setNewMessage(''); // Clear input instantly for a snappy feel

    await supabase.from('messages').insert([{
      user_id: currentUser.id,
      author_name: currentUser.display_name,
      content: textToSubmit
    }]);
  };

  // Don't render the chat bubble if the user isn't logged in yet
  if (!currentUser) return null; 

  return (
    <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50">
      
      {/* THE OPEN CHAT WINDOW */}
      {isOpen && (
        <div className="bg-white border-2 border-brand-dark rounded-xl shadow-2xl w-80 sm:w-96 flex flex-col mb-4 overflow-hidden h-[450px]">
          {/* Header */}
          <div className="bg-brand-dark text-brand-volt p-3 flex justify-between items-center">
            <h3 className="font-black uppercase tracking-widest text-sm italic">Locker Room</h3>
            <button onClick={() => setIsOpen(false)} className="text-white hover:text-red-400 font-bold px-2">&times;</button>
          </div>

          {/* Messages Area */}
          <div className="flex-grow p-4 overflow-y-auto bg-slate-50 flex flex-col gap-3">
            {messages.length === 0 ? (
              <p className="text-center text-gray-400 text-xs font-bold uppercase mt-10">No trash talk yet.</p>
            ) : (
              messages.map((msg) => {
                const isMe = msg.user_id === currentUser.id;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 px-1">
                      {isMe ? 'You' : msg.author_name}
                    </span>
                    <div className={`px-3 py-2 rounded-lg text-sm shadow-sm ${isMe ? 'bg-brand-violet text-white rounded-br-none' : 'bg-white border border-gray-200 text-brand-dark rounded-bl-none'}`}>
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={sendMessage} className="p-3 bg-white border-t border-gray-200 flex gap-2">
            <input 
              type="text" 
              value={newMessage} 
              onChange={(e) => setNewMessage(e.target.value)} 
              placeholder="Talk your talk..." 
              className="flex-grow bg-gray-100 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-brand-violet"
              maxLength={200}
            />
            <button type="submit" className="bg-brand-dark text-brand-volt px-3 py-2 rounded font-black uppercase text-xs hover:bg-brand-panel transition-colors">
              Send
            </button>
          </form>
        </div>
      )}

      {/* THE FLOATING BUBBLE BUTTON */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-brand-dark text-brand-volt h-14 w-14 rounded-full shadow-[0_0_15px_rgba(57,255,20,0.4)] flex items-center justify-center hover:scale-105 transition-transform"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 11.996c0 2.29.9 4.361 2.37 5.862a8.775 8.775 0 0 1-1.636 2.365.75.75 0 0 0 .524 1.28A8.82 8.82 0 0 0 8.35 20.01c1.13.25 2.34.39 3.65.39Z" />
          </svg>
        </button>
      )}
    </div>
  );
}