// Adapt extension content_script STATE_RESPONSE to strategy-friendly shape

export function fromPanelState(state){
  if(!state) return null;
  const { season, balance, gameCosts, timers, showcase, cityQuota, nurseries, shops, credits, me } = state;
  // defensive defaults to avoid null propagation
  const cityArr = Array.isArray(cityQuota) ? cityQuota : [];
  const showcaseArr = Array.isArray(showcase) ? showcase : [];
  const nurseriesArr = Array.isArray(nurseries) ? nurseries : [];
  const shopsArr = Array.isArray(shops) ? shops : [];
  const cityMap = new Map(cityArr.map(x=>[`${x.gender}_${x.color}`, x]));
  const showcaseMap = new Map(showcaseArr.map(x=>[`${x.gender}_${x.color}`, x]));
  const nurseriesIndex = nurseriesArr.map(n=>({
    uuid:n.uuid, name:n.name, relation:n.relation_to_me??null,
    price:new Map((n.default_prices||[]).map(p=>[`${p.gender}_${p.color}`, p]))
  }));
  const shopsIndex = shopsArr.map(sh=>({
    uuid:sh.uuid, name:sh.name, relation:sh.relation_to_me??null,
    price:new Map((sh.default_prices||[]).map(p=>[`${p.gender}_${p.color}`, p]))
  }));
  return {
    season, balance, gameCosts, timers,
    city: cityMap,
    showcase: showcaseMap,
    nurseries: nurseriesIndex,
    me,
    shops: shopsIndex,
    credits,
  };
}
