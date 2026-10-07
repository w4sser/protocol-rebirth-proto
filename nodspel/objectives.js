export function routeComplete(level,choice){
  const targets=choice.kind==='loot'?level.lootBoxes.filter(box=>box.marked):level.nodes;
  return targets.length>0&&targets.every(target=>choice.kind==='loot'?target.collected:target.active);
}
