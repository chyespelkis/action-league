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
      // Pulls every bet, plus the associated game details and the player's display name
      const { data, error } = await supabase
        .from('bets')
        .select(`
          *,
          games (*),
          profiles (display_name)
        `)
        .order('created_at', { ascending: false });

      if (data) setFeed(data);
      setLoading(false);
    }
    loadFeed();
  }, []);

  // Time check logic
  const hasGameStarted = (kickoffTime) => {
    return new Date() >= new Date(kickoffTime);
  };

  return (
    <main className="min-h-screen bg-slate-200 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-end mb-8 border-b-4 border-brand-violet pb-4">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-brand-dark">League Feed</h1>
          <a href="/" className="bg-brand-dark text-brand-volt px-4 py-2 rounded-lg font-black uppercase tracking-widest hover:bg-brand-panel transition-colors text-[10px] md:text-xs shadow-md">
            Return to Board
          </a>
        </div>

        {loading ? (
          <div className="p-8 text-center font-black uppercase italic text-brand-dark">Loading Action...</div>
        ) : (
          <div className="space-y-4">
            {feed.length === 0 ? (
              <div className="bg-white p-12 rounded-xl shadow-xl border text-center">
                <p className="text-gray-500 font-bold uppercase">No action placed yet.</p>
              </div>
            ) : (
              feed.map((bet) => {
                const gameStarted = hasGameStarted(bet.games.kickoff);
                
                return (
                  <div key={bet.id} className={`bg-white rounded-xl shadow-md border-l-8 overflow-hidden flex flex-col md:flex-row ${gameStarted ? 'border-l-brand-volt' : 'border-l-gray-300'}`}>
                    
                    {/* Bettor Info */}
                    <div className="bg-gray-50 p-4 border-b md:border-b-0 md:border-r border-gray-200 min-w-[150px] flex flex-col justify-center">
                      <p className="text-[10px] text-brand-violet font-bold uppercase tracking-widest">Player</p>
                      <p className="text-lg font-black text-brand-dark uppercase tracking-wider">{bet.profiles?.display_name || 'Unknown'}</p>
                    </div>

                    {/* Bet Details */}
                    <div className="p-4 flex-grow flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                          {bet.games.away_team} @ {bet.games.home_team}
                        </p>
                        
                        {gameStarted ? (
                          <div className="flex items-center gap-3">
                            <p className="text-xl font-black text-brand-dark uppercase">
                              {bet.selection} {bet.bet_type !== 'moneyline' ? bet.line_at_bet : ''}
                            </p>
                            <span className="text-xs font-bold text-white uppercase bg-brand-dark px-2 py-0.5 rounded">{bet.bet_type}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg w-fit">
                            <span className="text-sm">🔒</span>
                            <span className="text-xs font-black uppercase tracking-widest italic">Pick Locked Until Kickoff</span>
                          </div>
                        )}
                      </div>

                      <div className="text-right pl-4">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Risk</p>
                        <p className="text-lg font-black text-brand-dark">${parseFloat(bet.wager_amount).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </main>
  );
}