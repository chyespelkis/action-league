"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 🛑 REPLACE THIS WITH YOUR ACTUAL LOGIN EMAIL 🛑
const COMMISSIONER_EMAIL = 'chyespelkis@gmail.com';

export default function Commissioner() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const [homeTeam, setHomeTeam] = useState('');
  const [homeAbbr, setHomeAbbr] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [awayAbbr, setAwayAbbr] = useState('');
  const [kickoff, setKickoff] = useState('');
  const [homeSpread, setHomeSpread] = useState('');
  const [homeML, setHomeML] = useState('');
  const [awayML, setAwayML] = useState('');
  const [total, setTotal] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  
  const [activeGames, setActiveGames] = useState([]);
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email === COMMISSIONER_EMAIL) {
        setIsAuthorized(true);
        fetchData();
      }
      setAuthLoading(false);
    }
    checkAuth();
  }, []);

  async function fetchData() {
    const { data: gamesData } = await supabase.from('games').select('*').order('kickoff', { ascending: true });
    if (gamesData) setActiveGames(gamesData);

    const { data: playersData } = await supabase.from('profiles').select('*').order('display_name', { ascending: true });
    if (playersData) setPlayers(playersData);
  }

  async function handleAddGame(e) {
    e.preventDefault();
    setStatusMessage('Adding game to database...');
      const { error } = await supabase.from('games').insert([{
        home_team: homeTeam, 
        away_team: awayTeam,
        home_abbr: homeAbbr.toUpperCase(), // Saves it as BHAM
        away_abbr: awayAbbr.toUpperCase(), // Saves it as STAL
        kickoff: new Date(kickoff).toISOString(),
        home_spread: parseFloat(homeSpread), away_spread: parseFloat(homeSpread) * -1,
        home_ml: parseInt(homeML), away_ml: parseInt(awayML), total_points: parseFloat(total)
      }]);
    if (error) {
      setStatusMessage(`Error: ${error.message}`);
    } else {
      setStatusMessage('Touchdown! The full board is updated.');
      setHomeTeam(''); setAwayTeam(''); setKickoff(''); setHomeSpread(''); setHomeML(''); setAwayML(''); setTotal('');
      fetchData();
    }
  }

  async function handleDeleteGame(gameId) {
    if (!window.confirm("Are you sure you want to delete this game? This will also delete any bets placed on it!")) return;
    await supabase.from('games').delete().eq('id', gameId);
    fetchData(); 
  }

  async function handleRemovePlayer(playerId, playerName) {
    if (!window.confirm(`Are you absolutely sure you want to cut ${playerName} from the league? This permanently deletes their profile, wallet, and all active wagers.`)) return;
    
    await supabase.from('bets').delete().eq('user_id', playerId);
    await supabase.from('weekly_wallets').delete().eq('user_id', playerId);
    await supabase.from('profiles').delete().eq('id', playerId);
    
    alert(`${playerName} has been removed from the league.`);
    fetchData();
  }

  if (authLoading) return <main className="p-8 text-center font-black uppercase italic text-brand-dark">Verifying Credentials...</main>;

  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
        <div className="bg-red-500 text-white p-8 rounded-xl shadow-2xl text-center max-w-md w-full border-4 border-red-700">
          <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-4">Access Denied</h1>
          <p className="font-bold mb-6 text-red-100">You must be the Commissioner to enter the Front Office.</p>
          <a href="/" className="inline-block bg-brand-dark text-brand-volt px-6 py-3 rounded-lg font-black uppercase tracking-widest hover:bg-brand-panel transition-colors shadow-lg">Return to Board</a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* NEW COMMISSIONER HEADER WITH HOME BUTTON */}
        <div className="flex justify-between items-end mb-8 border-b-4 border-brand-violet pb-4">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-brand-dark">Front Office</h1>
          <a href="/" className="bg-brand-dark text-brand-volt px-4 py-2 rounded-lg font-black uppercase tracking-widest hover:bg-brand-panel transition-colors text-[10px] md:text-xs shadow-md">
            Return to Board
          </a>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          
          {/* LEFT COLUMN: Add Lines */}
          <div className="bg-white p-8 rounded-xl shadow-md border-t-8 border-t-brand-dark border-x border-b border-gray-200 h-fit">
            <h2 className="text-2xl font-black italic uppercase text-brand-dark mb-6">Add Lines</h2>
            
            <form onSubmit={handleAddGame} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase">Away Team</label>
                  <input type="text" required value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} className="mt-1 block w-full border-2 border-gray-200 rounded-lg p-2 font-bold focus:border-brand-violet outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase">Home Team</label>
                  <input type="text" required value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} className="mt-1 block w-full border-2 border-gray-200 rounded-lg p-2 font-bold focus:border-brand-violet outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Kickoff Time</label>
                <input type="datetime-local" required value={kickoff} onChange={(e) => setKickoff(e.target.value)} className="mt-1 block w-full border-2 border-gray-200 rounded-lg p-2 font-bold focus:border-brand-violet outline-none" />
              </div>

              <div className="grid grid-cols-3 gap-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Home Spread</label>
                  <input type="number" step="0.5" required value={homeSpread} onChange={(e) => setHomeSpread(e.target.value)} placeholder="-3.5" className="mt-1 block w-full border-2 border-gray-200 rounded p-2 font-bold text-sm focus:border-brand-violet outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Away ML</label>
                  <input type="number" required value={awayML} onChange={(e) => setAwayML(e.target.value)} placeholder="+150" className="mt-1 block w-full border-2 border-gray-200 rounded p-2 font-bold text-sm focus:border-brand-violet outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Home ML</label>
                  <input type="number" required value={homeML} onChange={(e) => setHomeML(e.target.value)} placeholder="-170" className="mt-1 block w-full border-2 border-gray-200 rounded p-2 font-bold text-sm focus:border-brand-violet outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Game Total (O/U)</label>
                <input type="number" step="0.5" required value={total} onChange={(e) => setTotal(e.target.value)} placeholder="44.5" className="mt-1 block w-full border-2 border-gray-200 rounded-lg p-2 font-bold focus:border-brand-violet outline-none" />
              </div>

              <button type="submit" className="w-full bg-brand-dark text-brand-volt font-black uppercase tracking-widest py-3 rounded-lg hover:bg-brand-panel shadow-[0_0_10px_rgba(57,255,20,0.2)] transition-all">
                Post to Board
              </button>
            </form>

            {statusMessage && <div className="mt-4 p-3 bg-brand-dark text-brand-volt border border-brand-violet rounded-lg text-center font-bold">{statusMessage}</div>}
          </div>

          {/* RIGHT COLUMN: Manage Board & Manage Roster */}
          <div className="space-y-8">
            
            {/* Manage Games */}
            <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200">
              <h2 className="text-2xl font-black italic uppercase mb-6 text-brand-dark">Manage Board</h2>
              <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {activeGames.length === 0 ? (
                  <p className="text-gray-500 font-bold italic">No games on the board.</p>
                ) : (
                  activeGames.map(game => (
                    <div key={game.id} className="border-2 border-gray-100 rounded-lg p-4 flex justify-between items-center hover:border-brand-violet transition-colors">
                      <div>
                        <h3 className="font-black uppercase text-sm text-brand-dark">{game.away_team} @ {game.home_team}</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                          {new Date(game.kickoff).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <button onClick={() => handleDeleteGame(game.id)} className="text-xs bg-red-50 text-red-600 font-bold px-3 py-2 rounded border border-red-100 hover:bg-red-600 hover:text-white transition-colors uppercase tracking-wider">
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Manage Roster (Delete Users) */}
            <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200">
              <h2 className="text-2xl font-black italic uppercase mb-6 text-brand-dark">Manage Roster</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {players.length === 0 ? (
                  <p className="text-gray-500 font-bold italic">No players in the league yet.</p>
                ) : (
                  players.map(player => (
                    <div key={player.id} className="bg-gray-50 rounded-lg p-3 flex justify-between items-center border border-gray-200">
                      <div>
                        <span className="font-black text-brand-dark uppercase tracking-wider block">{player.display_name}</span>
                        <span className="text-[10px] text-brand-violet font-bold">{player.email || 'Email not captured'}</span>
                      </div>
                      <button 
                        onClick={() => handleRemovePlayer(player.id, player.display_name)} 
                        className="text-[10px] text-red-500 font-bold px-3 py-1 rounded border border-red-200 hover:bg-red-500 hover:text-white transition-colors uppercase tracking-widest"
                      >
                        Cut Player
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}