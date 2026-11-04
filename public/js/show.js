(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var MS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DAY = 86400000;

  /* ---------- map: pin, directions link, and a route from the visitor's own location ---------- */
  var mapEl = $("#listingMap");
  if (mapEl && window.L) {
    var Lf = window.L;
    var lat = Number(mapEl.dataset.lat), lng = Number(mapEl.dataset.lng), zoom = Number(mapEl.dataset.zoom) || 10;
    var map = Lf.map(mapEl, { scrollWheelZoom: false }).setView([lat, lng], zoom);
    Lf.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19, attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
    }).addTo(map);
    map.on("click", function () { map.scrollWheelZoom.enable(); });
    var dirUrl = "https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lng + "&travelmode=driving";
    var pop = document.createElement("div");
    var pt = document.createElement("b"); pt.textContent = mapEl.dataset.label || "Listing";
    var pa = document.createElement("a"); pa.href = dirUrl; pa.target = "_blank"; pa.rel = "noopener noreferrer";
    pa.textContent = "Get directions from my location"; pa.style.cssText = "display:block;margin-top:6px;font-weight:700;color:#e61e4d;text-decoration:underline";
    pop.appendChild(pt); pop.appendChild(pa);
    var pin = Lf.marker([lat, lng]).addTo(map).bindPopup(pop);
    if (zoom > 5) pin.openPopup();

    var locBtn = $("#mapLocate"), routeOut = $("#mapRoute"), routeLayer = null, meMark = null;
    var say = function (t) { routeOut.textContent = t; routeOut.hidden = !t; };
    var km = function (m) { return m >= 1000 ? (m / 1000).toFixed(m >= 100000 ? 0 : 1) + " km" : Math.round(m) + " m"; };
    var dur = function (s) { var m = Math.round(s / 60), h = Math.floor(m / 60); return h ? h + " h " + (m % 60) + " min" : m + " min"; };
    var straight = function (a, b) {
      var R = 6371000, r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
      var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    };
    function draw(me) {
      if (routeLayer) map.removeLayer(routeLayer);
      if (meMark) map.removeLayer(meMark);
      meMark = Lf.circleMarker(me, { radius: 8, color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }).addTo(map).bindTooltip("You are here");
      var url = "https://router.project-osrm.org/route/v1/driving/" + me[1] + "," + me[0] + ";" + lng + "," + lat + "?overview=full&geometries=geojson";
      var ctl = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);
      fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) { return r.json(); }).then(function (j) {
        clearTimeout(timer);
        if (!j.routes || !j.routes.length) throw new Error("no route");
        var rt = j.routes[0];
        routeLayer = Lf.geoJSON(rt.geometry, { style: { color: "#e61e4d", weight: 5, opacity: .9 } }).addTo(map);
        map.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });
        say("By car: about " + km(rt.distance) + ", " + dur(rt.duration) + ". Open Google Maps for turn-by-turn directions.");
      }).catch(function () {
        clearTimeout(timer);
        routeLayer = Lf.polyline([me, [lat, lng]], { color: "#e61e4d", weight: 4, dashArray: "8 8" }).addTo(map);
        map.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });
        say("About " + km(straight(me, [lat, lng])) + " in a straight line. Road route is unavailable right now, so use Open in Google Maps.");
      });
    }
    if (locBtn) locBtn.addEventListener("click", function () {
      if (!navigator.geolocation) { say("Your browser cannot share your location. Use Open in Google Maps instead."); return; }
      locBtn.disabled = true; say("Finding your location...");
      navigator.geolocation.getCurrentPosition(function (p) {
        locBtn.disabled = false; say(""); draw([p.coords.latitude, p.coords.longitude]);
      }, function (err) {
        locBtn.disabled = false;
        say(err && err.code === 1 ? "Location is blocked for this site. Allow it in your browser settings, or use Open in Google Maps." : "Could not get your location. Use Open in Google Maps instead.");
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
    });
  }

  /* ---------- share ---------- */
  var share = $("[data-share]");
  if (share) share.addEventListener("click", function () {
    var url = location.href;
    if (navigator.share) { navigator.share({ title: share.dataset.title, url: url }).catch(function () {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { share.lastChild.textContent = "Link copied"; setTimeout(function () { share.lastChild.textContent = "Share"; }, 2000); }, function () {});
    }
  });

  /* ---------- heart label ---------- */
  var hb = $(".wl-heart-b");
  if (hb) {
    var syncHeart = function () { var l = $(".lbl", hb); if (l) l.textContent = hb.getAttribute("aria-pressed") === "true" ? "Saved" : "Save"; };
    syncHeart();
    new MutationObserver(syncHeart).observe(hb, { attributes: true, attributeFilter: ["aria-pressed"] });
  }

  /* ---------- booking card ---------- */
  var form = $("#wlBook");
  if (!form) return;
  var price = Number(form.dataset.price) || 0, maxGuests = Number(form.dataset.max) || 6;
  var booked = [];
  try { booked = JSON.parse(form.dataset.booked || "[]"); } catch (e) { booked = []; }
  var parts = form.dataset.today.split("-");
  var today = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
  var st = { start: null, end: null, guests: 1, view: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)) };
  var box = $("#bkCalBox");

  function iso(d) { return d.toISOString().slice(0, 10); }
  function fmt(d) { return MS[d.getUTCMonth()] + " " + d.getUTCDate(); }
  function money(n) { return "Rs " + Math.round(n).toLocaleString("en-US"); }
  var ranges = booked.map(function (r) { return [new Date(r[0] + "T00:00:00Z"), new Date(r[1] + "T00:00:00Z")]; });
  // A night is taken when it falls in [checkIn, checkOut) of an existing booking.
  function nightTaken(d) { return ranges.some(function (r) { return d >= r[0] && d < r[1]; }); }
  function rangeFree(a, b) { for (var t = a.getTime(); t < b.getTime(); t += DAY) if (nightTaken(new Date(t))) return false; return true; }

  function render() {
    var y = st.view.getUTCFullYear(), m = st.view.getUTCMonth(), grid = $("#bkCal");
    $("#bkMonth").textContent = MONTHS[m] + " " + y;
    $("#bkPrev").disabled = (y === today.getUTCFullYear() && m === today.getUTCMonth());
    grid.textContent = "";
    var first = new Date(Date.UTC(y, m, 1)).getUTCDay(), days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    for (var i = 0; i < first; i++) { var b = document.createElement("span"); b.className = "wl-day blank"; grid.appendChild(b); }
    for (var d = 1; d <= days; d++) {
      (function (d) {
        var date = new Date(Date.UTC(y, m, d)), t = date.getTime();
        var el = document.createElement("button");
        el.type = "button"; el.className = "wl-day"; el.textContent = d;
        el.setAttribute("aria-label", MONTHS[m] + " " + d + " " + y);
        // While choosing checkout, a day is allowed if every night in between is free.
        var choosingOut = st.start && !st.end;
        var disabled = date < today;
        if (!disabled) {
          if (choosingOut && date > st.start) disabled = !rangeFree(st.start, date);
          else disabled = nightTaken(date);
        }
        if (disabled) { el.disabled = true; if (!(date < today)) el.classList.add("taken"); }
        if ((st.start && t === st.start.getTime()) || (st.end && t === st.end.getTime())) el.classList.add("edge");
        else if (st.start && st.end && t > st.start.getTime() && t < st.end.getTime()) el.classList.add("mid");
        el.addEventListener("click", function () {
          if (!st.start || st.end || date <= st.start) { st.start = date; st.end = null; }
          else { st.end = date; box.hidden = true; $("#bkInBtn").setAttribute("aria-expanded", "false"); $("#bkOutBtn").setAttribute("aria-expanded", "false"); }
          sync();
        });
        grid.appendChild(el);
      })(d);
    }
  }

  function sync() {
    var nights = st.start && st.end ? Math.round((st.end - st.start) / DAY) : 0;
    var inT = $("#bkInBtn b"), outT = $("#bkOutBtn b");
    inT.textContent = st.start ? fmt(st.start) : "Add date"; inT.className = st.start ? "" : "ph";
    outT.textContent = st.end ? fmt(st.end) : "Add date"; outT.className = st.end ? "" : "ph";
    $("#bkIn").value = st.start ? iso(st.start) : "";
    $("#bkOut").value = st.end ? iso(st.end) : "";
    $("#bkGuests").value = st.guests;
    $("#bkGuestTxt").textContent = st.guests + (st.guests === 1 ? " guest" : " guests");
    $("#bkLess").disabled = st.guests <= 1; $("#bkMore").disabled = st.guests >= maxGuests;
    $("#bkHint").textContent = !st.start ? "Pick your check-in day" : !st.end ? "Now pick checkout (1 night or more)" : nights + (nights === 1 ? " night" : " nights") + " selected";
    var go = $("#bkGo");
    if (go) { go.disabled = nights < 1; go.textContent = nights < 1 ? "Select dates" : "Reserve " + nights + (nights === 1 ? " night" : " nights"); }
    $("#bkSum").hidden = nights < 1; $("#bkNote").hidden = nights >= 1;
    if (nights >= 1) {
      var sub = price * nights, gst = Math.round(sub * 0.18);
      $("#bkSumA").textContent = money(price) + " x " + nights + (nights === 1 ? " night" : " nights");
      $("#bkSub").textContent = money(sub); $("#bkGst").textContent = money(gst); $("#bkTot").textContent = money(sub + gst);
    }
    render();
  }
  function toggle(open) {
    box.hidden = !open;
    $("#bkInBtn").setAttribute("aria-expanded", open ? "true" : "false");
    $("#bkOutBtn").setAttribute("aria-expanded", open ? "true" : "false");
  }
  $("#bkInBtn").addEventListener("click", function () { toggle(box.hidden); });
  $("#bkOutBtn").addEventListener("click", function () { toggle(box.hidden); });
  $("#bkPrev").addEventListener("click", function () { st.view = new Date(Date.UTC(st.view.getUTCFullYear(), st.view.getUTCMonth() - 1, 1)); render(); });
  $("#bkNext").addEventListener("click", function () { st.view = new Date(Date.UTC(st.view.getUTCFullYear(), st.view.getUTCMonth() + 1, 1)); render(); });
  $("#bkClear").addEventListener("click", function () { st.start = null; st.end = null; sync(); });
  $("#bkLess").addEventListener("click", function () { st.guests = Math.max(1, st.guests - 1); sync(); });
  $("#bkMore").addEventListener("click", function () { st.guests = Math.min(maxGuests, st.guests + 1); sync(); });
  sync();
})();
