# BIT face, LOCKED asset (AD ad06 p23, proportion master v2.0). Pure geometry, never redrawn by hand:
# master box 1000x875 U; eyes 78x170 centred at y 364, 486 U centre-to-centre; smile = filled shape on a
# circular centreline (R 220.29, endpoints x 306.5/693.5, arc depth 115) with width 32+32*sin(pi*t).
# Endpoint y (528 U) traced from the p23 render (master geometry panel).
import math
R=220.29; X0,X1=306.5,693.5; DEPTH=115; YEND=528
CX=500; CY=YEND+DEPTH-R
def face_paths(s=1.0,ox=0.0,oy=0.0,n=40):
    P=lambda x,y:f"{ox+x*s:.3f} {oy+y*s:.3f}"
    a0=math.atan2(YEND-CY,X0-CX); a1=math.atan2(YEND-CY,X1-CX)  # left end -> right end, through bottom
    if a1>a0: a1-=2*math.pi
    # sweep from a0 (left, ~150deg) down through 90deg (bottom) to a1 (right, ~30deg)
    a0,a1=(a0,a1) if a0>a1 else (a1,a0)
    outer=[];inner=[]
    for i in range(n+1):
        t=i/n; a=a0+(a1-a0)*t; w=32+32*math.sin(math.pi*t)
        outer.append(P(CX+(R+w/2)*math.cos(a),CY+(R+w/2)*math.sin(a)))
        inner.append(P(CX+(R-w/2)*math.cos(a),CY+(R-w/2)*math.sin(a)))
    r=16*s
    smile="M"+outer[0]+" L"+" L".join(outer[1:])+f" A{r:.3f} {r:.3f} 0 0 1 "+inner[-1]+" L"+" L".join(reversed(inner[:-1]))+f" A{r:.3f} {r:.3f} 0 0 1 "+outer[0]+"Z"
    eyes=[(257,364),(743,364)]
    return smile,[(ox+x*s,oy+y*s,39*s,85*s) for x,y in eyes]
def face_svg_elems(s,ox,oy,fill):
    sm,eyes=face_paths(s,ox,oy)
    return ''.join(f'<ellipse cx="{x:.3f}" cy="{y:.3f}" rx="{rx:.3f}" ry="{ry:.3f}" fill="{fill}" stroke="none"/>' for x,y,rx,ry in eyes)+f'<path d="{sm}" fill="{fill}" stroke="none"/>'
if __name__=="__main__":
    open('assets/bit-face-master.svg','w').write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 875" width="1000" height="875" role="img" aria-label="B.I.T. face (locked master v2.0, AD ad06 p23)">'+face_svg_elems(1,0,0,"#75CFCC")+'</svg>\n')
    print("ok")
