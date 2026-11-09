// IRONDAY offline support
const CACHE='ironday-v1';
const CORE=["./", "index.html", "manifest.webmanifest", "privacy.html", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-180.png", "img/abs_1.jpg", "img/abs_2.jpg", "img/abs_3.jpg", "img/abs_4.jpg", "img/abs_5.jpg", "img/abs_6.jpg", "img/abs_map.jpg", "img/arms_1.jpg", "img/arms_2.jpg", "img/arms_3.jpg", "img/arms_4.jpg", "img/arms_5.jpg", "img/arms_6.jpg", "img/arms_map.jpg", "img/back_1.jpg", "img/back_2.jpg", "img/back_3.jpg", "img/back_4.jpg", "img/back_5.jpg", "img/back_6.jpg", "img/back_map.jpg", "img/calves_1.jpg", "img/calves_2.jpg", "img/calves_3.jpg", "img/calves_4.jpg", "img/calves_5.jpg", "img/calves_6.jpg", "img/calves_map.jpg", "img/chest_1.jpg", "img/chest_2.jpg", "img/chest_3.jpg", "img/chest_4.jpg", "img/chest_5.jpg", "img/chest_6.jpg", "img/chest_map.jpg", "img/cover.jpg", "img/curl2.jpg", "img/flex.jpg", "img/legs_1.jpg", "img/legs_2.jpg", "img/legs_3.jpg", "img/legs_4.jpg", "img/legs_5.jpg", "img/legs_6.jpg", "img/mirror.jpg", "img/shoulders_1.jpg", "img/shoulders_2.jpg", "img/shoulders_3.jpg", "img/shoulders_4.jpg", "img/shoulders_5.jpg", "img/shoulders_6.jpg", "img/shoulders_map.jpg"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET') return;
  const url=new URL(req.url);
  // Page: network first so updates arrive right away, cached copy when offline
  if(req.mode==='navigate'||(url.origin===location.origin&&url.pathname.endsWith('.html'))){
    e.respondWith(fetch(req).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp));return r;}).catch(()=>caches.match(req).then(r=>r||caches.match('index.html'))));
    return;
  }
  // Images, icons and Google Fonts: cache first
  if(url.origin===location.origin||url.host.endsWith('fonts.googleapis.com')||url.host.endsWith('fonts.gstatic.com')){
    e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{if(r.ok||r.type==='opaque'){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp));}return r;})));
  }
});
