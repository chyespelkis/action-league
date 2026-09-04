"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Home() {
  const [games, setGames] = useState([]);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [selectedBet, setSelectedBet] = useState(null);
  const [betAmount, setBetAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentMessages, setRecentMessages] = useState([]);
  const [stats, setStats] = useState({ topWhale: 0, activeBets: 0 });
  const [pageLoading, setPageLoading] = useState(true);
  
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [activeWeek, setActiveWeek] = useState(null);
  const [balance, setBalance] = useState(0);

  // Splash Screen State
  const [splashData, setSplashData] = useState(null);

  // Auth State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authView, setAuthView] = useState("sign_in");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  const calculateProfit = (wager, oddsStr) => {
    const amount = parseFloat(wager);
    if (isNaN(amount) || amount <= 0) return { profit: "0.00", total: "0.00", rawProfit: 0 };
    let odds = parseFloat(oddsStr) || -110;
    let profit = odds > 0 ? (amount * odds) / 100 : amount / (Math.abs(odds) / 100);
    return { profit: profit.toFixed(2), total: (amount + profit).toFixed(2), rawProfit: profit };
  };

  useEffect(() => {
    async function getInitialData() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setUser(session.user);
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (prof) {
          setProfile(prof);
          setBalance(prof.balance || 0);
        }

        const { data: g } = await supabase.from('games').select('*').eq('status', 'pending').order('kickoff', { ascending: true });
        if (g) {
          setGames(g);
          const weeks = [...new Set(g.map(game => game.week_number))].sort((a, b) => a - b);
          setAvailableWeeks(weeks);
          if (weeks.length > 0) setActiveWeek(weeks[0]);
        }
        
        const { data: activeBets } = await supabase.from('bets').select('wager_amount').eq('status', 'pending');
        if (activeBets && activeBets.length > 0) {
          const top = Math.max(...activeBets.map(b => b.wager_amount), 0);
          setStats({ topWhale: top, activeBets: activeBets.length });
        }
        
        const { data: msgs } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(6);
        setRecentMessages(msgs || []);

        // --- UPGRADED SPLASH SCREEN CALCULATOR ---
        if (typeof window !== 'undefined') {
          const { data: finalGames } = await supabase.from('games').select('week_number').eq('status', 'final');
          
          if (finalGames && finalGames.length > 0) {
            const completedWeeks = [...new Set(finalGames.map(game => game.week_number))].sort((a,b) => b-a);
            const latestWeek = completedWeeks[0];
            
            const splashKey = 'nfl_splash_week_${latestWeek}';
            if (!localStorage.getItem(splashKey)) {
              
              // NEW GUARDRAIL: Check if there are any games STILL PENDING for this week
              const { data: pendingThisWeek } = await supabase
                .from('games')
                .select('id')
                .eq('week_number', latestWeek)
                .eq('status', 'pending');

              // ONLY show the splash if every single game for this week is officially graded
              if (pendingThisWeek && pendingThisWeek.length === 0) {
                
                const { data: allGraded } = await supabase
                  .from('bets')
                  .select('wager_amount, odds, status, selection, line_at_bet, profiles!fk_bets_profiles(display_name), games!fk_bets_games(week_number)')
                  .neq('status', 'pending');

                const weekBets = allGraded.filter(b => b.games?.week_number === latestWeek);
                
                if (weekBets.length > 0) {
                  let userStats = {};
                  let biggestHit = { name: 'No Hits', amount: 0, pick: '-' };
                  let sniper = { name: 'No Snipes', odds: -9999, pick: '-', formattedOdds: '-' };

                  weekBets.forEach(bet => {
                    const name = bet.profiles?.display_name || 'Unknown';
                    if (!userStats[name]) userStats[name] = { grossProfit: 0, netProfit: 0, totalWagered: 0 };
                    
                    const amount = parseFloat(bet.wager_amount);
                    const numOdds = parseFloat(bet.odds) || -110;

                    userStats[name].totalWagered += amount;
                    
                    if (bet.status === 'won') {
                      const profit = calculateProfit(amount, bet.odds).rawProfit;
                      userStats[name].grossProfit += profit;
                      userStats[name].netProfit += profit;
                      
                      if (profit > biggestHit.amount) {
                        biggestHit = { 
                          name, 
                          amount: profit, 
                          pick: `${bet.selection} ${bet.line_at_bet || ''}`.trim() 
                        };
                      }

                      if (numOdds > sniper.odds) {
                        sniper = {
                          name,
                          odds: numOdds,
                          pick: `${bet.selection} ${bet.line_at_bet || ''}`.trim(),
                          formattedOdds: numOdds > 0 ? `+${numOdds}` : numOdds.toString()
                        };
                      }
                    } else if (bet.status === 'lost') {
                      userStats[name].netProfit -= amount;
                    }
                  });

                  let mvp = { name: 'No One', amount: 0 };
                  let toilet = { name: 'No One', amount: 0 };
                  let degenerate = { name: 'No One', amount: 0 };

                  Object.keys(userStats).forEach(name => {
                    if (userStats[name].grossProfit > mvp.amount) {
                      mvp = { name, amount: userStats[name].grossProfit };
                    }
                    if (userStats[name].netProfit < toilet.amount) {
                      toilet = { name, amount: userStats[name].netProfit };
                    }
                    if (userStats[name].totalWagered > degenerate.amount) {
                      degenerate = { name, amount: userStats[name].totalWagered };
                    }
                  });

                  setSplashData({
                    week: latestWeek,
                    mvp,
                    toilet,
                    biggestHit,
                    sniper,
                    degenerate,
                    storageKey: splashKey
                  });
                }
              }
            }
          }
        }
      }
      setPageLoading(false);
    }
    getInitialData();

    // Ensures your live chat keeps working!
    const channel = supabase.channel('sidebar').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
      setRecentMessages(prev => [p.new, ...prev].slice(0, 6));
    }).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const dismissSplash = () => {
    localStorage.setItem(splashData.storageKey, 'true');
    setSplashData(null);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      if (authView === 'sign_in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.reload();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Account created successfully! You can now sign in.");
        setAuthView('sign_in');
      }
    } catch (err) { setAuthError(err.message); } 
    finally { setAuthLoading(false); }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const formatLine = (val) => {
    if (val === null || val === undefined || val === '—') return '—';
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    return num > 0 ? `+${num}` : num;
  };

  const formatOdds = (odds) => {
    if (!odds || odds === '—') return '-110';
    const num = parseFloat(odds);
    if (isNaN(num)) return odds;
    return num > 0 ? `+${num}` : num;
  };

  const handlePlaceBet = async () => {
    if (!betAmount || !selectedBet || !user) return;
    const wager = parseFloat(betAmount);

    if (wager > balance) {
      alert(`❌ INSUFFICIENT FUNDS: You only have $${balance.toFixed(2)} in your bankroll.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const numLine = selectedBet.type === 'moneyline' || selectedBet.value === 'ML' ? null : parseFloat(selectedBet.value);
      const numOdds = parseFloat(selectedBet.odds) || -110;

      // 1. Process the Bet
      const { error: insertError } = await supabase.from('bets').insert([{
        user_id: user.id, 
        game_id: selectedBet.game.id, 
        selection: selectedBet.selection,
        bet_type: selectedBet.type, 
        line_at_bet: numLine, 
        odds: numOdds,        
        wager_amount: wager, 
        status: 'pending'
      }]);

      if (insertError) throw insertError;

      // 2. Update Wallet
      await supabase.from('profiles').update({ balance: balance - wager }).eq('id', user.id);

      // 3. Close the Modal Immediately (So the user is never stuck)
      setSelectedBet(null);
      setBetAmount("");

      // 4. Fire the Whale Alert (Silently)
      if (wager >= 50) {
        const whaleMessages = [
          `${profile?.display_name || 'Someone'} JUST DROPPED A WHALE BET! 🐋💸`,
          `🚨 ALERT: ${profile?.display_name || 'Someone'} is risking the rent money!`,
          `High roller in the building! ${profile?.display_name || 'Someone'} pushed the chips in. 🎰`,
          `🐳 WHALE SIGHTING: ${profile?.display_name || 'Someone'} must know something we don't.`,
          `Heavy action coming in from ${profile?.display_name || 'Someone'}. Fade or follow? 👀`,
          `Vegas is sweating. ${profile?.display_name || 'Someone'} just emptied the clip. 🔫`,
          `Calling a zero blitz! ${profile?.display_name || 'Someone'} is bringing the house on this bet. 🏈🏠`
        ];
        const randomMsg = whaleMessages[Math.floor(Math.random() * whaleMessages.length)];
        
        // If this fails, it won't crash the app. It just logs an error to the background console.
        const { error: chatError } = await supabase.from('messages').insert([{ 
          user_id: user.id, 
          author_name: 'SYSTEM', 
          content: randomMsg, 
          message_type: 'system_alert' 
        }]);

        if (chatError) console.error("Whale alert failed to send:", chatError.message);
      }
      
      // 5. Success
      alert("✅ TICKET LOCKED IN!");
      window.location.reload();

    } catch (err) { 
      console.error(err);
      alert(`Error placing bet: ${err.message}`); 
    }
    finally { 
      setIsSubmitting(false); 
    }
  };

  const isCommissioner = profile?.role === 'admin' || profile?.display_name?.toUpperCase() === 'CJYES';
  const displayedGames = games.filter(g => g.week_number === activeWeek && new Date(g.kickoff) > new Date());

  if (pageLoading) return <main className="min-h-screen bg-slate-200 flex items-center justify-center font-black uppercase tracking-widest text-brand-dark text-xl">Opening The Book...</main>;

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-200 flex flex-col items-center justify-center p-4">
        <div className="mb-8 text-center">
          <img src="/icon.png" alt="Action League" className="w-20 h-20 mx-auto mb-4 object-contain" />
          <h1 className="text-4xl font-black text-brand-dark italic uppercase tracking-tighter">Action League</h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-2">Players Only.</p>
        </div>
        
        <div className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-200 w-full max-w-md">
          <div className="flex gap-4 mb-8 border-b-2 border-gray-100 pb-4">
            <button onClick={() => { setAuthView('sign_in'); setAuthError(null); }} className={`flex-1 font-black uppercase tracking-widest text-xs pb-2 transition-colors ${authView === 'sign_in' ? 'text-brand-violet border-b-2 border-brand-violet' : 'text-gray-400 hover:text-gray-600'}`}>Sign In</button>
            <button onClick={() => { setAuthView('sign_up'); setAuthError(null); }} className={`flex-1 font-black uppercase tracking-widest text-xs pb-2 transition-colors ${authView === 'sign_up' ? 'text-brand-violet border-b-2 border-brand-violet' : 'text-gray-400 hover:text-gray-600'}`}>Register</button>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            {authError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-[10px] font-bold uppercase border border-red-200">{authError}</div>}
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-brand-dark focus:border-brand-violet outline-none transition-colors" placeholder="player@actionleague.com" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-brand-dark focus:border-brand-violet outline-none transition-colors" placeholder="••••••••" />
            </div>
            <button type="submit" disabled={authLoading} className="w-full bg-[#0b0f19] text-brand-volt py-4 rounded-xl font-black uppercase tracking-widest hover:bg-brand-dark transition-colors shadow-lg disabled:opacity-50 mt-4">
              {authLoading ? 'Verifying...' : (authView === 'sign_in' ? 'Enter The Book' : 'Join League')}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-200 text-brand-dark font-sans pb-12 relative">
      
      {/* THE MORNING AFTER SPLASH SCREEN */}
      {splashData && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-[#0b0f19] border-4 border-brand-violet rounded-3xl w-full max-w-lg overflow-hidden shadow-[0_0_50px_rgba(139,92,246,0.3)]">
            <div className="p-8 text-center border-b border-gray-800">
              <span className="text-brand-volt font-black uppercase tracking-[0.3em] text-[10px]">The Morning After</span>
              <h2 className="text-4xl font-black uppercase italic tracking-tighter text-white mt-2">
                Week {splashData.week} <br/>In The Books
              </h2>
            </div>
            
            <div className="p-8 space-y-6">
              {/* MVP */}
              <div className="bg-[#1e293b] p-4 rounded-xl border border-gray-700 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">🏆 The Champ</p>
                  <p className="text-xl font-black text-white uppercase italic">{splashData.mvp.name}</p>
                </div>
                <span className="text-2xl font-black text-green-500">+${splashData.mvp.amount.toFixed(0)}</span>
              </div>

              {/* WHALE */}
              <div className="bg-[#1e293b] p-4 rounded-xl border border-gray-700 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">🐋 Biggest Hit</p>
                  <p className="text-lg font-black text-white uppercase italic">{splashData.biggestHit.name}</p>
                  <p className="text-[10px] font-bold text-gray-500 uppercase mt-0.5">{splashData.biggestHit.pick}</p>
                </div>
                <span className="text-xl font-black text-brand-volt">+${splashData.biggestHit.amount.toFixed(0)}</span>
              </div>

              {/* TOILET BOWL */}
              <div className="bg-red-950/30 p-4 rounded-xl border border-red-900/50 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-red-500 font-black uppercase tracking-widest mb-1">🥶 Toilet Bowl (Net Loss)</p>
                  <p className="text-lg font-black text-gray-300 uppercase italic">{splashData.toilet.name}</p>
                </div>
                <span className="text-xl font-black text-red-500">-${Math.abs(splashData.toilet.amount).toFixed(0)}</span>
              </div>
            </div>

            <div className="p-6 bg-black">
              <button 
                onClick={dismissSplash} 
                className="w-full bg-brand-violet text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-white hover:text-brand-violet transition-colors shadow-lg active:scale-95"
              >
                Enter Week {splashData.week + 1}
              </button>
            </div>
          </div>
        </div>
      )}

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
            <a href="https://docs.google.com/forms/d/e/1FAIpQLScaec7ad9MQCanDmLrWQ8s6pQ-JnEMZhRvxtTm4tLTuK2eaSg/viewform" target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-gray-400 uppercase hover:text-brand-volt transition-colors">Feedback</a>
            <a href="/my-bets" className="bg-brand-violet text-white px-4 py-2 rounded font-black uppercase text-[10px] hover:bg-white hover:text-brand-violet transition-colors shadow-md">My Slips</a>
            <button onClick={handleSignOut} className="text-[9px] text-gray-500 font-bold uppercase border-l border-gray-800 pl-4 hover:text-red-400 transition-colors">Sign Out</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-gray-300 pb-2 mb-4">
             <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500">The Board</h2>
             {availableWeeks.length > 0 && (
                <div className="flex gap-2 mt-3 sm:mt-0">
                  {availableWeeks.map(weekNum => (
                    <button 
                      key={weekNum}
                      onClick={() => setActiveWeek(weekNum)}
                      className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                        activeWeek === weekNum 
                        ? 'bg-brand-violet text-white shadow-md' 
                        : 'bg-white text-gray-500 border border-gray-200 hover:border-brand-violet hover:text-brand-violet'
                      }`}
                    >
                      Week {weekNum}
                    </button>
                  ))}
                </div>
             )}
          </div>
          
          {displayedGames.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-200 shadow-sm">
              <p className="text-gray-400 font-bold italic">No pending games available right now. The Commissioner is sleeping.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {displayedGames.map(game => {
                const totalVal = game.total_points ?? game.over_under ?? game.total ?? '—';
                const awaySpread = game.away_spread ?? game.spread ?? 0;
                const homeSpread = game.home_spread ?? (awaySpread ? (parseFloat(awaySpread) * -1) : 0);
                const awaySpreadOdds = game.away_spread_odds ?? -110;
                const homeSpreadOdds = game.home_spread_odds ?? -110;
                const overOdds = game.over_odds ?? -110;
                const underOdds = game.under_odds ?? -110;
                const awayMl = game.away_moneyline ?? game.away_ml ?? '—';
                const homeMl = game.home_moneyline ?? game.home_ml ?? '—';
                const kickoffDate = new Date(game.kickoff);

                return (
                  <div key={game.id} className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
                    <div className="bg-[#0b0f19] p-3 flex justify-between items-center px-4 border-b-4 border-brand-violet">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-brand-volt uppercase tracking-widest">{kickoffDate.toLocaleDateString()}</span>
                        <span className="text-gray-500 text-[10px]">•</span>
                        <span className="text-[11px] font-black text-white uppercase tracking-widest">{kickoffDate.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}</span>
                      </div>
                      <span className="text-[9px] font-black bg-brand-violet text-white px-2 py-0.5 rounded uppercase shadow-sm">Week {game.week_number}</span>
                    </div>

                    <div className="p-4 md:p-6">
                      <div className="text-center mb-5 pb-4 border-b border-gray-100 flex flex-wrap justify-center items-center gap-2">
                        <h3 className="font-black text-lg md:text-xl text-brand-dark uppercase tracking-tight whitespace-nowrap">{game.away_team}</h3>
                        <span className="text-gray-300 font-medium italic mx-1">@</span>
                        <h3 className="font-black text-lg md:text-xl text-brand-dark uppercase tracking-tight whitespace-nowrap">{game.home_team}</h3>
                      </div>

                      <div className="grid grid-cols-[50px_1fr_1fr_1fr] md:grid-cols-[70px_1fr_1fr_1fr] gap-2 md:gap-3 mb-2 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center items-end pb-1">
                        <div className="text-left pl-2">Team</div>
                        <div>Spread</div>
                        <div>Moneyline</div>
                        <div>Total</div>
                      </div>

                      <div className="grid grid-cols-[50px_1fr_1fr_1fr] md:grid-cols-[70px_1fr_1fr_1fr] gap-2 md:gap-3 items-center mb-3">
                        <div className="border-l-4 border-gray-300 pl-2">
                          <span className="font-black text-sm md:text-lg text-brand-dark uppercase">{game.away_abbr}</span>
                        </div>
                        <button onClick={() => setSelectedBet({ game, selection: game.away_abbr, type: 'spread', value: awaySpread, odds: awaySpreadOdds })} className="bg-slate-50 hover:bg-brand-volt hover:text-brand-dark text-brand-dark py-2 rounded-xl transition-all border border-gray-200 shadow-sm flex flex-col items-center justify-center group">
                          <span className="font-black text-sm md:text-base leading-none mb-1">{formatLine(awaySpread)}</span>
                          <span className="text-[9px] md:text-[10px] font-bold text-gray-400 group-hover:text-brand-dark/70 leading-none">{formatOdds(awaySpreadOdds)}</span>
                        </button>
                        <button onClick={() => setSelectedBet({ game, selection: game.away_abbr, type: 'moneyline', value: 'ML', odds: awayMl })} className="bg-slate-50 hover:bg-brand-volt hover:text-brand-dark text-brand-dark py-2 rounded-xl transition-all border border-gray-200 shadow-sm flex flex-col items-center justify-center group">
                          <span className="font-black text-sm md:text-base leading-none mb-1">{awayMl !== '—' ? formatOdds(awayMl) : 'ML'}</span>
                          <span className="text-[9px] md:text-[10px] font-bold text-gray-400 group-hover:text-brand-dark/70 leading-none">{awayMl !== '—' ? 'ML' : 'Pick Em'}</span>
                        </button>
                        <button onClick={() => setSelectedBet({ game, selection: 'OVER', type: 'total', value: totalVal, odds: overOdds })} className="bg-slate-50 hover:bg-brand-volt hover:text-brand-dark text-brand-dark py-2 rounded-xl transition-all border border-gray-200 shadow-sm flex flex-col items-center justify-center group">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-[8px] md:text-[9px] uppercase text-gray-400 font-bold group-hover:text-brand-dark/70 leading-none">O</span>
                            <span className="font-black text-sm md:text-base leading-none">{totalVal}</span>
                          </div>
                          <span className="text-[9px] md:text-[10px] font-bold text-gray-400 group-hover:text-brand-dark/70 leading-none">{formatOdds(overOdds)}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-[50px_1fr_1fr_1fr] md:grid-cols-[70px_1fr_1fr_1fr] gap-2 md:gap-3 items-center">
                        <div className="border-l-4 border-brand-violet pl-2">
                          <span className="font-black text-sm md:text-lg text-brand-violet uppercase">{game.home_abbr}</span>
                        </div>
                        <button onClick={() => setSelectedBet({ game, selection: game.home_abbr, type: 'spread', value: homeSpread, odds: homeSpreadOdds })} className="bg-slate-50 hover:bg-brand-volt hover:text-brand-dark text-brand-dark py-2 rounded-xl transition-all border border-gray-200 shadow-sm flex flex-col items-center justify-center group">
                          <span className="font-black text-sm md:text-base leading-none mb-1">{formatLine(homeSpread)}</span>
                          <span className="text-[9px] md:text-[10px] font-bold text-gray-400 group-hover:text-brand-dark/70 leading-none">{formatOdds(homeSpreadOdds)}</span>
                        </button>
                        <button onClick={() => setSelectedBet({ game, selection: game.home_abbr, type: 'moneyline', value: 'ML', odds: homeMl })} className="bg-slate-50 hover:bg-brand-volt hover:text-brand-dark text-brand-dark py-2 rounded-xl transition-all border border-gray-200 shadow-sm flex flex-col items-center justify-center group">
                          <span className="font-black text-sm md:text-base leading-none mb-1">{homeMl !== '—' ? formatOdds(homeMl) : 'ML'}</span>
                          <span className="text-[9px] md:text-[10px] font-bold text-gray-400 group-hover:text-brand-dark/70 leading-none">{homeMl !== '—' ? 'ML' : 'Pick Em'}</span>
                        </button>
                        <button onClick={() => setSelectedBet({ game, selection: 'UNDER', type: 'total', value: totalVal, odds: underOdds })} className="bg-slate-50 hover:bg-brand-volt hover:text-brand-dark text-brand-dark py-2 rounded-xl transition-all border border-gray-200 shadow-sm flex flex-col items-center justify-center group">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-[8px] md:text-[9px] uppercase text-gray-400 font-bold group-hover:text-brand-dark/70 leading-none">U</span>
                            <span className="font-black text-sm md:text-base leading-none">{totalVal}</span>
                          </div>
                          <span className="text-[9px] md:text-[10px] font-bold text-gray-400 group-hover:text-brand-dark/70 leading-none">{formatOdds(underOdds)}</span>
                        </button>
                      </div>

                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
           <div className="bg-[#0b0f19] rounded-2xl p-6 text-white shadow-xl border-t-4 border-brand-volt">
              <h3 className="font-black italic uppercase tracking-tighter text-xl mb-4 text-brand-volt">League Intel</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                  <span className="text-[11px] font-bold text-gray-400 uppercase">Top Whale</span>
                  <span className="font-black text-brand-volt text-xl">${stats.topWhale.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-[11px] font-bold text-gray-400 uppercase">Active Bets</span>
                  <span className="font-black text-white text-xl">{stats.activeBets}</span>
                </div>
              </div>
           </div>

           <div className="bg-[#0b0f19] rounded-2xl p-5 shadow-xl border border-gray-800 h-[450px] flex flex-col overflow-hidden">
              <h3 className="font-black uppercase text-[11px] tracking-[0.2em] text-brand-violet mb-4">Locker Room</h3>
              <div className="flex-grow space-y-3 overflow-y-auto pr-2">
                {recentMessages.map(m => (
                  <div key={m.id} className={`p-4 rounded-xl text-[13px] border leading-snug ${m.message_type === 'system_alert' ? 'bg-brand-volt/10 border-brand-volt text-brand-volt font-black shadow-[0_0_10px_rgba(57,255,20,0.1)]' : 'bg-[#1e293b] border-gray-800 text-gray-200'}`}>
                    <span className="block text-[9px] opacity-60 uppercase mb-1.5 font-black tracking-wider text-gray-400">{m.author_name}</span>
                    {m.content}
                  </div>
                ))}
              </div>
           </div>
        </div>
      </div>

      {selectedBet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-[#0b0f19] p-6 text-white border-b-4 border-brand-violet">
              <p className="text-brand-volt font-black uppercase tracking-widest text-[10px] mb-2">Review Ticket</p>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter">
                    {selectedBet.selection} {selectedBet.type !== 'moneyline' ? formatLine(selectedBet.value) : ''}
                  </h2>
                  <p className="text-gray-400 text-xs font-bold mt-1 uppercase">{selectedBet.game.away_abbr} @ {selectedBet.game.home_abbr}</p>
                </div>
                <div className="bg-[#1e293b] text-brand-volt px-3 py-1.5 rounded-lg font-black text-lg border border-gray-700">
                  {formatOdds(selectedBet.odds)}
                </div>
              </div>
            </div>
            
            <div className="p-8">
              <div className="flex justify-between items-end mb-4">
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest">Wager Amount ($)</label>
                
                <div className="bg-brand-violet/10 px-3 py-1.5 rounded border border-brand-violet/20 text-right">
                  <span className="block text-[8px] font-black text-brand-violet uppercase tracking-widest mb-0.5">Avail Bankroll</span>
                  <span className="block text-sm font-black text-brand-dark leading-none">${balance.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="relative mb-6">
                <input 
                  type="number" 
                  autoFocus 
                  value={betAmount} 
                  onChange={(e) => setBetAmount(e.target.value)} 
                  placeholder="0.00" 
                  className="w-full text-5xl font-black border-b-4 border-gray-100 bg-transparent text-brand-dark focus:border-brand-violet outline-none pb-2 pr-16" 
                />
                
                <button 
                  onClick={() => setBetAmount(balance.toString())}
                  className="absolute right-0 bottom-4 bg-gray-200 text-gray-600 hover:bg-brand-violet hover:text-white px-3 py-1.5 rounded font-black text-[10px] uppercase tracking-widest transition-colors shadow-sm"
                >
                  Max
                </button>
              </div>
              
              {betAmount > 0 && (
                <div className="bg-slate-50 p-5 rounded-xl border border-gray-200">
                  <div className="flex justify-between mb-2">
                    <span className="text-[11px] font-black text-gray-500 uppercase">To Win (Profit)</span>
                    <span className="text-sm font-black text-green-600">+${calculateProfit(betAmount, selectedBet.odds).profit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[11px] font-black text-gray-500 uppercase">Total Payout</span>
                    <span className="text-sm font-black text-brand-dark">${calculateProfit(betAmount, selectedBet.odds).total}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-4 mt-8">
                <button onClick={() => setSelectedBet(null)} className="w-1/3 text-gray-400 hover:text-brand-dark font-black uppercase text-xs transition-colors">Cancel</button>
                <button 
                  onClick={handlePlaceBet} 
                  disabled={isSubmitting || parseFloat(betAmount) > balance || !betAmount || parseFloat(betAmount) <= 0} 
                  className="w-2/3 bg-brand-dark text-brand-volt py-4 rounded-xl font-black uppercase tracking-widest hover:bg-[#1e293b] transition-colors shadow-lg active:scale-95 disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
                >
                  {isSubmitting ? 'Locking...' : 'Lock It In'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}