"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function ActionFeed() {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

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

      if (data) setFeed(data);
      setLoading(false);
    }
    loadFeed();
  }, []);

  const hasGameStarted = (kickoffTime) => {
    return new Date() >= new Date(kickoffTime);
  };

  // --- DATA PROCESSING FOR THE MATRIX ---
  const players = Array.from(new Set(feed.map(b => b.profiles?.display_name || 'Unknown'))).sort();

  const uniqueGamesMap = new Map();
  feed.forEach(b => {
    if (!uniqueGamesMap.has(b.game_id)) {
      uniqueGamesMap.set(b.game_id, b.games);
    }
  });
  const games = Array.from(uniqueGamesMap.values()).sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));

  return (
    <main className="min-h-screen bg-slate-200 p-2 md:p-4">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex justify-between items-end mb-4 border-b-4 border-brand-violet pb-2">
          <h1 className="text-2xl font-black uppercase italic tracking-tighter text-brand-dark">The Action Matrix</h1>
          <a href="/" className="bg-brand-dark text-brand-volt px-3 py-1.5 rounded font-black uppercase tracking-widest hover:bg-brand-panel transition-colors text-[10px] shadow-md">
            Board
          </a>
        </div>

        {loading ? (
          <div className="p-8 text-center font-black uppercase italic text-brand-dark">Loading Action...</div>
        ) : feed.length === 0 ? (
          <div className="bg-white p-8 rounded-xl shadow-xl border text-center">
            <p className="text-gray-500 font-bold uppercase text-xs">No action placed yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded shadow-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              
              {/* TABLE HEADER */}
              <thead className="bg-brand-dark text-brand-volt uppercase font-black text-[9px] md:text-[10px] tracking-widest">
                <tr>
                  <th className="px-2 py-2 whitespace-nowrap border-r border-gray-700 w-24">Matchup</th>
                  {players.map(player => (
                    <th key={player} className="px-2 py-2 text-center border-r border-gray-700 whitespace-nowrap min-w-[100px]">
                      {player}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* TABLE BODY */}
              <tbody>
                {games.map((game, index) => {
                  const started = hasGameStarted(game.kickoff);
                  
                  return (
                    <tr key={game.id} className={`border-b border-gray-200 hover:bg-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      
                      {/* GAME INFO COLUMN */}
                      <td className="px-2 py-2 border-r border-gray-200 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-brand-dark leading-tight">{game.away_abbr} @ {game.home_abbr}</span>
                          <span className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">
                            {new Date(game.kickoff).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}
                          </span>
                        </div>
                      </td>

                      {/* PLAYER BET COLUMNS */}
                      {players.map(player => {
                        const playerBets = feed.filter(b => b.game_id === game.id && (b.profiles?.display_name || 'Unknown') === player);

                        return (
                          <td key={`${game.id}-${player}`} className="px-1 py-1 border-r border-gray-200 align-middle">
                            {playerBets.length === 0 ? (
                              <div className="text-center text-gray-200 font-black text-xs">-</div>
                            ) : (
                              <div className="flex flex-col gap-1 items-center">
                                {playerBets.map(bet => {
                                  
                                  // --- AUTO-ABBREVIATION SCRIPT ---
                                  let shortPick = bet.selection;
                                  if (bet.selection === game.home_team) shortPick = game.home_abbr;
                                  else if (bet.selection === game.away_team) shortPick = game.away_abbr;
                                  else if (bet.selection.toUpperCase() === 'OVER') shortPick = 'O';
                                  else if (bet.selection.toUpperCase() === 'UNDER') shortPick = 'U';

                                  const lineAmount = bet.bet_type !== 'moneyline' ? ` ${bet.line_at_bet}` : '';
                                  const finalPickString = `${shortPick}${lineAmount}`;
                                  // ---------------------------------

                                  // 1. Locked Game
                                  if (!started) {
                                    return (
                                      <div key={bet.id} className="text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest w-full max-w-[110px] text-center flex justify-center items-center gap-1">
                                        <span>🔒</span>
                                        <span>${parseFloat(bet.wager_amount).toFixed(0)}</span>
                                      </div>
                                    );
                                  }

                                  // 2. Graded / Started Game
                                  let bgColor = "bg-gray-100 border-gray-300 text-gray-700";
                                  let resultString = `$${parseFloat(bet.wager_amount).toFixed(0)}`; // Pending amount

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
                                    <div key={bet.id} className={`border rounded px-1.5 py-1 w-full max-w-[110px] flex justify-between items-center shadow-sm ${bgColor}`}>
                                      <span className="font-black text-[9px] uppercase tracking-wider whitespace-nowrap">{finalPickString}</span>
                                      <span className="font-bold text-[9px] tracking-wider opacity-80">{resultString}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        )
                      })}
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