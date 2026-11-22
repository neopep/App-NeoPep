const { createECDH, randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const [directory, subject] = process.argv.slice(2);
if (!directory || !subject || !/^(mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(subject)) {
  throw new Error('Informe um diretório privado novo e um assunto VAPID válido.');
}
const vapid = createECDH('prime256v1');
vapid.generateKeys();
const privateKey = Buffer.alloc(32);
const scalar = vapid.getPrivateKey();
scalar.copy(privateKey, privateKey.length - scalar.length);
const publicKey = vapid.getPublicKey().toString('base64url');
fs.mkdirSync(directory, { mode: 0o700 });
fs.writeFileSync(path.join(directory, 'edge.env'), [
  `NEO_VAPID_PUBLIC_KEY=${publicKey}`,
  `NEO_VAPID_PRIVATE_KEY=${privateKey.toString('base64url')}`,
  `NEO_VAPID_SUBJECT=${subject}`,
  `NEO_PUSH_CRON_SECRET=${randomBytes(32).toString('hex')}`,
  ''
].join('\n'), { flag: 'wx', mode: 0o600 });
fs.writeFileSync(path.join(directory, 'vercel-public.env'), `NEO_STAGING_VAPID_PUBLIC_KEY=${publicKey}\n`, { flag: 'wx', mode: 0o600 });
