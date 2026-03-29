"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function ActionFeed() {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- NEW WEEK SELECTOR STATE ---
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);

  useEffect(() => {
    async function loadFeed() {
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
        
        // Find all unique week numbers from the games being bet on
        const weeks = Array.from(new Set(data.map(b => b.games?.week_number)))
          .filter(w => w != null)
          .sort((a, b) => b - a); // Sort descending (highest week first)
        
        setAvailableWeeks(weeks);
        
        // Default to the most recent week
        if (weeks.length > 0) {
          setSelectedWeek(weeks[0]);
        }
      }
      setLoading(false);
    }
    loadFeed();
  }, []);

  const hasGameStarted = (kickoffTime) => {
    return new Date() >= new Date(kickoffTime);
  };

  // --- FILTER ACTION BY SELECTED WEEK ---
  const currentFeed = feed.filter(b => b.games?.week_number === selectedWeek);

  // --- DATA PROCESSING FOR THE MATRIX (Using filtered feed) ---
  const players = Array.from(new Set(currentFeed.map(b => b.profiles?.display_name || 'Unknown'))).sort();

  const uniqueGamesMap = new Map();
  currentFeed.forEach(b => {
    if (!uniqueGamesMap.has(b.game_id)) {
      uniqueGamesMap.set(b.game_id, b.games);
    }
  });
  const games = Array.from(uniqueGamesMap.values()).sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));

  return (
    <main className="min-h-screen bg-slate-200 p-2 md:p-4">
      <div className="max-w-[1400px] mx-auto">
        
        {/* HEADER SECTION WITH DROPDOWN */}
        <div className="flex justify-between items-end mb-4 border-b-4 border-brand-violet pb-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black uppercase italic tracking-tighter text-brand-dark">The Action Matrix</h1>
            
            {/* WEEK SELECTOR DROPDOWN */}
            {availableWeeks.length > 0 && (
              <select 
                value={selectedWeek || ''} 
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="bg-white border-2 border-brand-dark text-brand-dark font-black uppercase text-xs rounded-lg px-2 py-1 outline-none cursor-pointer shadow-sm focus:border-brand-violet transition-colors"
              >
                {availableWeeks.map(w => (
                  <option key={w} value={w}>WEEK {w}</option>
                ))}
              </select>
            )}
          </div>

          <a href="/" className="bg-brand-dark text-brand-volt px-3 py-1.5 rounded font-black uppercase tracking-widest hover:bg-brand-panel transition-colors text-[10px] shadow-md">
            Board
          </a>
        </div>

        {loading ? (
          <div className="p-8 text-center font-black uppercase italic text-brand-dark">Loading Action...</div>
        ) : currentFeed.length === 0 ? (
          <div className="bg-white p-8 rounded-xl shadow-xl border text-center">
            <p className="text-gray-500 font-bold uppercase text-xs">No action placed for Week {selectedWeek}.</p>
          </div>
        ) : (
          <div className="bg-white rounded shadow-xl border border-gray-200 overflow-x-auto">
            <table className="text-left border-collapse min-w-full">
              
              {/* TABLE HEADER */}
              <thead className="bg-brand-dark text-brand-volt uppercase font-black text-[9px] md:text-[10px] tracking-widest">
                <tr>
                  <th className="px-3 py-2 whitespace-nowrap border-r border-gray-700 w-[140px]">Matchup</th>
                  {players.map(player => (
                    <th key={player} className="px-2 py-2 text-center border-r border-gray-700 w-[120px] max-w-[120px] truncate">
                      {player}
                    </th>
                  ))}
                  <th className="w-full"></th>
                </tr>
              </thead>

              {/* TABLE BODY */}
              <tbody>
                {games.map((game, index) => {
                  const started = hasGameStarted(game.kickoff);
                  
                  return (
                    <tr key={game.id} className={`border-b border-gray-200 hover:bg-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      
                      {/* GAME INFO COLUMN */}
                      <td className="px-3 py-2 border-r border-gray-200 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-brand-dark leading-tight">{game.away_abbr} @ {game.home_abbr}</span>
                          <span className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">
                            {new Date(game.kickoff).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}
                          </span>
                        </div>
                      </td>

                      {/* PLAYER BET COLUMNS */}
                      {players.map(player => {
                        const playerBets = currentFeed.filter(b => b.game_id === game.id && (b.profiles?.display_name || 'Unknown') === player);

                        return (
                          <td key={`${game.id}-${player}`} className="px-2 py-2 border-r border-gray-200 align-middle">
                            {playerBets.length === 0 ? (
                              <div className="text-center text-gray-200 font-black text-xs">-</div>
                            ) : (
                              <div className="flex flex-col gap-1 items-center">
                                {playerBets.map(bet => {
                                  
                                  // --- AUTO-ABBREVIATION & FORMATTING SCRIPT ---
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
                                    if (!isTotal && numLine > 0) {
                                      lineAmount = ` +${numLine}`;
                                    } else {
                                      lineAmount = ` ${bet.line_at_bet}`;
                                    }
                                  }

                                  const finalPickString = `${shortPick}${lineAmount}`;
                                  // ----------------------------------------------

                                  // 1. Locked Game
                                  if (!started) {
                                    return (
                                      <div key={bet.id} className="text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest w-full text-center flex justify-center items-center gap-1">
                                        <span>🔒</span>
                                        <span>${parseFloat(bet.wager_amount).toFixed(0)}</span>
                                      </div>
                                    );
                                  }

                                  // 2. Graded / Started Game
                                  let bgColor = "bg-gray-100 border-gray-300 text-gray-700";
                                  let resultString = `$${parseFloat(bet.wager_amount).toFixed(0)}`;

                                  if (bet.status === 'won') {
                                    bgColor = "bg-green-100 border-green-400 text-green-800";
                                    resultString = `+$${parseFloat(bet.wager_amount).toFixed(0)}`; 
                                  } else if (bet.status === 'lost') {
                                    bgColor = "bg-red-100 border-red-300 text-red-800";
                                    resultString = `-$${parseFloat(bet.wager_amount).toFixed(0)}`;
                                  } else if (bet.status === 'push') {
                                    bgColor = "bg-gray-200 border-gray-400 text-gray-700";
                                    resultString = "$0";
                                  }

                                  return (
                                    <div key={bet.id} className={`border rounded px-1.5 py-1 w-full flex justify-between items-center shadow-sm ${bgColor}`}>
                                      <span className="font-black text-[10px] uppercase tracking-wider whitespace-nowrap">{finalPickString}</span>
                                      <span className="font-bold text-[9px] tracking-wider opacity-80 pl-2">{resultString}</span>
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