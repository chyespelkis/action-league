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

  useEffect(() => {
    async function checkAuthAndFetch() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Fetch the user's profile to verify they are an admin
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        
        if (prof?.role === 'admin' || prof?.display_name?.toUpperCase() === 'CJYES') {
          setIsAuthorized(true);
          const { data } = await supabase.from('games').select('*').eq('status', 'pending').order('kickoff', { ascending: true });
          if (data) setGames(data);
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

    // 1. Finalize the game score
    await supabase.from('games').update({ home_score: home, away_score: away, status: 'final' }).eq('id', game.id);
    
    // 2. Fetch all pending bets for this specific game
    const { data: bets } = await supabase.from('bets').select('*').eq('game_id', game.id).eq('status', 'pending');

    if (bets && bets.length > 0) {
      for (let bet of bets) {
        let isWinner = false;
        let isPush = false; 

        // THE MATH ENGINE
        if (bet.bet_type === 'moneyline') {
          const winner = home > away ? game.home_team : (away > home ? game.away_team : 'Tie');
          if (bet.selection === winner) isWinner = true;
          else if (winner === 'Tie') isPush = true; 
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

        // PROCESSING THE PAYOUT (Now correctly pointed to profiles)
        if (isWinner) {
          const numOdds = parseFloat(bet.odds);
          let profit = numOdds > 0 ? bet.wager_amount * (numOdds / 100) : bet.wager_amount * (100 / Math.abs(numOdds));
          const payout = bet.wager_amount + profit; // Returns stake + profit

          // Get the user's current LIVE profile balance
          const { data: profile } = await supabase.from('profiles').select('balance').eq('id', bet.user_id).single();
          
          if (profile) {
            // Update the main profile wallet
            await supabase.from('profiles').update({ balance: profile.balance + payout }).eq('id', bet.user_id);
          }
          await supabase.from('bets').update({ status: 'won' }).eq('id', bet.id);
        } 
        else if (isPush) {
          // REFUND THE WAGER
          const { data: profile } = await supabase.from('profiles').select('balance').eq('id', bet.user_id).single();
          
          if (profile) {
            await supabase.from('profiles').update({ balance: profile.balance + bet.wager_amount }).eq('id', bet.user_id);
          }
          await supabase.from('bets').update({ status: 'push' }).eq('id', bet.id);
        } 
        else {
          // LOSS: Do not refund wallet, just mark ticket lost
          await supabase.from('bets').update({ status: 'lost' }).eq('id', bet.id);
        }
      }
    }
    alert(`${game.away_team} @ ${game.home_team} has been officially graded!`);
    
    // Remove game from the commissioner's pending list visually
    setGames(games.filter(g => g.id !== game.id));
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
      
      {/* BRANDED NAV BAR */}
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
        
        <div className="grid gap-6">
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
      </div>
    </main>
  );
}