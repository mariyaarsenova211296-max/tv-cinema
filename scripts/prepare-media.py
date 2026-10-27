#!/usr/bin/env python3
"""Optional regeneration from original uploads; no external services or filters.
Requires ffmpeg/ffprobe with libx264. Normal development uses committed assets.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
for n in range(1, 5):
    parser.add_argument(f'--video{n}', required=True, type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
out = root/'public'/'media'
out.mkdir(parents=True, exist_ok=True)
manifest = []
for n in range(1, 5):
    source = getattr(args, f'video{n}')
    metadata = json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_format','-show_streams','-of','json',str(source)]))
    stream = next(s for s in metadata['streams'] if s['codec_type']=='video')
    duration = float(metadata['format']['duration'])
    target = out/f'video-{n}.mp4'
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-an','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-g','12','-keyint_min','12','-sc_threshold','0','-movflags','+faststart',str(target)],check=True)
    for name, seek in [('start',0),('end',max(0,duration-.08))]:
        subprocess.run(['ffmpeg','-v','error','-y','-ss',str(seek),'-i',str(target),'-frames:v','1','-q:v','2',str(out/f'video-{n}-{name}.jpg')],check=True)
    manifest.append({'video':n,'original_filename':source.name,'original_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'duration':duration,'original_codec':stream['codec_name'],'width':stream['width'],'height':stream['height'],'fps':stream['r_frame_rate'],'output_sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
