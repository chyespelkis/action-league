"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Leaderboard() {
  const [allWallets, setAllWallets] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [standings, setStandings] = useState([]);
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [selectedView, setSelectedView] = useState('Dashboard'); 
  const [loading, setLoading] = useState(true);
  
  const currentWeek = 1; // Drives the "Current Week" column on the dashboard
  const STARTING_BUDGET = 100;

  useEffect(() => {
    async function fetchAllData() {
      const { data: walletsData } = await supabase.from('weekly_wallets').select('*');
      const { data: profilesData } = await supabase.from('profiles').select('*');

      if (walletsData) {
        setAllWallets(walletsData);
        const weeks = [...new Set(walletsData.map(w => w.week_number))].sort((a, b) => a - b);
        setAvailableWeeks(weeks);
      }
      if (profilesData) setProfiles(profilesData);
      setLoading(false);
    }
    fetchAllData();
  }, []);

  useEffect(() => {
    if (!allWallets.length) return;
    let processedStandings = [];

    if (selectedView === 'Dashboard') {
      // The Macro View: Track Overall AND Current Week together
      const userTotals = {};
      allWallets.forEach(wallet => {
        if (!userTotals[wallet.user_id]) {
          userTotals[wallet.user_id] = { overall_winnings: 0, current_week_winnings: 0 };
        }
        const profit = wallet.balance - STARTING_BUDGET;
        userTotals[wallet.user_id].overall_winnings += profit;
        
        if (wallet.week_number === currentWeek) {
          userTotals[wallet.user_id].current_week_winnings += profit;
        }
      });

      processedStandings = Object.keys(userTotals).map(userId => {
        const profile = profiles?.find(p => p.id === userId);
        return {
          user_id: userId,
          display_name: profile ? profile.display_name : 'Unknown Player',
          overall_winnings: userTotals[userId].overall_winnings,
          current_week_winnings: userTotals[userId].current_week_winnings
        };
      });
      
      // Sort Dashboard by Overall Winnings
      processedStandings.sort((a, b) => b.overall_winnings - a.overall_winnings);

    } else {
      // The Specific Week View
      const weekWallets = allWallets.filter(w => w.week_number === parseInt(selectedView));
      processedStandings = weekWallets.map(wallet => {
        const profile = profiles?.find(p => p.id === wallet.user_id);
        return {
          user_id: wallet.user_id,
          display_name: profile ? profile.display_name : 'Unknown Player',
          overall_winnings: wallet.balance - STARTING_BUDGET, // Reusing this key for the sort
        };
      });
      // Sort Specific Week by that week's winnings
      processedStandings.sort((a, b) => b.overall_winnings - a.overall_winnings);
    }

    setStandings(processedStandings);
  }, [selectedView, allWallets, profiles]);

  if (loading) return <main className="p-8 text-center font-black uppercase italic text-brand-dark">Calculating Standings...</main>;

  return (
    <main className="min-h-screen bg-slate-200 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex justify-between items-end mb-6 border-b-4 border-brand-violet pb-4">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-brand-dark">League Standings</h1>
          <a href="/" className="text-sm font-bold text-brand-violet hover:text-brand-dark hover:underline uppercase tracking-widest transition-colors">← Back to Board</a>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          <button 
            onClick={() => setSelectedView('Dashboard')} 
            className={`px-5 py-2 rounded-full font-black uppercase tracking-wider text-xs whitespace-nowrap transition-all shadow-sm ${
              selectedView === 'Dashboard' ? 'bg-brand-dark text-brand-volt border-2 border-brand-dark' : 'bg-white text-gray-500 border-2 border-transparent hover:border-brand-violet'
            }`}
          >
            Dashboard
          </button>
          
          {availableWeeks.map(week => (
            <button 
              key={week}
              onClick={() => setSelectedView(week)}
              className={`px-5 py-2 rounded-full font-black uppercase tracking-wider text-xs whitespace-nowrap transition-all shadow-sm ${
                selectedView === week ? 'bg-brand-dark text-brand-volt border-2 border-brand-dark' : 'bg-white text-gray-500 border-2 border-transparent hover:border-brand-violet'
              }`}
            >
              Week {week}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
          <div className="bg-brand-dark text-white p-4 flex justify-between items-center font-black uppercase tracking-widest text-[10px] md:text-xs border-b-2 border-brand-volt">
            <span className="w-8 md:w-12 text-center">Rnk</span>
            <span className="flex-1">Player</span>
            {selectedView === 'Dashboard' && (
              <span className="w-24 text-right text-brand-violet hidden sm:block">Wk {currentWeek} Net</span>
            )}
            <span className="w-24 md:w-32 text-right text-brand-volt">
              {selectedView === 'Dashboard' ? 'Total Net' : 'Net Winnings'}
            </span>
          </div>
          
          <div className="divide-y divide-gray-100">
            {standings.length === 0 ? (
              <p className="p-8 text-center text-gray-400 font-bold uppercase italic">No scores recorded yet.</p>
            ) : (
              standings.map((row, index) => (
                <div key={index} className="p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                  <div className="w-8 md:w-12 text-center font-black text-lg md:text-xl text-gray-400">
                    {index === 0 ? <span className="text-brand-volt drop-shadow-sm">🏆</span> : index + 1}
                  </div>
                  
                  <div className="flex-1 font-black text-brand-dark uppercase tracking-wider text-sm md:text-lg truncate">
                    {row.display_name}
                  </div>
                  
                  {/* Current Week Net (Only shows on Dashboard) */}
                  {selectedView === 'Dashboard' && (
                    <div className={`w-24 text-right hidden sm:block text-sm font-bold ${
                      row.current_week_winnings > 0 ? 'text-green-600' : 
                      row.current_week_winnings < 0 ? 'text-red-500' : 
                      'text-gray-400'
                    }`}>
                      {row.current_week_winnings > 0 ? '+' : ''}{row.current_week_winnings < 0 ? '-' : ''}${Math.abs(row.current_week_winnings).toFixed(2)}
                    </div>
                  )}
                  
                  {/* The Main Sort Column (Overall Net or Specific Week Net) */}
                  <div className={`w-24 md:w-32 text-right text-lg md:text-xl font-black ${
                    row.overall_winnings > 0 ? 'text-green-600' : 
                    row.overall_winnings < 0 ? 'text-red-500' : 
                    'text-gray-900'
                  }`}>
                    {row.overall_winnings > 0 ? '+' : ''}{row.overall_winnings < 0 ? '-' : ''}${Math.abs(row.overall_winnings).toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}