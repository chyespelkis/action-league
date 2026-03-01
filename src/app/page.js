"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 🛑 REPLACE THIS WITH YOUR ACTUAL LOGIN EMAIL 🛑
const COMMISSIONER_EMAIL = 'chyespelkis@gmail.com';

export default function Home() {
  const [user, setUser] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [budgetUsed, setBudgetUsed] = useState(0);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [displayName, setDisplayName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [tempName, setTempName] = useState('');

  const [selectedBet, setSelectedBet] = useState(null);
  const [wagerAmount, setWagerAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  
  // SPLASH SCREEN STATE
  const [showSplash, setShowSplash] = useState(false);
  const [fadeSplash, setFadeSplash] = useState(false);
  
  const currentWeek = 1;
  const WEEKLY_BUDGET = 100;

  useEffect(() => {
    // 4-Second Video Splash Screen Logic
    const hasVisited = sessionStorage.getItem('actionLeagueVisited');
    if (!hasVisited) {
      setShowSplash(true);
      sessionStorage.setItem('actionLeagueVisited', 'true');
      
      setTimeout(() => setFadeSplash(true), 3500);
      setTimeout(() => setShowSplash(false), 4000);
    }

    async function loadBoard() {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user;
      setUser(currentUser);

      if (currentUser) {
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', currentUser.id).single();
        if (profile) setDisplayName(profile.display_name);
        else setShowNamePrompt(true);

        const { data: wallet } = await supabase.from('weekly_wallets').select('balance, budget_used').eq('user_id', currentUser.id).eq('week_number', currentWeek).single();
        if (wallet) {
          setWalletBalance(wallet.balance);
          setBudgetUsed(wallet.budget_used || 0);
        } else {
          const { data: newWallet } = await supabase.from('weekly_wallets').insert([{ user_id: currentUser.id, week_number: currentWeek, balance: 100, budget_used: 0 }]).select().single();
          if (newWallet) {
            setWalletBalance(newWallet.balance);
            setBudgetUsed(newWallet.budget_used || 0);
          }
        }
      }

      const currentIsoTime = new Date().toISOString();
      const { data: gamesData } = await supabase.from('games').select('*').eq('status', 'pending').gt('kickoff', currentIsoTime).order('kickoff', { ascending: true });
      if (gamesData) setGames(gamesData);
      setLoading(false);
    }
    loadBoard();
  }, []);

  async function saveDisplayName() {
    if (!tempName.trim()) return alert("Please enter a name.");
    
    // Injects user.email into the profile creation
    const { error } = await supabase
      .from('profiles')
      .insert([{ 
        id: user.id, 
        display_name: tempName.trim(),
        email: user.email 
      }]);
      
    if (error) {
      alert("Error saving name. Try another one.");
    } else {
      setDisplayName(tempName.trim());
      setShowNamePrompt(false);
    }
  }

  const calculatePayout = (wager, odds) => {
    const w = parseFloat(wager);
    if (!w || isNaN(w)) return 0;
    let profit = odds > 0 ? w * (odds / 100) : w * (100 / Math.abs(odds));
    return (w + profit).toFixed(2);
  };

  function handleSelectBet(game, selection, line, type, odds) {
    if (!user) return alert("Please log in to place a bet.");
    if (showNamePrompt) return alert("Please set your display name first!");
    setSelectedBet({ game_id: game.id, matchup: `${game.away_team} @ ${game.home_team}`, selection, line, type, odds });
    setWagerAmount('');
  }

  async function submitWager() {
    const amount = parseFloat(wagerAmount);
    if (!amount || amount <= 0) return alert("Enter a valid wager.");
    if (budgetUsed + amount > WEEKLY_BUDGET) return alert(`Budget Exceeded! You only have $${WEEKLY_BUDGET - budgetUsed} of action left this week.`);
    setProcessing(true);

    const { error: betError } = await supabase.from('bets').insert([{
      user_id: user.id, game_id: selectedBet.game_id, bet_type: selectedBet.type,
      selection: selectedBet.selection, line_at_bet: selectedBet.type === 'moneyline' ? null : selectedBet.line,
      odds: selectedBet.odds, wager_amount: amount
    }]);

    if (betError) { alert("Error placing bet."); setProcessing(false); return; }

    const newBalance = walletBalance - amount;
    const newBudgetUsed = budgetUsed + amount;

    await supabase.from('weekly_wallets').update({ balance: newBalance, budget_used: newBudgetUsed }).eq('user_id', user.id).eq('week_number', currentWeek);
    setWalletBalance(newBalance); setBudgetUsed(newBudgetUsed); setSelectedBet(null); setProcessing(false); alert("Wager Placed!");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  const availableAction = WEEKLY_BUDGET - budgetUsed;

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8 relative">
      
      {/* THE CINEMATIC VIDEO SPLASH SCREEN */}
      {showSplash && (
        <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-brand-dark bg-[url('/stars.png')] bg-cover bg-center bg-no-repeat ${fadeSplash ? 'animate-fade-out' : ''}`}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"></div>
          <video 
            autoPlay 
            muted 
            playsInline
            preload="auto"
            onLoadedMetadata={(e) => {
              if (e.target.duration) {
                e.target.playbackRate = e.target.duration / 3.5;
              }
              e.target.play().catch((err) => console.log("Browser blocked autoplay:", err));
            }}
            className="relative z-10 w-72 md:w-96 rounded-3xl animate-pop-in"
          >
            <source src="/splash.mp4" type="video/mp4" />
          </video>
        </div>
      )}

      {/* Main Board Content */}
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center bg-brand-dark text-white p-6 rounded-2xl mb-8 shadow-2xl border-b-4 border-brand-violet relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-volt opacity-5 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="flex items-center gap-4 relative z-10">
            <img src="/logo.png" alt="Action League Logo" className="h-12 w-12 object-contain rounded-xl shadow-[0_0_15px_rgba(57,255,20,0.3)]" />
            <div>
              <h1 className="text-3xl font-black italic tracking-tighter uppercase text-white drop-shadow-md">
                Action <span className="text-brand-volt">League</span>
              </h1>
              <a href="/leaderboard" className="text-xs text-brand-violet hover:text-brand-volt font-bold uppercase tracking-widest mt-1 block transition-colors">View Standings →</a>
            </div>
          </div>
          <div className="text-right relative z-10">
            {user ? (
              <>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">
                  {displayName ? `Player: ${displayName}` : 'Available Action'}
                </p>
                <p className="text-2xl font-black text-brand-volt drop-shadow-[0_0_8px_rgba(57,255,20,0.4)]">
                  ${availableAction.toFixed(2)}
                </p>
                <p className="text-xs text-gray-300 mt-1 font-bold">Leaderboard: <span className="text-white">${walletBalance.toFixed(2)}</span></p>
                
                {/* THE NEW HEADER NAVIGATION */}
                <div className="flex flex-wrap justify-end items-center gap-2 md:gap-3 mt-3">
                  
                  {/* SECRET COMMISSIONER DOORS */}
                  {user.email === COMMISSIONER_EMAIL && (
                    <>
                      <a href="/commissioner" className="text-[10px] text-brand-volt hover:text-white font-bold uppercase tracking-wider transition-colors drop-shadow-[0_0_5px_rgba(57,255,20,0.8)]">Front Office</a>
                      <span className="text-gray-600">|</span>
                      <a href="/grade" className="text-[10px] text-brand-volt hover:text-white font-bold uppercase tracking-wider transition-colors drop-shadow-[0_0_5px_rgba(57,255,20,0.8)]">Grade</a>
                      <span className="text-gray-600">|</span>
                    </>
                  )}

                  <a href="/my-bets" className="text-[10px] text-brand-violet hover:text-white font-bold uppercase tracking-wider transition-colors">My Slips</a>
                  <span className="text-gray-600">|</span>
                  <button onClick={handleSignOut} className="text-[10px] text-red-500 hover:text-red-400 font-bold uppercase tracking-wider transition-colors">Sign Out</button>
                </div>
              </>
            ) : (
              <a href="/login" className="bg-brand-volt text-brand-dark px-6 py-2 rounded-lg font-black uppercase tracking-wider hover:bg-white hover:shadow-[0_0_15px_rgba(57,255,20,0.6)] transition-all">Log In</a>
            )}
          </div>
        </div>
        
        {loading ? (
           <div className="p-8 text-center font-black uppercase italic text-brand-dark">Loading Board...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {games.length === 0 ? (
              <div className="bg-white p-12 rounded-xl shadow border text-center col-span-full">
                <p className="text-gray-500 font-bold uppercase">No active games on the board right now.</p>
              </div>
            ) : (
              games.map((game) => (
                <div key={game.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      {new Date(game.kickoff).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[10px] bg-gray-200 px-2 py-0.5 rounded font-bold text-gray-600 uppercase">UFL</span>
                  </div>

                  <div className="p-4 flex flex-col gap-4">
                    <div className="w-full text-center border-b pb-3">
                      <h2 className="text-xl font-black text-gray-800 uppercase italic">
                        {game.away_team} <span className="text-gray-300 not-italic mx-2">@</span> {game.home_team}
                      </h2>
                    </div>

                    <div className="w-full">
                      <div className="grid grid-cols-3 gap-3 mb-2 px-2">
                        <p className="text-[10px] text-center font-black text-gray-400 uppercase">Spread</p>
                        <p className="text-[10px] text-center font-black text-gray-400 uppercase">Moneyline</p>
                        <p className="text-[10px] text-center font-black text-gray-400 uppercase">Total</p>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <button onClick={() => handleSelectBet(game, game.away_team, game.away_spread, 'spread', -110)} className="bg-gray-50 hover:bg-brand-dark hover:text-brand-volt border border-gray-200 p-2 md:p-3 rounded-lg transition-all flex justify-between items-center group">
                          <span className="text-[10px] md:text-xs font-bold text-gray-500 group-hover:text-brand-volt uppercase truncate mr-2">{game.away_team}</span>
                          <span className="font-black text-sm">{game.away_spread > 0 ? `+${game.away_spread}` : game.away_spread}</span>
                        </button>
                        <button onClick={() => handleSelectBet(game, game.away_team, 'ML', 'moneyline', game.away_ml)} className="bg-gray-50 hover:bg-brand-dark hover:text-brand-volt border border-gray-200 p-2 md:p-3 rounded-lg transition-all flex justify-between items-center group">
                          <span className="text-[10px] md:text-xs font-bold text-gray-500 group-hover:text-brand-volt uppercase truncate mr-2">{game.away_team}</span>
                          <span className="font-black text-sm">{game.away_ml > 0 ? `+${game.away_ml}` : game.away_ml}</span>
                        </button>
                        <button onClick={() => handleSelectBet(game, 'Over', game.total_points, 'total', -110)} className="bg-gray-50 hover:bg-brand-dark hover:text-brand-volt border border-gray-200 p-2 md:p-3 rounded-lg transition-all flex justify-between items-center group">
                          <span className="text-[10px] md:text-xs font-bold text-gray-500 group-hover:text-brand-volt uppercase mr-2">Over</span>
                          <span className="font-black text-sm">{game.total_points}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <button onClick={() => handleSelectBet(game, game.home_team, game.home_spread, 'spread', -110)} className="bg-gray-50 hover:bg-brand-dark hover:text-brand-volt border border-gray-200 p-2 md:p-3 rounded-lg transition-all flex justify-between items-center group">
                          <span className="text-[10px] md:text-xs font-bold text-gray-500 group-hover:text-brand-volt uppercase truncate mr-2">{game.home_team}</span>
                          <span className="font-black text-sm">{game.home_spread > 0 ? `+${game.home_spread}` : game.home_spread}</span>
                        </button>
                        <button onClick={() => handleSelectBet(game, game.home_team, 'ML', 'moneyline', game.home_ml)} className="bg-gray-50 hover:bg-brand-dark hover:text-brand-volt border border-gray-200 p-2 md:p-3 rounded-lg transition-all flex justify-between items-center group">
                          <span className="text-[10px] md:text-xs font-bold text-gray-500 group-hover:text-brand-volt uppercase truncate mr-2">{game.home_team}</span>
                          <span className="font-black text-sm">{game.home_ml > 0 ? `+${game.home_ml}` : game.home_ml}</span>
                        </button>
                        <button onClick={() => handleSelectBet(game, 'Under', game.total_points, 'total', -110)} className="bg-gray-50 hover:bg-brand-dark hover:text-brand-volt border border-gray-200 p-2 md:p-3 rounded-lg transition-all flex justify-between items-center group">
                          <span className="text-[10px] md:text-xs font-bold text-gray-500 group-hover:text-brand-volt uppercase mr-2">Under</span>
                          <span className="font-black text-sm">{game.total_points}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Name Prompt Modal */}
      {showNamePrompt && (
        <div className="fixed inset-0 bg-brand-dark/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-brand-panel p-8 rounded-2xl shadow-2xl max-w-sm w-full border-b-8 border-brand-volt">
            <h2 className="text-2xl font-black italic text-white uppercase mb-2 drop-shadow-md">Locker Room</h2>
            <p className="text-sm text-brand-violet font-bold mb-6 uppercase tracking-wider">What should we call you on the board?</p>
            <input 
              type="text" maxLength="15" value={tempName} onChange={(e) => setTempName(e.target.value)} 
              className="w-full bg-brand-dark border-2 border-brand-violet rounded-xl p-3 text-lg font-black text-white uppercase tracking-wider focus:border-brand-volt outline-none mb-6" 
              placeholder="e.g. THE SHARP" 
            />
            <button onClick={saveDisplayName} className="w-full bg-brand-volt text-brand-dark font-black py-4 rounded-xl hover:bg-white transition-all shadow-[0_0_15px_rgba(57,255,20,0.5)] uppercase tracking-widest">
              Enter The League
            </button>
          </div>
        </div>
      )}

      {/* Bet Slip Modal */}
      {selectedBet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full border-b-8 border-brand-dark">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-black italic text-gray-900 uppercase">Bet Slip</h2>
              <button onClick={() => setSelectedBet(null)} className="text-gray-400 hover:text-red-500 text-2xl">×</button>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-xl mb-4 border border-gray-200">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{selectedBet.matchup}</p>
              <p className="text-xl font-black text-brand-dark uppercase">
                {selectedBet.selection} {selectedBet.type !== 'moneyline' ? selectedBet.line : ''}
              </p>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs font-bold text-white uppercase bg-brand-dark px-2 py-1 rounded">{selectedBet.type}</span>
                <span className="font-bold text-gray-700">{selectedBet.odds > 0 ? `+${selectedBet.odds}` : selectedBet.odds}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Wager Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-400 font-bold">$</span>
                <input 
                  type="number" value={wagerAmount} onChange={(e) => setWagerAmount(e.target.value)} 
                  className="w-full border-2 border-gray-100 rounded-xl p-2 pl-8 text-xl font-black focus:border-brand-volt outline-none" 
                  placeholder="0.00" 
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-2 font-bold uppercase text-right">Max Risk: ${(availableAction).toFixed(2)}</p>
            </div>

            <div className="bg-brand-dark p-3 rounded-xl mb-6 flex justify-between items-center">
              <span className="text-xs font-bold text-brand-violet uppercase">Potential Payout</span>
              <span className="text-lg font-black text-brand-volt">${potentialPayout}</span>
            </div>

            <button onClick={submitWager} disabled={processing} className="w-full bg-brand-volt text-brand-dark font-black py-4 rounded-xl hover:bg-white shadow-[0_0_10px_rgba(57,255,20,0.4)] transition-all uppercase tracking-widest">
              {processing ? 'Confirming...' : 'Place Wager'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}