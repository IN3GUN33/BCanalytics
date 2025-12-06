import { recommendedDiscountPctEnhanced, recommendedDiscountPct, maxAllowedRelationDelta } from './rules.js';
import { TAU_BY_COLOR, profitDominanceAllowed } from './profit_dominance.js';

export function planNurseryPurchases({state, risk}){
  const plans = [];
  for(const n of state.nurseries){
    const items = [];
    for(const [key, city] of state.city.entries()){
      const p = n.price.get(key); if(!p) continue;
      // строгая проверка profit-dominance для линии
      const target = state.showcase.get(key)?.price || (city.buy_price||0);
      if(!profitDominanceAllowed({ city, color:city.color, targetSell: target, nurseryPrice: p.sell_price, gameCosts: state.gameCosts })) continue;
      const margin = target - (p.sell_price||0);
      if(margin > 0){ items.push({ key, gender:city.gender, color:city.color, nursery:n, price:p.sell_price, margin }); }
    }
    items.sort((a,b)=>b.margin-a.margin);
    if(items.length){
      const take = items.slice(0, Math.min(4, items.length));
      const dealCatsCount = take.length * 5; // базовый батч
      const avgMargin = Math.round(take.reduce((s,x)=>s+x.margin,0)/take.length);
      const baseDisc = recommendedDiscountPct({dealCatsCount, relation:n.relation});
      const discountPct = recommendedDiscountPctEnhanced({dealCatsCount, relation:n.relation, avgMargin});
      const maxDelta = maxAllowedRelationDelta({relation:n.relation});
      plans.push({ nursery:n, lines: take, dealCatsCount, discountPct, baseDiscountPct: baseDisc, relationBudget: maxDelta, risk });
    }
  }
  return plans;
}
