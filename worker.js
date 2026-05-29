// Cloudflare Worker — API proxy + video CORS proxy for GloryFuel
// Paste this entire file into https://dash.cloudflare.com/ -> Workers & Pages -> Create Worker
// No build step needed. Just paste and deploy.

const API_HOST = 'vibrant-drab.vercel.app';

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname + url.search;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // Video CORS proxy — fetch from classx.co.in with CORS headers
  if (url.pathname === '/proxy-video') {
    const target = url.searchParams.get('url');
    if (!target) return new Response('Missing url', { status: 400, headers: corsHeaders() });
    try {
      const resp = await fetch(target, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://appx-play.akamai.net.in',
          'Referer': 'https://appx-play.akamai.net.in/',
        },
      });
      const h = new Headers(resp.headers);
      h.set('Access-Control-Allow-Origin', '*');
      h.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      h.set('Access-Control-Allow-Headers', '*');
      h.set('Access-Control-Expose-Headers', '*');
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('mpegurl') || ct.includes('x-mpegURL') || target.includes('.m3u8')) {
        const text = await resp.text();
        const baseUrl = target.substring(0, target.lastIndexOf('/') + 1);
        const lines = text.split('\n');
        const rewritten = lines.map(function(line) {
          var t = line.trim();
          if (!t || t.startsWith('#') || t.startsWith('http')) return line;
          return '/proxy-video?url=' + encodeURIComponent(baseUrl + t);
        }).join('\n');
        h.delete('content-length');
        return new Response(rewritten, { status: resp.status, headers: h });
      }
      return new Response(resp.body, { status: resp.status, headers: h });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 502, headers: { 'Content-Type': 'application/json', ...objFromHeaders(corsHeaders()) },
      });
    }
  }

  // Proxy API requests to vibrant-drab
  if (path.startsWith('/api/') || path.startsWith('/new-api/') || path.startsWith('/api/v1/vibrant/')) {
    const targetUrl = 'https://' + API_HOST + path;
    const headers = {
      'Host': API_HOST,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Origin': 'https://vibrant-drab.vercel.app',
      'Referer': 'https://vibrant-drab.vercel.app/',
    };
    try {
      const resp = await fetch(targetUrl, { method: request.method, headers: headers });
      const h = new Headers(resp.headers);
      var cors = corsHeaders();
      cors.forEach(function(v, k) { h.set(k, v); });
      return new Response(resp.body, { status: resp.status, headers: h });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 502, headers: { 'Content-Type': 'application/json', ...objFromHeaders(corsHeaders()) },
      });
    }
  }

  return new Response('Not Found', { status: 404, headers: corsHeaders() });
}

addEventListener('fetch', function(event) {
  event.respondWith(handleRequest(event.request));
});

function corsHeaders() {
  return new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  });
}

function objFromHeaders(headers) {
  var obj = {};
  headers.forEach(function(v, k) { obj[k] = v; });
  return obj;
}
