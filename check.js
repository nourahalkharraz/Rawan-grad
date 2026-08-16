/*  فحص شامل لصفحة الدعوة.
 *  الاستخدام:  node check.js index.html
 *
 *  يفحص ما لا تراه العين بسهولة:
 *   ١) نسبة كل صورة المعلنة مقابل أبعادها الحقيقية
 *   ٢) عناصر عالقة على شفافية صفر (بق فئة .r الشهير)
 *   ٣) تباعد حروف على نص عربي — يفصل الحروف
 *   ٤) تباين كل نص مقابل خلفيته الفعلية
 *   ٥) بقايا ألوان من اللوحة العنّابية القديمة
 *   ٦) كثافة الكونفيتي المرئية فعلًا على الشاشة
 */
const { chromium } = require('playwright');
const path = require('path');

const FILE = process.argv[2] || 'index.html';
const URL  = 'file://' + path.resolve(FILE);
const CHROME = process.env.CHROME_PATH || undefined;

const OLD_BURGUNDY = ['rgb(168, 55, 69)','rgb(142, 39, 51)','rgb(200, 67, 79)',
                      'rgb(176, 66, 80)','rgb(126, 34, 48)','rgb(179, 112, 124)'];

(async () => {
  const browser = await chromium.launch(CHROME ? {executablePath:CHROME} : {});
  const page = await browser.newPage({ viewport:{width:390,height:844} });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type()==='error') errs.push('CONSOLE: ' + m.text()); });

  await page.goto(URL);
  await page.waitForTimeout(900);

  /* ── ٦) كثافة الكونفيتي: نقرأ قناة ألفا من الكانفس مباشرة ──────────────
     قياس اللقطات لا ينفع هنا — القطع عشوائية فتختلف النتيجة كل مرة.
     قراءة الكانفس نفسه ثابتة، ونضربها في شفافية الطبقة وقتها.          */
  const sampleInk = async (frames = 30) => {
    let sum = 0;
    for (let i = 0; i < frames; i++) {
      sum += await page.evaluate(() => {
        const cv = document.getElementById('fx');
        if (!cv) return 0;
        const d = cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
        let s = 0;
        for (let k = 3; k < d.length; k += 4) s += d[k];
        return (s / (d.length/4) / 255) * (+getComputedStyle(cv).opacity);
      });
      await page.waitForTimeout(55);
    }
    return sum / frames;
  };

  const inkIdle = await sampleInk(20);            // المطر وحده قبل الفتح
  await page.evaluate(() => openIt());
  await page.waitForTimeout(1100);
  const inkOpen = await sampleInk(30);            // المطر + الانفجار

  await page.waitForTimeout(6000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(700);

  const r = await page.evaluate((OLD) => {
    const out = {};
    const AR = /[؀-ۿ]/;

    out.aspect = [];
    const seen = new Set();
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.aspectRatio === 'auto') continue;
      const m = cs.backgroundImage.match(/url\("(data:image\/[^"]+)"\)/);
      if (!m || seen.has(el.className)) continue;
      seen.add(el.className);
      out.aspect.push({ cls: el.className, declared: cs.aspectRatio, src: m[1] });
    }

    out.stuck = [...document.querySelectorAll('.r')]
      .filter(e => getComputedStyle(e).opacity === '0')
      .map(e => e.className);

    out.spacing = [];
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length) continue;
      const t = (el.textContent||'').trim();
      if (!t || !AR.test(t)) continue;
      const ls = getComputedStyle(el).letterSpacing;
      if (ls !== 'normal' && parseFloat(ls) > 0.3)
        out.spacing.push({ cls: el.className||el.tagName, ls, text: t.slice(0,26) });
    }

    const lum = c => { const f = v => (v/=255) <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4;
      return .2126*f(c[0]) + .7152*f(c[1]) + .0722*f(c[2]); };
    const parse = s => (s.match(/[\d.]+/g)||[]).map(Number);
    const bgOf = el => { let n = el;
      while (n && n !== document.documentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c.length >= 3 && (c[3] === undefined || c[3] > .5)) return c;
        n = n.parentElement; }
      return [253,245,238]; };

    out.contrast = [];
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length) continue;
      const t = (el.textContent||'').trim();
      if (!t) continue;
      const cs = getComputedStyle(el), bx = el.getBoundingClientRect();
      if (bx.width < 4 || cs.opacity === '0' || cs.visibility === 'hidden') continue;
      const fg = parse(cs.color), bg = bgOf(el);
      if (fg.length < 3) continue;
      if (fg[3] !== undefined && fg[3] < .95) {
        const a = fg[3];
        for (let i = 0; i < 3; i++) fg[i] = fg[i]*a + bg[i]*(1-a);
      }
      const l1 = lum(fg), l2 = lum(bg);
      const cr = (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
      const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
      const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
      if (cr < need)
        out.contrast.push({ cls: el.className||el.tagName, text: t.slice(0,24),
                            ratio: +cr.toFixed(2), need, size: Math.round(size) });
    }

    out.old = [];
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      for (const p of ['color','backgroundColor','borderTopColor','borderInlineStartColor'])
        if (OLD.includes(cs[p])) out.old.push(`${el.className||el.tagName}.${p}`);
    }

    out.hOverflow = document.documentElement.scrollWidth > window.innerWidth + 1;
    return out;
  }, OLD_BURGUNDY);

  // أبعاد الصور الحقيقية
  const real = await page.evaluate(async (list) => {
    const res = [];
    for (const it of list) {
      const img = new Image();
      await new Promise(k => { img.onload = k; img.onerror = k; img.src = it.src; });
      res.push({ ...it, natural: img.naturalWidth + 'x' + img.naturalHeight,
                 ratio: img.naturalWidth / img.naturalHeight });
    }
    return res;
  }, r.aspect);

  const ok = s => '  ✓ ' + s;
  const no = s => '  ✗ ' + s;
  console.log(`\n═══ فحص ${path.basename(FILE)} ═══\n`);

  console.log('نِسب الصور');
  let aspectBad = 0;
  for (const x of real) {
    const d = x.declared.split('/').map(Number);
    const dec = d.length === 2 ? d[0]/d[1] : Number(x.declared);
    const off = Math.abs(dec - x.ratio) / x.ratio;
    if (off > 0.03) { aspectBad++; console.log(no(`${x.cls}: معلنة ${dec.toFixed(3)} والحقيقية ${x.ratio.toFixed(3)} (${x.natural}) — فرق ${Math.round(off*100)}%`)); }
  }
  if (!aspectBad) console.log(ok(`${real.length} صورة، كلها مطابقة`));

  console.log('\nعناصر عالقة على شفافية صفر');
  console.log(r.stuck.length ? r.stuck.map(no).join('\n') : ok('ولا وحدة'));

  console.log('\nتباعد حروف على نص عربي');
  console.log(r.spacing.length ? r.spacing.map(s=>no(`${s.cls}: ${s.ls} — "${s.text}"`)).join('\n') : ok('ولا وحدة'));

  console.log('\nتباين النصوص');
  console.log(r.contrast.length
    ? r.contrast.map(c=>no(`${c.cls} ${c.ratio} (يحتاج ${c.need}) ${c.size}px — "${c.text}"`)).join('\n')
    : ok('كل النصوص تحقق الحد'));

  console.log('\nبقايا اللوحة العنّابية');
  console.log(r.old.length ? r.old.map(no).join('\n') : ok('ولا وحدة'));

  console.log('\nكثافة الكونفيتي المرئية (متوسط ألفا × شفافية الطبقة، ×10⁻⁴)');
  console.log(`     قبل الفتح (المطر وحده): ${(inkIdle*1e4).toFixed(2)}`);
  console.log(`     أثناء الفتح (مع الانفجار): ${(inkOpen*1e4).toFixed(2)}`);
  console.log('     قارني هذين الرقمين قبل وبعد أي تعديل على الشفافية.');

  console.log('\nعام');
  console.log(r.hOverflow ? no('تمدد أفقي') : ok('لا تمدد أفقي'));
  console.log(errs.length ? no('أخطاء: ' + errs.join(' | ')) : ok('ولا خطأ جافاسكربت'));

  const problems = aspectBad + r.stuck.length + r.spacing.length + r.contrast.length + r.old.length + (r.hOverflow?1:0) + errs.length;
  console.log(`\n${problems ? '✗ ' + problems + ' ملاحظة' : '✓ كل الفحوص نظيفة'}\n`);

  await browser.close();
  process.exit(problems ? 1 : 0);
})();
