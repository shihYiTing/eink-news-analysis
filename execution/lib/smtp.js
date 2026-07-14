// Minimal zero-dependency SMTP client: connect, STARTTLS, AUTH LOGIN, send one HTML message.
const net = require('net');
const tls = require('tls');

const DEFAULT_TIMEOUT_MS = 20000;

function readResponse(socket) {
  return new Promise((resolve, reject) => {
    let buf = '';
    function onData(chunk) {
      buf += chunk.toString('utf8');
      const lines = buf.split(/\r\n/).filter(Boolean);
      const last = lines[lines.length - 1];
      // Multi-line SMTP responses use "250-" for continuation lines and
      // "250 " (space) on the final line.
      if (last && /^\d{3} /.test(last)) {
        cleanup();
        resolve(buf);
      }
    }
    function onError(err) { cleanup(); reject(err); }
    function cleanup() {
      socket.removeListener('data', onData);
      socket.removeListener('error', onError);
    }
    socket.on('data', onData);
    socket.on('error', onError);
  });
}

function send(socket, line) {
  socket.write(line + '\r\n');
}

function code(resp) {
  return parseInt(resp.slice(0, 3), 10);
}

async function sendMail(opts) {
  const sockets = [];
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;

  const core = sendMailCore(opts, sockets);
  const timeout = new Promise((_, reject) => {
    const t = setTimeout(() => {
      for (const s of sockets) { try { s.destroy(); } catch { /* already closed */ } }
      reject(new Error(`SMTP timed out after ${timeoutMs}ms (no response from ${opts.host}:${opts.port} — likely blocked network, not a credential problem)`));
    }, timeoutMs);
    t.unref?.();
  });

  return Promise.race([core, timeout]);
}

async function sendMailCore({ host, port, user, pass, from, to, subject, html }, sockets) {
  const plainSocket = net.connect({ host, port });
  sockets.push(plainSocket);
  await new Promise((resolve, reject) => {
    plainSocket.once('connect', resolve);
    plainSocket.once('error', reject);
  });

  const greeting = await readResponse(plainSocket);
  if (code(greeting) !== 220) throw new Error(`Unexpected greeting: ${greeting}`);

  send(plainSocket, 'EHLO localhost');
  await readResponse(plainSocket);

  send(plainSocket, 'STARTTLS');
  const starttlsResp = await readResponse(plainSocket);
  if (code(starttlsResp) !== 220) throw new Error(`STARTTLS rejected: ${starttlsResp}`);

  const secureSocket = await new Promise((resolve, reject) => {
    const s = tls.connect({ socket: plainSocket, host, servername: host }, () => resolve(s));
    s.once('error', reject);
  });
  sockets.push(secureSocket);

  send(secureSocket, 'EHLO localhost');
  await readResponse(secureSocket);

  send(secureSocket, 'AUTH LOGIN');
  await readResponse(secureSocket);
  send(secureSocket, Buffer.from(user, 'utf8').toString('base64'));
  await readResponse(secureSocket);
  send(secureSocket, Buffer.from(pass, 'utf8').toString('base64'));
  const authResp = await readResponse(secureSocket);
  if (code(authResp) !== 235) throw new Error(`AUTH failed: ${authResp}`);

  send(secureSocket, `MAIL FROM:<${from}>`);
  const mailResp = await readResponse(secureSocket);
  if (code(mailResp) !== 250) throw new Error(`MAIL FROM rejected: ${mailResp}`);

  const recipients = Array.isArray(to) ? to : [to];
  for (const rcpt of recipients) {
    send(secureSocket, `RCPT TO:<${rcpt}>`);
    const rcptResp = await readResponse(secureSocket);
    if (![250, 251].includes(code(rcptResp))) throw new Error(`RCPT TO rejected for ${rcpt}: ${rcptResp}`);
  }

  send(secureSocket, 'DATA');
  const dataResp = await readResponse(secureSocket);
  if (code(dataResp) !== 354) throw new Error(`DATA rejected: ${dataResp}`);

  const headers = [
    `From: ${from}`,
    `To: ${recipients.join(', ')}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    '',
  ].join('\r\n');

  const bodyB64 = Buffer.from(html, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');
  const message = headers + bodyB64;
  // Dot-stuffing per RFC 5321: a line starting with '.' must be escaped as '..'
  const dotStuffed = message.split('\r\n').map((l) => (l.startsWith('.') ? `.${l}` : l)).join('\r\n');

  secureSocket.write(`${dotStuffed}\r\n.\r\n`);
  const sentResp = await readResponse(secureSocket);
  if (code(sentResp) !== 250) throw new Error(`Message not accepted: ${sentResp}`);

  send(secureSocket, 'QUIT');
  try { await readResponse(secureSocket); } catch { /* server may close before replying */ }
  secureSocket.end();
}

module.exports = { sendMail };
