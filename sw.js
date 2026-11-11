/* Offline shell for Winyle. Bump CACHE together with BUILD in index.html. */
const CACHE='winyle-v13';
const ASSETS=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];
const SHELL=new URL('./',self.location).href;            // the app itself, whatever the launch URL carried
const isShell=u=>u.origin===self.location.origin&&(u.href.split(/[?#]/)[0]===SHELL||u.href.split(/[?#]/)[0]===SHELL+'index.html');

self.addEventListener('install',e=>{
  // cache:'reload' - from the server, not from the browser's HTTP cache, which can
  // still be holding the previous build for a few minutes after a deploy
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(a=>new Request(a,{cache:'reload'})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==self.location.origin) return;
  if(e.request.mode==='navigate'||e.request.destination==='document'){
    if(!isShell(u)) return;                                // some other page under this path: the browser's business
    /* Network first, so a deploy shows up on the next launch. Only a good answer
       replaces the stored copy - an error page from the host must never be what
       the app opens to offline - and it is stored under one key, so a launch URL
       with a query string finds it too. Anything else (no network, a 5xx, a
       404) falls back to the copy we have. */
    e.respondWith((async()=>{
      try{
        const r=await fetch(e.request);
        if(r.ok){
          const copy=r.clone();
          e.waitUntil(caches.open(CACHE).then(c=>c.put(SHELL,copy)).catch(()=>{}));
          return r;
        }
        return (await caches.match(SHELL))||r;
      }catch(err){
        const hit=await caches.match(SHELL);
        if(hit) return hit;
        throw err;
      }
    })());
  } else {
    // cache-first for the few static assets; everything else straight through
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
  }
});
