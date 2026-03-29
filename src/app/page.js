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
  const [stats, setStats] = useState({ topWhale: 0, activeBets: 0 });

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
      const { data: bets } = await supabase.from('bets').select('wager_amount').eq('status', 'pending');
      if (bets && bets.length > 0) {
        const top = Math.max(...bets.map(b => b.wager_amount), 0);
        setStats({ topWhale: top, activeBets: bets.length });
      }
      const { data: msgs } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(6);
      setRecentMessages(msgs || []);
    }
    getInitialData();

    const channel = supabase.channel('sidebar').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
      setRecentMessages(prev => [p.new, ...prev].slice(0, 6));
    }).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // --- 2026 PAYOUT ENGINE ---
  const calculatePayout = (wager, line) => {
    const amount = parseFloat(wager);
    if (isNaN(amount) || amount <= 0) return { profit: 0, total: 0 };
    
    // Default to -110 if it's a spread/total without a specific price
    const odds = (line === 'ML' || !line) ? -110 : parseFloat(line);
    let profit = 0;

    if (odds > 0) {
      profit = (amount * odds) / 100;
    } else {
      profit = amount / (Math.abs(odds) / 100);
    }
    
    return { 
      profit: profit.toFixed(2), 
      total: (amount + profit).toFixed(2) 
    };
  };

  const formatLine = (val) => {
    if (!val || val === '—') return '—';
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    return num > 0 ? `+${num}` : num;
  };

  const handlePlaceBet = async () => {
    if (!betAmount || !selectedBet || !user) return;
    setIsSubmitting(true);
    try {
      const wager = parseFloat(betAmount);
      await supabase.from('bets').insert([{
        user_id: user.id, game_id: selectedBet.game.id, selection: selectedBet.selection,
        bet_type: selectedBet.type, line_at_bet: selectedBet.line, wager_amount: wager, status: 'pending'
      }]);
      if (wager >= 50) {
        await supabase.from('messages').insert([{
          user_id: user.id, author_name: 'SYSTEM', content: `${profile.display_name} JUST DROPPED A WHALE BET! 🐋💸`, message_type: 'system_alert'
        }]);
      }
      setSelectedBet(null);
      setBetAmount("");
      alert("Locked In!");
      window.location.reload();
    } catch (err) { alert("Error."); }
    finally { setIsSubmitting(false); }
  };

  return (
    <main className="min-h-screen bg-slate-200">
      <nav className="bg-brand-dark p-4 border-b-4 border-brand-violet sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-brand-volt italic tracking-tighter uppercase leading-none">Action League</h1>
            <a href="/leaderboard" className="text-[10px] font-bold text-brand-violet uppercase">Standings →</a>
          </div>
          <div className="flex gap-4 items-center">
            {profile?.role === 'admin' && (
              <>
                <a href="/commissioner" className="text-[10px] font-black text-brand-volt uppercase underline decoration-brand-violet underline-offset-4">Front Office</a>
                <a href="/grade" className="text-[10px] font-black text-brand-volt uppercase underline decoration-brand-violet underline-offset-4">Grade</a>
              </>
            )}
            <a href="/feed" className="text-[10px] font-black text-white uppercase">Action Feed</a>
            <a href="/my-bets" className="bg-brand-violet text-white px-3 py-1.5 rounded font-black uppercase text-[10px]">My Slips</a>
            <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="text-[9px] text-gray-500 font-bold uppercase border-l border-gray-800 pl-4">Sign Out</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {games.map(game => {
              // DATA DETECTIVE: Check every possible column for the O/U line
              const totalVal = game.over_under || game.total || game.over_under_line || game.total_points || '—';
              const spreadVal = game.away_spread || game.spread || 0;
              
              return (
                <div key={game.id} className="bg-white rounded-3xl shadow-xl border-2 border-white overflow-hidden">
                  <div className="bg-slate-50 p-3 border-b flex justify-between px-4">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date(game.kickoff).toLocaleDateString()}</span>
                    <span className="text-[10px] font-black text-brand-violet uppercase">UFL Week {game.week_number}</span>
                  </div>
                  <div className="p-8">
                    <div className="flex justify-between items-center mb-8">
                      <div className="text-center w-5/12"><h3 className="font-black text-2xl text-brand-dark uppercase tracking-tighter">{game.away_team}</h3></div>
                      <div className="text-gray-200 font-black italic text-xl">VS</div>
                      <div className="text-center w-5/12"><h3 className="font-black text-2xl text-brand-dark uppercase tracking-tighter">{game.home_team}</h3></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <button onClick={() => setSelectedBet({ game, selection: game.away_abbr, type: 'spread', line: spreadVal })} className="bg-slate-50 p-4 rounded-2xl hover:bg-brand-volt transition-all border border-gray-100 flex flex-col items-center">
                        <span className="text-[9px] font-black text-gray-400 uppercase mb-1">Spread</span>
                        <span className="font-black text-sm">{formatLine(spreadVal)}</span>
                      </button>
                      <button onClick={() => setSelectedBet({ game, selection: game.away_abbr, type: 'moneyline', line: 'ML' })} className="bg-slate-50 p-4 rounded-2xl hover:bg-brand-volt transition-all border border-gray-100 flex flex-col items-center">
                        <span className="text-[9px] font-black text-gray-400 uppercase mb-1">ML</span>
                        <span className="font-black text-sm">Pick Em</span>
                      </button>
                      <button onClick={() => setSelectedBet({ game, selection: 'OVER', type: 'total', line: totalVal })} className="bg-slate-50 p-4 rounded-2xl hover:bg-brand-volt transition-all border border-gray-100 flex flex-col items-center">
                        <span className="text-[9px] font-black text-gray-400 uppercase mb-1">Total</span>
                        <span className="font-black text-sm">{totalVal}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-brand-dark rounded-3xl p-6 text-white shadow-2xl border-t-8 border-brand-volt">
              <h3 className="font-black italic uppercase tracking-tighter text-2xl mb-4 text-brand-volt">League Intel</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                  <span className="text-[11px] font-bold text-gray-400 uppercase">Top Whale</span>
                  <span className="font-black text-brand-volt text-xl">${stats.topWhale.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-gray-400 uppercase">Active Bets</span>
                  <span className="font-black text-white text-xl">{stats.activeBets}</span>
                </div>
              </div>
           </div>

           <div className="bg-white rounded-3xl p-5 shadow-xl border border-gray-100 h-[450px] flex flex-col overflow-hidden">
              <h3 className="font-black uppercase text-[11px] tracking-[0.2em] text-brand-violet mb-4">Locker Room</h3>
              <div className="flex-grow space-y-3 overflow-y-auto pr-2">
                {recentMessages.map(m => (
                  <div key={m.id} className={`p-3 rounded-2xl text-[12px] border ${m.message_type === 'system_alert' ? 'bg-brand-volt/10 border-brand-volt/30 text-brand-dark font-black' : 'bg-slate-50 border-gray-100 text-brand-dark'}`}>
                    <span className="block text-[8px] opacity-40 uppercase mb-1 font-black">{m.author_name}</span>
                    {m.content}
                  </div>
                ))}
              </div>
           </div>
        </div>
      </div>

      {selectedBet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-brand-dark p-6 text-white">
              <p className="text-brand-volt font-black uppercase tracking-widest text-[10px] mb-2">Review Ticket</p>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">
                {selectedBet.selection} {selectedBet.type !== 'moneyline' ? formatLine(selectedBet.line) : 'ML'}
              </h2>
              <p className="text-gray-400 text-xs font-bold mt-1 uppercase">{selectedBet.game.away_abbr} @ {selectedBet.game.home_abbr}</p>
            </div>
            
            <div className="p-8">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Wager Amount ($)</label>
              <input type="number" autoFocus value={betAmount} onChange={(e) => setBetAmount(e.target.value)} placeholder="0.00" className="w-full text-4xl font-black border-b-4 border-gray-100 focus:border-brand-violet outline-none pb-2 text-brand-dark mb-6" />
              
              {/* REAL-TIME PAYOUT PREVIEW */}
              {betAmount > 0 && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase">To Win (Profit)</span>
                    <span className="text-sm font-black text-green-600">+${calculatePayout(betAmount, selectedBet.line).profit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] font-black text-gray-400 uppercase">Total Payout</span>
                    <span className="text-sm font-black text-brand-dark">${calculatePayout(betAmount, selectedBet.line).total}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-4 mt-8">
                <button onClick={() => setSelectedBet(null)} className="w-1/3 text-gray-400 font-black uppercase text-xs">Cancel</button>
                <button onClick={handlePlaceBet} disabled={isSubmitting} className="w-2/3 bg-brand-dark text-brand-volt py-4 rounded-xl font-black uppercase tracking-widest hover:bg-brand-panel transition-all shadow-lg active:scale-95 disabled:opacity-50">
                  {isSubmitting ? 'Locking...' : 'Lock It In'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}