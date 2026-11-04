(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function open(id) { var m = document.getElementById(id); if (m) { m.hidden = false; var f = $("input:not([type=hidden]), .keep", m); if (f) f.focus(); } }

  // delete listing / cancel trip: fill the confirm dialog, then open it
  $$("[data-del-listing]").forEach(function (b) {
    b.addEventListener("click", function () {
      $("#delListingForm").action = "/listings/" + encodeURIComponent(b.getAttribute("data-del-listing")) + "?_method=DELETE";
      $("#delListName").textContent = b.getAttribute("data-title");
      open("wlDelListing");
    });
  });
  $$("[data-cancel]").forEach(function (b) {
    b.addEventListener("click", function () {
      $("#cancelTripForm").action = "/bookings/" + encodeURIComponent(b.getAttribute("data-cancel")) + "/cancel";
      $("#cancelName").textContent = b.getAttribute("data-title");
      open("wlCancelTrip");
    });
  });

  // account details: locked until "Edit profile"
  var form = $("#acctForm"), btn = $("#editBtn");
  if (!form || !btn) return;
  var editing = false;
  btn.addEventListener("click", function () {
    if (!editing) {
      editing = true;
      $$("[data-edit]", form).forEach(function (i) { i.disabled = false; });
      $$("[data-edit-only]", form).forEach(function (n) { n.hidden = false; });
      btn.textContent = "Save changes"; btn.className = "pink";
      var em = $('[name="user[email]"]', form); if (em) em.focus();
      return;
    }
    var cur = $('[name="user[current]"]', form);
    if (!cur.value) { cur.setAttribute("aria-invalid", "true"); cur.focus(); return; }
    btn.disabled = true;
    form.submit();
  });
})();
