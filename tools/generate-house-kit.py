#!/usr/bin/env python3
"""Build the small, texture-free Abandoned Town house kit as compact glTF 2.0 binary files."""
import json, math, os, struct, sys
OUT=(sys.argv[1] if len(sys.argv)>1 else os.path.abspath(os.path.join(os.path.dirname(__file__),'..','assets','env','town','house_interior')))
os.makedirs(OUT,exist_ok=True)
# restrained, warm survival-game palette; one draw call per color/material per GLB
C={
 'plaster':'#82745f','plaster_light':'#a08e71','plaster_shadow':'#514b40',
 'wood':'#57402d','wood_light':'#886644','wood_dark':'#33271f',
 'floor':'#75563a','floor_light':'#94704a','metal':'#536267','metal_dark':'#303b3d',
 'glass':'#385a59','glass_glow':'#d19554','fabric':'#59736c','fabric_light':'#81958a',
 'rust':'#95533b','paper':'#c3aa78','loot':'#d49b43','ceramic':'#aaa18b',
 'accent':'#b94f38','dark':'#252b2b'}
def hx(s): return tuple(int(s[i:i+2],16)/255 for i in (1,3,5))
# geometry is authored around the expected origin and dimensions, Y up
class Model:
 def __init__(self): self.faces={}
 def box(self,mat,cx,cy,cz,sx,sy,sz):
  x0,x1=cx-sx/2,cx+sx/2; y0,y1=cy-sy/2,cy+sy/2; z0,z1=cz-sz/2,cz+sz/2
  # outward normals, two triangles each
  f=[((0,0,-1),[(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0)]),((0,0,1),[(x1,y0,z1),(x0,y0,z1),(x0,y1,z1),(x1,y1,z1)]),((-1,0,0),[(x0,y0,z1),(x0,y0,z0),(x0,y1,z0),(x0,y1,z1)]),((1,0,0),[(x1,y0,z0),(x1,y0,z1),(x1,y1,z1),(x1,y1,z0)]),((0,1,0),[(x0,y1,z0),(x1,y1,z0),(x1,y1,z1),(x0,y1,z1)]),((0,-1,0),[(x0,y0,z1),(x1,y0,z1),(x1,y0,z0),(x0,y0,z0)])]
  a=self.faces.setdefault(mat,[])
  for n,v in f:
   start=len(a)
   for p in v:a.append((p,n))
   # indexed triangle list generated below; each face has 4 separate vertices
   self.faces[mat][-4:]=self.faces[mat][-4:]
   self.tris=getattr(self,'tris',{});self.tris.setdefault(mat,[]).extend([start,start+2,start+1,start,start+3,start+2])
def make_glb(name,m):
 mats=[]; meshes=[]; nodes=[]; chunks=[]; offset=0
 def add(data,align=4):
  nonlocal offset
  pad=(-offset)%align
  if pad:chunks.append(b'\0'*pad);offset+=pad
  start=offset;chunks.append(data);offset+=len(data);return start,len(data)
 access=[]; views=[]
 def view(data,target):
  start,n=add(data);views.append({'buffer':0,'byteOffset':start,'byteLength':n,'target':target});return len(views)-1
 for ix,(mat,verts) in enumerate(m.faces.items()):
  col=hx(C[mat]); mats.append({'name':mat,'pbrMetallicRoughness':{'baseColorFactor':[col[0],col[1],col[2],1],'metallicFactor':.05 if 'metal' in mat else 0,'roughnessFactor':.92}})
  pos=[];norm=[]
  for p,n in verts:pos.extend(p);norm.extend(n)
  pv=view(struct.pack('<%sf'%len(pos),*pos),34962);nv=view(struct.pack('<%sf'%len(norm),*norm),34962)
  indices=m.tris[mat];iv=view(struct.pack('<%sH'%len(indices),*indices),34963)
  xs=pos[0::3];ys=pos[1::3];zs=pos[2::3]
  pa=len(access);access.append({'bufferView':pv,'componentType':5126,'count':len(verts),'type':'VEC3','min':[min(xs),min(ys),min(zs)],'max':[max(xs),max(ys),max(zs)]})
  na=len(access);access.append({'bufferView':nv,'componentType':5126,'count':len(verts),'type':'VEC3'})
  ia=len(access);access.append({'bufferView':iv,'componentType':5123,'count':len(indices),'type':'SCALAR'})
  meshes.append({'name':f'{name}_{mat}','primitives':[{'attributes':{'POSITION':pa,'NORMAL':na},'indices':ia,'material':ix,'mode':4}]})
  nodes.append({'mesh':ix,'name':mat})
 blob=b''.join(chunks);doc={'asset':{'version':'2.0','generator':'Protocol Rebirth compact house kit'},'scene':0,'scenes':[{'nodes':list(range(len(nodes)))}],'nodes':nodes,'meshes':meshes,'materials':mats,'buffers':[{'byteLength':len(blob)}],'bufferViews':views,'accessors':access}
 js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);blob+=b'\0'*((-len(blob))%4);total=12+8+len(js)+8+len(blob)
 data=struct.pack('<4sII',b'glTF',2,total)+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(blob),b'BIN\0')+blob
 open(os.path.join(OUT,name+'.glb'),'wb').write(data)
def B(m,x,y,z,w,h,d):m.box(m,x,y,z,w,h,d)
def build(kind):
 m=Model()
 if kind=='floor_4m':
  m.box('wood_dark',0,.04,0,4.3,.12,4.3)
  for i in range(8):
   x=-1.82+i*.52;m.box('floor',x,.115,0,.49,.03,4.12)
   # varied boards and subtle end grain joints
   for z in (-1.45,.55):m.box('floor_light' if i%3 else 'wood_light',x,.133,z,.47,.012,.018)
  m.box('wood_dark',0,.14,-2.1,4.3,.08,.12);m.box('wood_dark',0,.14,2.1,4.3,.08,.12)
 elif kind.startswith('wall_'):
  # split wall segments leave clean gameplay openings with sturdy dark timber framing
  if kind=='wall_doorway_4m':
   m.box('plaster',-1.29,1.31,0,1.42,2.58,.16);m.box('plaster',1.29,1.31,0,1.42,2.58,.16);m.box('plaster',0,2.36,0,1.16,.5,.16)
   for x in (-1.96,-.62,.62,1.96):m.box('wood_dark',x,1.3,0,.12,2.6,.21)
   m.box('wood_light',0,2.57,0,1.34,.12,.23)
  elif kind=='wall_window_4m':
   # opening 1.2 wide x 1.0 high, sill=.95 m
   m.box('plaster',0,.475,0,4,.95,.16);m.box('plaster',0,2.275,0,4,.65,.16);m.box('plaster',-1.4,1.45,0,1.2,1.1,.16);m.box('plaster',1.4,1.45,0,1.2,1.1,.16)
   m.box('glass',0,1.45,-.005,1.12,.94,.06)
   for x in (-.65,.65):m.box('wood_dark',x,1.45,0,.1,1.16,.22)
   for y in (.91,1.99):m.box('wood_light',0,y,0,1.4,.12,.22)
   m.box('wood_dark',0,1.45,0,.08,.94,.22)
  else:m.box('plaster',0,1.3,0,4,2.6,.16)
  # continuous baseboard and crown moulding
  for y,ma,h in ((.12,'wood_dark',.22),(2.49,'wood_dark',.18),(2.59,'wood_light',.07)):
   if kind=='wall_doorway_4m' and y==.12:
    m.box(ma,-1.29,y,0,1.42,h,.22);m.box(ma,1.29,y,0,1.42,h,.22)
   else:m.box(ma,0,y,0,4.05,h,.22)
  # four warm exposed studs give the plain module a readable, crafted silhouette
  for x in (-1.94,-.65,.65,1.94):m.box('wood_dark',x,1.3,0,.105,2.6,.205)
 elif kind=='roof_removable_4m':
  m.box('wood_dark',0,.07,0,4.5,.14,4.5)
  # overlapping muted slate strips make the top recognizable without texture maps
  for z in (-1.75,-1.1,-.45,.2,.85,1.5):m.box('metal_dark',0,.17,z,4.42,.12,.58)
  for x in (-2.18,2.18):m.box('wood_light',x,.21,0,.16,.22,4.48)
  for z in (-2.18,2.18):m.box('wood_light',0,.21,z,4.48,.22,.16)
 elif kind.startswith('door_'):
  if kind=='door_open':
   # model remains leaf in rotated footprint for existing game side pose
   m.box('wood_dark',0,1.04,0,.07,2.08,.94);m.box('wood_light',0,1.05,-.25,.08,1.88,.4);m.box('wood',0,1.05,.22,.08,1.88,.42)
   for y in (.18,.58,1.2,1.84):m.box('wood_dark',0,y,0,.09,.06,.92)
  else:
   m.box('wood_dark',0,1.04,0,.94,2.08,.07);m.box('wood_light',0,1.05,-.005,.78,1.86,.045)
   for x in (-.28,.28):m.box('wood',x,1.05,-.03,.05,1.76,.05)
   for y in (.18,.58,1.45,1.84):m.box('wood_dark',0,y,-.04,.82,.06,.05)
   m.box('metal',.33,1.02,-.07,.06,.13,.05);m.box('loot',.33,1.02,-.105,.04,.04,.025)
 elif kind=='table_small':
  m.box('wood_dark',0,.77,0,1.35,.12,.85);m.box('wood_light',0,.85,0,1.42,.09,.9)
  for x in (-.55,.55):
   for z in (-.3,.3):m.box('wood',x,.4,z,.1,.72,.1)
  m.box('wood_dark',0,.38,0,1.14,.1,.62)
 elif kind=='chair_wood':
  m.box('wood_light',0,.48,.02,.55,.13,.55)
  for x in (-.21,.21):
   for z in (-.2,.2):m.box('wood',x,.24,z,.07,.48,.07)
  m.box('wood_dark',0,1.03,.23,.48,1.02,.08);m.box('wood_light',0,.8,.23,.42,.08,.07)
 elif kind=='bed_single':
  m.box('wood_dark',0,.24,0,1.2,.38,2);m.box('wood_light',0,.48,0,1.17,.2,1.96);m.box('fabric',0,.64,.15,1.16,.2,1.45);m.box('fabric_light',0,.76,-.65,.8,.16,.48);m.box('rust',0,.79,.25,.45,.035,.25)
  for x in (-.51,.51):
   for z in (-.85,.85):m.box('wood',x,.12,z,.09,.24,.09)
 elif kind=='sofa_two_seat':
  m.box('wood_dark',0,.34,0,2,.42,.9);m.box('fabric',0,.62,.05,1.75,.32,.72);m.box('fabric_light',0,1.0,.34,1.78,.75,.22);m.box('wood_dark',0,.66,-.37,2,.58,.16)
  for x in (-.91,.91):m.box('fabric',x,.75,0,.18,.62,.9)
 elif kind=='kitchen_counter':
  m.box('wood_dark',0,.49,0,1.5,.9,.68);m.box('ceramic',0,.99,0,1.58,.12,.76)
  for x in (-.48,0,.48):m.box('wood_light',x,.57,-.35,.42,.28,.04)
  m.box('metal',.48,.56,-.39,.15,.035,.025)
 elif kind=='fridge':
  m.box('metal_dark',0,.92,0,.82,1.84,.8);m.box('ceramic',0,.93,-.025,.74,1.72,.75);m.box('metal',.28,.94,-.42,.04,.42,.035);m.box('glass_glow',-.22,1.62,-.414,.22,.07,.02)
 elif kind=='wardrobe':
  m.box('wood_dark',0,.84,0,1.05,1.68,.52);m.box('wood_light',0,.86,-.025,.96,1.54,.48);m.box('wood',0,.86,-.06,.04,1.46,.05)
  for x in (-.18,.18):m.box('loot',x,.86,-.1,.035,.09,.035)
 elif kind=='bookshelf':
  m.box('wood_dark',0,.72,0,1,1.44,.48)
  for y in (.14,.5,.86,1.22,1.39):m.box('wood_light',0,y,-.03,.96,.07,.5)
  for j,y in enumerate((.31,.67,1.03)):
   for i in range(5):m.box(('rust','fabric','paper','loot')[((i+j)%4)],-.38+i*.19,y,-.08,.13,.27+(.04 if i%2 else 0),.34)
 elif kind=='loot_crate':
  m.box('wood_dark',0,.35,0,.75,.7,.58);m.box('wood_light',0,.36,-.3,.72,.58,.055)
  for x in (-.27,0,.27):m.box('wood',x,.36,-.34,.035,.5,.025)
  for y in (.08,.64):m.box('metal_dark',0,y,-.34,.76,.07,.04)
  m.box('loot',0,.38,-.38,.19,.15,.04)
 elif kind=='medicine_cabinet':
  m.box('metal_dark',0,.38,0,.52,.76,.4);m.box('ceramic',0,.38,-.025,.45,.68,.36);m.box('metal',0,.38,-.22,.03,.6,.03);m.box('accent',-.08,.39,-.24,.07,.28,.025);m.box('accent',-.08,.39,-.24,.24,.07,.025)
 else: # safe fallback to a named simple form
  m.box('wood',0,.5,0,.7,1,.7)
 return m
FILES=['floor_4m','wall_plain_4m','wall_doorway_4m','wall_window_4m','door_closed','door_open','roof_removable_4m','table_small','chair_wood','sofa_two_seat','bed_single','kitchen_counter','fridge','wardrobe','bookshelf','loot_crate','medicine_cabinet']
for f in FILES: make_glb(f,build(f))
print(f'Generated {len(FILES)} compact GLBs in {OUT}')
