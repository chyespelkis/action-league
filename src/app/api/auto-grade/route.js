import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const ODDS_API_KEY = process.env.ODDS_API_KEY;

export async function GET(request) {
  try {
    const SPORTS = ['americanfootball_nfl', 'americanfootball_ncaaf'];
    let gradedCount = 0;

    for (const sport of SPORTS) {
      // Fetch scores from the last 3 days from The-Odds-API
      const res = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/scores/?apiKey=${ODDS_API_KEY}&daysFrom=3`);
      if (!res.ok) continue;
      
      const apiGames = await res.json();

      // Find games that are officially finished and have score data
      const completedApiGames = apiGames.filter(g => g.completed === true && g.scores !== null);
      if (completedApiGames.length === 0) continue;

      // Find those exact games in your database that are still marked as "pending"
      const { data: pendingDbGames } = await supabase
        .from('games')
        .select('*')
        .eq('status', 'pending')
        .in('api_id', completedApiGames.map(g => g.id));

      if (!pendingDbGames || pendingDbGames.length === 0) continue;

      // Grade them!
      for (let dbGame of pendingDbGames) {
        const apiData = completedApiGames.find(g => g.id === dbGame.api_id);
        if (!apiData) continue;

        const homeScoreObj = apiData.scores.find(s => s.name === dbGame.home_team);
        const awayScoreObj = apiData.scores.find(s => s.name === dbGame.away_team);

        if (!homeScoreObj || !awayScoreObj) continue;

        const homeScore = parseInt(homeScoreObj.score);
        const awayScore = parseInt(awayScoreObj.score);

        // 1. Update Game Status
        await supabase.from('games').update({ 
          home_score: homeScore, 
          away_score: awayScore, 
          status: 'final' 
        }).eq('id', dbGame.id);

        // 2. Fetch and Process All Bets for this Game
        const { data: bets } = await supabase.from('bets').select('*').eq('game_id', dbGame.id).eq('status', 'pending');

        if (bets && bets.length > 0) {
          for (let bet of bets) {
            let isWinner = false;
            let isPush = false; 

            // Moneyline Logic
            if (bet.bet_type === 'moneyline' || bet.bet_type === 'ML') {
              if (homeScore > awayScore) {
                if (bet.selection === dbGame.home_team || bet.selection === dbGame.home_abbr) isWinner = true;
              } else if (awayScore > homeScore) {
                if (bet.selection === dbGame.away_team || bet.selection === dbGame.away_abbr) isWinner = true;
              } else {
                isPush = true;
              }
            } 
            // Spread Logic
            else if (bet.bet_type === 'spread') {
              const betLine = parseFloat(bet.line_at_bet);
              if (bet.selection === dbGame.home_team || bet.selection === dbGame.home_abbr) {
                if ((homeScore + betLine) > awayScore) isWinner = true;
                else if ((homeScore + betLine) === awayScore) isPush = true;
              } else {
                if ((awayScore + betLine) > homeScore) isWinner = true;
                else if ((awayScore + betLine) === homeScore) isPush = true;
              }
            } 
            // Total (Over/Under) Logic
            else if (bet.bet_type === 'total') {
              const totalScore = homeScore + awayScore;
              const gameTotal = parseFloat(dbGame.total_points || dbGame.total || dbGame.over_under);
              
              if ((bet.selection === 'Over' || bet.selection === 'OVER') && totalScore > gameTotal) isWinner = true;
              else if ((bet.selection === 'Under' || bet.selection === 'UNDER') && totalScore < gameTotal) isWinner = true;
              else if (totalScore === gameTotal) isPush = true;
            }

            // Payout Logic
            if (isWinner) {
              const numOdds = parseFloat(bet.odds);
              let profit = numOdds > 0 ? bet.wager_amount * (numOdds / 100) : bet.wager_amount * (100 / Math.abs(numOdds));
              const payout = bet.wager_amount + profit;

              const { data: profile } = await supabase.from('profiles').select('balance').eq('id', bet.user_id).single();
              if (profile) await supabase.from('profiles').update({ balance: profile.balance + payout }).eq('id', bet.user_id);
              
              await supabase.from('bets').update({ status: 'won' }).eq('id', bet.id);
            } 
            else if (isPush) {
              const { data: profile } = await supabase.from('profiles').select('balance').eq('id', bet.user_id).single();
              if (profile) await supabase.from('profiles').update({ balance: profile.balance + bet.wager_amount }).eq('id', bet.user_id);
              
              await supabase.from('bets').update({ status: 'push' }).eq('id', bet.id);
            } 
            else {
              await supabase.from('bets').update({ status: 'lost' }).eq('id', bet.id);
            }
          }
        }
        gradedCount++;
      }
    }

    return NextResponse.json({ success: true, message: `Auto-graded ${gradedCount} games.` });

  } catch (error) {
    console.error("Auto-Grade Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}