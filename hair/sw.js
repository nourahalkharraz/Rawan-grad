/* عامل الخدمة.
   القاعدة: الصفحة نفسها من الشبكة أولًا (عشان أي تحديث يوصلك فورًا)،
   والأصول الثابتة من المخزون أولًا (عشان السرعة). وبدون إنترنت: كل شي من المخزون. */
const CACHE = 'hair-v14';
const CORE = ['./','./index.html','./manifest.webmanifest',
              './icon-192.png','./icon-512.png','./icon-maskable.png',
              './st/bow.png','./st/bubble.png','./st/peonywhite.png','./st/branch.png',
              './st/waterflower.png','./st/blossoms.png','./st/peonypink.png','./st/heartbub.png',
              './st/butterfly.png','./st/cosmos.png','./st/bowheart.png','./st/lemon.png',
              './st/arbor.png','./st/dove.png',
              './gen/garden.jpg','./gen/bub1.png','./gen/bub2.png',
              './gen/bub3.png','./gen/bub4.png','./gen/bub5.png','./gen/bub6.png',
              './gen/bub7.png','./gen/bub8.png',
              './gen/bub9.png','./gen/bub10.png',
              './gen/bub11.png','./gen/bub12.png',
              './gen/bub13.png','./gen/bub14.png',
              './gen/bub15.png','./gen/bub16.png',
              './gen/bub17.png','./gen/bub18.png',
              './gen/bub19.png','./gen/bub20.png',
              './gen/bub21.png','./gen/bub22.png','./gen/bub23.png','./gen/bub24.png',
              './gen/bub25.png','./gen/bub26.png','./gen/bub27.png',

              './apple-touch-icon.png',
              './fonts/ArefRuqaa-700-arabic.woff2','./fonts/ArefRuqaa-700-latin.woff2',
              './fonts/Amiri-400-arabic.woff2','./fonts/Amiri-400-latin.woff2',
              './fonts/Amiri-700-arabic.woff2','./fonts/Amiri-700-latin.woff2',
              './fonts/Almarai-400-arabic.woff2','./fonts/Almarai-400-latin.woff2',
              './fonts/Almarai-800-arabic.woff2','./fonts/Almarai-800-latin.woff2'];

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
    /* المخزون أولًا: الصفحة تفتح فورًا. وبالخلفية نجيب النسخة الجديدة
       فتظهر من الفتحة الجاية — أسرع فتح مقابل تأخير تحديث بفتحة وحدة. */
    e.respondWith(
      caches.match('./index.html').then(hit => {
        const net = fetch(e.request).then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(()=>{});
          }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
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
