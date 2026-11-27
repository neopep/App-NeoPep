"""Offline candidate validator. Run in a locked-down process, not the MCP worker.
This is a conservative format policy, not a guarantee against malware.
"""
import hashlib
import io
import json
import math
import os
import re
import subprocess
import sys
import warnings

POLICY = 'neopep-media-validation-v1'
LIMITS = {'image/jpeg': 1048576, 'application/pdf': 5242880, 'video/mp4': 5242880}

class Rejected(ValueError):
    pass

def require(condition):
    if not condition:
        raise Rejected('invalid or unsupported media')

def jpeg(data):
    from PIL import Image, ImageFile
    Image.MAX_IMAGE_PIXELS = 16_000_000
    ImageFile.LOAD_TRUNCATED_IMAGES = False
    require(data[:2] == b'\xff\xd8' and data[-2:] == b'\xff\xd9')
    # Scan marker grammar. Only JFIF and Adobe metadata accepted; no comments,
    # EXIF, embedded thumbnails, or bytes following the first real EOI.
    pos, entropy, frames, scans = 2, False, 0, 0
    while pos < len(data):
        if entropy:
            marker = data.find(b'\xff', pos)
            require(marker >= 0)
            pos = marker
        require(data[pos] == 255)
        while pos < len(data) and data[pos] == 255:
            pos += 1
        require(pos < len(data))
        m = data[pos]; pos += 1
        if entropy and (m == 0 or 0xD0 <= m <= 0xD7):
            continue
        entropy = False
        if m == 0xD9:
            require(pos == len(data) and frames == 1 and scans >= 1)
            break
        require(m in {0xC0, 0xC2, 0xC4, 0xDB, 0xDD, 0xDA, 0xE0, 0xEE})
        require(pos + 2 <= len(data))
        length = int.from_bytes(data[pos:pos + 2], 'big')
        require(length >= 2 and pos + length <= len(data))
        payload = data[pos + 2:pos + length]
        if m in {0xC0, 0xC2}:
            frames += 1
            require(frames == 1 and len(payload) >= 6 and payload[0] == 8)
            height = int.from_bytes(payload[1:3], 'big'); width = int.from_bytes(payload[3:5], 'big')
            require(0 < width <= 4096 and 0 < height <= 4096 and width * height <= 16_000_000 and payload[5] in (1, 3))
        if m == 0xE0:
            require(len(payload) == 14 and payload[:5] == b'JFIF\0' and payload[-2:] == b'\0\0')
        if m == 0xEE:
            require(len(payload) == 12 and payload[:5] == b'Adobe')
        if m == 0xDA:
            scans += 1; require(frames == 1 and scans <= 64); entropy = True
        pos += length
    else:
        raise Rejected('missing end marker')
    with warnings.catch_warnings():
        warnings.simplefilter('error')
        with Image.open(io.BytesIO(data), formats=['JPEG']) as image:
            image.verify()
        with Image.open(io.BytesIO(data), formats=['JPEG']) as image:
            image.load()
            require(image.mode in ('L', 'RGB') and image.width * image.height <= 16_000_000)

DENY_KEYS = {'/AA','/OpenAction','/JavaScript','/JS','/Launch','/EmbeddedFiles','/EF','/AF','/RichMedia','/XFA','/AcroForm','/URI','/SubmitForm','/ImportData','/Movie','/Sound','/3D','/Rendition','/GoToR','/GoToE','/F','/FFilter','/FDecodeParms','/Annots','/Collection','/Names','/Encrypt'}
DENY_NAMES = {'/JavaScript','/Launch','/Action','/Filespec','/EmbeddedFile','/RichMedia','/XFA','/GoToR','/GoToE','/URI','/SubmitForm','/ImportData','/Movie','/Sound','/3D','/Rendition','/JBIG2Decode','/JPXDecode','/Crypt'}

def pdf(data):
    from pypdf import PdfReader
    from pypdf.generic import ArrayObject, DictionaryObject, IndirectObject, NameObject, StreamObject
    require(re.match(rb'%PDF-[12]\.\d(?:\r\n|\r|\n)', data) and re.search(rb'%%EOF[\r\n\t ]*\Z', data))
    reader = PdfReader(io.BytesIO(data), strict=True)
    require(not reader.is_encrypted and 1 <= len(reader.pages) <= 100)
    ids = {(obj, gen) for gen, entries in reader.xref.items() for obj, offset in entries.items() if obj and offset > 0}
    ids.update((obj, 0) for obj in reader.xref_objStm)
    require(len(ids) <= 4000)
    seen, nodes, decoded = set(), 0, 0
    def walk(value, depth=0):
        nonlocal nodes, decoded
        nodes += 1; require(nodes <= 100_000 and depth <= 64)
        if isinstance(value, IndirectObject):
            key = (value.idnum, value.generation)
            if key in seen: return
            require(key in ids); seen.add(key)
            walk(value.get_object(), depth + 1); return
        if isinstance(value, NameObject): require(str(value) not in DENY_NAMES)
        if isinstance(value, DictionaryObject):
            require(not (set(map(str, value.keys())) & DENY_KEYS))
            for val in value.values(): walk(val, depth + 1)
            if isinstance(value, StreamObject):
                raw = value.get_data(); decoded += len(raw)
                require(len(raw) <= 16_000_000 and decoded <= 64_000_000)
        elif isinstance(value, ArrayObject):
            for val in value: walk(val, depth + 1)
    walk(reader.trailer)
    for obj, gen in sorted(ids): walk(IndirectObject(obj, gen, reader))
    for page in reader.pages:
        box = page.mediabox
        require(0 < float(box.width) <= 14400 and 0 < float(box.height) <= 14400)
        contents = page.get_contents()
        if contents is not None:
            require(len(contents.operations) <= 50_000)

def command(args, data, seconds):
    result = subprocess.run(args, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=seconds, check=False, env={'PATH':'/usr/bin:/bin','LANG':'C'})
    require(result.returncode == 0 and len(result.stdout) <= 131072 and not result.stderr.strip())
    return result.stdout

def mp4(data):
    # Accept only conventional nonfragmented MP4 with no unknown top-level boxes.
    offset, boxes = 0, []
    while offset < len(data):
        require(offset + 8 <= len(data) and len(boxes) <= 128)
        size = int.from_bytes(data[offset:offset+4], 'big'); kind = data[offset+4:offset+8]
        require(size >= 8 and offset+size <= len(data) and kind in {b'ftyp', b'moov', b'mdat', b'free', b'skip', b'wide'})
        if kind in {b'free', b'skip', b'wide'}: require(size <= 16 and not any(data[offset+8:offset+size]))
        boxes.append(kind); offset += size
    require(boxes and boxes[0] == b'ftyp' and boxes.count(b'ftyp') == boxes.count(b'moov') == boxes.count(b'mdat') == 1)
    require(boxes.index(b'moov') < boxes.index(b'mdat'))
    # Network and file protocols are disabled. Decode through stdin only.
    probe = json.loads(command(['ffprobe','-v','error','-max_alloc','67108864','-protocol_whitelist','pipe','-f','mov','-i','pipe:0','-show_streams','-show_format','-of','json'], data, 4))
    streams = probe.get('streams', []); require(1 <= len(streams) <= 2)
    require(sum(s.get('codec_type') == 'video' for s in streams) == 1)
    require(float(probe['format']['duration']) > 0 and float(probe['format']['duration']) <= 120)
    for s in streams:
        require(s.get('codec_type') in ('video','audio') and s.get('codec_name') in ('h264','aac'))
        if s['codec_type'] == 'video':
            require(s['codec_name']=='h264' and 0 < int(s['width']) <= 1920 and 0 < int(s['height']) <= 1920 and int(s['width'])*int(s['height']) <= 2073600)
            num, den = map(int,s['avg_frame_rate'].split('/')); require(den > 0 and 0 < num/den <= 60)
        else:
            require(s['codec_name']=='aac' and 0 < int(s['channels']) <= 2 and 0 < int(s['sample_rate']) <= 48000)
    command(['ffmpeg','-v','error','-xerror','-nostdin','-max_alloc','67108864','-threads','1','-filter_threads','1','-protocol_whitelist','pipe','-f','mov','-i','pipe:0','-map','0:v:0','-map','0:a:0?','-f','null','-'], data, 8)

def inspect(mime, data):
    require(mime in LIMITS and isinstance(data, bytes) and 0 < len(data) <= LIMITS[mime])
    {'image/jpeg':jpeg,'application/pdf':pdf,'video/mp4':mp4}[mime](data)
    return {'policy':POLICY,'mime':mime,'size':len(data),'sha256':hashlib.sha256(data).hexdigest(),'fullParse':True}

def main():
    # CLI candidate only. A trusted isolated service must enforce network/filesystem
    # isolation, request concurrency and scanner readiness before granting validity.
    import resource
    resource.setrlimit(resource.RLIMIT_AS, (768*1024*1024,768*1024*1024))
    resource.setrlimit(resource.RLIMIT_CPU, (12,12))
    resource.setrlimit(resource.RLIMIT_CORE, (0,0))
    mime = sys.argv[1] if len(sys.argv)==2 else ''
    if mime not in LIMITS: return 2
    data = sys.stdin.buffer.read(LIMITS[mime]+1)
    try:
        receipt = inspect(mime,data)
        # No live antivirus / isolated hosting configured. Never advertise this as
        # an approved upload or set contentSafety true from format parsing alone.
        print(json.dumps({**receipt,'valid':False,'contentSafety':False,'reason':'scanner_and_isolation_not_homologated'}))
        return 0
    except Exception:
        print(json.dumps({'policy':POLICY,'valid':False,'fullParse':False,'contentSafety':False}))
        return 1
if __name__ == '__main__':
    sys.exit(main())
