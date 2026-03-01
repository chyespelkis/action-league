"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 🛑 REPLACE THIS WITH YOUR ACTUAL LOGIN EMAIL 🛑
const COMMISSIONER_EMAIL = 'chyespelkis@gmail.com';

export default function GradingRoom() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState({});

  useEffect(() => {
    async function checkAuthAndFetch() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email === COMMISSIONER_EMAIL) {
        setIsAuthorized(true);
        const { data } = await supabase.from('games').select('*').eq('status', 'pending').order('kickoff', { ascending: true });
        if (data) setGames(data);
        setLoading(false);
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

    if (bets) {
      for (let bet of bets) {
        let isWinner = false;
        let isPush = false; // NEW: The Push Tracker

        if (bet.bet_type === 'moneyline') {
          const winner = home > away ? game.home_team : (away > home ? game.away_team : 'Tie');
          if (bet.selection === winner) isWinner = true;
          else if (winner === 'Tie') isPush = true; // Moneyline tie (rare but possible)
        } 
        else if (bet.bet_type === 'spread') {
          if (bet.selection === game.home_team) {
            if ((home + game.home_spread) > away) isWinner = true;
            else if ((home + game.home_spread) === away) isPush = true;
          } else {
            if ((away + game.away_spread) > home) isWinner = true;
            else if ((away + game.away_spread) === home) isPush = true;
          }
        } 
        else if (bet.bet_type === 'total') {
          const totalScore = home + away;
          if (bet.selection === 'Over' && totalScore > game.total_points) isWinner = true;
          else if (bet.selection === 'Under' && totalScore < game.total_points) isWinner = true;
          else if (totalScore === game.total_points) isPush = true;
        }

        // Processing the Result
        if (isWinner) {
          let profit = bet.odds > 0 ? bet.wager_amount * (bet.odds / 100) : bet.wager_amount * (100 / Math.abs(bet.odds));
          const payout = bet.wager_amount + profit;

          const { data: wallet } = await supabase.from('weekly_wallets').select('balance').eq('user_id', bet.user_id).single();
          if (wallet) await supabase.from('weekly_wallets').update({ balance: wallet.balance + payout }).eq('user_id', bet.user_id);
          await supabase.from('bets').update({ status: 'won' }).eq('id', bet.id);
        } 
        else if (isPush) {
          // REFUND THE WAGER
          const { data: wallet } = await supabase.from('weekly_wallets').select('balance').eq('user_id', bet.user_id).single();
          if (wallet) await supabase.from('weekly_wallets').update({ balance: wallet.balance + bet.wager_amount }).eq('user_id', bet.user_id);
          await supabase.from('bets').update({ status: 'push' }).eq('id', bet.id); // Mark as push in DB
        } 
        else {
          await supabase.from('bets').update({ status: 'lost' }).eq('id', bet.id);
        }
      }
    }
    alert(`${game.away_team} @ ${game.home_team} has been graded!`);
    setGames(games.filter(g => g.id !== game.id));
  }

  if (authLoading) return <main className="p-8 text-center font-black uppercase italic text-brand-dark">Verifying Credentials...</main>;

  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
        <div className="bg-red-500 text-white p-8 rounded-xl shadow-2xl text-center max-w-md w-full border-4 border-red-700">
          <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-4">Access Denied</h1>
          <p className="font-bold mb-6 text-red-100">You must be the Commissioner to grade papers.</p>
          <a href="/" className="inline-block bg-brand-dark text-brand-volt px-6 py-3 rounded-lg font-black uppercase tracking-widest hover:bg-brand-panel transition-colors shadow-lg">Return to Board</a>
        </div>
      </main>
    );
  }

  if (loading) return <p className="p-8 text-center font-bold text-brand-dark">Opening the Vault...</p>;

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b-4 border-brand-violet pb-4">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-brand-dark">Grading Room</h1>
          <a href="/" className="text-[10px] text-brand-violet font-bold uppercase hover:text-brand-dark transition-colors">← Back to Board</a>
        </div>
        
        <div className="grid gap-6">
          {games.length === 0 ? (
            <p className="text-gray-500 font-bold italic text-center p-12 bg-white rounded-xl shadow border">No pending games to grade.</p>
          ) : (
            games.map(game => (
              <div key={game.id} className="bg-white p-6 rounded-xl shadow border-l-8 border-l-brand-dark flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <h2 className="font-black text-lg uppercase italic text-brand-dark">{game.away_team} @ {game.home_team}</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                    H {game.home_spread > 0 ? `+${game.home_spread}` : game.home_spread} | O/U {game.total_points}
                  </p>
                </div>
                <div className="flex gap-4 items-center w-full md:w-auto">
                  <input type="number" placeholder="Away" className="w-20 border-2 border-gray-200 p-2 rounded-lg font-bold text-center focus:border-brand-violet outline-none" onChange={(e) => handleScoreChange(game.id, 'away', e.target.value)} />
                  <span className="font-black text-gray-400">-</span>
                  <input type="number" placeholder="Home" className="w-20 border-2 border-gray-200 p-2 rounded-lg font-bold text-center focus:border-brand-violet outline-none" onChange={(e) => handleScoreChange(game.id, 'home', e.target.value)} />
                  <button onClick={() => gradeGame(game)} className="bg-brand-volt text-brand-dark px-6 py-2 rounded-lg font-black uppercase tracking-widest hover:bg-white shadow-[0_0_10px_rgba(57,255,20,0.4)] transition-all">Grade</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}