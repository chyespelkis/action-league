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
  
  // 1. Get a unique list of all players who have placed a bet (Columns)
  const players = Array.from(new Set(feed.map(b => b.profiles?.display_name || 'Unknown'))).sort();

  // 2. Get a unique list of all games that have action on them (Rows)
  const uniqueGamesMap = new Map();
  feed.forEach(b => {
    if (!uniqueGamesMap.has(b.game_id)) {
      uniqueGamesMap.set(b.game_id, b.games);
    }
  });
  // Sort games by kickoff time
  const games = Array.from(uniqueGamesMap.values()).sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));

  return (
    <main className="min-h-screen bg-slate-200 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-6 border-b-4 border-brand-violet pb-4">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-brand-dark">The Action Matrix</h1>
          <a href="/" className="bg-brand-dark text-brand-volt px-4 py-2 rounded-lg font-black uppercase tracking-widest hover:bg-brand-panel transition-colors text-[10px] md:text-xs shadow-md">
            Return to Board
          </a>
        </div>

        {loading ? (
          <div className="p-8 text-center font-black uppercase italic text-brand-dark">Loading Action...</div>
        ) : feed.length === 0 ? (
          <div className="bg-white p-12 rounded-xl shadow-xl border text-center">
            <p className="text-gray-500 font-bold uppercase">No action placed yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm text-left">
              
              {/* TABLE HEADER (Players) */}
              <thead className="bg-brand-dark text-brand-volt uppercase font-black text-[10px] md:text-xs tracking-wider">
                <tr>
                  <th className="px-4 py-4 whitespace-nowrap border-r border-gray-700">Matchup</th>
                  {players.map(player => (
                    <th key={player} className="px-4 py-4 text-center border-r border-gray-700 whitespace-nowrap min-w-[120px]">
                      {player}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* TABLE BODY (Games) */}
              <tbody>
                {games.map((game, index) => {
                  const started = hasGameStarted(game.kickoff);
                  
                  return (
                    <tr key={game.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      
                      {/* GAME INFO COLUMN */}
                      <td className="px-4 py-4 border-t border-r border-gray-200 font-black text-brand-dark whitespace-nowrap">
                        <div className="text-[10px] text-gray-500 font-bold mb-1 uppercase tracking-widest">
                          {new Date(game.kickoff).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                        {game.away_abbr} @ {game.home_abbr}
                      </td>

                      {/* PLAYER BET COLUMNS */}
                      {players.map(player => {
                        // Find all bets this specific player made on this specific game
                        const playerBets = feed.filter(b => b.game_id === game.id && (b.profiles?.display_name || 'Unknown') === player);

                        return (
                          <td key={`${game.id}-${player}`} className="px-2 py-2 border-t border-r border-gray-200 text-center align-middle">
                            {playerBets.length === 0 ? (
                              <span className="text-gray-300 font-bold">-</span>
                            ) : (
                              <div className="flex flex-col gap-2 items-center">
                                {playerBets.map(bet => {
                                  // 1. If game hasn't started, hide the pick
                                  if (!started) {
                                    return (
                                      <div key={bet.id} className="text-gray-400 bg-gray-100 px-3 py-1.5 rounded text-[10px] font-bold w-full max-w-[120px]">
                                        🔒 ${parseFloat(bet.wager_amount).toFixed(2)}
                                      </div>
                                    );
                                  }

                                  // 2. If game started, determine Win/Loss styling
                                  let bgColor = "bg-gray-100 border-gray-200 text-brand-dark";
                                  let resultText = "PENDING";
                                  let resultAmount = "";

                                  if (bet.status === 'won') {
                                    bgColor = "bg-green-100 border-green-400 text-green-800";
                                    resultText = "WON";
                                    // Assuming you want to show the wager amount won. If you have a 'to_win' column, use bet.to_win here instead.
                                    resultAmount = `+$${parseFloat(bet.wager_amount).toFixed(2)}`; 
                                  } else if (bet.status === 'lost') {
                                    bgColor = "bg-red-100 border-red-300 text-red-800";
                                    resultText = "LOST";
                                    resultAmount = `-$${parseFloat(bet.wager_amount).toFixed(2)}`;
                                  } else if (bet.status === 'push') {
                                    bgColor = "bg-gray-200 border-gray-400 text-gray-700";
                                    resultText = "PUSH";
                                    resultAmount = "$0.00";
                                  }

                                  return (
                                    <div key={bet.id} className={`border rounded-lg p-2 w-full max-w-[120px] flex flex-col items-center justify-center shadow-sm ${bgColor}`}>
                                      <span className="font-black text-[11px] uppercase leading-tight whitespace-nowrap">
                                        {bet.selection} {bet.bet_type !== 'moneyline' ? bet.line_at_bet : ''}
                                      </span>
                                      
                                      {/* Show pending risk, or final win/loss amount */}
                                      {bet.status === 'pending' || !bet.status ? (
                                        <span className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-wider">Risk ${parseFloat(bet.wager_amount).toFixed(0)}</span>
                                      ) : (
                                        <div className="mt-1 flex flex-col items-center">
                                          <span className="text-[9px] font-black uppercase tracking-widest">{resultText}</span>
                                          <span className="text-[11px] font-black">{resultAmount}</span>
                                        </div>
                                      )}
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