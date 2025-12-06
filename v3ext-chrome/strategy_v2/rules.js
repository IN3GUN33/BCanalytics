// Shop mode rules: margins, limits, relations impact

export const RELATION_LEVEL = {
  BAD: 'bad',
  NORMAL: 'normal',
  GOOD: 'good',
};

// How relation_to_me maps to qualitative levels. Game uses numeric smiles; in trainings: 0..5
export function relationLevel(score){
  if(score === null || score === undefined) return RELATION_LEVEL.NORMAL;
  if(score <= 1) return RELATION_LEVEL.BAD;
  if(score >= 4) return RELATION_LEVEL.GOOD;
  return RELATION_LEVEL.NORMAL;
}

// Max discount to ask from a nursery per deal size without harming relations too much
// We penalize asking discount on small deals. On big deals allow slightly more.
export function maxAllowedRelationDelta({relation}){
  // guard rails: how many relation points we can afford to lose per deal
  if(relation==null) return 1;
  if(relation <= 1) return 0;      // критично — не тратить вовсе
  if(relation === 2) return 1;     // очень аккуратно
  if(relation === 3) return 2;     // умеренно
  if(relation >= 4) return 3;      // можно чуть смелее
  return 1;
}

// Deal size classification thresholds (cats)
export const DEAL_SIZE = {
  SMALL: 'small',       // >=2 and <5 cats
  LARGE: 'large',       // >=5 and <7 cats
  VERY_LARGE: 'very_large', // >=7 cats
  MICRO: 'micro',       // <2 cats
};

export function dealSizeCategory(count){
  const c = Math.max(0, count||0);
  if(c >= 7) return DEAL_SIZE.VERY_LARGE;
  if(c >= 5) return DEAL_SIZE.LARGE;
  if(c >= 2) return DEAL_SIZE.SMALL;
  return DEAL_SIZE.MICRO;
}

export function recommendedDiscountPct({dealCatsCount, relation}){
  const level = relationLevel(relation);
  const size = dealSizeCategory(dealCatsCount||0);
  // base matrix by relation level and deal size
  const matrix = {
    [RELATION_LEVEL.BAD]:       { [DEAL_SIZE.MICRO]:0, [DEAL_SIZE.SMALL]:0, [DEAL_SIZE.LARGE]:1, [DEAL_SIZE.VERY_LARGE]:1 },
    [RELATION_LEVEL.NORMAL]:    { [DEAL_SIZE.MICRO]:0, [DEAL_SIZE.SMALL]:1, [DEAL_SIZE.LARGE]:2, [DEAL_SIZE.VERY_LARGE]:3 },
    [RELATION_LEVEL.GOOD]:      { [DEAL_SIZE.MICRO]:1, [DEAL_SIZE.SMALL]:2, [DEAL_SIZE.LARGE]:3, [DEAL_SIZE.VERY_LARGE]:4 },
  };
  const base = matrix[level]?.[size] ?? 0;
  const cap = maxAllowedRelationDelta({relation});
  return Math.min(base, cap);
}

// Enhanced: consider average margin to slightly bump within cap
export function recommendedDiscountPctEnhanced({dealCatsCount, relation, avgMargin}){
  const base = recommendedDiscountPct({dealCatsCount, relation});
  const cap = maxAllowedRelationDelta({relation});
  // bump +1% if avg margin >= 15, +2% if >= 25
  let bonus = 0;
  if((avgMargin||0) >= 25) bonus = 2; else if((avgMargin||0) >= 15) bonus = 1;
  return Math.min(cap, base + bonus);
}

// Model relation delta (cost) from asking discount
// Negative value means relation worsens. Stronger penalty at low relation, scales with deal size and asked pct.
export function relationDeltaForDiscount({askedPct=0, dealCatsCount=0, relation}){
  if(askedPct<=0) return 0;
  const level = relationLevel(relation);
  const sizeFactor = 1 + Math.min(2, (dealCatsCount||0)/10); // up to 3x at 20+ cats
  const basePerPct = level === RELATION_LEVEL.BAD ? 1.2 : level === RELATION_LEVEL.NORMAL ? 1.0 : 0.8;
  const delta = - (askedPct * basePerPct * sizeFactor) / 2; // 2% asked ~1 relation at normal, scaled by size
  // clamp: don't overshoot beyond -5 per deal
  return Math.max(-5, Math.round(delta*10)/10);
}

// Max markup to set on showcase relative to city buy price while staying competitive
export function recommendedMarkup({cityBuyPrice, relation}){
  const level = relationLevel(relation);
  const pct = level === RELATION_LEVEL.GOOD ? 30 : level === RELATION_LEVEL.NORMAL ? 25 : 20; // heuristic
  return Math.round(cityBuyPrice * pct / 100);
}

// Minimal margin per cat to consider profitable after costs
export function minimalMargin({gameCosts}){
  const costs = gameCosts||{};
  // household is per season, food per cat consumption; use conservative fixed per-cat overhead
  const overhead = (costs.food||1) + Math.ceil((costs.household||3)/50); // assume ~50 cats throughput per season
  return Math.max(2, overhead + 2);
}

export function priceBand({cityBuyPrice, gameCosts, relation}){
  const minMargin = minimalMargin({gameCosts});
  const minPrice = cityBuyPrice + minMargin;
  const markup = recommendedMarkup({cityBuyPrice, relation});
  const maxPrice = cityBuyPrice + markup;
  return { minPrice, maxPrice };
}
