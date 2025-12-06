import { unitOverhead } from './profit_dominance.js';

export function buildBuyOffer({nurseryUuid, lines}){
  return { msg_type:'trading_request', data:{ request_type:'buy', seller: nurseryUuid, contents: lines.map(l=>({ gender:l.gender, color:l.color, count:l.count, price:l.price })) } };
}

export function buildSellOffer({nurseryUuid, lines}){
  return { msg_type:'trading_request', data:{ request_type:'sell', buyer: nurseryUuid, contents: lines.map(l=>({ gender:l.gender, color:l.color, count:l.count, price:l.price, detail:l.detail })) } };
}

export function pickSellLinesFromShowcase({state, maxLines=3}){
  // берём излишки на витрине: если count > 0 и цена не ниже города+overhead+1
  const out=[]; const uo=unitOverhead(state.gameCosts);
  for(const [key, r] of state.showcase.entries()){
    const city = state.city.get(key); if(!city) continue;
    const count = r.count ?? 0; if(count<=0) continue;
    const minAcceptable = (city.sell_price||0)+uo+1;
    const price = Math.max(minAcceptable, r.price||minAcceptable);
    const take = Math.min(3, count);
    const details = Array.isArray(r.contents) ? r.contents.slice(0,take).map(c=>({ cat_id:c.cat_id })) : undefined;
    out.push({ key, gender:r.gender, color:r.color, count: take, price, detail: details && details.length ? details[0] : undefined });
  }
  return out.slice(0, maxLines);
}
