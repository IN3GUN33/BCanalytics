import { recommendShowcasePrices, recommendBuyPrices } from './pricing.js';
import { planNurseryPurchases } from './policy.js';
import { estimateDeal } from './simulator.js';
import { profitDominanceDealFilter } from './profit_dominance.js';

const DEFAULT_RISK = { reservePct: 0.15, reserveAbs: 30 };

export function buildPlan({state, risk=DEFAULT_RISK, profitDominance=true}){
  const showcase = recommendShowcasePrices({state});
  const buyPrices = recommendBuyPrices({state, sellRecos: showcase});
  const nurseryPlans = planNurseryPurchases({state, risk}).map(p=>estimateDeal({state, plan:p, risk}));
  const alpha = 0.2; // штраф за выручку питомника
  let candidates = nurseryPlans.filter(p=>{
    const hasRel = p?.nursery?.relation!=null; const budget = hasRel ? (p.planRelationBudget||p.relationBudget||0) : (p.relationBudget||0); const spent = Math.abs(p.relationDelta||0); return spent <= (budget||0);
  });

  if(profitDominance){
    candidates = candidates.filter(p=>{
      const lines = (p.lines||[]).map(l=>({ city: state.city.get(l.key), color:l.color, qty:l.expectedSold||l.qty||0, unitCost:l.buyPrice, targetSell:l.targetPrice }));
      const check = profitDominanceDealFilter({lines, gameCosts: state.gameCosts});
      if(!check.ok) return false; p.grossProfit = check.gross; p.nurseryRevenue = check.rev; return true;
    });
  }

  const score = (p)=>{
    const nurseryRevenue = p.nurseryRevenue ?? (p.lines||[]).reduce((s,x)=> s + (x.buyPrice||0)*(x.qty||0), 0);
    return (p.grossProfit - Math.abs(Math.min(0, p.relationDelta||0)) - alpha * nurseryRevenue);
  };
  candidates.sort((a,b)=> score(b) - score(a));
  const bestDeal = candidates.find(p=>p.ok);
  return { showcase, buyPrices, bestDeal, candidates, risk };
}
