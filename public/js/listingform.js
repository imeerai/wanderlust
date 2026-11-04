(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var form = $("#wlListingForm");
  if (!form) return;

  var title = $('[data-f="title"]'), place = $('[data-f="place"]'), price = $('[data-f="price"]');
  var pvTitle = $("#pvTitle"), pvPlace = $("#pvPlace"), pvPrice = $("#pvPrice"), gst = $("#gstHint"), pvImg = $("#pvImg");
  var fmt = function (n) { return Math.round(n).toLocaleString("en-US"); };

  function preview() {
    pvTitle.textContent = title.value.trim() || "Your listing title";
    pvPlace.textContent = place.value.trim() ? place.value.trim() + ", Pakistan" : "Location";
    var n = Number(price.value) || 0;
    pvPrice.textContent = "Rs " + fmt(n);
    gst.textContent = "Guests see Rs " + fmt(n * 1.18) + " when GST (18%) is included.";
  }
  [title, place, price].forEach(function (i) { i.addEventListener("input", preview); });
  preview();

  /* ---------- photo: pick or drop, check type/size, preview ---------- */
  var input = $("#photoInput"), zone = $("#dropZone"), msg = $("#photoMsg"), txt = $("#dropText");
  var OK = ["image/jpeg", "image/png", "image/webp"], MAX = 5 * 1024 * 1024, url = null;

  function take(file) {
    msg.textContent = "";
    if (!file) return;
    if (OK.indexOf(file.type) === -1) { msg.textContent = "Please choose a JPG, PNG or WebP image."; input.value = ""; return; }
    if (file.size > MAX) { msg.textContent = "That photo is over 5 MB. Please choose a smaller one."; input.value = ""; return; }
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(file);
    pvImg.src = url; pvImg.hidden = false;
    txt.textContent = file.name;
  }
  input.addEventListener("change", function () { take(input.files && input.files[0]); });
  ["dragenter", "dragover"].forEach(function (ev) { zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add("on"); }); });
  ["dragleave", "drop"].forEach(function (ev) { zone.addEventListener(ev, function () { zone.classList.remove("on"); }); });
  zone.addEventListener("drop", function (e) {
    e.preventDefault();
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    try { var dt = new DataTransfer(); dt.items.add(f); input.files = dt.files; } catch (err) { /* older browsers: use click */ }
    take(f);
  });

  /* ---------- checks: same limits the server enforces, one clear message per field ---------- */
  var RULES = {
    title: function (v) { return v.trim().length < 3 ? "Give your place a title (at least 3 characters)." : ""; },
    place: function (v) { return v.trim().length < 2 ? "Tell guests where it is (city or area)." : ""; },
    price: function (v) { var n = Number(v); return !v || !(n >= 10) ? "Set a price per night of at least Rs 10." : n > 10000000 ? "That price is too high." : ""; },
    guests: function (v) { var n = Number(v); return !(n >= 1 && n <= 30) || n % 1 ? "Choose between 1 and 30 guests." : ""; },
    desc: function (v) { return v.trim().length < 10 ? "Describe your place in at least 10 characters." : ""; }
  };
  function check(el) {
    var rule = RULES[el.getAttribute("data-rule")];
    if (!rule) return "";
    var text = rule(el.value), lab = el.closest("label"), m = lab && lab.querySelector("[data-msg]");
    el.setAttribute("aria-invalid", text ? "true" : "false");
    if (m) m.textContent = text;
    return text;
  }
  [].forEach.call(form.querySelectorAll("[data-rule]"), function (el) {
    el.addEventListener("blur", function () { check(el); });
    el.addEventListener("input", function () { if (el.getAttribute("aria-invalid") === "true") check(el); });
  });
  var desc = form.querySelector('[data-f="desc"]'), cnt = $("#descCount");
  if (desc && cnt) {
    var count = function () { cnt.textContent = desc.value.length + " / 2000"; };
    desc.addEventListener("input", count); count();
  }

  /* ---------- submit: check everything, jump to the first problem, then lock the button (no double posts) ---------- */
  form.addEventListener("submit", function (e) {
    if (form.dataset.busy) { e.preventDefault(); return; }
    var bad = null;
    [].forEach.call(form.querySelectorAll("[data-rule]"), function (el) { if (check(el) && !bad) bad = el; });
    if (!bad && input.required && !(input.files && input.files.length)) { msg.textContent = "Please add a photo of your place."; bad = zone; }
    if (bad) { e.preventDefault(); bad.scrollIntoView({ block: "center" }); if (bad.focus) bad.focus(); return; }
    form.dataset.busy = "1";
    var b = $("#saveBtn"); b.disabled = true; b.textContent = "Saving...";
  });
})();
