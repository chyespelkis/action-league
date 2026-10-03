import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// We must use the SERVICE_ROLE_KEY here to bypass RLS policies and allow automated writing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ODDS_API_KEY = process.env.ODDS_API_KEY; // Get this free from the-odds-api.com

export async function GET(request) {
  try {
    const SPORTS = ['americanfootball_nfl', 'americanfootball_ncaaf'];
    let allFormattedGames = []; // FIXED: Initialized the array to hold all games

    // 1. CALCULATE THE WEDNESDAY CUTOFF
    const now = new Date();
    const cutoffDate = new Date();
    // 3 represents Wednesday (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)
    const daysUntilWednesday = (3 - now.getDay() + 7) % 7 || 7; 
    cutoffDate.setDate(now.getDate() + daysUntilWednesday);
    cutoffDate.setHours(12, 0, 0, 0); // Noon UTC on Wednesday
    
    // Format for The-Odds-API (ISO 8601)
    const commenceTimeTo = cutoffDate.toISOString().split('.')[0] + 'Z';

    for (const sport of SPORTS) {
      // 2. INJECT THE CUTOFF INTO THE FETCH URL
      const res = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&commenceTimeTo=${commenceTimeTo}`);
      
      if (!res.ok) continue;
      
      const apiGames = await res.json();
      
      // FIXED: Define league tag based on the current loop iteration
      const leagueTag = sport === 'americanfootball_nfl' ? 'NFL' : 'NCAAF';

      // FIXED: Map over apiGames instead of the undefined gamesData
      const formattedGames = apiGames.map(game => {
        // Find a reliable sportsbook for the lines (DraftKings is usually first/best)
        const bookmaker = game.bookmakers.find(b => b.key === 'draftkings') || game.bookmakers[0];
        if (!bookmaker) return null;

        // --- AUTOMATED WEEK CALCULATION ---
        const kickoffDate = new Date(game.commence_time);
        const seasonStart = new Date('2026-09-08T00:00:00Z'); // Anchor Day: Tuesday before NFL Week 1
        const diffTime = kickoffDate - seasonStart;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        let calculatedWeek = Math.floor(diffDays / 7) + 1;
        if (calculatedWeek < 1) calculatedWeek = 1;
        // ----------------------------------

        let home_ml = null, away_ml = null;
        let home_spread = null, away_spread = null;
        let total_points = null;

        // Parse Moneyline (h2h)
        const h2hMarket = bookmaker.markets.find(m => m.key === 'h2h');
        if (h2hMarket) {
          const homeOutcome = h2hMarket.outcomes.find(o => o.name === game.home_team);
          const awayOutcome = h2hMarket.outcomes.find(o => o.name === game.away_team);
          if (homeOutcome) home_ml = homeOutcome.price;
          if (awayOutcome) away_ml = awayOutcome.price;
        }

        // Parse Spread
        const spreadMarket = bookmaker.markets.find(m => m.key === 'spreads');
        if (spreadMarket) {
          const homeOutcome = spreadMarket.outcomes.find(o => o.name === game.home_team);
          const awayOutcome = spreadMarket.outcomes.find(o => o.name === game.away_team);
          if (homeOutcome) home_spread = homeOutcome.point;
          if (awayOutcome) away_spread = awayOutcome.point;
        }

        // Parse Total (Over/Under)
        const totalMarket = bookmaker.markets.find(m => m.key === 'totals');
        if (totalMarket) {
          total_points = totalMarket.outcomes[0]?.point; // Over and Under point values are the same
        }

        return {
          api_id: game.id,
          league: leagueTag,
          week_number: calculatedWeek, // REPLACED: Now dynamically assigning the week
          home_team: game.home_team,
          home_abbr: game.home_team.substring(0, 3).toUpperCase(), // Basic abbreviation fallback
          away_team: game.away_team,
          away_abbr: game.away_team.substring(0, 3).toUpperCase(),
          kickoff: game.commence_time,
          home_ml,
          away_ml,
          home_spread,
          away_spread,
          total_points,
          status: 'pending'
        };
      }).filter(Boolean); // Remove any null games

      allFormattedGames = [...allFormattedGames, ...formattedGames];
    }

    // UPSERT: Insert new games, or update odds for existing games based on the unique api_id
    const { error } = await supabase.from('games').upsert(allFormattedGames, { onConflict: 'api_id' });
    
    if (error) throw error;

    return NextResponse.json({ success: true, message: `Synced ${allFormattedGames.length} games to the board.` });

  } catch (error) {
    console.error("Odds Sync Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}