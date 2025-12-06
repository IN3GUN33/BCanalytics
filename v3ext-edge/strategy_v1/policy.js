import { recommendedDiscountPctEnhanced, recommendedDiscountPct, maxAllowedRelationDelta } from './rules.js';

export function planNurseryPurchases({state, risk}){
  // Heuristic: pick cats where (showcase target - nursery price) margin is highest, and batch into big deals
  const plans = [];
  for(const n of state.nurseries){
    const items = [];
    for(const [key, city] of state.city.entries()){
      const p = n.price.get(key); if(!p) continue;
      const margin = (state.showcase.get(key)?.price || (city.buy_price||0)) - (p.sell_price||0);
      if(margin > 0){ items.push({ key, gender:city.gender, color:city.color, nursery:n, price:p.sell_price, margin }); }
    }
    items.sort((a,b)=>b.margin-a.margin);
    if(items.length){
      const take = items.slice(0, Math.min(4, items.length));
      const dealCatsCount = take.length * 5; // pretend we buy 5 of each type
      const avgMargin = Math.round(take.reduce((s,x)=>s+x.margin,0)/take.length);
      const baseDisc = recommendedDiscountPct({dealCatsCount, relation:n.relation});
      const discountPct = recommendedDiscountPctEnhanced({dealCatsCount, relation:n.relation, avgMargin: avgMargin});
      const maxDelta = maxAllowedRelationDelta({relation:n.relation});
      plans.push({ nursery:n, lines: take, dealCatsCount, discountPct, baseDiscountPct: baseDisc, relationBudget: maxDelta, risk });
    }
  }
  return plans;
}
