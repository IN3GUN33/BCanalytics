import { minimalMargin, relationDeltaForDiscount } from './rules.js';
import { sellThrough, demandCap } from './demand.js';
import { cashReserve } from './credits.js';

function parseKey(key){ const [gender,color]=key.split('_'); return {gender,color}; }

export function affordableQty({balance, unitCost, plannedQty}){
  if(unitCost<=0) return plannedQty;
  const max = Math.floor(balance / unitCost);
  return Math.max(0, Math.min(plannedQty, max));
}

export function estimateDeal({state, plan, risk}){
  // plan: { nursery, lines:[{key, price, margin}], dealCatsCount, discountPct }
  const discount = (plan.discountPct||0)/100;
  const results = [];
  const costs = state.gameCosts||{};
  const perCatOverhead = (costs.food||1) + Math.ceil((costs.household||3)/50);
  let neededCash = 0; let revenue = 0; let grossProfit = 0; let catsTotal = 0;

  // Risk-aware cash buffer: don't spend below reserve to avoid cash gaps
  const reserve = cashReserve({balance: state.balance, credits: state.credits, timers: state.timers, gameCosts: state.gameCosts, risk});
  const spendable = Math.max(0, (state.balance||0) - reserve);

  for(const line of plan.lines){
    const key = line.key; const sc = state.showcase.get(key);
    const {gender,color} = parseKey(key);
    const targetPrice = sc?.price ?? 0;
    const buyPrice = Math.max(0, (line.price||0) * (1-discount));
    const unitCost = buyPrice; // платить нужно сразу
    const plannedQty = 5; // базовый батч
    // Respect spendable cap
    const remaining = Math.max(0, spendable - neededCash);
    const maxBySpend = unitCost>0 ? Math.floor(remaining / unitCost) : plannedQty;
    const qty = Math.max(0, Math.min(plannedQty, maxBySpend));
    if(qty<=0) continue;
    neededCash += unitCost * qty;
    const band = { min: targetPrice, max: Math.max(targetPrice, targetPrice*1.25) };
    const st = sellThrough({price: targetPrice, band:[band.min, band.max], color, gender, season: state.season});
    // apply demand cap if city quota defines per-type quantity
    const cityQ = state.city.get(key);
    const demandLimit = cityQ?.quantity ?? null;
    const expectedSold = Math.round(demandCap({ expected: qty * st, limit: demandLimit }));
    const sales = targetPrice * expectedSold;
    const unitOverhead = perCatOverhead;
    const unitProfit = targetPrice - unitCost - unitOverhead;
    revenue += sales;
    grossProfit += unitProfit * expectedSold;
    catsTotal += qty;
    results.push({ key, gender, color, qty, expectedSold, targetPrice, buyPrice, unitOverhead, unitProfit });
  }

  const minMargin = minimalMargin({gameCosts:state.gameCosts});
  const relationDelta = relationDeltaForDiscount({ askedPct: plan.discountPct||0, dealCatsCount: plan.dealCatsCount||catsTotal, relation: plan.nursery?.relation });

  return {
    nursery: plan.nursery,
    catsTotal,
    neededCash,
    revenue,
    grossProfit,
    relationDelta,
    planRelationBudget: plan.relationBudget,
    requestedDiscountPct: plan.discountPct,
    baseDiscountPct: plan.baseDiscountPct,
    lines: results,
    ok: catsTotal>0 && neededCash<=spendable && grossProfit >= minMargin,
  };
}
