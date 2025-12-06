// Simple demand heuristic for showcase
// Returns sell-through ratio (0..1) for a horizon based on price within band and color/gender preferences

const COLOR_WEIGHT = {
  white: 1.15,
  black: 1.1,
  gray: 1.0,
  ginger: 0.95,
};

const GENDER_WEIGHT = {
  male: 1.0,
  female: 1.05,
};

const SEASON_WEIGHT = {
  spring: 1.08,
  summer: 1.0,
  fall: 0.95,
  winter: 1.02,
};

function normSeason(season){
  if(!season && season!==0) return null;
  if(typeof season === 'string') return season.toLowerCase();
  // numeric mapping fallback (0..3 -> spring..winter)
  const map = ['spring','summer','fall','winter'];
  return map[season] || null;
}

export function sellThrough({price, band, color, gender, season}){
  const [minP, maxP] = band;
  if(!price || !minP || !maxP || maxP<=minP){ return 0.6; }
  const t = (price - minP) / (maxP - minP); // 0 at min, 1 at max
  // at min price we sell ~90%, at max ~40%
  let base = 0.9 - 0.5 * Math.max(0, Math.min(1, t));
  const cw = COLOR_WEIGHT[color] ?? 1.0;
  const gw = GENDER_WEIGHT[gender] ?? 1.0;
  const sw = SEASON_WEIGHT[normSeason(season)] ?? 1.0;
  base *= cw * gw * sw;
  // clamp
  if(base<0.1) base=0.1;
  if(base>0.95) base=0.95;
  return base;
}

// Demand-limited quantity: cap expected sales by demand limit per type if provided
export function demandCap({expected, limit}){
  if(!limit || limit<=0) return expected;
  return Math.min(expected, limit);
}
