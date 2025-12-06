// Profit-dominance filters to avoid feeding nurseries

export const TAU_BY_COLOR = { ginger: 2, gray: 3, black: 5, white: 7 };
export const ROI_MIN = 1.2; // minimal ratio grossProfit / nurseryRevenue per line
export const REV_CAP_RATIO = 0.8; // nursery revenue per deal must not exceed 80% of our gross profit for that deal

export function unitOverhead(gameCosts){
  const costs = gameCosts||{};
  return (costs.food||1) + Math.ceil((costs.household||3)/50);
}

export function profitDominanceAllowed({city, color, targetSell, nurseryPrice, gameCosts}){
  if(!Number.isFinite(targetSell) || !Number.isFinite(nurseryPrice)) return false;
  const tau = TAU_BY_COLOR[color] ?? 2;
  // strict price gap vs city sell
  if(Number.isFinite(city?.sell_price)){
    if(nurseryPrice >= (city.sell_price - tau)) return false;
  }
  // require our per-unit margin above overhead + 1
  const uo = unitOverhead(gameCosts);
  if((targetSell - nurseryPrice - uo) < 1) return false;
  return true;
}

export function profitDominanceDealFilter({lines, gameCosts}){
  // lines: [{city, color, qty, unitCost, targetSell}]
  const uo = unitOverhead(gameCosts);
  let gross = 0; let rev = 0;
  for(const l of lines){
    const g = (l.targetSell - l.unitCost - uo) * l.qty;
    const r = (l.unitCost) * l.qty;
    gross += g; rev += r;
    if(r<=0 || g<=0) return {ok:false, gross, rev};
    if((g/r) < ROI_MIN) return {ok:false, gross, rev};
  }
  if(rev > REV_CAP_RATIO * gross) return {ok:false, gross, rev};
  return {ok:true, gross, rev};
}
