// Offer helper: build TRADING_REQUEST messages for buy/sell lots with our constraints

export function buildBuyOffer({nurseryUuid, lines}){
  // lines: [{gender,color,count,price}]
  return { msg_type:'trading_request', data:{ request_type:'buy', seller: nurseryUuid, contents: lines.map(l=>({ gender:l.gender, color:l.color, count:l.count, price:l.price })) } };
}

export function buildSellOffer({nurseryUuid, lines}){
  // lines: [{gender,color,count,price, detail?}]
  // Note: selling конкретных котов требует detail.cat_id на сервере; тут даём базовую структуру
  return { msg_type:'trading_request', data:{ request_type:'sell', buyer: nurseryUuid, contents: lines.map(l=>({ gender:l.gender, color:l.color, count:l.count, price:l.price })) } };
}
