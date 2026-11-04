(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var USER_RE = /^[a-z0-9._]{4,30}$/, EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Every field has a message line under it: data-msg="<field>".
  function msgFor(input) {
    var label = input.closest("label");
    return label ? $("[data-msg]", label) : null;
  }
  function setMsg(input, text, kind) {
    var m = msgFor(input);
    input.setAttribute("aria-invalid", kind === "bad" ? "true" : "false");
    input.classList.toggle("good", kind === "good");
    if (m) { m.textContent = text || ""; m.className = "msg" + (kind ? " " + kind : ""); }
  }

  /* ---------- show / hide password + Caps Lock hint ---------- */
  $$("[data-pw-toggle]").forEach(function (b) {
    b.addEventListener("click", function () {
      var input = b.parentNode.querySelector("input");
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      b.textContent = show ? "Hide" : "Show";
    });
  });
  $$("input[type=password]").forEach(function (i) {
    var hint = i.closest("label") && $("[data-caps]", i.closest("label"));
    if (!hint) return;
    var check = function (e) { if (e.getModifierState) hint.hidden = !e.getModifierState("CapsLock"); };
    i.addEventListener("keydown", check); i.addEventListener("keyup", check);
    i.addEventListener("blur", function () { hint.hidden = true; });
  });

  /* ---------- password rules + username check (sign-up only) ---------- */
  var signup = $("#signupForm");
  var pwState = function () { return { len: 0, mix: 0, sym: 0, long: 0 }; };
  var signupProblems = function () { return {}; };
  if (signup) {
    var u = $('[name="user[username]"]', signup), em = $('[name="user[email]"]', signup), pw = $('[name="user[password]"]', signup);
    var meter = $$(".wl-meter span", signup);
    var availTimer = null, availSeq = 0, taken = false;

    pwState = function () {
      var v = pw.value;
      return { len: v.length >= 8, mix: /[A-Za-z]/.test(v) && /\d/.test(v), sym: /[\W_]/.test(v), long: v.length >= 12 };
    };
    var userProblem = function () { return USER_RE.test(u.value) ? "" : "Use 4 to 30 characters: lowercase letters, numbers, . or _"; };
    var emailProblem = function () { return EMAIL_RE.test(em.value.trim()) ? "" : "Enter a valid email address, like you@example.com"; };
    var pwProblem = function () {
      var s = pwState();
      if (!s.len) return "Use at least 8 characters";
      if (!s.mix) return "Include letters and a number";
      if (!s.sym) return "Include one symbol (e.g. ! @ #)";
      return "";
    };
    signupProblems = function () {
      var p = {};
      var a = u.value ? userProblem() : "Choose a username"; if (a || taken) p.u = a || "That username is already taken";
      var b = em.value ? emailProblem() : "Enter your email address"; if (b) p.e = b;
      var c = pw.value ? pwProblem() : "Create a password"; if (c) p.p = c;
      return p;
    };

    u.addEventListener("input", function () {
      taken = false; clearTimeout(availTimer);
      if (!u.value) { setMsg(u, "", ""); return; }
      var bad = userProblem();
      if (bad) { setMsg(u, bad, "bad"); return; }
      setMsg(u, "Checking...", "");
      var seq = ++availSeq;
      availTimer = setTimeout(function () {
        fetch("/register/available?username=" + encodeURIComponent(u.value), { headers: { Accept: "application/json" }, credentials: "same-origin" })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (seq !== availSeq) return;
            if (j && j.ok && j.available === false) { taken = true; setMsg(u, "That username is already taken", "bad"); }
            else if (j && j.ok) setMsg(u, "@" + u.value + " is available", "good");
            else setMsg(u, "", "");
          })
          .catch(function () { if (seq === availSeq) setMsg(u, "", ""); });
      }, 400);
    });
    em.addEventListener("input", function () {
      if (!em.value) { setMsg(em, "", ""); return; }
      var bad = emailProblem();
      setMsg(em, bad || "Looks good", bad ? "" : "good");
    });
    em.addEventListener("blur", function () { if (em.value && emailProblem()) setMsg(em, emailProblem(), "bad"); });
    pw.addEventListener("input", function () {
      var s = pwState();
      var score = [s.len, s.mix, s.sym, s.long].filter(Boolean).length;
      var cls = score <= 1 ? "s1" : score === 2 ? "s2" : "s3";
      meter.forEach(function (m, i) { m.className = i < score ? cls : ""; });
      [["len", s.len, "At least 8 characters"], ["mix", s.mix, "Letters and a number"], ["sym", s.sym, "One symbol (e.g. ! @ #)"]].forEach(function (r) {
        var el = $('[data-rule="' + r[0] + '"]', signup);
        el.textContent = (r[1] ? "\u2713 " : "\u25CB ") + r[2];
        el.className = r[1] ? "ok" : "";
      });
      setMsg(pw, "", "");
    });
  }

  /* ---------- submit: say exactly what is missing, then lock the button ---------- */
  $$("form").forEach(function (f) {
    if (!$("[data-req]", f)) return;
    f.addEventListener("submit", function (e) {
      if (f.dataset.busy) { e.preventDefault(); return; }
      var first = null;
      $$("[data-req]", f).forEach(function (i) {
        if (!i.value.trim()) { setMsg(i, i.getAttribute("data-req"), "bad"); if (!first) first = i; }
      });
      if (f === signup && !first) {
        var p = signupProblems();
        [[u, p.u], [em, p.e], [pw, p.p]].forEach(function (x) { if (x[1]) { setMsg(x[0], x[1], "bad"); if (!first) first = x[0]; } });
      }
      if (first) {
        e.preventDefault();
        var box = $("#formAlert", f);
        if (box && !box.firstChild) { var d = document.createElement("div"); d.className = "wl-alert"; d.setAttribute("role", "alert"); d.textContent = "Please fix the highlighted fields."; box.appendChild(d); }
        first.focus();
        return;
      }
      f.dataset.busy = "1";
      var cta = $(".wl-cta", f); if (cta) { cta.disabled = true; cta.textContent = f.id === "loginForm" ? "Logging in..." : "Creating account..."; }
    });
    // typing clears the "required" message right away
    $$("[data-req]", f).forEach(function (i) {
      if (f === signup) return;
      i.addEventListener("input", function () { if (i.getAttribute("aria-invalid") === "true") setMsg(i, "", ""); });
    });
  });
})();
