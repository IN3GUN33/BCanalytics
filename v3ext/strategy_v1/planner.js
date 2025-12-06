import { recommendShowcasePrices, recommendBuyPrices } from './pricing.js';
import { planNurseryPurchases } from './policy.js';
import { estimateDeal } from './simulator.js';

// Risk config defaults for planner (can be overridden by caller)
const DEFAULT_RISK = {
  reservePct: 0.1,   // keep 10% balance as reserve
  reserveAbs: 20,    // or at least 20 coins
};

export function buildPlan({state, risk=DEFAULT_RISK}){
  const showcase = recommendShowcasePrices({state});
  const buyPrices = recommendBuyPrices({state, sellRecos: showcase});
  const nurseryPlans = planNurseryPurchases({state, risk}).map(p=>estimateDeal({state, plan:p, risk}));
  // строгий фильтр по репутации с питомниками: не тратить больше бюджета на ∆отношений
  const filtered = nurseryPlans.filter(p=>{
    const hasRel = p?.nursery?.relation!=null;
    const budget = hasRel ? (p.planRelationBudget||p.relationBudget||0) : (p.relationBudget||0);
    const spent = Math.abs(p.relationDelta||0);
    return spent <= (budget||0);
  });
  // Score with relation penalty: penalize negative deltas by their absolute magnitude
  const score = (p)=> (p.grossProfit - Math.abs(Math.min(0, p.relationDelta||0)));
  filtered.sort((a,b)=> score(b) - score(a));
  const bestDeal = filtered.find(p=>p.ok);
  return { showcase, buyPrices, bestDeal, candidates:filtered, risk };
}
