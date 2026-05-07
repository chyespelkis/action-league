"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function GradingRoom() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState({});
  
  // Rollover State
  const [rolloverWeek, setRolloverWeek] = useState("");
  const [isProcessingRollover, setIsProcessingRollover] = useState(false);
  const [latestGradedWeek, setLatestGradedWeek] = useState(null); // NEW: Tracker State

  useEffect(() => {
    async function checkAuthAndFetch() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        
        if (prof?.role === 'admin' || prof?.display_name?.toUpperCase() === 'CJYES') {
          setIsAuthorized(true);
          
          // 1. Fetch pending games
          const { data } = await supabase.from('games').select('*').eq('status', 'pending').order('kickoff', { ascending: true });
          if (data) setGames(data);

          // 2. NEW: Fetch the most recently graded week
          const { data: finalGames } = await supabase.from('games').select('week_number').eq('status', 'final');
          if (finalGames && finalGames.length > 0) {
            const maxWeek = Math.max(...finalGames.map(g => g.week_number));
            setLatestGradedWeek(maxWeek);
          }

          setLoading(false);
        }
      }
      setAuthLoading(false);
    }
    checkAuthAndFetch();
  }, []);

  const handleScoreChange = (gameId, team, val) => {
    setScores(prev => ({ ...prev, [gameId]: { ...prev[gameId], [team]: parseInt(val) } }));
  };

  async function gradeGame(game) {
    const gameScores = scores[game.id];
    if (!gameScores || gameScores.home === undefined || gameScores.away === undefined) return alert("Enter both scores first!");
    const { home, away } = gameScores;

    await supabase.from('games').update({ home_score: home, away_score: away, status: 'final' }).eq('id', game.id);
    
    const { data: bets } = await supabase.from('bets').select('*').eq('game_id', game.id).eq('status', 'pending');

    if (bets && bets.length > 0) {
      for (let bet of bets) {
        let isWinner = false;
        let isPush = false; 

        if (bet.bet_type === 'moneyline') {
          if (home > away) {
            if (bet.selection === game.home_team || bet.selection === game.home_abbr) isWinner = true;
          } else if (away > home) {
            if (bet.selection === game.away_team || bet.selection === game.away_abbr) isWinner = true;
          } else {
            isPush = true;
          }
        } 
        else if (bet.bet_type === 'spread') {
          const betLine = parseFloat(bet.line_at_bet);
          if (bet.selection === game.home_team || bet.selection === game.home_abbr) {
            if ((home + betLine) > away) isWinner = true;
            else if ((home + betLine) === away) isPush = true;
          } else {
            if ((away + betLine) > home) isWinner = true;
            else if ((away + betLine) === home) isPush = true;
          }
        } 
        else if (bet.bet_type === 'total') {
          const totalScore = home + away;
          const gameTotal = parseFloat(game.total_points || game.total || game.over_under);
          
          if ((bet.selection === 'Over' || bet.selection === 'OVER') && totalScore > gameTotal) isWinner = true;
          else if ((bet.selection === 'Under' || bet.selection === 'UNDER') && totalScore < gameTotal) isWinner = true;
          else if (totalScore === gameTotal) isPush = true;
        }

        if (isWinner) {
          const numOdds = parseFloat(bet.odds);
          let profit = numOdds > 0 ? bet.wager_amount * (numOdds / 100) : bet.wager_amount * (100 / Math.abs(numOdds));
          const payout = bet.wager_amount + profit;

          const { data: profile } = await supabase.from('profiles').select('balance').eq('id', bet.user_id).single();
          if (profile) {
            await supabase.from('profiles').update({ balance: profile.balance + payout }).eq('id', bet.user_id);
          }
          await supabase.from('bets').update({ status: 'won' }).eq('id', bet.id);
        } 
        else if (isPush) {
          const { data: profile } = await supabase.from('profiles').select('balance').eq('id', bet.user_id).single();
          if (profile) {
            await supabase.from('profiles').update({ balance: profile.balance + bet.wager_amount }).eq('id', bet.user_id);
          }
          await supabase.from('bets').update({ status: 'push' }).eq('id', bet.id);
        } 
        else {
          await supabase.from('bets').update({ status: 'lost' }).eq('id', bet.id);
        }
      }
    }
    
    // Update the Latest Graded Week tracker if this game belongs to a new week
    if (!latestGradedWeek || game.week_number > latestGradedWeek) {
      setLatestGradedWeek(game.week_number);
    }

    alert(`${game.away_team} @ ${game.home_team} has been officially graded!`);
    setGames(games.filter(g => g.id !== game.id));
  }

  async function processWeeklyRollover() {
    if (!rolloverWeek) return alert("Please enter the week number you want to close out.");
    
    const weekNum = parseInt(rolloverWeek);
    const confirmMessage = `WARNING: You are about to deposit the Weekly Stimulus for Week ${weekNum}. This will add money to players' active wallets based on what they wagered in Week ${weekNum}.\n\nAre you sure you want to proceed?`;
    
    if (window.confirm(confirmMessage)) {
      setIsProcessingRollover(true);
      try {
        const { error } = await supabase.rpc('process_weekly_stimulus', { completed_week: weekNum });
        if (error) throw error;
        
        alert(`✅ SUCCESS: Week ${weekNum} stimulus checks have been deposited! Wallets are reloaded.`);
        setRolloverWeek("");
      } catch (err) {
        console.error(err);
        alert(`Error processing rollover: ${err.message}`);
      } finally {
        setIsProcessingRollover(false);
      }
    }
  }

  if (authLoading) return <main className="p-8 text-center font-black uppercase italic text-brand-dark">Verifying Credentials...</main>;

  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-4">
        <div className="bg-white p-12 rounded-3xl shadow-2xl text-center max-w-md w-full border-t-8 border-red-500">
          <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-4 text-brand-dark">Access Denied</h1>
          <p className="font-bold mb-8 text-gray-500">You must be the Commissioner to access the grading vault.</p>
          <a href="/" className="inline-block bg-brand-dark text-brand-volt px-8 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-[#1e293b] transition-colors shadow-lg">Return to Board</a>
        </div>
      </main>
    );
  }

  if (loading) return <p className="p-8 text-center font-bold text-brand-dark">Opening the Vault...</p>;

  return (
    <main className="min-h-screen bg-slate-200 text-brand-dark font-sans pb-12">
      
      <nav className="bg-[#0b0f19] p-4 border-b-2 border-brand-violet sticky top-0 z-40 shadow-xl mb-8">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/icon.png" alt="Action League" className="w-8 h-8 object-contain" />
            <h1 className="text-xl font-black text-white italic tracking-tighter uppercase">Front Office <span className="text-brand-volt">/</span> Grade</h1>
          </div>
          <a href="/" className="text-[10px] font-black text-brand-violet uppercase hover:text-white transition-colors tracking-widest bg-brand-violet/10 px-3 py-1.5 rounded-full border border-brand-violet/30">Exit Vault →</a>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-4 md:p-8 mt-4">
        <div className="mb-8 border-b-2 border-gray-300 pb-4">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-brand-dark">Pending Games</h1>
          <p className="text-sm font-bold text-gray-500 uppercase mt-1">Careful. Grading is permanent.</p>
        </div>
        
        <div className="grid gap-6 mb-12">
          {games.length === 0 ? (
            <div className="text-center p-12 bg-white rounded-2xl shadow-xl border border-gray-200">
               <p className="text-gray-400 font-bold uppercase italic text-lg tracking-widest">The board is clean.</p>
            </div>
          ) : (
            games.map(game => {
              const kickoffDate = new Date(game.kickoff);
              
              return (
                <div key={game.id} className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
                  <div className="bg-[#0b0f19] p-3 flex justify-between items-center px-4 border-b-4 border-brand-violet">
                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                      {kickoffDate.toLocaleDateString()}
                    </span>
                    <span className="text-[9px] font-black bg-brand-violet text-white px-2 py-0.5 rounded uppercase shadow-sm">
                      Week {game.week_number}
                    </span>
                  </div>

                  <div className="p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="w-full md:w-auto text-center md:text-left">
                      <h2 className="font-black text-xl uppercase tracking-tighter text-brand-dark">
                        {game.away_team} <span className="text-gray-300 mx-1">@</span> {game.home_team}
                      </h2>
                    </div>
                    
                    <div className="flex gap-4 items-center bg-slate-50 p-4 rounded-xl border border-gray-200 w-full md:w-auto">
                      <div className="flex flex-col">
                        <label className="text-[9px] font-black text-gray-400 uppercase mb-1">{game.away_abbr} Score</label>
                        <input type="number" className="w-20 border-2 border-gray-200 p-2 rounded-lg font-black text-center focus:border-brand-violet outline-none text-xl" onChange={(e) => handleScoreChange(game.id, 'away', e.target.value)} />
                      </div>
                      
                      <span className="font-black text-gray-300 text-xl pt-4">-</span>
                      
                      <div className="flex flex-col">
                        <label className="text-[9px] font-black text-gray-400 uppercase mb-1">{game.home_abbr} Score</label>
                        <input type="number" className="w-20 border-2 border-gray-200 p-2 rounded-lg font-black text-center focus:border-brand-violet outline-none text-xl" onChange={(e) => handleScoreChange(game.id, 'home', e.target.value)} />
                      </div>
                      
                      <div className="ml-4 pt-4">
                        <button onClick={() => gradeGame(game)} className="bg-brand-dark text-brand-volt px-6 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-[#1e293b] shadow-md transition-all active:scale-95">Grade</button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* LEAGUE MANAGEMENT SECTION */}
        <div className="mb-8 border-b-2 border-gray-300 pb-4">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-brand-dark">League Management</h1>
          <p className="text-sm font-bold text-gray-500 uppercase mt-1">End of week processing</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex-1">
            <h3 className="font-black uppercase tracking-tighter text-xl text-brand-dark">Deposit Weekly Stimulus</h3>
            <p className="text-xs font-bold text-gray-500 uppercase mt-2 leading-relaxed">
              Run this after all games for a week are officially graded. This will scan all tickets for the specified week and deposit matching funds (up to $100) directly into players' live wallets.
            </p>
            
            {/* NEW: DYNAMIC INDICATOR */}
            {latestGradedWeek !== null && (
              <div className="mt-4 inline-block bg-[#0b0f19] text-brand-volt px-3 py-1.5 rounded-lg border border-gray-800 text-[10px] font-black uppercase tracking-widest shadow-sm">
                Latest Graded Week: <span className="text-white text-xs ml-1">{latestGradedWeek}</span>
              </div>
            )}

          </div>
          
          <div className="flex flex-col items-end gap-3 w-full md:w-auto">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Close Week:</span>
              <input 
                type="number" 
                placeholder="Ex: 1" 
                value={rolloverWeek}
                onChange={(e) => setRolloverWeek(e.target.value)}
                className="w-24 border-2 border-gray-200 p-3 rounded-xl font-black text-center focus:border-brand-violet outline-none text-lg" 
              />
            </div>
            <button 
              onClick={processWeeklyRollover}
              disabled={isProcessingRollover}
              className="w-full bg-brand-violet text-white px-6 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-[#0b0f19] shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:bg-gray-400"
            >
              {isProcessingRollover ? 'Processing...' : 'Run Rollover'}
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}