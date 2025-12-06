// Autotrade orchestrator: apply showcase prices and place trading requests for planned purchases

export function buildChangePresetPriceMessages({plan}){
  // returns array of { msg_type:'change_preset_price', data:{gender,color,buy_price,sell_price} }
  return (plan.showcase||[])
    .filter(r=> r.current==null || Number(r.current)!==Number(r.targetPrice))
    .map(r=>({
      msg_type: 'change_preset_price',
      data: { gender: r.gender, color: r.color, buy_price: undefined, sell_price: r.targetPrice }
    }));
}

export function buildTradingRequestMessages({plan}){
  const res = [];
  if(!plan.bestDeal) return res;
  // Form a simple TRADING_REQUEST payload: lot for BUY from target nursery with selected contents and prices
  const lot = {
    request_type: 'buy',
    seller: plan.bestDeal.nursery.uuid,
    buyer: undefined, // server will set as me
    contents: plan.bestDeal.lines.map(l=>({ gender:l.gender, color:l.color, count:l.qty, price:l.buyPrice })),
  };
  res.push({ msg_type: 'trading_request', data: lot });
  return res;
}

export function buildChangeBuyPriceMessages({plan}){
  const res = [];
  (plan.buyPrices||[]).forEach(b=>{
    if(b.currentBuy==null || Number(b.currentBuy)!==Number(b.targetBuyPrice)){
      res.push({ msg_type:'change_preset_price', data:{ gender:b.gender, color:b.color, buy_price:b.targetBuyPrice, sell_price: undefined } });
    }
  });
  return res;
}

export function buildAutotradeMessages({plan}){
  const sellPrices = buildChangePresetPriceMessages({plan});
  const buyPrices = buildChangeBuyPriceMessages({plan});
  const deals = buildTradingRequestMessages({plan});
  return [...sellPrices, ...buyPrices, ...deals];
}
