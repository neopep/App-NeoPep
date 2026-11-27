import hashlib
import json
import subprocess
import tempfile
import unittest
from types import SimpleNamespace
from scan_entry import validate
from gateway import command, make_handler, run_isolated
from unittest.mock import patch

class RuntimeTests(unittest.TestCase):
    def test_scanner_requires_clean_complete_scan(self):
        data=b'fixture'
        def parse(m,d): return {'policy':'neopep-media-validation-v1','mime':m,'size':len(d),'sha256':hashlib.sha256(d).hexdigest(),'fullParse':True}
        good=b'Scanned files: 1\nInfected files: 0\n'
        for result in (SimpleNamespace(returncode=1,stdout=good,stderr=b''),SimpleNamespace(returncode=2,stdout=good,stderr=b''),SimpleNamespace(returncode=0,stdout=b'Scanned files: 0\nInfected files: 0',stderr=b''),SimpleNamespace(returncode=0,stdout=good,stderr=b'warning')):
            with self.assertRaises(ValueError): validate('image/jpeg',data,parse,lambda *a,**k:result)
        def scan(args,**kw):
            self.assertEqual(kw['input'],data)
            self.assertIn('--fail-if-cvd-older-than=2',args)
            return SimpleNamespace(returncode=0,stdout=good,stderr=b'')
        self.assertTrue(validate('image/jpeg',data,parse,scan)['contentSafety'])
    def test_isolated_command_and_credentials(self):
        with tempfile.TemporaryDirectory() as db:
            image='sha256:'+'a'*64
            args=command(image,db,'image/jpeg','fixture')
            for flag in ('--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pull=never','--user=65532:65532'):
                self.assertIn(flag,args)
            with self.assertRaises(ValueError): command('latest',db,'image/jpeg','fixture')
            with self.assertRaises(ValueError): make_handler('short',image,db)
            self.assertTrue(make_handler('b'*64,image,db))
    def test_digest_mismatch_is_rejected(self):
        with tempfile.TemporaryDirectory() as db:
            receipt={'valid':True,'fullParse':True,'contentSafety':True,'policy':'neopep-media-validation-v1','mime':'image/jpeg','size':1,'sha256':'0'*64}
            with patch('gateway.subprocess.run',return_value=SimpleNamespace(returncode=0,stdout=json.dumps(receipt).encode())):
                self.assertIsNone(run_isolated('sha256:'+'a'*64,db,'image/jpeg',b'x'))
if __name__=='__main__': unittest.main()
