const CACHE="parent-app-v54";
const CORE=["/parent-icon.svg"];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;

  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;

  // Never cache auth, APIs, or Next.js runtime/chunks.
  if(
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/parent-login")
  ){
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(res=>{
        if(res.ok){
          const clone=res.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,clone)).catch(()=>{});
        }
        return res;
      })
      .catch(()=>caches.match(event.request))
  );
});
