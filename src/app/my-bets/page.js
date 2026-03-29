"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function MyBets() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserBets() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data } = await supabase
          .from('bets')
          .select(`
            id,
            selection,
            line_at_bet,
            wager_amount,
            status,
            odds,
            bet_type,
            games (
              home_team,
              away_team,
              kickoff,
              home_score,
              away_score,
              status
            )
          `)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (data) setBets(data);
      }
      setLoading(false);
    }
    fetchUserBets();
  }, []);

  if (loading) return <main className="p-8 text-center font-black uppercase italic text-gray-700">Loading Slips...</main>;

  return (
    <main className="min-h-screen bg-slate-200 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-end mb-8 border-b-4 border-brand-violet pb-4">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-brand-dark">My Bet Slips</h1>
          <a href="/" className="text-sm font-bold text-brand-violet hover:text-brand-volt hover:underline uppercase tracking-widest transition-colors">← Back to Board</a>
        </div>

        {bets.length === 0 ? (
          <div className="bg-white p-12 rounded-xl shadow-inner text-center border-2 border-dashed border-gray-300">
            <p className="text-gray-400 font-bold uppercase italic">No wagers on the books yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bets.map((bet) => (
              <div key={bet.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-gray-200 flex flex-col">
                
                <div className="bg-brand-dark px-4 py-2 border-b-2 border-brand-volt flex justify-between items-center">
                  <span className="text-[10px] font-black text-brand-volt uppercase tracking-widest">
                    {bet.bet_type} Ticket
                  </span>
                  {bet.games.status === 'final' && (
                    <span className="text-[10px] font-black text-white uppercase bg-brand-violet px-2 py-0.5 rounded border border-white/20">
                      Final: {bet.games.away_score} - {bet.games.home_score}
                    </span>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider truncate">
                      {bet.games.away_team} @ {bet.games.home_team}
                    </p>
                    <h2 className="text-lg font-black text-brand-dark uppercase italic leading-tight">
                      {bet.selection} 
                      {bet.bet_type !== 'moneyline' && bet.line_at_bet !== null && (
                        <span className="ml-1 text-gray-500">
                          {bet.line_at_bet > 0 ? `+${bet.line_at_bet}` : bet.line_at_bet}
                        </span>
                      )}
                      <span className="text-brand-violet not-italic ml-2 text-sm">
                        ({bet.odds > 0 ? `+${bet.odds}` : bet.odds})
                      </span>
                    </h2>
                  </div>
                  
                  <div className="mt-4 flex justify-between items-end">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">
                      Risked: <span className="text-gray-900 text-sm">${bet.wager_amount}</span>
                    </p>
                    <div className={`px-3 py-1 rounded-md text-[10px] font-black uppercase italic border ${
                      bet.status === 'pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : 
                      bet.status === 'won' ? 'bg-brand-volt/10 text-green-600 border-brand-volt' : 
                      'bg-red-50 text-red-600 border-red-200'
                    }`}>
                      {bet.status}
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}