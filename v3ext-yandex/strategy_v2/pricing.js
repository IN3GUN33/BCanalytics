import { priceBand, minimalMargin } from './rules.js';

const TAU = 2; // анти‑субсидирование питомника: барьер по близости к городским ценам

export function recommendShowcasePrices({state}){
  const recos = [];
  for(const [key, city] of state.city.entries()){
    const current = state.showcase.get(key) || { price: null };
    const { minPrice, maxPrice } = priceBand({ cityBuyPrice: city.buy_price||0, gameCosts: state.gameCosts, relation: null });
    // Базовая цель — верхняя часть бэнда с гвардом к городу
    let target = Math.round(minPrice + 0.7*(maxPrice-minPrice));

    // Конкурентный анализ: собрать лучший прайс конкурента (sell)
    const competitorPrices = [];
    for(const sh of (state.shops||[])){
      if(sh.uuid===state.me) continue; // пропускаем себя
      const p = sh.price?.get(key);
      const sp = p?.sell_price;
      if(typeof sp==='number' && isFinite(sp) && sp>0){ competitorPrices.push(sp); }
    }
    let competitorBest = null;
    if(competitorPrices.length){
      competitorBest = Math.min(...competitorPrices);
    }

    // Пол цены по себестоимости: минимально возможная закупка (город sell_price или питомник)
    // Маржа: если есть конкуренты — допускаем минимальную маржу = 1, чтобы войти в поток спроса;
    // иначе используем более консервативную (minimalMargin-1, но ≥1)
    const mmBase = minimalMargin({gameCosts: state.gameCosts});
    const mmAgg = (competitorBest!=null) ? 1 : Math.max(1, mmBase - 1);
    let nurseryBest = null;
    for(const n of (state.nurseries||[])){
      const p = n.price?.get(key);
      if(p && p.sell_price!=null){ nurseryBest = (nurseryBest==null)? p.sell_price : Math.min(nurseryBest, p.sell_price); }
    }
    const possibleCosts = [];
    if(typeof city.sell_price==='number' && isFinite(city.sell_price) && city.sell_price>0) possibleCosts.push(city.sell_price);
    if(typeof nurseryBest==='number' && isFinite(nurseryBest) && nurseryBest>0) possibleCosts.push(nurseryBest);
    const minCost = possibleCosts.length ? Math.min(...possibleCosts) : null;
    const costFloor = (minCost!=null) ? (minCost + mmAgg) : minPrice;

    // Минимальный уровень для таргета: если есть конкуренты — ориентируемся на пол по себестоимости (агрессивный), иначе на стандартный бэнд
    const bandMin = (competitorBest!=null) ? costFloor : minPrice;

    // Стратегия: если можем — на 1 ниже конкурента; если нельзя (слишком низко) — ставим равного конкурента, но не ниже пола; иначе — bandMin
    if(competitorBest!=null){
      const under = competitorBest - 1;
      if(under >= bandMin){
        target = under;
      }else{
        target = Math.max(bandMin, Math.min(competitorBest, maxPrice));
      }
    }else{
      target = bandMin;
      // fallback guard: если конкурент неизвестен, но есть городская цена покупки, не опускаемся ниже (city.buy_price - 1)
      if(typeof city.buy_price==='number' && isFinite(city.buy_price) && city.buy_price>0){
        const cityGuard = city.buy_price - 1;
        if(target < cityGuard){ target = Math.max(bandMin, Math.min(cityGuard, maxPrice)); }
      }
    }
    if(target > maxPrice) target = maxPrice;
    // guard: не ниже города с учётом overhead
    const uo = Math.ceil(((state.gameCosts?.household||3)/50)) + (state.gameCosts?.food||1);
    const cityGuard2 = (typeof city.sell_price==='number' && isFinite(city.sell_price)) ? (city.sell_price + uo + 1) : null;
    if(cityGuard2!=null && target < cityGuard2){ target = cityGuard2; }

    recos.push({ key, gender:city.gender, color:city.color, targetPrice: target, band:[bandMin,maxPrice], current: current.price, kind:'sell', competitorBest });

  }
  return recos;
}

export function recommendBuyPrices({state, sellRecos}){
  const recos = [];
  const self = (state.shops||[]).find(sh=> sh.uuid===state.me);
  const MIN_PROFIT_BUY = 1; // условие: прибыль хотя бы 1 монета по одному из каналов
  for(const [key, city] of state.city.entries()){
    const sellReco = (sellRecos||[]).find(r=> r.key===key);
    const targetSell = sellReco?.targetPrice ?? (state.showcase.get(key)?.price ?? null);
    // границы прибыли: хотим, чтобы хотя бы ГОРОД давал прибыль ≥1 (безопасный fallback)
    const capByCity = (typeof city.buy_price==='number' && isFinite(city.buy_price)) ? (city.buy_price - MIN_PROFIT_BUY) : -Infinity;
    // и дополнительно витрина (если есть целевая цена)
    const capByOurSell = (typeof targetSell==='number' && isFinite(targetSell)) ? (targetSell - MIN_PROFIT_BUY) : -Infinity;
    const profitCapAny = Math.floor(Math.max(capByCity, capByOurSell));

    // Конкурентный анализ по buy: хотим быть на 1 монету выше лучшего покупателя
    const competitorBuys = [];
    for(const sh of (state.shops||[])){
      if(sh.uuid===state.me) continue;
      const p = sh.price?.get(key);
      const bp = p?.buy_price;
      if(typeof bp==='number' && isFinite(bp) && bp>=0) competitorBuys.push(bp);
    }
    const competitorBestBuy = competitorBuys.length? Math.max(...competitorBuys) : null;

    if(!isFinite(profitCapAny)) continue; // нет смысла рекомендовать без верхней границы

    let targetBuy = profitCapAny;
    const candidate = (competitorBestBuy!=null) ? (competitorBestBuy + 1) : null;
    if(candidate!=null && candidate <= capByCity){
      targetBuy = candidate;
    }else{
      if(isFinite(capByCity)) targetBuy = Math.min(targetBuy, capByCity);
    }

    // Анти‑субсидирование питомника: не поднимать buy выше городского порога
    const citySell = (typeof city.sell_price==='number' && isFinite(city.sell_price)) ? city.sell_price : null;
    if(citySell!=null){
      const cityBarrier = citySell - TAU; // если мы платим почти как город продаёт — мы кормим питомник
      if(isFinite(cityBarrier)) targetBuy = Math.min(targetBuy, cityBarrier);
    }

    if(targetBuy<0) targetBuy=0;

    const currentBuy = self?.price?.get(key)?.buy_price ?? null;
    recos.push({ key, gender:city.gender, color:city.color, targetBuyPrice: targetBuy, currentBuy, competitorBestBuy, cityBuy: city.buy_price??null });
  }
  return recos;
}

function demandNudgePct(gender, color){
  const colorAdj = { white: 2, black: 1.5, gray: 0, ginger: -1 }[color] ?? 0;
  const genderAdj = { female: 1, male: 0 }[gender] ?? 0;
  return colorAdj + genderAdj; // modest tweak within band
}
