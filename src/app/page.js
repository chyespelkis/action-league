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

  useEffect(() => {
    async function getInitialData() {
      // 1. Get Session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        setProfile(prof);
      }

      // 2. Get Active Games (Assuming status is 'pending' for open games)
      const { data: g } = await supabase.from('games').select('*').eq('status', 'pending').order('kickoff', { ascending: true });
      setGames(g || []);
    }
    getInitialData();
  }, []);

  const handlePlaceBet = async () => {
    if (!betAmount || !selectedBet || !user) return;
    setIsSubmitting(true);

    try {
      const wager = parseFloat(betAmount);
      
      // 1. Record the Bet
      const { error: betError } = await supabase.from('bets').insert([{
        user_id: user.id,
        game_id: selectedBet.game.id,
        selection: selectedBet.selection,
        bet_type: selectedBet.type,
        line_at_bet: selectedBet.line,
        wager_amount: wager,
        status: 'pending'
      }]);

      if (betError) throw betError;

      // 2. THE SNITCH: Send automated message to Locker Room
      let snitchMessage = "";
      if (wager >= 50) {
        snitchMessage = `${profile.display_name} JUST DROPPED A WHALE BET! 🐋💸`;
      } else if (wager <= 5) {
        snitchMessage = `${profile.display_name} is playing it safe with a minnow. 🦐`;
      } else if (wager === 20) {
        snitchMessage = `${profile.display_name} put a standard $20 on the board. 🎯`;
      }

      if (snitchMessage) {
        await supabase.from('messages').insert([{
          user_id: user.id,
          author_name: 'SYSTEM',
          content: snitchMessage,
          message_type: 'system_alert'
        }]);
      }

      alert("Bet Locked In!");
      setSelectedBet(null);
      setBetAmount("");
    } catch (err) {
      console.error(err);
      alert("Error placing bet.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-200">
      
      {/* HEADER NAVIGATION */}
      <nav className="bg-brand-dark p-4 border-b-4 border-brand-violet sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-brand-volt italic tracking-tighter uppercase leading-none">Action League</h1>
            <a href="/leaderboard" className="text-[10px] font-bold text-brand-violet uppercase hover:text-white transition-colors">View Standings →</a>
          </div>
          
          <div className="flex gap-4 items-center">
            <a href="/feed" className="text-xs font-black text-white uppercase hover:text-brand-volt transition-colors">Action Feed</a>
            <a href="/my-slips" className="bg-brand-violet text-white px-3 py-1.5 rounded font-black uppercase text-[10px] shadow-lg">My Slips</a>
            <a href="YOUR_FORM_LINK" target="_blank" className="text-[9px] text-gray-500 font-bold uppercase border-l border-gray-800 pl-4 hover:text-brand-volt transition-colors">Feedback</a>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* MAIN BOARD (LEFT 3 COLS) */}
        <div className="lg:col-span-3 space-y-6">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500 border-b-2 border-gray-300 pb-2">The Board</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {games.map(game => (
              <div key={game.id} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
                <div className="bg-slate-50 p-2 text-center border-b border-gray-100 flex justify-between px-4">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{new Date(game.kickoff).toLocaleDateString()}</span>
                  <span className="text-[9px] font-black text-brand-violet uppercase">Live Odds</span>
                </div>
                
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div className="text-center w-1/3">
                      <p className="text-xs font-bold text-gray-400 mb-1">{game.away_abbr}</p>
                      <h3 className="font-black text-lg text-brand-dark uppercase">{game.away_team}</h3>
                    </div>
                    <div className="text-gray-300 font-black italic text-xl">@</div>
                    <div className="text-center w-1/3">
                      <p className="text-xs font-bold text-gray-400 mb-1">{game.home_abbr}</p>
                      <h3 className="font-black text-lg text-brand-dark uppercase">{game.home_team}</h3>
                    </div>
                  </div>

                  {/* ODDS BUTTONS */}
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => setSelectedBet({ game, selection: game.away_team, type: 'spread', line: game.away_spread })} 
                      className="bg-slate-100 p-2 rounded hover:bg-brand-volt hover:text-brand-dark transition-all border border-gray-200">
                      <span className="block text-[9px] font-bold text-gray-400">SPREAD</span>
                      <span className="font-black text-xs">{game.away_spread > 0 ? `+${game.away_spread}` : game.away_spread}</span>
                    </button>
                    <button onClick={() => setSelectedBet({ game, selection: game.away_team, type: 'moneyline', line: 'ML' })}
                      className="bg-slate-100 p-2 rounded hover:bg-brand-volt hover:text-brand-dark transition-all border border-gray-200">
                      <span className="block text-[9px] font-bold text-gray-400">ML</span>
                      <span className="font-black text-xs">Pick Em</span>
                    </button>
                    <button onClick={() => setSelectedBet({ game, selection: 'OVER', type: 'total', line: game.over_under })}
                      className="bg-slate-100 p-2 rounded hover:bg-brand-volt hover:text-brand-dark transition-all border border-gray-200">
                      <span className="block text-[9px] font-bold text-gray-400">TOTAL</span>
                      <span className="font-black text-xs">O {game.over_under}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* STATS/FEED SIDEBAR (RIGHT 1 COL) */}
        <div className="hidden lg:block space-y-6">
           <div className="bg-brand-dark rounded-2xl p-6 text-white shadow-xl border-t-4 border-brand-volt">
              <h3 className="font-black italic uppercase tracking-tighter text-xl mb-4">League Intel</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Top Whale</span>
                  <span className="font-black text-brand-volt">$250.00</span>
                </div>
                <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Active Bets</span>
                  <span className="font-black text-white">14</span>
                </div>
              </div>
           </div>

           <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-200 h-[400px] overflow-hidden flex flex-col">
              <h3 className="font-black uppercase text-[10px] tracking-widest text-gray-400 mb-3">Live Smack Talk</h3>
              <div className="flex-grow text-[11px] font-medium text-gray-300 italic flex items-center justify-center text-center">
                Open the Locker Room bubble in the corner to talk trash.
              </div>
           </div>
        </div>
      </div>

      {/* BETTING MODAL */}
      {selectedBet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-brand-dark p-6 text-white">
              <p className="text-brand-volt font-black uppercase tracking-widest text-[10px] mb-2">Review Ticket</p>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">
                {selectedBet.selection} {selectedBet.type !== 'moneyline' ? selectedBet.line : 'ML'}
              </h2>
              <p className="text-gray-400 text-xs font-bold mt-1">{selectedBet.game.away_abbr} @ {selectedBet.game.home_abbr}</p>
            </div>
            
            <div className="p-8">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Wager Amount ($)</label>
              <input 
                type="number" 
                autoFocus
                value={betAmount} 
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="0.00"
                className="w-full text-4xl font-black border-b-4 border-gray-100 focus:border-brand-violet outline-none pb-2 transition-colors"
              />
              
              <div className="flex gap-4 mt-8">
                <button onClick={() => setSelectedBet(null)} className="w-1/3 text-gray-400 font-black uppercase text-xs">Cancel</button>
                <button 
                  onClick={handlePlaceBet}
                  disabled={isSubmitting}
                  className="w-2/3 bg-brand-dark text-brand-volt py-4 rounded-xl font-black uppercase tracking-widest hover:bg-brand-panel transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
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