/* عامل خدمة «شلونج» — نطاقه الموقع كله عشان التنقل بين الأقسام يبقى داخل التطبيق،
   لكنه يخزّن صفحة «شلونج» وأصولها فقط. صفحات الشعر ومِران لها عوامل خدمتها الخاصة
   (نطاقها أضيق فهي اللي تخدمها)، ودعوة التخرج تمرّ للشبكة كما هي. */
const CACHE = 'me-v3';
const CORE = ['./me/','./me/index.html','./me/manifest.webmanifest',
              './me/icon-192.png','./me/icon-512.png','./me/icon-maskable.png','./me/apple-touch-icon.png',
              './hair/gen/garden.jpg','./hair/st/heartbub.png','./hair/st/peonywhite.png','./hair/st/branch.png',
              './hair/st/bubble.png','./hair/st/butterfly.png',
              './hair/fonts/ArefRuqaa-700-arabic.woff2','./hair/fonts/Almarai-400-arabic.woff2',
              './hair/fonts/Almarai-800-arabic.woff2','./hair/fonts/Amiri-400-arabic.woff2',
              './hair/fonts/Amiri-700-arabic.woff2','./hair/fonts/Almarai-400-latin.woff2','./hair/fonts/Almarai-800-latin.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.allSettled(CORE.map(u => c.add(u))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('me-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const mine = url => new URL(url).pathname.includes('/me/');
const isPage = req => req.mode === 'navigate' || req.destination === 'document';

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  /* خارج «شلونج» وخارج أصولها المشتركة: لا نتدخل */
  const shared = CORE.some(u => url.pathname.endsWith(u.slice(1)));
  if (!mine(e.request.url) && !shared) return;

  if (isPage(e.request)) {
    e.respondWith(
      caches.match('./me/index.html').then(hit => {
        const net = fetch(e.request).then(res => {
          if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./me/index.html', copy)).catch(()=>{}); }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(res => {
        if (res && (res.type === 'basic' || res.type === 'cors')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{}); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
