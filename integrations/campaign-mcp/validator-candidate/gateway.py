"""Candidate loopback-only gateway. Requires a reviewed rootless Docker image.
No public listener, no file retention, no credentials passed into the sandbox.
"""
import hashlib
import hmac
import http.server
import json
import os
import re
import subprocess
import threading
import uuid
from pathlib import Path

LIMITS={'image/jpeg':1048576,'application/pdf':5242880,'video/mp4':5242880}
POLICY='neopep-media-validation-v1'
def command(image, db, mime, name):
    if not re.fullmatch(r'sha256:[a-f0-9]{64}',image) or mime not in LIMITS:
        raise ValueError('invalid runtime configuration')
    if not Path(db).is_absolute() or ',' in db or not Path(db).is_dir():
        raise ValueError('invalid database directory')
    return ['docker','run','--rm','--pull=never','--name',name,'--network=none',
            '--read-only','--cap-drop=ALL','--security-opt=no-new-privileges',
            '--pids-limit=64','--memory=2g','--memory-swap=2g','--cpus=1',
            '--user=65532:65532','--log-driver=none',
            '--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=64m',
            '--mount','type=bind,src='+db+',dst=/var/lib/clamav,readonly',
            '-i',image,mime]

def run_isolated(image,db,mime,data):
    name='neo-media-'+uuid.uuid4().hex
    args=command(image,db,mime,name)
    try:
        result=subprocess.run(args,input=data,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=12,check=False)
        if result.returncode!=0 or len(result.stdout)>2048:
            return None
        receipt=json.loads(result.stdout)
        if (receipt.get('valid') is not True or receipt.get('fullParse') is not True or
            receipt.get('contentSafety') is not True or receipt.get('policy')!=POLICY or
            receipt.get('mime')!=mime or receipt.get('size')!=len(data) or
            receipt.get('sha256')!=hashlib.sha256(data).hexdigest()):
            return None
        return receipt
    except (OSError,ValueError,subprocess.TimeoutExpired):
        return None
    finally:
        try:
            subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=3,check=False)
        except (OSError,subprocess.TimeoutExpired):
            pass

def make_handler(secret,image,db,runner=run_isolated):
    if not re.fullmatch(r'[a-f0-9]{64}',secret):
        raise ValueError('missing private credential')
    lock=threading.BoundedSemaphore(1)
    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self,*args): pass
        def setup(self):
            super().setup();self.connection.settimeout(3)
        def reply(self,status,body):
            data=json.dumps(body,separators=(',',':')).encode()
            self.send_response(status);self.send_header('Content-Type','application/json')
            self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)))
            self.end_headers();self.wfile.write(data);self.close_connection=True
        def do_POST(self):
            if self.path!='/validate' or not hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+secret):
                return self.reply(403,{'valid':False})
            if self.headers.get('x-neo-validation-policy')!=POLICY or self.headers.get('Transfer-Encoding'):
                return self.reply(400,{'valid':False})
            mime=self.headers.get('Content-Type','')
            lengths=self.headers.get_all('Content-Length') or []
            if mime not in LIMITS or len(lengths)!=1 or not re.fullmatch(r'[0-9]{1,8}',lengths[0]):
                return self.reply(400,{'valid':False})
            size=int(lengths[0])
            if not 0<size<=LIMITS[mime]:
                return self.reply(413,{'valid':False})
            if not lock.acquire(blocking=False):
                return self.reply(503,{'valid':False})
            try:
                data=self.rfile.read(size)
                if len(data)!=size:
                    return self.reply(400,{'valid':False})
                receipt=runner(image,db,mime,data)
                return self.reply(200,receipt or {'policy':POLICY,'valid':False,'contentSafety':False})
            finally:
                lock.release()
    return Handler

def main():
    # Deliberate operator gate; this file is not enabled by CI or the Worker.
    if os.environ.get('NEO_VALIDATOR_HOST_HOMOLOGATED')!='1':
        raise SystemExit('runtime not homologated')
    image=os.environ['NEO_VALIDATOR_IMAGE_ID'];db=os.environ['NEO_VALIDATOR_DB_DIR']
    command(image,db,'image/jpeg','neo-media-preflight')
    handler=make_handler(os.environ['NEO_VALIDATOR_SECRET'],image,db)
    http.server.ThreadingHTTPServer(('127.0.0.1',8788),handler).serve_forever()
if __name__=='__main__':
    main()
