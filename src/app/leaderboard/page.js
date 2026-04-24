"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Leaderboard() {
  const [bets, setBets] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [standings, setStandings] = useState([]);
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [selectedView, setSelectedView] = useState('Dashboard'); 
  const [loading, setLoading] = useState(true);
  
  const [user, setUser] = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [balance, setBalance] = useState(0);

  const calculateProfit = (wager, oddsStr) => {
    const amount = parseFloat(wager);
    if (isNaN(amount) || amount <= 0) return 0;
    let odds = parseFloat(oddsStr);
    if (isNaN(odds)) odds = -110;
    if (odds > 0) return (amount * odds) / 100;
    return amount / (Math.abs(odds) / 100);
  };

  useEffect(() => {
    async function fetchAllData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (prof) {
          setCurrentUserProfile(prof);
          setBalance(prof.balance || 0);
        }
      }

      const { data: allGames } = await supabase.from('games').select('week_number');
      if (allGames) {
         const weeks = [...new Set(allGames.map(g => g.week_number).filter(Boolean))].sort((a, b) => a - b);
         setAvailableWeeks(weeks);
      }

      const { data: profilesData } = await supabase.from('profiles').select('*');
      const { data: betsData } = await supabase.from('bets').select(`user_id, wager_amount, odds, status, games (week_number)`);

      if (profilesData) setProfiles(profilesData);
      if (betsData) setBets(betsData);
      setLoading(false);
    }
    fetchAllData();
  }, []);

  // OVERALL NET PROFIT LOGIC
  useEffect(() => {
    if (!profiles.length) return;

    let processedStandings = profiles.map(p => {
      let netProfit = 0;
      
      const userBets = bets.filter(b => b.user_id === p.id);
      
      userBets.forEach(bet => {
        // If we are looking at a specific week, only count bets from that week
        if (selectedView !== 'Dashboard' && bet.games?.week_number !== parseInt(selectedView)) {
          return; 
        }

        const amount = parseFloat(bet.wager_amount);

        if (bet.status === 'won') {
          netProfit += calculateProfit(amount, bet.odds);
        } else if (bet.status === 'lost') {
          netProfit -= amount; // Subtract the lost stake for true net profit
        }
      });

      return {
        user_id: p.id,
        display_name: p.display_name,
        score: netProfit
      };
    });

    // Sort descending by highest net profit
    processedStandings.sort((a, b) => b.score - a.score);
    setStandings(processedStandings);
  }, [selectedView, bets, profiles]);

  const isCommissioner = currentUserProfile?.role === 'admin' || currentUserProfile?.display_name?.toUpperCase() === 'CJYES';

  if (loading) return <main className="min-h-screen bg-slate-200 p-8 text-center font-black uppercase italic text-brand-dark mt-20 text-xl tracking-widest">Calculating Scores...</main>;

  return (
    <main className="min-h-screen bg-slate-200 text-brand-dark font-sans pb-12">
      <nav className="bg-[#0b0f19] p-4 border-b-2 border-brand-violet sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src="/icon.png" alt="Action League" className="w-10 h-10 object-contain" />
              <h1 className="text-2xl font-black text-brand-volt italic tracking-tighter uppercase leading-none">Action League</h1>
            </a>
            <div className="h-6 w-px bg-gray-700 hidden md:block"></div>
            <a href="/" className="text-[10px] font-black text-white uppercase hover:text-brand-volt transition-colors tracking-widest bg-white/5 px-3 py-1.5 rounded-full border border-white/10 hover:border-brand-volt">The Board →</a>
          </div>

          <div className="flex gap-4 items-center flex-wrap justify-center">
            <div className="bg-[#1e293b] px-4 py-1.5 rounded-lg border border-brand-volt/20 text-right mr-2 shadow-sm">
              <p className="text-[8px] font-black text-gray-500 uppercase leading-none mb-1">Bankroll</p>
              <p className="text-lg font-black text-brand-volt leading-none tracking-tighter">${balance.toFixed(2)}</p>
            </div>

            {isCommissioner && (
              <>
                <a href="/commissioner" className="text-[10px] font-black text-brand-volt uppercase hover:text-white transition-colors">Front Office</a>
                <a href="/grade" className="text-[10px] font-black text-brand-volt uppercase hover:text-white transition-colors">Grade</a>
                <div className="h-4 w-px bg-gray-700"></div>
              </>
            )}
            <a href="/feed" className="text-[10px] font-black text-white uppercase hover:text-brand-volt transition-colors">Action Feed</a>
            <a href="/my-bets" className="bg-brand-violet text-white px-4 py-2 rounded font-black uppercase text-[10px] hover:bg-white hover:text-brand-violet transition-colors shadow-md">My Slips</a>
            <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="text-[9px] text-gray-500 font-bold uppercase border-l border-gray-800 pl-4 hover:text-red-400 transition-colors">Sign Out</button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-4 md:p-8 mt-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 border-b-2 border-gray-300 pb-4 gap-4">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-brand-dark">League Standings</h1>
          
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            <button 
              onClick={() => setSelectedView('Dashboard')} 
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all shadow-sm ${
                selectedView === 'Dashboard' ? 'bg-brand-violet text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:border-brand-violet hover:text-brand-violet'
              }`}
            >
              Total Net Profit
            </button>
            
            {availableWeeks.map(week => (
              <button 
                key={week}
                onClick={() => setSelectedView(week)}
                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all shadow-sm ${
                  selectedView === week ? 'bg-brand-violet text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:border-brand-violet hover:text-brand-violet'
                }`}
              >
                Week {week}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
          <div className="bg-[#0b0f19] text-white p-4 flex justify-between items-center font-black uppercase tracking-widest text-[10px] md:text-xs border-b-4 border-brand-violet">
            <span className="w-8 md:w-12 text-center text-gray-400">Rnk</span>
            <span className="flex-1 pl-2">Player</span>
            <span className="w-32 text-right text-brand-volt">
              {selectedView === 'Dashboard' ? 'Overall Net' : `Wk ${selectedView} Net`}
            </span>
          </div>
          
          <div className="divide-y divide-gray-100">
            {standings.length === 0 ? (
              <p className="p-8 text-center text-gray-400 font-bold uppercase italic">No scores recorded yet.</p>
            ) : (
              standings.map((row, index) => {
                const isPositive = row.score > 0;
                const isNegative = row.score < 0;
                let scoreColor = 'text-gray-400'; // $0 or even
                if (isPositive) scoreColor = 'text-green-600';
                if (isNegative) scoreColor = 'text-red-500';

                return (
                  <div key={index} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <div className="w-8 md:w-12 text-center font-black text-lg md:text-xl text-gray-400">
                      {index === 0 && isPositive ? <span className="text-brand-volt drop-shadow-sm text-2xl">🏆</span> : index + 1}
                    </div>
                    
                    <div className="flex-1 pl-2 font-black text-brand-dark uppercase tracking-tighter text-sm md:text-lg truncate">
                      {row.display_name}
                    </div>
                    
                    <div className={`w-32 text-right text-xl md:text-2xl font-black tracking-tighter ${scoreColor}`}>
                      {isNegative ? '-' : isPositive ? '+' : ''}${Math.abs(row.score).toFixed(2)}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </main>
  );
}