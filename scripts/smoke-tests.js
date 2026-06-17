#!/usr/bin/env node
(async () => {
  const base = 'http://localhost:4000';
  const waitTimeoutMs = 120000;
  const start = Date.now();
  const end = start + waitTimeoutMs;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // wait for server to be ready
  let ready = false;
  while (Date.now() < end) {
    try {
      const c = new AbortController();
      const id = setTimeout(() => c.abort(), 3000);
      const res = await fetch(base + '/', { signal: c.signal });
      clearTimeout(id);
      if (res.ok) {
        console.log('Server ready');
        ready = true;
        break;
      }
    } catch (e) {
      // ignore
    }
    await sleep(1000);
  }
  if (!ready) {
    console.error('Server did not become ready in time');
    process.exit(1);
  }

  const queries = ['sfera ebbasta', 'coldplay', 'gianna'];

  for (const q of queries) {
    console.log(`\n=== SEARCH: ${q} ===`);
    const body = JSON.stringify({ json: { query: q } });
    const ctrl = new AbortController();
    const t0 = Date.now();
    const to = setTimeout(() => ctrl.abort(), 30000);
    let resp = null;
    try {
      resp = await fetch(`${base}/api/trpc/music.searchAll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: ctrl.signal,
      });
    } catch (e) {
      console.error('searchAll request failed', e && e.message ? e.message : e);
      continue;
    } finally {
      clearTimeout(to);
    }
    const t1 = Date.now();
    let json = null;
    try { json = await resp.json(); } catch (e) { json = null; }
    console.log(`searchAll took ${t1 - t0} ms`);
    try { console.log('searchAll response:', JSON.stringify(json, null, 2).slice(0, 2000)); } catch (e) {}

    let tracks = null;
    if (json && json.result && json.result.tracks) tracks = json.result.tracks;
    else if (json && json.tracks) tracks = json.tracks;
    else if (json && json.result && json.result.data && json.result.data.tracks) tracks = json.result.data.tracks;

    if (!tracks || tracks.length === 0) {
      console.log('No tracks returned from searchAll');
      continue;
    }

    const first = tracks[0];
    const vid = first.id;
    const title = first.title || '';
    const artist = first.artist || '';
    console.log(`Found track: ${title} (${vid}) by ${artist}`);

    const body2 = JSON.stringify({ json: { videoId: vid, title, artist, album: '', duration: 0 } });
    const ctrl2 = new AbortController();
    const to2 = setTimeout(() => ctrl2.abort(), 30000);
    const t2 = Date.now();
    try {
      const lresp = await fetch(`${base}/api/trpc/music.getLyrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body2,
        signal: ctrl2.signal,
      });
      const t3 = Date.now();
      let j2 = null;
      try { j2 = await lresp.json(); } catch (e) { j2 = null; }
      console.log(`getLyrics took ${t3 - t2} ms`);
      try { console.log('getLyrics response:', JSON.stringify(j2, null, 2).slice(0, 2000)); } catch (e) {}
    } catch (e) {
      console.error('getLyrics request failed', e && e.message ? e.message : e);
    } finally {
      clearTimeout(to2);
    }
  }

  console.log('\nSmoke tests complete.');
  process.exit(0);
})();
