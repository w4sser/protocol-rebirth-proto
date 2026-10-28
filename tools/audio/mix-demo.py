#!/usr/bin/env python3
"""Assemble the 20 s local audition; duck the complete bed by -6dB under F1 VO."""
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[2]
AUDIO=ROOT/'assets/audio'
OUT=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/workspace/rostprov/mix-demo.ogg')
# Each overlay's start is on the 20-second demo timeline.
cues=[('sfx/shoot-carbine.ogg',2),('sfx/impact-wall.ogg',2.2),
      ('sfx/shoot-shotgun.ogg',3.5),('sfx/impact-enemy.ogg',3.7),
      ('sfx/pickup-rare.ogg',5),('sfx/alarm.ogg',7),('sfx/hunter-wave.ogg',8.5),
      ('sfx/shoot-smg.ogg',11),('sfx/impact-enemy.ogg',11.2),('sfx/extract-success.ogg',17)]
voice='bit/hunters-inbound.ogg';voice_at=9
voice_duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(AUDIO/voice)],text=True))
cmd=['ffmpeg','-v','error','-y','-i',str(AUDIO/'ambience/archipelago.ogg')]
for name,_ in cues:cmd+=['-i',str(AUDIO/name)]
cmd+=['-i',str(AUDIO/voice)]
filters=['[0:a]volume=0.65[bed]'];inputs=['[bed]']
for i,(_,at) in enumerate(cues,1):
    filters.append(f'[{i}:a]volume=0.4,adelay={int(at*1000)}:all=1[c{i}]');inputs.append(f'[c{i}]')
filters.append(''.join(inputs)+f'amix=inputs={len(inputs)}:normalize=0,volume=0.5011872336272722:enable=\'between(t,{voice_at},{voice_at+voice_duration})\'[ducked]')
filters.append(f'[{len(cues)+1}:a]volume=0.95,adelay={voice_at*1000}:all=1[vo]')
filters.append('[ducked][vo]amix=inputs=2:normalize=0,alimiter=limit=0.95:level=false,apad,atrim=duration=20[out]')
OUT.parent.mkdir(parents=True,exist_ok=True)
subprocess.run(cmd+['-filter_complex',';'.join(filters),'-map','[out]','-ac','1','-c:a','libvorbis','-q:a','4',str(OUT)],check=True)
print(OUT)
