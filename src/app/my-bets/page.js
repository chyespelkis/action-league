"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function MyBets() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [balance, setBalance] = useState(0); // Restored the True Bankroll state
  
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [activeWeek, setActiveWeek] = useState(null);

  useEffect(() => {
    async function fetchUserBets() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        
        if (session?.user) {
          setUser(session.user);
          const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
          if (prof) {
            setProfile(prof);
            setBalance(prof.balance || 0); // Sync to live bankroll
          }

          const { data: allGames } = await supabase.from('games').select('week_number');
          if (allGames) {
            const weeks = [...new Set(allGames.map(g => g.week_number).filter(Boolean))].sort((a, b) => b - a);
            setAvailableWeeks(weeks);
            if (weeks.length > 0) setActiveWeek(weeks[0]);
          }

          let fetchedBets = [];
          const { data: primaryData, error: primaryError } = await supabase
            .from('bets')
            .select(`id, selection, line_at_bet, wager_amount, status, bet_type, created_at, odds, games (home_team, away_team, kickoff, home_score, away_score, status, week_number, away_abbr, home_abbr)`)
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });

          if (primaryError) {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('bets')
              .select(`id, selection, line_at_bet, wager_amount, status, bet_type, created_at, odds, games!fk_bets_games (home_team, away_team, kickoff, home_score, away_score, status, week_number, away_abbr, home_abbr)`)
              .eq('user_id', session.user.id)
              .order('created_at', { ascending: false });
            if (fallbackError) throw fallbackError;
            fetchedBets = fallbackData;
          } else {
            fetchedBets = primaryData;
          }

          if (fetchedBets) setBets(fetchedBets);
        }
      } catch (err) {
        console.error("Data Fetch Error:", err);
        setErrorMsg(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchUserBets();
  }, []);

  const isCommissioner = profile?.role === 'admin' || profile?.display_name?.toUpperCase() === 'CJYES';

  if (loading) return <main className="min-h-screen bg-slate-200 p-8 text-center font-black uppercase italic text-gray-400 text-xl tracking-widest mt-20">Loading Slips...</main>;
  
  if (errorMsg) return (
    <main className="min-h-screen bg-slate-200 p-8 text-center">
      <div className="bg-red-50 border-2 border-red-200 p-8 rounded-xl max-w-lg mx-auto">
        <h2 className="text-red-600 font-black uppercase text-xl mb-2">Database Error</h2>
        <p className="text-red-500 font-bold text-sm mb-4">The page crashed while trying to load your bets.</p>
        <code className="bg-red-100 text-red-800 p-2 rounded text-xs block">{errorMsg}</code>
      </div>
    </main>
  );

  const filteredBets = bets.filter(b => b.games?.week_number === activeWeek);
  const pendingBets = filteredBets.filter(b => b.status === 'pending');
  const gradedBets = filteredBets.filter(b => b.status !== 'pending');

  return (
    <main className="min-h-screen bg-slate-200 text-brand-dark font-sans pb-12">
      <nav className="bg-[#0b0f19] p-4 border-b-2 border-brand-violet sticky top-0 z-40 shadow-xl mb-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src="/icon.png" alt="Action League" className="w-10 h-10 object-contain" />
              <h1 className="text-2xl font-black text-brand-volt italic tracking-tighter uppercase leading-none">Action League</h1>
            </a>
            <div className="h-6 w-px bg-gray-700 hidden md:block"></div>
            <a href="/leaderboard" className="text-[10px] font-black text-brand-violet uppercase hover:text-white transition-colors tracking-widest bg-brand-violet/10 px-3 py-1.5 rounded-full border border-brand-violet/30">Standings →</a>
          </div>

          <div className="flex gap-4 items-center flex-wrap justify-center">
            
            {/* CLEAN BANKROLL DISPLAY */}
            <div className="bg-[#1e293b] px-4 py-1.5 rounded-lg border border-brand-volt/20 text-right mr-2 shadow-sm">
              <p className="text-[8px] font-black text-gray-500 uppercase leading-none mb-1">Bankroll</p>
              <p className="text-lg font-black text-brand-volt leading-none tracking-tighter">${balance.toFixed(2)}</p>
            </div>

            {isCommissioner && (
              <>
                <a href="/commissioner" className="text-[10px] font-black text-brand-volt uppercase hover:text-white transition-colors">Front Office</a>
                <div className="h-4 w-px bg-gray-700"></div>
              </>
            )}
            <a href="/" className="text-[10px] font-black text-white uppercase hover:text-brand-volt transition-colors">The Board</a>
            <a href="YOUR_GOOGLE_FORM_LINK" target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-gray-400 uppercase hover:text-brand-volt transition-colors">Feedback</a>
            <a href="/my-bets" className="bg-brand-violet text-white px-4 py-2 rounded font-black uppercase text-[10px] shadow-md">My Slips</a>
            <button onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')} className="text-[9px] text-gray-500 font-bold uppercase border-l border-gray-800 pl-4 hover:text-red-400 transition-colors">Sign Out</button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b-4 border-brand-violet pb-4 gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter text-brand-dark mb-3">My Bet Slips</h1>
            {availableWeeks.length > 0 && (
              <div className="flex gap-2">
                {availableWeeks.map(weekNum => (
                  <button 
                    key={weekNum}
                    onClick={() => setActiveWeek(weekNum)}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                      activeWeek === weekNum 
                      ? 'bg-brand-violet text-white shadow-md' 
                      : 'bg-white text-gray-500 border border-gray-300 hover:border-brand-violet hover:text-brand-violet'
                    }`}
                  >
                    Week {weekNum}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {filteredBets.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl shadow-sm text-center border border-gray-200">
            <p className="text-gray-400 font-bold uppercase tracking-widest">No wagers on the books for Week {activeWeek || '?'}.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {pendingBets.length > 0 && (
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500 border-b-2 border-gray-300 pb-2 mb-6">Pending Action</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pendingBets.map((bet) => <TicketCard key={bet.id} bet={bet} />)}
                </div>
              </div>
            )}
            {gradedBets.length > 0 && (
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500 border-b-2 border-gray-300 pb-2 mb-6">Graded Slips</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {gradedBets.map((bet) => <TicketCard key={bet.id} bet={bet} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function TicketCard({ bet }) {
  const isWin = bet.status === 'won';
  const isLoss = bet.status === 'lost';
  const isPush = bet.status === 'push';
  const isPending = bet.status === 'pending';

  const cardStyle = isWin ? 'bg-green-50 border-green-200' : isLoss ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200';
  const badgeStyle = isPending ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : isWin ? 'bg-brand-volt text-brand-dark border-brand-volt shadow-sm' : isPush ? 'bg-gray-100 text-gray-700 border-gray-300' : 'bg-red-100 text-red-700 border-red-300';

  const awayTeam = bet.games?.away_team || 'Away';
  const homeTeam = bet.games?.home_team || 'Home';

  // Math for the ticket readout
  const numOdds = parseFloat(bet.odds) || -110;
  const amount = parseFloat(bet.wager_amount);
  const profit = numOdds > 0 ? (amount * numOdds) / 100 : amount / (Math.abs(numOdds) / 100);

  return (
    <div className={`rounded-xl shadow-md hover:shadow-lg transition-shadow overflow-hidden border flex flex-col ${cardStyle}`}>
      <div className="bg-[#0b0f19] px-4 py-2 border-b-4 border-brand-violet flex justify-between items-center">
        <span className="text-[10px] font-black text-brand-volt uppercase tracking-widest">{bet.bet_type} Ticket</span>
        {bet.games?.status === 'final' && (
          <span className="text-[10px] font-black text-white uppercase bg-brand-violet px-2 py-0.5 rounded shadow-sm">
            Final: {bet.games?.away_score} - {bet.games?.home_score}
          </span>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <p className="text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wider truncate">{awayTeam} @ {homeTeam}</p>
          <h2 className="text-xl font-black text-brand-dark uppercase italic leading-tight">
            {bet.selection} 
            <span className="text-brand-violet not-italic ml-2 text-base">{bet.line_at_bet}</span>
          </h2>
        </div>
        
        <div className="mt-6 flex justify-between items-end border-t border-gray-200 pt-4">
          <div className="flex flex-col">
            <p className="text-[10px] font-bold text-gray-500 uppercase">
              Risked: <span className="text-gray-900 text-sm font-black ml-1">${amount.toFixed(2)}</span>
            </p>
            {isWin && (
              <p className="text-[10px] font-bold text-green-700 uppercase mt-1">
                Won: <span className="text-green-600 text-sm font-black ml-1">+${profit.toFixed(2)}</span>
              </p>
            )}
            {isPending && (
              <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">
                To Win: <span className="text-gray-500 text-sm font-black ml-1">+${profit.toFixed(2)}</span>
              </p>
            )}
          </div>
          <div className={`px-3 py-1 rounded-md text-[10px] font-black uppercase italic border ${badgeStyle}`}>
            {bet.status}
          </div>
        </div>
      </div>
    </div>
  );
}