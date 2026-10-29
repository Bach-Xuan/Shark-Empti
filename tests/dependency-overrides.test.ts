// @vitest-environment node
import { createRequire } from 'node:module';
import { createServer, type Server, type Socket } from 'node:net';
import type { Readable } from 'node:stream';
import { expect, it } from 'vitest';

const projectRequire = createRequire(`${process.cwd()}/package.json`);

it('loads the patched gRPC API used by the pinned Firebase client without replacing its SDK major', () => {
  const fromFirestore = createRequire(projectRequire.resolve('@firebase/firestore'));
  const grpc = fromFirestore('@grpc/grpc-js');
  expect(fromFirestore('@grpc/grpc-js/package.json').version).toBe('1.13.7');
  expect(typeof grpc.loadPackageDefinition).toBe('function');
  expect(typeof grpc.credentials.createInsecure).toBe('function');
});

async function listen(server: Server) {
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing loopback fixture address');
  return address.port;
}

it('keeps the CLI proxy dependency FTP reader working with the security-hardened client', async () => {
  const fromGetUri = createRequire(projectRequire.resolve('get-uri'));
  expect(fromGetUri('basic-ftp/package.json').version).toBe('6.2.3');
  const sockets = new Set<Socket>();
  let transfer: Socket | undefined;
  const data = createServer(socket => { sockets.add(socket); transfer = socket; });
  const dataPort = await listen(data);
  const control = createServer(socket => {
    sockets.add(socket);
    socket.write('220 Loopback test fixture\r\n');
    let pending = '';
    socket.on('data', chunk => {
      pending += chunk.toString();
      const lines = pending.split('\r\n');
      pending = lines.pop() ?? '';
      for (const line of lines) {
        const verb = line.split(' ')[0];
        if (verb === 'USER') socket.write('331 Password required\r\n');
        else if (verb === 'PASS') socket.write('230 Logged in\r\n');
        else if (verb === 'FEAT') socket.write('211-Features\r\n EPSV\r\n UTF8\r\n211 End\r\n');
        else if (verb === 'MDTM') socket.write('213 20261029000000\r\n');
        else if (verb === 'EPSV') socket.write(`229 Entering Extended Passive Mode (|||${dataPort}|)\r\n`);
        else if (verb === 'RETR') {
          socket.write('150 Opening data connection\r\n');
          transfer?.end('loopback-only fixture');
          socket.write('226 Transfer complete\r\n');
        } else if (verb === 'QUIT') socket.end('221 Bye\r\n');
        else socket.write('200 OK\r\n');
      }
    });
  });
  try {
    const port = await listen(control);
    const stream = await projectRequire('get-uri').getUri(`ftp://127.0.0.1:${port}/fixture.txt`) as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe('loopback-only fixture');
  } finally {
    for (const socket of sockets) socket.destroy();
    await Promise.all([control, data].map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  }
}, 10000);
