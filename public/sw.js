const CACHE="varen-study-ai-v2";
const ASSETS=["/","/index.html","/styles.css","/app.js","/questions.json","/manifest.webmanifest","/icon.svg"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
 const url=new URL(e.request.url);
 if(e.request.method!=="GET"||url.pathname.startsWith("/api/"))return;
 e.respondWith(fetch(e.request).then(r=>{
   if(r.ok&&url.origin===location.origin){
     const copy=r.clone();
     caches.open(CACHE).then(c=>c.put(e.request,copy));
   }
   return r;
 }).catch(()=>caches.match(e.request).then(cached=>cached||caches.match("/index.html"))));
});