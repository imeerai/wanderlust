(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };

  /* ---------- photos that fail to load get a stock house photo instead of a blank box ---------- */
  var STOCK = ["photo-1568605114967-8130f3a36994", "photo-1564013799919-ab600027ffc6", "photo-1560185008-b033106af5c3", "photo-1572120360610-d971b9d7767c", "photo-1613490493576-7fde63acd811", "photo-1600585154340-be6161a56a0c", "photo-1505693416388-ac5ce068fe85", "photo-1522708323590-d24dbb6b0267"];
  document.addEventListener("error", function (e) {
    var img = e.target;
    if (!img || img.tagName !== "IMG" || img.getAttribute("data-fb") || img.hasAttribute("data-nofb")) return;
    var h = 0, src = img.getAttribute("src") || "x";
    for (var i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) >>> 0;
    img.setAttribute("data-fb", "1");
    img.src = "https://images.unsplash.com/" + STOCK[h % STOCK.length] + "?auto=format&fit=crop&w=900&q=75";
  }, true);

  /* ---------- flash messages: dismiss button + auto-hide for success ---------- */
  $$(".wl-flash [data-x]").forEach(function (b) {
    b.addEventListener("click", function () { var m = b.closest(".wl-msg"); if (m) m.parentNode.removeChild(m); });
  });
  $$(".wl-flash .wl-msg.ok").forEach(function (m) {
    setTimeout(function () { m.classList.add("out"); setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); }, 400); }, 6000);
  });

  /* ---------- toast ---------- */
  var toast = $("#wlToast"), toastTimer;
  function showToast(text, linkText, href) {
    if (!toast) return;
    toast.textContent = text;
    if (linkText) {
      var a = document.createElement("a");
      a.href = href; a.textContent = linkText;
      toast.appendChild(a);
    }
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 3500);
  }

  /* ---------- account menu + drawer ---------- */
  var btn = $("#wlAcctBtn"), menu = $("#wlMenu");
  function setMenu(open) {
    if (!btn || !menu) return;
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  if (btn && menu) {
    btn.addEventListener("click", function (e) { e.stopPropagation(); setMenu(menu.hidden); });
    menu.addEventListener("click", function (e) { e.stopPropagation(); });
  }
  var burger = $("#wlBurger"), drawer = $("#wlDrawer"), closeBtn = $("#wlDrawerClose");
  function setDrawer(open) {
    if (!drawer) return;
    drawer.hidden = !open;
    if (burger) burger.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.style.overflow = open ? "hidden" : "";
  }
  if (burger) burger.addEventListener("click", function () { setDrawer(true); });
  if (closeBtn) closeBtn.addEventListener("click", function () { setDrawer(false); });
  if (drawer) drawer.addEventListener("click", function (e) { if (e.target === drawer) setDrawer(false); });

  /* ---------- dark mode ---------- */
  var dark = $("#wlDark");
  function applyTheme(isDark) {
    if (isDark) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    if (dark) dark.setAttribute("aria-checked", isDark ? "true" : "false");
  }
  applyTheme(store.get("wl-theme") === "dark");
  if (dark) dark.addEventListener("click", function () {
    var on = dark.getAttribute("aria-checked") !== "true";
    store.set("wl-theme", on ? "dark" : "light"); applyTheme(on);
  });

  /* ---------- sticky header: soft shadow once the page has scrolled ---------- */
  var header = $("#wlHeader");
  if (header) {
    var tick = false;
    window.addEventListener("scroll", function () {
      if (tick) return;
      tick = true;
      window.requestAnimationFrame(function () { tick = false; header.classList.toggle("scrolled", (window.pageYOffset || 0) > 8); });
    }, { passive: true });
    header.classList.toggle("scrolled", (window.pageYOffset || 0) > 8);
  }

  /* ---------- search pill: Where / When / Who ---------- */
  var pill = $("#wlPill");
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var MS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var panels = {}, openSeg = null;
  var state = { start: null, end: null, adults: 0, children: 0, view: new Date() };
  var today = new Date(); today.setHours(0, 0, 0, 0);
  state.view = new Date(today.getFullYear(), today.getMonth(), 1);

  function iso(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function fmt(d) { return MS[d.getMonth()] + " " + d.getDate(); }

  function closePanels() {
    if (!pill) return;
    Object.keys(panels).forEach(function (k) { panels[k].hidden = true; });
    $$("[data-seg]", pill).forEach(function (s) { s.classList.remove("on"); if (s.tagName === "BUTTON") s.setAttribute("aria-expanded", "false"); });
    pill.classList.remove("open");
    openSeg = null;
  }
  function openPanel(name) {
    if (!pill) return;
    closePanels();
    openSeg = name;
    panels[name].hidden = false;
    pill.classList.add("open");
    var seg = $('[data-seg="' + name + '"]', pill);
    seg.classList.add("on");
    if (seg.tagName === "BUTTON") seg.setAttribute("aria-expanded", "true");
  }

  function renderCal() {
    var grid = $("#wlCal"), title = $("#wlMonth");
    if (!grid) return;
    var y = state.view.getFullYear(), m = state.view.getMonth();
    title.textContent = MONTHS[m] + " " + y;
    $("#wlPrev").disabled = (y === today.getFullYear() && m === today.getMonth());
    grid.textContent = "";
    var first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    for (var i = 0; i < first; i++) { var b = document.createElement("span"); b.className = "wl-day blank"; grid.appendChild(b); }
    for (var d = 1; d <= days; d++) {
      (function (d) {
        var date = new Date(y, m, d);
        var el = document.createElement("button");
        el.type = "button"; el.className = "wl-day"; el.textContent = d;
        el.setAttribute("aria-label", MONTHS[m] + " " + d + " " + y);
        if (date < today) el.disabled = true;
        var t = date.getTime();
        if ((state.start && t === state.start.getTime()) || (state.end && t === state.end.getTime())) el.classList.add("edge");
        else if (state.start && state.end && t > state.start.getTime() && t < state.end.getTime()) el.classList.add("mid");
        el.addEventListener("click", function () {
          if (!state.start || (state.start && state.end) || date <= state.start) { state.start = date; state.end = null; }
          else { state.end = date; }
          syncSummary(); renderCal();
          if (state.end) openPanel("who");
        });
        grid.appendChild(el);
      })(d);
    }
  }
  function syncSummary() {
    var when = $("#wlWhenTxt"), who = $("#wlWhoTxt"), g = state.adults + state.children;
    when.textContent = state.start ? fmt(state.start) + (state.end ? " - " + fmt(state.end) : "") : "Add dates";
    when.classList.toggle("set", !!state.start);
    who.textContent = g ? g + (g > 1 ? " guests" : " guest") : "Add guests";
    who.classList.toggle("set", g > 0);
    $("#wlIn").value = state.start ? iso(state.start) : "";
    $("#wlOut").value = state.end ? iso(state.end) : "";
    $("#wlGuests").value = g ? String(g) : "";
    $("#wlAdults").textContent = state.adults;
    $("#wlChildren").textContent = state.children;
    $$("[data-g][data-d='-1']", pill).forEach(function (b) { b.disabled = state[b.getAttribute("data-g")] <= 0; });
    $$("[data-g][data-d='1']", pill).forEach(function (b) { b.disabled = state[b.getAttribute("data-g")] >= 16; });
  }

  if (pill) {
    panels.where = $("#wlPWhere"); panels.when = $("#wlPWhen"); panels.who = $("#wlPWho");
    var where = $("#wlWhere");
    where.addEventListener("focus", function () { openPanel("where"); });
    where.addEventListener("click", function (e) { e.stopPropagation(); if (openSeg !== "where") openPanel("where"); });
    $$("button[data-seg]", pill).forEach(function (s) {
      s.addEventListener("click", function (e) {
        e.stopPropagation();
        var n = s.getAttribute("data-seg");
        if (openSeg === n) closePanels(); else openPanel(n);
      });
    });
    $$("[data-place]", pill).forEach(function (o) {
      o.addEventListener("click", function () { where.value = o.getAttribute("data-place"); openPanel("when"); });
    });
    $("#wlPrev").addEventListener("click", function () { state.view = new Date(state.view.getFullYear(), state.view.getMonth() - 1, 1); renderCal(); });
    $("#wlNext").addEventListener("click", function () { state.view = new Date(state.view.getFullYear(), state.view.getMonth() + 1, 1); renderCal(); });
    $$("[data-g]", pill).forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-g");
        state[k] = Math.max(0, Math.min(16, state[k] + Number(b.getAttribute("data-d"))));
        syncSummary();
      });
    });
    pill.addEventListener("click", function (e) { e.stopPropagation(); });
    // Empty fields are not sent, so the URL stays clean.
    pill.addEventListener("submit", function () {
      $$("input[type=hidden]", pill).forEach(function (i) { if (!i.value) i.disabled = true; });
      if (!where.value) where.disabled = true;
    });
    renderCal(); syncSummary();
  }

  document.addEventListener("click", function () { closePanels(); setMenu(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closePanels(); setMenu(false); setDrawer(false); } });

  /* ---------- row pagers (6 cards per page, 2 at a time like the design) ---------- */
  $$("[data-pager]").forEach(function (b) {
    var row = document.getElementById(b.getAttribute("data-pager"));
    if (!row) return;
    var cards = $$(".wl-card", row), per = function () { return Math.max(1, Math.floor(row.clientWidth / 200)); };
    var start = Number(row.getAttribute("data-start") || 0);
    function update() {
      var n = per(), max = Math.max(0, cards.length - n);
      start = Math.max(0, Math.min(max, start));
      row.setAttribute("data-start", start);
      cards.forEach(function (c, i) { c.hidden = i < start || i >= start + n; });
      $$('[data-pager="' + row.id + '"]').forEach(function (x) {
        x.disabled = (Number(x.getAttribute("data-dir")) < 0 && start === 0) || (Number(x.getAttribute("data-dir")) > 0 && start >= max);
      });
    }
    if (!row.getAttribute("data-bound")) {
      row.setAttribute("data-bound", "1");
      window.addEventListener("resize", update);
    }
    b.addEventListener("click", function () { start += 2 * Number(b.getAttribute("data-dir")); update(); });
    update();
  });

  /* ---------- hearts (wishlist) ---------- */
  var csrf = ($('meta[name="csrf-token"]') || {}).content || "";
  document.addEventListener("click", function (e) {
    var h = e.target.closest ? e.target.closest("[data-heart]") : null;
    if (!h) return;
    e.preventDefault(); e.stopPropagation();
    var id = h.getAttribute("data-heart");
    h.disabled = true;
    fetch("/wishlist/" + encodeURIComponent(id) + "/toggle", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Accept": "application/json", "x-csrf-token": csrf }
    }).then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (res) {
        if (res.s === 401) { window.location.href = "/login"; return; }
        if (!res.j.ok) { showToast(res.j.error || "Could not update your wishlist."); return; }
        $$('[data-heart="' + id + '"]').forEach(function (x) { x.setAttribute("aria-pressed", res.j.saved ? "true" : "false"); });
        var c = $("#wlCount");
        if (c) { c.textContent = res.j.count; c.hidden = !res.j.count; }
        var wp = $("[data-wishlist-page]");
        if (wp && !res.j.saved) {
          var card = h.closest("[data-wish-card]");
          if (card && card.parentNode) card.parentNode.removeChild(card);
          var left = $$("[data-wish-card]").length;
          var n = $("[data-wish-count]"); if (n) n.textContent = left + " saved";
          var em = $("[data-wish-empty]"); if (em) em.hidden = left > 0;
        }
        if (res.j.saved) showToast("Saved to Wishlist", "View wishlist", "/wishlist"); else showToast("Removed from Wishlist");
      })
      .catch(function () { showToast("Network error. Please try again."); })
      .then(function () { h.disabled = false; });
  });

  /* ---------- GST switch ---------- */
  function applyGst(on) {
    $$("[data-price]").forEach(function (el) {
      var p = Number(el.getAttribute("data-price")) || 0;
      el.textContent = (el.hasAttribute("data-bare") ? "" : "Rs ") + Math.round(on ? p * 1.18 : p).toLocaleString("en-US");
    });
    $$("[data-gst-note]").forEach(function (el) { el.hidden = !on; });
    $$("[data-gst-toggle]").forEach(function (t) { t.setAttribute("aria-checked", on ? "true" : "false"); });
  }
  $$("[data-gst-toggle]").forEach(function (t) {
    t.addEventListener("click", function () {
      var on = t.getAttribute("aria-checked") !== "true";
      store.set("wl-gst", on ? "1" : "0"); applyGst(on);
    });
  });
  if ($("[data-gst-toggle]")) applyGst(store.get("wl-gst") === "1");


  /* ---------- filter modal ---------- */
  var openers = $$("[data-open]");
  function setModal(m, open) {
    if (!m) return;
    m.hidden = !open;
    document.body.style.overflow = open ? "hidden" : "";
    if (open) { var f = $("input,button", m); if (f) f.focus(); }
  }
  openers.forEach(function (o) {
    o.addEventListener("click", function (e) { e.stopPropagation(); setModal(document.getElementById(o.getAttribute("data-open")), true); });
  });
  $$(".wl-modal").forEach(function (m) {
    m.addEventListener("click", function (e) { if (e.target === m || (e.target.closest && e.target.closest("[data-close]"))) setModal(m, false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setModal(m, false); });
  });
  var price = $("#wlPrice"), ff = $("#wlFilterForm");
  if (price && ff) {
    var chips = $$("[data-price-chip]", ff);
    var syncChips = function () {
      chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c.getAttribute("data-price-chip")) === String(price.value || "") ? "true" : "false"); });
    };
    chips.forEach(function (c) {
      c.addEventListener("click", function () { price.value = c.getAttribute("data-price-chip"); syncChips(); });
    });
    price.addEventListener("input", syncChips); syncChips();
    ff.addEventListener("submit", function () {
      if (!price.value || Number(price.value) <= 0) price.disabled = true;
      var any = $('input[name="minRating"][value="0"]', ff);
      if (any && any.checked) any.disabled = true;
    });
  }

  /* ---------- stay type picker (phones) ---------- */
  $$("[data-cat-select]").forEach(function (sel) {
    sel.addEventListener("change", function () { if (/^\/\?cat=/.test(sel.value)) window.location.href = sel.value; });
  });

  /* ---------- inspiration tabs ---------- */
  $$("[data-itab]").forEach(function (t) {
    t.addEventListener("click", function () {
      var n = t.getAttribute("data-itab");
      $$("[data-itab]").forEach(function (x) { x.setAttribute("aria-selected", x === t ? "true" : "false"); });
      $$(".wl-ipanel").forEach(function (p) { p.hidden = p.id !== "ipanel" + n; });
    });
  });
})();
