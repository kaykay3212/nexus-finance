"use strict";

const CACHE_NAME = "nexus-shell-20261023-diary3";
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.json",
  "/styles.css?v=20261023-diary3",
  "/finance-analytics.js?v=20261023-diary3",
  "/dashboard-charts.js?v=20261023-diary3",
  "/app.js?v=20261023-diary3",
  "/diary.js?v=20261023-diary3",
  "/site-structure.js?v=20261023-diary3",
  "/simulation.js?v=20261023-diary3",
  "/icons/nexus-192.png",
  "/icons/nexus-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon-32.png"
];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL_ASSETS)));
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith("nexus-shell-")&&key!==CACHE_NAME).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("message",event=>{
  if(event.data?.type==="SKIP_WAITING")self.skipWaiting();
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(clients=>{
    const client=clients.find(client=>new URL(client.url).origin===self.location.origin);
    return client?client.focus():self.clients.openWindow("/");
  }));
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;

  if(request.mode==="navigate"){
    event.respondWith(
      fetch(request).catch(async()=>{
        const cached=await caches.match(request);
        return cached||caches.match("/offline.html");
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached=>cached||fetch(request).catch(()=>caches.match(request)))
  );
});
