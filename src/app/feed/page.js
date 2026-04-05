"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function ActionFeed() {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Nav Bar State
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [balance, setBalance] = useState(0);

  // Week Selector State
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);

  useEffect(() => {
    async function loadFeed() {
      // 1. Fetch User Data for Nav Bar
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (prof) {
          setProfile(prof);
          setBalance(prof.balance || 0);
        }
      }

      // 2. Fetch Feed Data 
      const { data, error } = await supabase
        .from('bets')
        .select(`
          *,
          games!fk_bets_games (*),
          profiles!fk_bets_profiles (display_name)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Supabase Error:", error);
        alert("Database Error: " + error.message);
      }

      if (data) {
        setFeed(data);
        const weeks = Array.from(new Set(data.map(b => b.games?.week_number)))
          .filter(w => w != null)
          .sort((a, b) => b - a); 
        
        setAvailableWeeks(weeks);
        if (weeks.length > 0) setSelectedWeek(weeks[0]);
      }
      setLoading(false);
    }
    loadFeed();
  }, []);

  const hasGameStarted = (kickoffTime) => {
    return new Date() >= new Date(kickoffTime);
  };

  const isCommissioner = profile?.role === 'admin' || profile?.display_name?.toUpperCase() === 'CJYES';

  const currentFeed = feed.filter(b => b.games?.week_number === selectedWeek);
  const players = Array.from(new Set(currentFeed.map(b => b.profiles?.display_name || 'Unknown'))).sort();

  const uniqueGamesMap = new Map();
  currentFeed.forEach(b => {
    if (!uniqueGamesMap.has(b.game_id)) {
      uniqueGamesMap.set(b.game_id, b.games);
    }
  });
  const games = Array.from(uniqueGamesMap.values()).sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));

  return (
    <main className="min-h-screen bg-slate-200 text-brand-dark font-sans pb-12">
      
      {/* BRANDED NAV BAR */}
      <nav className="bg-[#0b0f19] p-4 border-b-2 border-brand-violet sticky top-0 z-40 shadow-xl">
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
            <div className="bg-[#1e293b] px-4 py-1.5 rounded-lg border border-brand-volt/20 text-right mr-2 shadow-sm">
              <p className="text-[8px] font-black text-gray-500 uppercase leading-none mb-1">Wallet</p>
              <p className="text-lg font-black text-brand-volt leading-none tracking-tighter">${balance.toFixed(2)}</p>
            </div>

            {isCommissioner && (
              <>
                <a href="/commissioner" className="text-[10px] font-black text-brand-volt uppercase hover:text-white transition-colors">Front Office</a>
                <a href="/grade" className="text-[10px] font-black text-brand-volt uppercase hover:text-white transition-colors">Grade</a>
                <div className="h-4 w-px bg-gray-700"></div>
              </>
            )}
            <a href="/" className="text-[10px] font-black text-white uppercase hover:text-brand-volt transition-colors">The Board</a>
            <a href="YOUR_GOOGLE_FORM_LINK" target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-gray-400 uppercase hover:text-brand-volt transition-colors">Feedback</a>
            <a href="/my-bets" className="bg-brand-violet text-white px-4 py-2 rounded font-black uppercase text-[10px] hover:bg-white hover:text-brand-violet transition-colors shadow-md">My Slips</a>
            <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="text-[9px] text-gray-500 font-bold uppercase border-l border-gray-800 pl-4 hover:text-red-400 transition-colors">Sign Out</button>
          </div>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto p-4 md:p-8 mt-4">
        
        {/* HEADER SECTION WITH PILL TOGGLES */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 border-b-2 border-gray-300 pb-4 gap-4">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-brand-dark">The Action Matrix</h1>
          
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            {availableWeeks.map(w => (
              <button 
                key={w}
                onClick={() => setSelectedWeek(w)}
                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all shadow-sm ${
                  selectedWeek === w 
                  ? 'bg-brand-violet text-white shadow-md' 
                  : 'bg-white text-gray-500 border border-gray-200 hover:border-brand-violet hover:text-brand-violet'
                }`}
              >
                Week {w}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center font-black uppercase italic text-brand-dark">Loading Action...</div>
        ) : currentFeed.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl shadow-xl border border-gray-200 text-center">
            <p className="text-gray-400 font-bold uppercase italic">No action placed for Week {selectedWeek}.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden overflow-x-auto">
            <table className="text-left border-collapse min-w-full">
              
              <thead className="bg-[#0b0f19] text-white uppercase font-black text-[9px] md:text-[10px] tracking-widest border-b-4 border-brand-violet">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap border-r border-gray-800 w-[140px] text-gray-400">Matchup</th>
                  {players.map(player => (
                    <th key={player} className="px-2 py-3 text-center border-r border-gray-800 w-[120px] max-w-[120px] truncate text-brand-volt">
                      {player}
                    </th>
                  ))}
                  <th className="w-full"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {games.map((game, index) => {
                  const started = hasGameStarted(game.kickoff);
                  
                  return (
                    <tr key={game.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 border-r border-gray-100 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-brand-dark leading-tight">{game.away_abbr} @ {game.home_abbr}</span>
                          <span className="text-[9px] text-gray-400 font-bold uppercase mt-1 tracking-wider">
                            {new Date(game.kickoff).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}
                          </span>
                        </div>
                      </td>

                      {players.map(player => {
                        const playerBets = currentFeed.filter(b => b.game_id === game.id && (b.profiles?.display_name || 'Unknown') === player);

                        return (
                          <td key={`${game.id}-${player}`} className="px-2 py-3 border-r border-gray-100 align-middle">
                            {playerBets.length === 0 ? (
                              <div className="text-center text-gray-200 font-black text-xs">-</div>
                            ) : (
                              <div className="flex flex-col gap-1.5 items-center">
                                {playerBets.map(bet => {
                                  
                                  // Auto-Abbreviation Script
                                  let shortPick = bet.selection;
                                  let isTotal = false;

                                  if (bet.selection === game.home_team) shortPick = game.home_abbr;
                                  else if (bet.selection === game.away_team) shortPick = game.away_abbr;
                                  else if (bet.selection.toUpperCase() === 'OVER') { shortPick = 'O'; isTotal = true; }
                                  else if (bet.selection.toUpperCase() === 'UNDER') { shortPick = 'U'; isTotal = true; }

                                  let lineAmount = '';
                                  if (bet.bet_type === 'moneyline') {
                                    lineAmount = ' ML';
                                  } else if (bet.line_at_bet) {
                                    const numLine = parseFloat(bet.line_at_bet);
                                    if (!isTotal && numLine > 0) lineAmount = ` +${numLine}`;
                                    else lineAmount = ` ${parseFloat(bet.line_at_bet)}`;
                                  }

                                  const finalPickString = `${shortPick}${lineAmount}`;

                                  if (!started) {
                                    return (
                                      <div key={bet.id} className="text-gray-400 bg-gray-100 px-2 py-1.5 rounded text-sm w-full text-center flex justify-center items-center shadow-sm border border-gray-200">
                                        🔒
                                      </div>
                                    );
                                  }

                                  let bgColor = "bg-white border-gray-200 text-brand-dark";
                                  let resultString = `$${parseFloat(bet.wager_amount).toFixed(0)}`;

                                  // --- NEW PROFIT CALCULATION FOR WINS ---
                                  if (bet.status === 'won') {
                                    bgColor = "bg-green-50 border-green-400 text-green-700 shadow-sm";
                                    const numOdds = parseFloat(bet.odds) || -110;
                                    const amount = parseFloat(bet.wager_amount);
                                    const profit = numOdds > 0 ? (amount * numOdds) / 100 : amount / (Math.abs(numOdds) / 100);
                                    resultString = `+$${profit.toFixed(0)}`; 
                                  } else if (bet.status === 'lost') {
                                    bgColor = "bg-red-50 border-red-300 text-red-700";
                                    resultString = `-$${parseFloat(bet.wager_amount).toFixed(0)}`;
                                  } else if (bet.status === 'push') {
                                    bgColor = "bg-yellow-50 border-yellow-400 text-yellow-700";
                                    resultString = "$0";
                                  }

                                  return (
                                    <div key={bet.id} className={`border rounded-lg px-2 py-1.5 w-full flex justify-between items-center ${bgColor}`}>
                                      <span className="font-black text-[10px] uppercase tracking-wider whitespace-nowrap">{finalPickString}</span>
                                      <span className="font-bold text-[9px] tracking-wider opacity-90 pl-2">{resultString}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-2 py-2"></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}