// H03 · Round-trip calculator: where the time goes before your server does any work.
// Run: npx tsx hld/1-basics/H03-networking-basics/demo.ts

interface Path { name: string; rttMs: number }
interface Options { tls: '1.2' | '1.3' | 'quic'; dnsCached: boolean; reuse: boolean; serverMs: number; dnsColdMs: number }

const handshakeRtts = (o: Options) => (o.reuse ? 0 : o.tls === 'quic' ? 1 : o.tls === '1.3' ? 2 : 3); // TCP(1)+TLS(1|2), QUIC combined

// Time to first byte for one request.
function ttfb(p: Path, o: Options, edge?: Path) {
  const dns = o.dnsCached ? 0 : o.dnsColdMs;
  if (!edge) {
    const hs = handshakeRtts(o) * p.rttMs;
    return { dns, handshakes: hs, request: p.rttMs, server: o.serverMs, total: dns + hs + p.rttMs + o.serverMs };
  }
  // Via an edge: handshakes over the short hop, request crosses edge→origin on a warm pooled connection.
  const hs = handshakeRtts(o) * edge.rttMs;
  const request = edge.rttMs + p.rttMs;
  return { dns, handshakes: hs, request, server: o.serverMs, total: dns + hs + request + o.serverMs };
}

function row(label: string, r: ReturnType<typeof ttfb>) {
  const bar = '#'.repeat(Math.round(r.total / 20));
  console.log(`${label.padEnd(34)} dns ${String(r.dns).padStart(3)} + hs ${String(r.handshakes).padStart(3)} + req ${String(r.request).padStart(3)} + srv ${r.server} = ${String(r.total).padStart(4)} ms ${bar}`);
}

// N sequential calls from one service to another (e.g. Node → payment provider).
function sequentialCalls(n: number, p: Path, keepAlive: boolean) {
  let t = 0;
  for (let i = 0; i < n; i++) {
    const reuse = keepAlive && i > 0;
    t += ttfb(p, { tls: '1.3', dnsCached: i > 0, reuse, serverMs: 15, dnsColdMs: 30 }).total;
  }
  return t;
}

// TCP vs UDP when one packet in a stream of frames is lost.
function lossDemo(rttMs: number) {
  const frames = [1, 2, 3, 4], lost = 2, gapMs = 20;
  const tcp = frames.map((f) => (f < lost ? f * gapMs : lost * gapMs + rttMs + (f - lost) * 1)); // later frames wait for the resend
  const udp = frames.map((f) => (f === lost ? NaN : f * gapMs));
  console.log('frame:      ' + frames.map((f) => `#${f}`.padStart(8)).join(''));
  console.log('TCP ready:  ' + tcp.map((t) => `${t}ms`.padStart(8)).join('') + '   (ordered: 3 and 4 wait for 2)');
  console.log('UDP ready:  ' + udp.map((t) => (isNaN(t) ? 'lost' : `${t}ms`).padStart(8)).join('') + '   (skip 2, play the rest on time)');
}

function main() {
  const usEast: Path = { name: 'Mumbai → us-east', rttMs: 200 };
  const sg: Path = { name: 'Mumbai → Singapore', rttMs: 60 };
  const edge: Path = { name: 'Pune → CDN edge Mumbai', rttMs: 15 };
  const base: Options = { tls: '1.3', dnsCached: false, reuse: false, serverMs: 20, dnsColdMs: 60 };

  console.log('=== Time to first byte (ms) ===');
  row('us-east, new conn, TLS 1.2', ttfb(usEast, { ...base, tls: '1.2' }));
  row('us-east, new conn, TLS 1.3', ttfb(usEast, base));
  row('us-east, new conn, QUIC (HTTP/3)', ttfb(usEast, { ...base, tls: 'quic' }));
  row('us-east, reused conn (keep-alive)', ttfb(usEast, { ...base, dnsCached: true, reuse: true }));
  row('us-east via CDN edge, new conn', ttfb(usEast, base, edge));
  row('Singapore region, new conn', ttfb(sg, base));
  row('Singapore region, reused conn', ttfb(sg, { ...base, dnsCached: true, reuse: true }));

  console.log('\n=== 10 sequential calls to a provider 60 ms away ===');
  const cold = sequentialCalls(10, sg, false), warm = sequentialCalls(10, sg, true);
  console.log(`no keep-alive: ${cold} ms | keep-alive: ${warm} ms | saved ${cold - warm} ms (${Math.round((1 - warm / cold) * 100)}%)`);

  console.log('\n=== One lost packet: TCP vs UDP (RTT 100 ms, frames every 20 ms) ===');
  lossDemo(100);

  console.log('\n=== DNS TTL and failover ===');
  for (const ttl of [3600, 300, 60]) {
    console.log(`TTL ${String(ttl).padStart(4)} s → after an IP change, some users hit the old IP for up to ${ttl >= 60 ? ttl / 60 + ' min' : ttl + ' s'}`);
  }
}

main();

export {};
