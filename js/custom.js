/* ==========================================================================
   自定义首页横幅：向 Redefine 的 home banner 注入
   1) 晕染圆球背景（.aurora-bg > .aurora-blob * 4）
   2) 鼠标揭示文字（SVG 双层文字，圆孔跟随光标，带缓动）
   兼容 swup 单页导航：回到首页时重新初始化
   ========================================================================== */
(function () {
  'use strict';

  var CONFIG = {
    basePrefix: '你好，我是',   // 中文前缀
    topPrefix: "HELLO，I'M",    // 英文前缀（逗号与中文一致用全角）
    name: 'laimanxi',           // 两行中保持一致、像素级对齐的名字
    radius: 170,          // 揭示圆孔半径（px）
    easePos: 0.18,        // 圆心跟随缓动系数
    easeRadius: 0.12      // 圆孔缩放缓动系数
  };

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function isCoarsePointer() {
    return window.matchMedia('(hover: none), (pointer: coarse)').matches;
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---------- 注入全局晕染背景（所有页面） ---------- */
  function buildAurora() {
    if (document.querySelector('.aurora-global')) return;

    var layer = document.createElement('div');
    layer.className = 'aurora-global';

    var bg = document.createElement('div');
    bg.className = 'aurora-bg';
    ['b1', 'b2', 'b3', 'b4'].forEach(function (cls) {
      var blob = document.createElement('div');
      blob.className = 'aurora-blob ' + cls;
      bg.appendChild(blob);
    });

    layer.appendChild(bg);
    document.body.appendChild(layer);
  }

  /* ---------- 揭示文字布局 ----------
     交互模式：以中文行为准居中；英文行的 laimanxi 与中文行严格对齐，
     英文前缀（HELLO, I'M）允许向左超出中文行左缘（用户明确要求）。
     静态模式（触屏/减弱动态）：两行各自独立居中、上下排列。 */
  function measure(svg, p, n) {
    p.removeAttribute('textLength');
    p.removeAttribute('lengthAdjust');
    return {
      fs: parseFloat(window.getComputedStyle(svg).fontSize) || 16,
      pw: p.getComputedTextLength(),
      nw: n.getComputedTextLength()
    };
  }

  function place(p, n, x, y) {
    p.setAttribute('x', x);
    p.setAttribute('y', y);
    n.setAttribute('x', x);
    n.setAttribute('y', y);
  }

  function layout(base, top, staticMode) {
    var p1 = base.querySelector('.reveal-prefix');
    var n1 = base.querySelector('.reveal-name');
    var p2 = top.querySelector('.reveal-prefix');
    var n2 = top.querySelector('.reveal-name');
    if (!p1 || !n1 || !p2 || !n2) return;

    var pad = 8;
    var m1 = measure(base, p1, n1);
    var m2 = measure(top, p2, n2);

    if (staticMode) {
      // 各自独立成框、各自居中
      [[base, p1, n1, m1], [top, p2, n2, m2]].forEach(function (item) {
        var svg = item[0], p = item[1], n = item[2], m = item[3];
        var w = Math.ceil(m.pw + m.nw + pad);
        var h = Math.ceil(m.fs * 1.35);
        svg.setAttribute('width', w);
        svg.setAttribute('height', h);
        svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
        svg.style.marginLeft = '';
        place(p, n, m.pw + pad / 2, (m.fs * 1.02).toFixed(1));
      });
      return;
    }

    // 交互模式：框宽 = 中文行宽（中文居中）；
    // 英文前缀若更宽，viewBox 向左扩展 leftOver 并用负 margin 补偿居中
    var w = Math.ceil(m1.pw + m1.nw + pad);
    var h = Math.ceil(m1.fs * 1.35);
    var joinX = m1.pw + pad / 2;                 // laimanxi 的起笔位置（两层共用）
    var leftOver = Math.max(0, Math.ceil(m2.pw - joinX));
    var wBox = w + leftOver;
    var y = (m1.fs * 1.02).toFixed(1);

    [base, top].forEach(function (svg) {
      svg.setAttribute('width', wBox);
      svg.setAttribute('height', h);
      svg.setAttribute('viewBox', (-leftOver) + ' 0 ' + wBox + ' ' + h);
      svg.style.marginLeft = (-leftOver / 2) + 'px';
    });

    var x = joinX;
    place(p1, n1, x, y);
    place(p2, n2, x, y);
  }

  function buildLayer(cls, prefixText) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'reveal-layer ' + cls);

    var prefix = document.createElementNS(SVG_NS, 'text');
    prefix.setAttribute('class', 'reveal-prefix');
    prefix.setAttribute('text-anchor', 'end');
    prefix.textContent = prefixText + ' ';

    var name = document.createElementNS(SVG_NS, 'text');
    name.setAttribute('class', 'reveal-name');
    name.setAttribute('text-anchor', 'start');
    name.textContent = CONFIG.name;

    svg.appendChild(prefix);
    svg.appendChild(name);
    return svg;
  }

  /* ---------- 注入揭示文字并绑定鼠标交互 ---------- */
  function buildReveal(banner) {
    var content = banner.querySelector('.content');
    if (!content || content.querySelector('.reveal-wrap')) return;

    var wrap = document.createElement('div');
    wrap.className = 'reveal-wrap';

    var base = buildLayer('reveal-base', CONFIG.basePrefix);
    var top = buildLayer('reveal-top', CONFIG.topPrefix);
    top.setAttribute('aria-hidden', 'true');

    wrap.appendChild(base);
    wrap.appendChild(top);
    content.insertBefore(wrap, content.firstChild);

    // 触屏设备或系统要求减弱动态：静态双行展示，不绑定鼠标事件
    var staticMode = isCoarsePointer() || prefersReducedMotion();
    if (staticMode) {
      wrap.classList.add('reveal-static');
    }

    function relayout() {
      layout(base, top, staticMode);
    }
    relayout();
    // 字体是异步加载的：fonts.ready 可能在字体开始使用前就已 resolve，
    // 这里显式请求加载相关字体，加载完成后重新测量，避免按回退字体布局导致裁切
    if (document.fonts && document.fonts.load) {
      document.fonts.load('900 96px "Noto Sans SC"', CONFIG.basePrefix).then(relayout).catch(function () {});
      document.fonts.load('96px "Chillax-Variable"', CONFIG.name).then(relayout).catch(function () {});
    } else if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(relayout);
    }
    // 兜底：延迟再测一次，覆盖极端时序
    setTimeout(relayout, 1200);
    window.addEventListener('resize', relayout);

    if (staticMode) {
      return;
    }

    var tx = 0, ty = 0;   // 目标圆心
    var cx = 0, cy = 0;   // 当前圆心（缓动逼近目标）
    var tr = 0, r = 0;    // 目标/当前半径
    var rafId = null;

    function tick() {
      rafId = requestAnimationFrame(function () {
        cx += (tx - cx) * CONFIG.easePos;
        cy += (ty - cy) * CONFIG.easePos;
        r += (tr - r) * CONFIG.easeRadius;

        wrap.style.setProperty('--mx', cx.toFixed(1) + 'px');
        wrap.style.setProperty('--my', cy.toFixed(1) + 'px');
        wrap.style.setProperty('--r', r.toFixed(1) + 'px');

        if (tr > 0 || r > 0.5) {
          tick();
        } else {
          rafId = null;
        }
      });
    }

    banner.addEventListener('mousemove', function (e) {
      // 坐标必须相对于 SVG 本身（遮罩在 SVG 上），不能相对于 wrap
      var rect = base.getBoundingClientRect();
      tx = e.clientX - rect.left;
      ty = e.clientY - rect.top;
      tr = CONFIG.radius;
      if (!rafId) tick();
    });

    banner.addEventListener('mouseleave', function () {
      tr = 0; // 半径缓动收缩至 0，圆孔消失
    });
  }

  /* ---------- 入口：背景全站注入，揭示文字仅首页 ---------- */
  function initCustom() {
    buildAurora();
    var banner = document.querySelector('.home-banner-container');
    if (banner) buildReveal(banner);
  }

  document.addEventListener('DOMContentLoaded', initCustom);
  // swup 单页导航时重新初始化（不同 swup 版本的事件名都监听，取先触发者）
  ['swup:contentReplaced', 'swup:page:view', 'swup:pageView'].forEach(function (evt) {
    document.addEventListener(evt, initCustom);
  });
})();
setTimeout(function () {
  var layer = document.querySelector('.aurora-global');
  if (!layer) { document.title = 'NO-LAYER'; return; }
  var blob = layer.querySelector('.aurora-blob');
  var r = layer.getBoundingClientRect();
  var b = blob.getBoundingClientRect();
  document.title = JSON.stringify({
    rect: [r.width, r.height],
    blobRect: [Math.round(b.width), Math.round(b.height), Math.round(b.left), Math.round(b.top)],
    layerZ: window.getComputedStyle(layer).zIndex,
    layerBg: window.getComputedStyle(layer).backgroundColor,
    bodyBg: window.getComputedStyle(document.body).backgroundColor,
    htmlBg: window.getComputedStyle(document.documentElement).backgroundColor
  });
}, 2500);


