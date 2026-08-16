const { chromium } = require('playwright');
const P = '/tmp/claude-0/-home-user-hereera/bb01ce01-efc4-589c-b3d4-1f7a67a4216f/scratchpad/';

(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const p = await b.newPage({viewport:{width:390,height:844}});
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type()==='error') errs.push('CONSOLE: ' + m.text()); });

  await p.goto('file://' + P + 'demo.html');
  await p.waitForTimeout(900);
  await p.evaluate(() => openIt());
  await p.waitForTimeout(6500);                 // انتظر انكشاف كل الأقسام
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(2500);                 // شغّل مراقب الظهور لكل الأقسام
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(800);

  const report = await p.evaluate(() => {
    const out = {};

    // ١) نسبة العرض/الارتفاع المعلنة مقابل أبعاد الصورة الحقيقية
    out.aspect = [];
    const seen = new Set();
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      const ar = cs.aspectRatio;
      const bg = cs.backgroundImage;
      if (ar === 'auto' || !bg || bg === 'none') continue;
      const m = bg.match(/url\("(data:image\/[^"]+)"\)/);
      if (!m) continue;
      const key = el.className + '|' + ar;
      if (seen.has(key)) continue;
      seen.add(key);
      out.aspect.push({ cls: el.className || el.tagName, declared: ar, src: m[1].slice(0, 30) });
    }

    // ٢) عناصر تحمل فئة r (أنيميشن الظهور، تبدأ بشفافية صفر)
    out.rClass = [...document.querySelectorAll('.r')].map(e => ({
      cls: e.className, tag: e.tagName,
      opacityNow: getComputedStyle(e).opacity
    }));

    // ٣) عناصر مخفية بالكامل رغم أنها ليست مقصودة للإخفاء
    out.invisible = [...document.querySelectorAll('*')].filter(e => {
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return cs.opacity === '0' && cs.display !== 'none' && cs.visibility !== 'hidden'
             && r.width > 4 && r.height > 4 && !e.closest('#ov') && e.id !== 'back';
    }).map(e => ({ cls: e.className || e.tagName, w: Math.round(e.getBoundingClientRect().width) }));

    // ٤) تباعد الحروف على نص عربي (يفصل الحروف)
    const AR = /[؀-ۿ]/;
    out.arabicSpacing = [];
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length) continue;
      const t = (el.textContent || '').trim();
      if (!t || !AR.test(t)) continue;
      const ls = getComputedStyle(el).letterSpacing;
      if (ls !== 'normal' && parseFloat(ls) > 0.3)
        out.arabicSpacing.push({ cls: el.className || el.tagName, ls, text: t.slice(0, 26) });
    }

    // ٥) تباين كل نص مقابل خلفيته الفعلية
    const lum = c => { const f = v => (v/=255) <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4;
      return .2126*f(c[0]) + .7152*f(c[1]) + .0722*f(c[2]); };
    const parse = s => (s.match(/[\d.]+/g) || []).map(Number);
    const bgOf = el => { let n = el;
      while (n && n !== document.documentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c.length >= 3 && (c[3] === undefined || c[3] > .5)) return c;
        n = n.parentElement; }
      return [253, 245, 238]; };
    out.contrast = [];
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length) continue;
      const t = (el.textContent || '').trim();
      if (!t) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width < 4 || cs.opacity === '0' || cs.visibility === 'hidden') continue;
      const fg = parse(cs.color), bg = bgOf(el);
      if (fg.length < 3) continue;
      if (fg[3] !== undefined && fg[3] < .95) {           // ادمج الشفافية مع الخلفية
        const a = fg[3];
        for (let i = 0; i < 3; i++) fg[i] = fg[i]*a + bg[i]*(1-a);
      }
      const l1 = lum(fg), l2 = lum(bg);
      const cr = (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
      const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
      const large = size >= 24 || (size >= 18.66 && bold);
      const need = large ? 3 : 4.5;
      if (cr < need)
        out.contrast.push({ cls: el.className || el.tagName, text: t.slice(0, 24),
          ratio: +cr.toFixed(2), need, size: Math.round(size) });
    }

    // ٦) ألوان عنّابية متبقية من اللوحة القديمة
    const OLD = ['rgb(168, 55, 69)','rgb(142, 39, 51)','rgb(200, 67, 79)','rgb(176, 66, 80)',
                 'rgb(126, 34, 48)','rgb(179, 112, 124)'];
    out.oldColors = [];
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      for (const prop of ['color','backgroundColor','borderTopColor','borderInlineStartColor']) {
        if (OLD.includes(cs[prop]))
          out.oldColors.push({ cls: el.className || el.tagName, prop, val: cs[prop] });
      }
    }

    out.hOverflow = document.documentElement.scrollWidth > window.innerWidth + 1;
    out.sections = [...document.querySelectorAll('main .card > *')].map(e => e.className || e.tagName);
    return out;
  });

  // أبعاد الصور الحقيقية
  const real = await p.evaluate(async () => {
    const res = [];
    const seen = new Set();
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.aspectRatio === 'auto') continue;
      const m = cs.backgroundImage.match(/url\("(data:image\/[^"]+)"\)/);
      if (!m) continue;
      const k = el.className;
      if (seen.has(k)) continue; seen.add(k);
      const img = new Image();
      await new Promise(r => { img.onload = r; img.onerror = r; img.src = m[1]; });
      res.push({ cls: k, declared: cs.aspectRatio, natural: img.naturalWidth + 'x' + img.naturalHeight,
                 realRatio: (img.naturalWidth/img.naturalHeight).toFixed(3) });
    }
    return res;
  });

  console.log('════ أقسام الدعوة ════');
  console.log(report.sections.join(' · '));

  console.log('\n════ ١) نِسب الصور المعلنة مقابل الحقيقية ════');
  for (const r of real) {
    const d = r.declared.split('/').map(Number);
    const dec = d.length === 2 ? (d[0]/d[1]) : Number(r.declared);
    const off = Math.abs(dec - r.realRatio) / r.realRatio;
    console.log(`  ${r.cls.padEnd(16)} معلنة ${r.declared.padEnd(10)} (${dec.toFixed(3)})  حقيقية ${r.natural.padEnd(10)} (${r.realRatio})  ${off > 0.03 ? '✗ فرق ' + Math.round(off*100) + '%' : '✓'}`);
  }

  console.log('\n════ ٢) عناصر بفئة r ════');
  const structural = report.rClass.filter(e => /env-|fc|lace|seal|dball|orn|frame/.test(e.cls));
  console.log(`  المجموع ${report.rClass.length} — منها هيكلية/زخرفية: ${structural.length ? structural.map(e=>e.cls).join(', ') : 'ولا وحدة ✓'}`);
  const stillHidden = report.rClass.filter(e => e.opacityNow === '0');
  console.log(`  ما زالت شفافيتها صفر بعد الكشف: ${stillHidden.length ? stillHidden.map(e=>e.cls).join(', ') + ' ✗' : 'ولا وحدة ✓'}`);

  console.log('\n════ ٣) عناصر مرئية المفروض لكن شفافيتها صفر ════');
  console.log(report.invisible.length ? report.invisible.map(e=>`  ${e.cls} (${e.w}px) ✗`).join('\n') : '  ولا وحدة ✓');

  console.log('\n════ ٤) تباعد حروف على نص عربي ════');
  console.log(report.arabicSpacing.length ? report.arabicSpacing.map(e=>`  ${e.cls}: ${e.ls} — "${e.text}" ✗`).join('\n') : '  ولا وحدة ✓');

  console.log('\n════ ٥) نصوص تحت حد التباين ════');
  console.log(report.contrast.length ? report.contrast.map(e=>`  ${String(e.cls).padEnd(14)} ${e.ratio} (يحتاج ${e.need}) ${e.size}px — "${e.text}"`).join('\n') : '  ولا وحدة ✓');

  console.log('\n════ ٦) ألوان عنّابية متبقية ════');
  console.log(report.oldColors.length ? report.oldColors.map(e=>`  ${e.cls}.${e.prop} = ${e.val} ✗`).join('\n') : '  ولا وحدة ✓');

  console.log('\n════ عام ════');
  console.log('  تمدد أفقي:', report.hOverflow ? 'نعم ✗' : 'لا ✓');
  console.log('  أخطاء جافاسكربت:', errs.length ? errs.join(' | ') : 'ولا خطأ ✓');

  await b.close();
})();
