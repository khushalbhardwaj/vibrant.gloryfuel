# GloryFuel — Node.js server
# Deploy to Render: connect this repo, pick "Web Service", start command: node server.js
# Or Railway: connect repo, it auto-detects Node.js

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const API_HOST = 'vibrant-drab.vercel.app';
const CACHE_TTL = 10 * 60 * 1000;
const CACHE_DIR = path.join(__dirname, 'cache');
const apiCache = {};
const pendingFetches = {};

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

try {
    const now = Date.now();
    fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json')).forEach(f => {
        try {
            const p = path.join(CACHE_DIR, f);
            const raw = fs.readFileSync(p, 'utf-8');
            const entry = JSON.parse(raw);
            if (now - entry.ts >= CACHE_TTL) fs.unlinkSync(p);
        } catch (e) { try { fs.unlinkSync(path.join(CACHE_DIR, f)); } catch (e2) {} }
    });
} catch (e) {}

function cachePath(key) {
    const safe = key.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 120);
    return path.join(CACHE_DIR, safe + '.json');
}

function getCached(key) {
    if (apiCache[key] && Date.now() - apiCache[key].ts < CACHE_TTL) return apiCache[key].data;
    const cp = cachePath(key);
    try {
        const raw = fs.readFileSync(cp, 'utf-8');
        const entry = JSON.parse(raw);
        if (Date.now() - entry.ts < CACHE_TTL) {
            apiCache[key] = entry;
            return entry.data;
        }
        fs.unlinkSync(cp);
    } catch (e) {}
    return null;
}

function setCache(key, data) {
    const entry = { key, ts: Date.now(), data };
    apiCache[key] = entry;
    try { fs.writeFileSync(cachePath(key), JSON.stringify(entry)); } catch (e) {}
    delete pendingFetches[key];
    queueChildFetches(key, data);
}

function primeCache() {
    try {
        const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
        for (const file of files) {
            try {
                const raw = fs.readFileSync(path.join(CACHE_DIR, file), 'utf-8');
                const entry = JSON.parse(raw);
                if (Date.now() - entry.ts >= CACHE_TTL) continue;
                const key = entry.key || '/' + file.replace(/\.json$/, '').split('_').join('/').replace('/_', '?');
                apiCache[key] = entry;
                if (key.includes('course-hehe')) queueChildFetches(key, entry.data);
            } catch (e) {}
        }
    } catch (e) {}
}

function queueChildFetches(key, data) {
    if (!key.includes('course-hehe')) return;
    const items = data && data.data;
    if (!Array.isArray(items)) return;
    const courseMatch = key.match(/course_id=(\d+)/);
    if (!courseMatch) return;
    const courseId = courseMatch[1];
    const folderIds = items.filter(i => i.material_type === 'FOLDER').map(i => i.id);
    for (const fid of folderIds) {
        const ck = '/new-api/vibrant/course-hehe?course_id=' + courseId + '&parent_id=' + fid;
        if (getCached(ck)) continue;
        if (pendingFetches[ck]) continue;
        const opts = {
            hostname: API_HOST,
            path: ck,
            method: 'GET',
            rejectUnauthorized: false,
            headers: {
                'host': API_HOST,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'accept': 'application/json, text/plain, */*',
            },
        };
        backgroundFetch(ck, opts);
    }
}

function backgroundFetch(key, opts) {
    if (pendingFetches[key]) return;
    let attempts = 0;
    pendingFetches[key] = true;
    const poll = () => {
        attempts++;
        const proxyReq = https.request(opts, (proxyRes) => {
            let chunks = [];
            proxyRes.on('data', c => chunks.push(c));
            proxyRes.on('end', () => {
                const body = Buffer.concat(chunks).toString();
                if (proxyRes.statusCode === 200) {
                    try { setCache(key, JSON.parse(body)); } catch(e) {}
                    return;
                }
                if (attempts < 20) {
                    const delay = Math.min(5000 * attempts, 30000);
                    setTimeout(poll, delay);
                } else {
                    delete pendingFetches[key];
                }
            });
        });
        proxyReq.on('error', () => {
            if (attempts < 20) { setTimeout(poll, 10000); } else { delete pendingFetches[key]; }
        });
        proxyReq.end();
    };
    poll();
}

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.json': 'application/json; charset=utf-8',
};

const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost:' + PORT);

    if (url.pathname === '/proxy-video') {
        const targetUrl = url.searchParams.get('url');
        if (!targetUrl) { res.writeHead(400); res.end('Missing url'); return; }
        const opts = new URL(targetUrl);
        const driver = opts.protocol === 'https:' ? https : http;
        const reqOpts = {
            hostname: opts.hostname,
            path: opts.pathname + opts.search,
            method: 'GET',
            rejectUnauthorized: false,
            headers: {
                'host': opts.hostname,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'accept': '*/*',
                'origin': 'https://appx-play.akamai.net.in',
                'referer': 'https://appx-play.akamai.net.in/',
            },
        };
        const upstreamReq = driver.request(reqOpts, (upstreamRes) => {
            const ct = upstreamRes.headers['content-type'] || '';
            const isM3U8 = ct.includes('mpegurl') || ct.includes('x-mpegURL') || targetUrl.includes('.m3u8');
            const headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Expose-Headers': '*',
                'Content-Type': ct || 'application/octet-stream',
                'Cache-Control': 'public, max-age=3600',
            };
            if (!isM3U8) {
                if (upstreamRes.headers['content-length']) headers['Content-Length'] = upstreamRes.headers['content-length'];
                res.writeHead(upstreamRes.statusCode, headers);
                upstreamRes.pipe(res);
                return;
            }
            let chunks = [];
            upstreamRes.on('data', c => chunks.push(c));
            upstreamRes.on('end', () => {
                let body = Buffer.concat(chunks).toString();
                const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
                const lines = body.split('\n');
                const rewritten = lines.map(line => {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('http')) return line;
                    const absUrl = baseUrl + trimmed;
                    return '/proxy-video?url=' + encodeURIComponent(absUrl);
                }).join('\n');
                delete headers['Content-Length'];
                res.writeHead(upstreamRes.statusCode, headers);
                res.end(rewritten);
            });
        });
        upstreamReq.on('error', () => { res.writeHead(502); res.end('Proxy error'); });
        upstreamReq.end();
        return;
    }

    if (url.pathname === '/api-status') {
        const cacheFiles = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({
            cacheSize: cacheFiles.length,
            pendingFetches: Object.keys(pendingFetches).length,
            cachedEndpoints: cacheFiles.map(f => f.replace(/\.json$/, '').replace(/_/g, '/')).filter(k => k.includes('course')),
        }));
        return;
    }

    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/new-api/') || url.pathname.startsWith('/api/v1/vibrant/')) {
        const apiPath = url.pathname + url.search;
        const opts = {
            hostname: API_HOST,
            path: apiPath,
            method: req.method,
            rejectUnauthorized: false,
            headers: {
                'host': API_HOST,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'accept': 'application/json, text/plain, */*',
            },
        };
        const cached = getCached(apiPath);
        if (cached) {
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'X-Cache': 'HIT',
            });
            res.end(JSON.stringify(cached));
            return;
        }
        const upstreamReq = https.request(opts, (upstreamRes) => {
            let chunks = [];
            upstreamRes.on('data', c => chunks.push(c));
            upstreamRes.on('end', () => {
                const body = Buffer.concat(chunks).toString();
                let data;
                try { data = JSON.parse(body); } catch(e) { data = null; }
                if (upstreamRes.statusCode === 200 && data) {
                    setCache(apiPath, data);
                    res.writeHead(200, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'X-Cache': 'MISS',
                    });
                    res.end(JSON.stringify(data));
                } else if (upstreamRes.statusCode === 429) {
                    if (!pendingFetches[apiPath]) backgroundFetch(apiPath, opts);
                    res.writeHead(200, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'X-Cache': 'RATE_LIMITED',
                    });
                    res.end(JSON.stringify({ status: 200, message: 'Upstream rate limited, retrying in background. Please reload shortly.', data: null }));
                } else {
                    if (!pendingFetches[apiPath]) backgroundFetch(apiPath, opts);
                    res.writeHead(upstreamRes.statusCode || 502, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    });
                    res.end(body);
                }
            });
        });
        upstreamReq.on('error', (err) => {
            if (!pendingFetches[apiPath]) backgroundFetch(apiPath, opts);
            res.writeHead(502, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            });
            res.end(JSON.stringify({ status: 502, message: 'Proxy error', error: err.message }));
        });
        upstreamReq.end();
        return;
    }

    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        });
        res.end();
        return;
    }

    let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);
    const ext = path.extname(filePath);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 Not Found</h1>');
            return;
        }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
});

const AUTO_PRIME = [
    '/api/v1/vibrant/batches',
    '/new-api/vibrant/course-hehe?course_id=35',
    '/new-api/vibrant/course-hehe?course_id=8',
    '/api/v1/vibrant/video?video_id=5051&course_id=35',
    '/api/v1/vibrant/video?video_id=5864&course_id=8',
];

server.listen(PORT, () => {
    console.log('GloryFuel server running on port ' + PORT);
    primeCache();
    for (const path of AUTO_PRIME) {
        if (!getCached(path) && !pendingFetches[path]) {
            const opts = {
                hostname: API_HOST,
                path: path,
                method: 'GET',
                rejectUnauthorized: false,
                headers: {
                    'host': API_HOST,
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'accept': 'application/json, text/plain, */*',
                },
            };
            backgroundFetch(path, opts);
        }
    }
});
