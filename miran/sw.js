/* عامل الخدمة.
   القاعدة: الصفحة نفسها من الشبكة أولًا (عشان أي تحديث يوصلك فورًا)،
   والأصول الثابتة من المخزون أولًا (عشان السرعة). وبدون إنترنت: كل شي من المخزون. */
const CACHE = 'miran';
const CORE = ['./','./index.html','./manifest.webmanifest',
              './icon-192.png','./icon-512.png','./icon-maskable.png',
              './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.allSettled(CORE.map(u => c.add(u))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const isPage = req =>
  req.mode === 'navigate' || req.destination === 'document' ||
  new URL(req.url).pathname.endsWith('/index.html');

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  if (isPage(e.request)) {
    /* الشبكة أولًا: تحديثاتك تظهر بلا أي خطوة يدوية */
    e.respondWith(
      fetch(e.request)
        .then(res => {
          /* لا تخزّني ردًّا فاشلًا مكان الصفحة — بيصير هو نسخة «بدون إنترنت» */
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(()=>{});
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  /* الأصول: من المخزون فورًا، مع تحديث صامت في الخلفية */
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(res => {
        /* خطوط جوجل ترجع نوع cors، وكان الشرط القديم يرفضها فما تُخزّن أبدًا:
           كل فتحة تدفع رحلةً للشبكة، وبدون إنترنت ما تجي أصلًا. */
        if (res && (res.type === 'basic' || res.type === 'opaque' ||
                    res.type === 'cors')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{});
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
