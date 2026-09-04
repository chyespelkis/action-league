"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function CommissionerOffice() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [games, setGames] = useState([]);
  const [scores, setScores] = useState({});
  const [isGrading, setIsGrading] = useState(false);
  
  const [rolloverWeek, setRolloverWeek] = useState("");
  const [isProcessingRollover, setIsProcessingRollover] = useState(false);
  const [latestGradedWeek, setLatestGradedWeek] = useState(null);

  useEffect(() => {
    async function checkAuthAndFetch() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        
if (prof?.role === 'admin' || session.user.email === 'chyespelkis@gmail.com') {          setIsAuthorized(true);
          
          const { data } = await supabase.from('games').select('*').eq('status', 'pending').order('kickoff', { ascending: true });
          if (data) setGames(data);

          const { data: finalGames } = await supabase.from('games').select('week_number').eq('status', 'final');
          if (finalGames && finalGames.length > 0) {
            setLatestGradedWeek(Math.max(...finalGames.map(g => g.week_number)));
          }
        }
      }
      setAuthLoading(false);
    }
    checkAuthAndFetch();
  }, []);

  const handleScoreChange = (gameId, team, val) => {
    setScores(prev => ({ ...prev, [gameId]: { ...prev[gameId], [team]: val === "" ? undefined : parseInt(val) } }));
  };

  async function handleBulkGrade() {
    const gamesToGrade = games.filter(g => scores[g.id]?.home !== undefined && scores[g.id]?.away !== undefined);
    
    if (gamesToGrade.length === 0) return alert("Enter both the Away and Home scores for at least one game to grade it.");
    if (!window.confirm(`You are about to officially grade ${gamesToGrade.length} game(s) and pay out all matching tickets.\n\nProceed?`)) return;

    setIsGrading(true);
    try {
      for (let game of gamesToGrade) {
        const homeScore = scores[game.id].home;
        const awayScore = scores[game.id].away;

        await supabase.from('games').update({ home_score: homeScore, away_score: awayScore, status: 'final' }).eq('id', game.id);
        
        const { data: bets } = await supabase.from('bets').select('*').eq('game_id', game.id).eq('status', 'pending');

        if (bets && bets.length > 0) {
          for (let bet of bets) {
            let isWinner = false;
            let isPush = false; 

            if (bet.bet_type === 'moneyline') {
              if (homeScore > awayScore) {
                if (bet.selection === game.home_team || bet.selection === game.home_abbr) isWinner = true;
              } else if (awayScore > homeScore) {
                if (bet.selection === game.away_team || bet.selection === game.away_abbr) isWinner = true;
              } else {
                isPush = true;
              }
            } 
            else if (bet.bet_type === 'spread') {
              const betLine = parseFloat(bet.line_at_bet);
              if (bet.selection === game.home_team || bet.selection === game.home_abbr) {
                if ((homeScore + betLine) > awayScore) isWinner = true;
                else if ((homeScore + betLine) === awayScore) isPush = true;
              } else {
                if ((awayScore + betLine) > homeScore) isWinner = true;
                else if ((awayScore + betLine) === homeScore) isPush = true;
              }
            } 
            else if (bet.bet_type === 'total') {
              const totalScore = homeScore + awayScore;
              const gameTotal = parseFloat(game.total_points || game.total || game.over_under);
              
              if ((bet.selection === 'Over' || bet.selection === 'OVER') && totalScore > gameTotal) isWinner = true;
              else if ((bet.selection === 'Under' || bet.selection === 'UNDER') && totalScore < gameTotal) isWinner = true;
              else if (totalScore === gameTotal) isPush = true;
            }

            // Sequential balance fetch ensures no race conditions when paying out multiple bets to the same user
            if (isWinner) {
              const numOdds = parseFloat(bet.odds);
              let profit = numOdds > 0 ? bet.wager_amount * (numOdds / 100) : bet.wager_amount * (100 / Math.abs(numOdds));
              const payout = bet.wager_amount + profit;

              const { data: profile } = await supabase.from('profiles').select('balance').eq('id', bet.user_id).single();
              if (profile) await supabase.from('profiles').update({ balance: profile.balance + payout }).eq('id', bet.user_id);
              await supabase.from('bets').update({ status: 'won' }).eq('id', bet.id);
            } 
            else if (isPush) {
              const { data: profile } = await supabase.from('profiles').select('balance').eq('id', bet.user_id).single();
              if (profile) await supabase.from('profiles').update({ balance: profile.balance + bet.wager_amount }).eq('id', bet.user_id);
              await supabase.from('bets').update({ status: 'push' }).eq('id', bet.id);
            } 
            else {
              await supabase.from('bets').update({ status: 'lost' }).eq('id', bet.id);
            }
          }
        }
      }
      alert(`✅ Successfully graded ${gamesToGrade.length} game(s)!`);
      window.location.reload(); 
    } catch (err) {
      console.error(err);
      alert(`Grading Error: ${err.message}`);
    } finally {
      setIsGrading(false);
    }
  }

  async function processWeeklyRollover() {
    if (!rolloverWeek) return alert("Enter the week number you want to close out.");
    if (window.confirm(`Deposit Weekly Stimulus for Week ${rolloverWeek}?\n\nThis adds money to players' wallets based on their Week ${rolloverWeek} wagers (up to $100).`)) {
      setIsProcessingRollover(true);
      try {
        const { error } = await supabase.rpc('process_weekly_stimulus', { completed_week: parseInt(rolloverWeek) });
        if (error) throw error;
        alert(`✅ SUCCESS: Week ${rolloverWeek} stimulus deposited!`);
        setRolloverWeek("");
      } catch (err) { alert(`Error: ${err.message}`); } 
      finally { setIsProcessingRollover(false); }
    }
  }

  if (authLoading) return <main className="p-8 text-center font-black uppercase italic text-brand-dark">Verifying...</main>;

  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-4">
        <div className="bg-white p-12 rounded-3xl text-center border-t-8 border-red-500 max-w-md w-full">
          <h1 className="text-4xl font-black uppercase italic text-brand-dark mb-4">Access Denied</h1>
          <a href="/" className="inline-block bg-brand-dark text-brand-volt px-8 py-4 rounded-xl font-black uppercase">Return to Board</a>
        </div>
      </main>
    );
  }

  const readyToGradeCount = games.filter(g => scores[g.id]?.home !== undefined && scores[g.id]?.away !== undefined).length;

  return (
    <main className="min-h-screen bg-slate-200 text-brand-dark font-sans pb-12">
      <nav className="bg-[#0b0f19] p-4 border-b-2 border-brand-violet sticky top-0 z-40 shadow-xl mb-8">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/icon.png" alt="Action League" className="w-8 h-8 object-contain" />
            <h1 className="text-xl font-black text-white italic tracking-tighter uppercase">Front Office</h1>
          </div>
          <a href="/" className="text-[10px] font-black text-brand-violet uppercase hover:text-white transition-colors bg-brand-violet/10 px-3 py-1.5 rounded-full border border-brand-violet/30">Exit Vault →</a>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-4 md:p-8">
        
        {/* BULK GRADING SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 border-b-2 border-gray-300 pb-4 gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter">Bulk Grading</h1>
            <p className="text-sm font-bold text-gray-500 uppercase mt-1">Enter final scores. Leave pending games blank.</p>
          </div>
          <button 
            onClick={handleBulkGrade}
            disabled={isGrading || readyToGradeCount === 0}
            className="bg-brand-dark text-brand-volt px-6 py-3 rounded-xl font-black uppercase tracking-widest shadow-lg hover:bg-[#1e293b] disabled:opacity-50 disabled:bg-gray-400 transition-all"
          >
            {isGrading ? 'Processing...' : `Grade Selected (${readyToGradeCount})`}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-12">
          {games.length === 0 ? (
            <div className="lg:col-span-2 text-center p-12 bg-white rounded-xl shadow-sm border border-gray-200">
               <p className="text-gray-400 font-bold uppercase italic tracking-widest">The board is clean.</p>
            </div>
          ) : (
            games.map(game => (
              <div key={game.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col sm:flex-row">
                
                <div className="bg-[#0b0f19] p-4 flex sm:flex-col justify-between items-center sm:justify-center sm:w-24 border-b sm:border-b-0 sm:border-r-4 border-brand-violet shrink-0">
                  <span className="text-[10px] font-black text-gray-400 uppercase text-center">{new Date(game.kickoff).toLocaleDateString(undefined, {weekday: 'short', month: 'numeric', day: 'numeric'})}</span>
                  <span className="text-[9px] font-black bg-brand-violet text-white px-2 py-0.5 rounded uppercase mt-0 sm:mt-2">Wk {game.week_number}</span>
                </div>

                <div className="p-4 flex-1 flex justify-between items-center gap-4">
                  <div className="flex flex-col flex-1 items-end gap-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase">{game.away_team}</span>
                    <input type="number" placeholder="Away" value={scores[game.id]?.away ?? ''} onChange={(e) => handleScoreChange(game.id, 'away', e.target.value)} className="w-16 border-2 border-gray-200 p-2 rounded-lg font-black text-center focus:border-brand-violet outline-none text-lg" />
                  </div>
                  
                  <span className="font-black text-gray-300 text-xl">@</span>
                  
                  <div className="flex flex-col flex-1 items-start gap-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase">{game.home_team}</span>
                    <input type="number" placeholder="Home" value={scores[game.id]?.home ?? ''} onChange={(e) => handleScoreChange(game.id, 'home', e.target.value)} className="w-16 border-2 border-gray-200 p-2 rounded-lg font-black text-center focus:border-brand-violet outline-none text-lg" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* LEAGUE MANAGEMENT SECTION */}
        <div className="mb-6 border-b-2 border-gray-300 pb-4">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter">League Management</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex-1">
            <h3 className="font-black uppercase tracking-tighter text-xl">Weekly Stimulus Deposit</h3>
            <p className="text-xs font-bold text-gray-500 uppercase mt-2 leading-relaxed">
              Run this after all games for a week are officially graded. Drops up to $100 into live wallets based on prior week wagers.
            </p>
            {latestGradedWeek !== null && (
              <div className="mt-4 inline-block bg-[#0b0f19] text-brand-volt px-3 py-1.5 rounded-lg border border-gray-800 text-[10px] font-black uppercase tracking-widest shadow-sm">
                Latest Graded Week: <span className="text-white text-xs ml-1">{latestGradedWeek}</span>
              </div>
            )}
          </div>
          
          <div className="flex flex-col items-end gap-3 w-full md:w-auto">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Close Week:</span>
              <input type="number" placeholder="Ex: 1" value={rolloverWeek} onChange={(e) => setRolloverWeek(e.target.value)} className="w-24 border-2 border-gray-200 p-3 rounded-xl font-black text-center focus:border-brand-violet outline-none text-lg" />
            </div>
            <button onClick={processWeeklyRollover} disabled={isProcessingRollover} className="w-full bg-brand-violet text-white px-6 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-[#0b0f19] shadow-lg transition-all active:scale-95 disabled:opacity-50">
              {isProcessingRollover ? 'Processing...' : 'Run Rollover'}
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}