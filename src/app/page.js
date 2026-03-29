"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Home() {
  const [games, setGames] = useState([]);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [selectedBet, setSelectedBet] = useState(null);
  const [betAmount, setBetAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentMessages, setRecentMessages] = useState([]);

  useEffect(() => {
    async function getInitialData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        setProfile(prof);
      }

      const { data: g } = await supabase.from('games').select('*').eq('status', 'pending').order('kickoff', { ascending: true });
      setGames(g || []);

      // Initial load of smack talk for the sidebar
      const { data: msgs } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(5);
      setRecentMessages(msgs || []);
    }
    getInitialData();

    // Subscribe to new messages for the sidebar feed
    const channel = supabase.channel('sidebar_chat').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      setRecentMessages(prev => [payload.new, ...prev].slice(0, 5));
    }).subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handlePlaceBet = async () => {
    if (!betAmount || !selectedBet || !user) return;
    setIsSubmitting(true);
    try {
      const wager = parseFloat(betAmount);
      await supabase.from('bets').insert([{
        user_id: user.id,
        game_id: selectedBet.game.id,
        selection: selectedBet.selection,
        bet_type: selectedBet.type,
        line_at_bet: selectedBet.line,
        wager_amount: wager,
        status: 'pending'
      }]);

      let snitch = "";
      if (wager >= 50) snitch = `${profile.display_name} JUST DROPPED A WHALE BET! 🐋💸`;
      else if (wager <= 5) snitch = `${profile.display_name} is playing it safe with a minnow. 🦐`;
      
      if (snitch) {
        await supabase.from('messages').insert([{
          user_id: user.id, author_name: 'SYSTEM', content: snitch, message_type: 'system_alert'
        }]);
      }
      setSelectedBet(null);
      setBetAmount("");
      alert("Locked In!");
    } catch (err) { alert("Error placing bet."); }
    finally { setIsSubmitting(false); }
  };

  return (
    <main className="min-h-screen bg-slate-200">
      {/* FULL NAV BAR RESTORED */}
      <nav className="bg-brand-dark p-4 border-b-4 border-brand-violet sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-brand-volt italic tracking-tighter uppercase leading-none">Action League</h1>
            <a href="/leaderboard" className="text-[10px] font-bold text-brand-violet uppercase">View Standings →</a>
          </div>
          
          <div className="flex gap-4 items-center">
            {profile?.role === 'admin' && (
              <>
                <a href="/commissioner" className="text-[10px] font-black text-brand-volt uppercase hover:text-white transition-colors">Front Office</a>
                <a href="/grade" className="text-[10px] font-black text-brand-volt uppercase hover:text-white transition-colors">Grade</a>
              </>
            )}
            <a href="/feed" className="text-[10px] font-black text-white uppercase hover:text-brand-volt transition-colors">Action Feed</a>
            <a href="/my-slips" className="bg-brand-violet text-white px-3 py-1.5 rounded font-black uppercase text-[10px]">My Slips</a>
            <button onClick={handleSignOut} className="text-[9px] text-gray-500 font-bold uppercase border-l border-gray-800 pl-4 hover:text-red-400">Sign Out</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500 border-b-2 border-gray-300 pb-2">The Board</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {games.map(game => (
              <div key={game.id} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
                <div className="bg-slate-50 p-3 flex justify-between px-4 border-b">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date(game.kickoff).toLocaleDateString()}</span>
                  <span className="text-[10px] font-black text-brand-violet uppercase">Live Odds</span>
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div className="text-center w-5/12">
                      <h3 className="font-black text-xl text-brand-dark uppercase leading-tight">{game.away_team}</h3>
                    </div>
                    <div className="text-gray-200 font-black italic text-xl">VS</div>
                    <div className="text-center w-5/12">
                      <h3 className="font-black text-xl text-brand-dark uppercase leading-tight">{game.home_team}</h3>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => setSelectedBet({ game, selection: game.away_abbr, type: 'spread', line: game.away_spread })} className="bg-slate-50 p-3 rounded-xl hover:bg-brand-volt transition-all border border-gray-100 shadow-sm">
                      <span className="block text-[8px] font-black text-gray-400 uppercase mb-1">Spread</span>
                      <span className="font-black text-sm">{game.away_spread > 0 ? `+${game.away_spread}` : game.away_spread}</span>
                    </button>
                    <button onClick={() => setSelectedBet({ game, selection: game.away_abbr, type: 'moneyline', line: 'ML' })} className="bg-slate-50 p-3 rounded-xl hover:bg-brand-volt transition-all border border-gray-100 shadow-sm">
                      <span className="block text-[8px] font-black text-gray-400 uppercase mb-1">ML</span>
                      <span className="font-black text-sm">Pick Em</span>
                    </button>
                    <button onClick={() => setSelectedBet({ game, selection: 'OVER', type: 'total', line: (game.over_under || game.total || 0) })} className="bg-slate-50 p-3 rounded-xl hover:bg-brand-volt transition-all border border-gray-100 shadow-sm">
                      <span className="block text-[8px] font-black text-gray-400 uppercase mb-1">Total</span>
                      <span className="font-black text-sm">{game.over_under || game.total || '—'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SIDEBAR SMACK TALK (THE MOLD BREAKER) */}
        <div className="hidden lg:block space-y-6">
           <div className="bg-brand-dark rounded-3xl p-6 text-white shadow-xl border-t-4 border-brand-volt">
              <h3 className="font-black italic uppercase tracking-tighter text-xl mb-4 text-brand-volt">League Intel</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Top Whale</span>
                  <span className="font-black text-brand-volt">$250.00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Active Bets</span>
                  <span className="font-black text-white">14</span>
                </div>
              </div>
           </div>

           <div className="bg-white rounded-3xl p-5 shadow-xl border border-gray-100 h-[500px] flex flex-col">
              <h3 className="font-black uppercase text-[10px] tracking-widest text-brand-violet mb-4">Locker Room Feed</h3>
              <div className="flex-grow space-y-4 overflow-hidden">
                {recentMessages.map(m => (
                  <div key={m.id} className={`p-3 rounded-2xl text-[11px] leading-tight shadow-sm ${m.message_type === 'system_alert' ? 'bg-brand-volt/20 text-brand-dark border border-brand-volt/50 font-black' : 'bg-slate-50 text-brand-dark border border-gray-100'}`}>
                    <span className="block text-[8px] opacity-50 uppercase mb-1">{m.author_name}</span>
                    {m.content}
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 text-[9px] font-bold text-gray-300 text-center uppercase">
                Open Bubble to Join
              </div>
           </div>
        </div>
      </div>
      {/* BETTING MODAL (Code remains same as previous) */}
      {selectedBet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-brand-dark p-6 text-white">
              <p className="text-brand-volt font-black uppercase tracking-widest text-[10px] mb-2">Review Ticket</p>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">{selectedBet.selection} {selectedBet.type !== 'moneyline' ? selectedBet.line : 'ML'}</h2>
              <p className="text-gray-400 text-xs font-bold mt-1">{selectedBet.game.away_abbr} @ {selectedBet.game.home_abbr}</p>
            </div>
            <div className="p-8">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Wager Amount ($)</label>
              <input type="number" autoFocus value={betAmount} onChange={(e) => setBetAmount(e.target.value)} placeholder="0.00" className="w-full text-4xl font-black border-b-4 border-gray-100 focus:border-brand-violet outline-none pb-2" />
              <div className="flex gap-4 mt-8">
                <button onClick={() => setSelectedBet(null)} className="w-1/3 text-gray-400 font-black uppercase text-xs">Cancel</button>
                <button onClick={handlePlaceBet} disabled={isSubmitting} className="w-2/3 bg-brand-dark text-brand-volt py-4 rounded-xl font-black uppercase tracking-widest hover:bg-brand-panel shadow-lg active:scale-95 disabled:opacity-50">{isSubmitting ? 'Locking...' : 'Lock It In'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}