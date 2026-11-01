// Ninaivo Service Worker with Offline App Shell and Audio 206 Range Caching
const CACHE_NAME = "ninaivo-v2";

const SHELL_ASSETS = [
  "/",
  "/login",
  "/today",
  "/daily",
  "/upcoming",
  "/report",
  "/settings",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon.svg",
  "/apple-touch-icon.png",
  "/audio/ninaivo-theme.mp3",
];

// 1. Install: Pre-cache app shell and audio file
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache assets individually so failure of one does not abort the rest
      for (const asset of SHELL_ASSETS) {
        try {
          const res = await fetch(asset, { cache: "reload" });
          if (res.ok) {
            await cache.put(asset, res);
          }
        } catch (err) {
          console.warn("[SW] Failed to pre-cache:", asset, err);
        }
      }
    })
  );
  self.skipWaiting();
});

// 2. Activate: Clean up older cache versions and claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Helper: Handle 206 Partial Content Range requests for audio from cache
async function handleAudioRangeRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  // Match audio file by clean pathname
  const url = new URL(request.url);
  let cachedResponse = await cache.match(url.pathname);
  if (!cachedResponse) {
    cachedResponse = await cache.match("/audio/ninaivo-theme.mp3");
  }

  // If not yet in cache, fetch and store
  if (!cachedResponse) {
    try {
      const netRes = await fetch(url.pathname);
      if (netRes.ok) {
        await cache.put(url.pathname, netRes.clone());
        cachedResponse = netRes;
      }
    } catch {
      // If offline and not in cache, return 404
      return new Response("Audio not cached offline", { status: 404 });
    }
  }

  const rangeHeader = request.headers.get("range");
  if (!rangeHeader) {
    return cachedResponse;
  }

  // Parse Range: bytes=start-end
  const arrayBuffer = await cachedResponse.clone().arrayBuffer();
  const total = arrayBuffer.byteLength;
  const parts = rangeHeader.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : total - 1;

  if (isNaN(start) || start >= total || end >= total) {
    return new Response("Range Not Satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${total}` },
    });
  }

  const chunk = arrayBuffer.slice(start, end + 1);

  return new Response(chunk, {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Accept-Ranges": "bytes",
      "Content-Length": String(chunk.byteLength),
      "Content-Type": "audio/mpeg",
    },
  });
}

// 3. Fetch Event Handler
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip sync endpoints and Next.js server action POSTs/component payloads
  if (url.pathname.startsWith("/api/sync") || url.pathname.startsWith("/api/backup")) {
    return;
  }

  // Handle Audio requests (including Range headers)
  if (url.pathname.endsWith(".mp3") || url.pathname.includes("/audio/")) {
    event.respondWith(handleAudioRangeRequest(request));
    return;
  }

  // Handle HTML Page Navigations (Network first with cache fallback)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(request);
          if (cached) return cached;
          // Fallbacks
          return (await cache.match("/today")) || (await cache.match("/login")) || Response.error();
        })
    );
    return;
  }

  // Static Assets: Next.js bundles, CSS, fonts, images (Stale-while-revalidate / cache-first)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then(async (netRes) => {
            if (netRes.ok) {
              const cache = await caches.open(CACHE_NAME);
              cache.put(request, netRes.clone());
            }
            return netRes;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Other GET requests: network with cache fallback
  event.respondWith(
    fetch(request)
      .then(async (response) => {
        if (response.ok && response.type === "basic") {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone());
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
