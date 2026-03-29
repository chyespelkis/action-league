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

  const calculatePayout = (wager, line) => {
    const amount = parseFloat(wager);
    if (isNaN(amount) || amount <= 0) return { profit: 0, total: 0 };
    const odds = (line === 'ML' || !line) ? -110 : parseFloat(line);
    let profit = odds > 0 ? (amount * odds) / 100 : amount / (Math.abs(odds) / 100);
    return { profit: profit.toFixed(2), total: (amount + profit).toFixed(2) };
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
    <main className="min-h-screen bg-slate-900 text-slate-200">
      
      {/* BRANDED NAV BAR */}
      <nav className="bg-[#0b0f19] p-4 border-b-2 border-brand-violet sticky top-0 z-40 shadow-2xl">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          
          {/* LOGO & HOME LINK */}
          <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src="/icon.png" alt="Action League" className="w-10 h-10 object-contain" />
            <div className="flex flex-col">
              <h1 className="text-2xl font-black text-brand-volt italic tracking-tighter uppercase leading-none">Action League</h1>
              <span className="text-[9px] font-bold text-brand-violet uppercase tracking-widest">Standings →</span>
            </div>
          </a>

          <div className="flex gap-4 items-center">
            {profile?.role === 'admin' && (
              <>
                <a href="/commissioner" className="text-[10px] font-black text-brand-volt uppercase underline decoration-brand-violet underline-offset-4 hover:text-white">Front Office</a>
                <a href="/grade" className="text-[10px] font-black text-brand-volt uppercase underline decoration-brand-violet underline-offset-4 hover:text-white">Grade</a>
              </>
            )}
            <a href="/feed" className="text-[10px] font-black text-white uppercase hover:text-brand-volt transition-colors">Action Feed</a>
            <a href="/my-bets" className="bg-brand-violet text-white px-3 py-1.5 rounded font-black uppercase text-[10px] hover:bg-white hover:text-brand-violet transition-colors">My Slips</a>
            <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="text-[9px] text-gray-500 font-bold uppercase border-l border-gray-800 pl-4 hover:text-red-400 transition-colors">Sign Out</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* THE BOARD */}
        <div className="lg:col-span-3 space-y-6">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500 border-b-2 border-gray-800 pb-2">The Board</h2>
          
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {games.map(game => {
              const totalVal = game.over_under || game.total || game.over_under_line || '—';
              const awaySpread = game.away_spread || game.spread || 0;
              // Mathematically mirror the spread for the home team if not explicitly defined
              const homeSpread = game.home_spread !== undefined ? game.home_spread : (awaySpread ? (parseFloat(awaySpread) * -1) : 0);
              
              const kickoffDate = new Date(game.kickoff);

              return (
                <div key={game.id} className="bg-[#121826] rounded-2xl shadow-2xl border border-gray-800 overflow-hidden">
                  
                  {/* GAME HEADER WITH TIME */}
                  <div className="bg-[#0b0f19] p-3 flex justify-between items-center px-4 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-brand-volt uppercase tracking-widest">{kickoffDate.toLocaleDateString()}</span>
                      <span className="text-gray-600 text-[10px]">•</span>
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">{kickoffDate.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}</span>
                    </div>
                    <span className="text-[9px] font-black bg-brand-violet text-white px-2 py-0.5 rounded uppercase">Week {game.week_number}</span>
                  </div>

                  {/* VEGAS GRID BODY */}
                  <div className="p-5">
                    
                    {/* Grid Headers */}
                    <div className="grid grid-cols-4 gap-2 mb-3 text-[9px] font-black text-gray-500 uppercase tracking-widest text-center px-2">
                      <div className="text-left">Matchup</div>
                      <div>Spread</div>
                      <div>Moneyline</div>
                      <div>Total</div>
                    </div>

                    {/* AWAY ROW */}
                    <div className="grid grid-cols-4 gap-2 items-center mb-2">
                      <div className="font-black text-sm md:text-base text-white uppercase truncate pr-2 border-l-2 border-gray-700 pl-2">{game.away_team}</div>
                      
                      <button onClick={() => setSelectedBet({ game, selection: game.away_abbr, type: 'spread', line: awaySpread })} className="bg-[#1a2235] hover:bg-brand-volt hover:text-brand-dark text-white p-2 rounded-lg transition-all border border-gray-700 font-black text-xs text-center">
                        {formatLine(awaySpread)}
                      </button>
                      
                      <button onClick={() => setSelectedBet({ game, selection: game.away_abbr, type: 'moneyline', line: 'ML' })} className="bg-[#1a2235] hover:bg-brand-volt hover:text-brand-dark text-white p-2 rounded-lg transition-all border border-gray-700 font-black text-xs text-center">
                        ML
                      </button>
                      
                      <button onClick={() => setSelectedBet({ game, selection: 'OVER', type: 'total', line: totalVal })} className="bg-[#1a2235] hover:bg-brand-volt hover:text-brand-dark text-white p-1.5 rounded-lg transition-all border border-gray-700 font-black text-xs text-center flex flex-col items-center justify-center">
                        <span className="text-[8px] uppercase text-gray-400 leading-none mb-0.5">Over</span>
                        <span className="leading-none">{totalVal}</span>
                      </button>
                    </div>

                    {/* HOME ROW */}
                    <div className="grid grid-cols-4 gap-2 items-center">
                      <div className="font-black text-sm md:text-base text-white uppercase truncate pr-2 border-l-2 border-brand-violet pl-2">{game.home_team}</div>
                      
                      <button onClick={() => setSelectedBet({ game, selection: game.home_abbr, type: 'spread', line: homeSpread })} className="bg-[#1a2235] hover:bg-brand-volt hover:text-brand-dark text-white p-2 rounded-lg transition-all border border-gray-700 font-black text-xs text-center">
                        {formatLine(homeSpread)}
                      </button>
                      
                      <button onClick={() => setSelectedBet({ game, selection: game.home_abbr, type: 'moneyline', line: 'ML' })} className="bg-[#1a2235] hover:bg-brand-volt hover:text-brand-dark text-white p-2 rounded-lg transition-all border border-gray-700 font-black text-xs text-center">
                        ML
                      </button>
                      
                      <button onClick={() => setSelectedBet({ game, selection: 'UNDER', type: 'total', line: totalVal })} className="bg-[#1a2235] hover:bg-brand-volt hover:text-brand-dark text-white p-1.5 rounded-lg transition-all border border-gray-700 font-black text-xs text-center flex flex-col items-center justify-center">
                        <span className="text-[8px] uppercase text-gray-400 leading-none mb-0.5">Under</span>
                        <span className="leading-none">{totalVal}</span>
                      </button>
                    </div>

                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="space-y-6">
           <div className="bg-[#0b0f19] rounded-2xl p-6 text-white shadow-2xl border-t-4 border-brand-volt">
              <h3 className="font-black italic uppercase tracking-tighter text-xl mb-4 text-brand-volt">League Intel</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Open Whale</span>
                  <span className="font-black text-brand-volt text-lg">${stats.topWhale.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Active Bets</span>
                  <span className="font-black text-white text-lg">{stats.activeBets}</span>
                </div>
              </div>
           </div>

           <div className="bg-[#0b0f19] rounded-2xl p-5 shadow-2xl border border-gray-800 h-[450px] flex flex-col overflow-hidden">
              <h3 className="font-black uppercase text-[10px] tracking-[0.2em] text-brand-violet mb-4">Locker Room</h3>
              <div className="flex-grow space-y-3 overflow-y-auto pr-2">
                {recentMessages.map(m => (
                  <div key={m.id} className={`p-3 rounded-xl text-[12px] border ${m.message_type === 'system_alert' ? 'bg-brand-volt/10 border-brand-volt text-brand-volt font-black' : 'bg-[#121826] border-gray-800 text-gray-300'}`}>
                    <span className="block text-[8px] opacity-50 uppercase mb-1 font-black text-gray-500">{m.author_name}</span>
                    {m.content}
                  </div>
                ))}
              </div>
           </div>
        </div>
      </div>

      {/* BETTING MODAL (Dark Theme) */}
      {selectedBet && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#121826] border border-gray-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-[#0b0f19] p-6 text-white border-b border-gray-800">
              <p className="text-brand-volt font-black uppercase tracking-widest text-[10px] mb-2">Review Ticket</p>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">
                {selectedBet.selection} {selectedBet.type !== 'moneyline' ? formatLine(selectedBet.line) : 'ML'}
              </h2>
              <p className="text-gray-400 text-xs font-bold mt-1 uppercase">{selectedBet.game.away_abbr} @ {selectedBet.game.home_abbr}</p>
            </div>
            
            <div className="p-8">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Wager Amount ($)</label>
              <input type="number" autoFocus value={betAmount} onChange={(e) => setBetAmount(e.target.value)} placeholder="0.00" className="w-full text-4xl font-black border-b-2 border-gray-700 bg-transparent text-white focus:border-brand-violet outline-none pb-2 mb-6" />
              
              {betAmount > 0 && (
                <div className="bg-[#0b0f19] p-4 rounded-xl border border-gray-800">
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] font-black text-gray-500 uppercase">To Win (Profit)</span>
                    <span className="text-sm font-black text-brand-volt">+${calculatePayout(betAmount, selectedBet.line).profit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] font-black text-gray-500 uppercase">Total Payout</span>
                    <span className="text-sm font-black text-white">${calculatePayout(betAmount, selectedBet.line).total}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-4 mt-8">
                <button onClick={() => setSelectedBet(null)} className="w-1/3 text-gray-500 hover:text-white font-black uppercase text-xs transition-colors">Cancel</button>
                <button onClick={handlePlaceBet} disabled={isSubmitting} className="w-2/3 bg-brand-volt text-brand-dark py-4 rounded-xl font-black uppercase tracking-widest hover:bg-white transition-colors shadow-lg active:scale-95 disabled:opacity-50">
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