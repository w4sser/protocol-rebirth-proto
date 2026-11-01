import '../data/raid-operator.js?v=2.22.2';

const art=globalThis.DATA.raidOperator;
const clips=art.clips;
const rig={spine:'Abdomen',head:'Head',chest:'Chest',forearm:'LowerArmR',leftArm:['UpperArmL','LowerArmL'],leftHand:'WristL',rightArm:['UpperArmR','LowerArmR']};
// Socket transforms use character-world units; +Z is the barrel and +Y its top.
const weapon={bone:'WristR',offset:[0,0,0],rotation:[-Math.PI/2,0,Math.PI/2],muzzle:'muzzle'};
const rim={color:'#75cfcc',strength:.45,power:2.4};
export const DEFAULT_CHARACTER='operator';
export const CHARACTERS=Object.freeze({
  operator:Object.freeze({id:'operator',model:'./assets/coast-operator.glb?v=2.22.2',scale:1.4,height:art.height,rig,clips,weapon,rim,accessories:true}),
  punk:Object.freeze({id:'punk',model:art.asset,scale:1,height:art.height,rig,clips,weapon,rim:{...rim,strength:.7},accessories:false}),
  robot:Object.freeze({id:'robot',model:null,procedural:true,scale:1,height:1.125,rig:{spine:null,head:null,chest:null},clips:{idle:null,run:null,shoot:null,dash:null,hit:null,death:null},weapon:{bone:'robotGun',offset:[0,0,.335],rotation:[0,0,0],muzzle:'muzzle'},rim:{...rim,strength:0},accessories:false}),
});
export function characterFor(search=''){
  const id=new URLSearchParams(search).get('skin');
  const key=id==='human'?'punk':id;
  return Object.hasOwn(CHARACTERS,key)?CHARACTERS[key]:CHARACTERS[DEFAULT_CHARACTER];
}
// World Y for the overhead health/shield pips: just above the scaled head, never below the legacy 1.65.
export const OVERHEAD_GAP=.2;
export function overheadAnchorY(c){return Math.max(1.65,(c?.height??1.65)*(c?.scale??1)+OVERHEAD_GAP);}
