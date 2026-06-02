/* =========================================================
   AzaPay — script.js
   Nav, scroll-reveal, counters, gauge, bars, waitlist form
   ========================================================= */
(function () {
  "use strict";

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) {
    var y = new Date().getFullYear();
    if (!isNaN(y)) yearEl.textContent = String(y);
  }

  /* ---------- Sticky nav state ---------- */
  var nav = document.getElementById("nav");
  function onScroll() {
    if (nav) nav.classList.toggle("is-scrolled", window.scrollY > 8);
    var toTop = document.getElementById("toTop");
    if (toTop) toTop.classList.toggle("is-on", window.scrollY > 600);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile nav toggle ---------- */
  var toggle = document.getElementById("navToggle");
  var links = document.getElementById("navLinks");
  var mqMobile = window.matchMedia("(max-width: 760px)");

  function closeNav(returnFocus) {
    if (!toggle || !links) return;
    links.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    if (returnFocus) toggle.focus();
  }
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      // Move focus into the menu when opened on mobile
      if (open && mqMobile.matches) {
        var first = links.querySelector("a");
        if (first) first.focus();
      }
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { closeNav(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (!links.classList.contains("is-open")) return;
      if (e.key === "Escape") { closeNav(true); return; }
      // Trap Tab within the open mobile menu (toggle + links)
      if (e.key === "Tab" && mqMobile.matches) {
        var items = links.querySelectorAll("a");
        if (!items.length) return;
        var first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); toggle.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); toggle.focus(); }
      }
    });
  }

  /* ---------- Back to top ---------- */
  var toTopBtn = document.getElementById("toTop");
  if (toTopBtn) {
    toTopBtn.hidden = false;
    toTopBtn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
    });
  }

  /* ---------- Animated counters ---------- */
  function animateCount(el) {
    if (el.dataset.done) return;
    el.dataset.done = "1";
    var target = parseInt(el.getAttribute("data-target"), 10);
    if (isNaN(target)) return;
    var prefix = el.getAttribute("data-prefix") || "";
    var duration = parseInt(el.getAttribute("data-duration"), 10) || 1400;

    if (prefersReduced) {
      el.textContent = prefix + target.toLocaleString("en-US");
      return;
    }

    var start = null;
    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      var val = Math.round(target * eased);
      el.textContent = prefix + val.toLocaleString("en-US");
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Trust gauge ---------- */
  function animateGauge() {
    var arc = document.getElementById("gaugeArc");
    if (!arc || arc.dataset.done) return;
    arc.dataset.done = "1";
    // Score 724 on a 300–850 scale → fraction of the 314-unit half-circle arc.
    var fraction = (724 - 300) / (850 - 300);
    var total = 314;
    var offset = Math.round(total * (1 - fraction));
    if (prefersReduced) {
      arc.style.strokeDashoffset = String(offset);
      return;
    }
    arc.style.transition = "stroke-dashoffset 1.6s cubic-bezier(.16,.84,.44,1)";
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        arc.style.strokeDashoffset = String(offset);
      });
    });
  }

  /* ---------- Reveal + trigger child animations ---------- */
  var revealEls = document.querySelectorAll(".reveal");

  function activate(el) {
    el.classList.add("is-visible");
    // Counters within this element
    el.querySelectorAll(".count").forEach(animateCount);
    if (el.classList.contains("count")) animateCount(el);
    // Weight bars
    el.querySelectorAll(".bar").forEach(function (b) { b.classList.add("is-on"); });
    // Gauge
    if (el.querySelector(".gauge") || el.classList.contains("trust__gauge")) animateGauge();
  }

  if ("IntersectionObserver" in window && !prefersReduced) {
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          activate(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    revealEls.forEach(function (el, i) {
      // Subtle stagger for siblings
      el.style.transitionDelay = (Math.min(i % 4, 3) * 60) + "ms";
      io.observe(el);
    });
  } else {
    // No IO support or reduced motion → show everything immediately
    revealEls.forEach(activate);
    document.querySelectorAll(".count").forEach(animateCount);
    document.querySelectorAll(".bar").forEach(function (b) { b.classList.add("is-on"); });
    animateGauge();
  }

  /* ---------- Waitlist form ---------- */
  var form = document.getElementById("waitlistForm");
  var note = document.getElementById("formNote");
  var emailInput = document.getElementById("email");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      // Native constraint validation across all fields (name, email, mobile, age, ID, city, ZIP).
      if (!form.checkValidity()) { form.reportValidity(); return; }
      // Demo: persist only the email locally; never store sensitive KYC fields.
      try {
        var em = emailInput ? emailInput.value.trim() : "";
        if (em) {
          var list = JSON.parse(localStorage.getItem("azapay_waitlist") || "[]");
          if (list.indexOf(em) === -1) list.push(em);
          localStorage.setItem("azapay_waitlist", JSON.stringify(list));
        }
      } catch (err) { /* storage unavailable */ }
      var modal = document.getElementById("approveModal");
      if (modal) {
        runApproval(modal);
      } else if (note) {
        note.textContent = "🎉 You're on the list! We'll be in touch about early access.";
        note.className = "cta__formnote ok";
      }
    });
  }

  // Simulated account-approval flow: faded modal -> approve -> unlock + open the sandbox.
  function runApproval(modal) {
    var stage1 = document.getElementById("approveStage1");
    var stage2 = document.getElementById("approveStage2");
    modal.hidden = false;
    document.body.classList.add("modal-open");
    var heading = modal.querySelector("h2");
    if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus(); }
    setTimeout(function () {
      if (stage1) stage1.hidden = true;
      if (stage2) stage2.hidden = false;
      try { sessionStorage.setItem("azapay_approved", "1"); } catch (e) { /* storage unavailable */ }
      var enter = document.getElementById("enterSandbox");
      if (enter) enter.focus();
      setTimeout(function () { window.location.href = "sandbox.html"; }, 2400);
    }, 1700);
  }
})();
