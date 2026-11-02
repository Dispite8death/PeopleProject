"""Crop real browser captures using the recorded viewport coordinates.

No resizing, overlays or content replacement. Native captures stay in sources/.
Usage: python presentation/crop_screenshots.py <capture-directory>
"""
import json
import sys
from pathlib import Path
from PIL import Image

folder = Path(sys.argv[1]).resolve()
manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
for shot in manifest['shots']:
    source = folder / shot['source']
    with Image.open(source) as image:
        viewport = shot['viewport']
        sx, sy = image.width / viewport['width'], image.height / viewport['height']
        rect = shot['clip']
        box = (round(rect['x'] * sx), round(rect['y'] * sy),
               round((rect['x'] + rect['width']) * sx),
               round((rect['y'] + rect['height']) * sy))
        if not (0 <= box[0] < box[2] <= image.width and 0 <= box[1] < box[3] <= image.height):
            raise ValueError(f'Crop out of image bounds: {shot["file"]} {box}')
        cropped = image.crop(box)
        output = folder / shot['file']
        output.parent.mkdir(parents=True, exist_ok=True)
        cropped.save(output, format='PNG')
        shot['sourcePixels'] = [image.width, image.height]
        shot['outputPixels'] = list(cropped.size)
        print(f'{shot["file"]}: {cropped.width} x {cropped.height}')
(folder / 'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
