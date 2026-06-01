/* =========================================================
   AzaPay — sandbox.js  (AzaPay Bridge simulation)
   Step 1: a LIVE cash-flow Bridge calculator. The offer recomputes on
           every change to trade, cash flow, Trust Score, amount and the
           APR toggle — approving 85% of the request, flexed by occupation
           and Trust Score.
   Step 2: same-day disbursement to the wallet (simulated).
   Step 3: add money via a real Stripe TEST-mode Checkout.
   State is EPHEMERAL (in-memory) — a page refresh resets the whole flow,
   so the Disburse button auto-resets. Only the top-up calls Stripe.
   ========================================================= */
(function () {
  "use strict";

  // --- Bridge pricing (illustrative, test-mode only) ---
  var BASE_APR = 24;          // annual %
  var AZA_DISCOUNT = 2;       // % off APR when paid into an AzaPay account
  var TENOR_DAYS = 30;        // bridge term
  var CASHFLOW_FACTOR = 0.5;  // ceiling: up to 50% of monthly cash flow

  // Approval rate = % of the REQUESTED amount we approve. Starts at 85% and
  // flexes by occupation (cash-flow stability) and Trust Score, clamped 55–95%.
  var BASE_RATE = 85;
  var OCC = {
    electrician: { delta: 3,  label: "electrician" },
    plumber:     { delta: 2,  label: "plumber" },
    mechanic:    { delta: 0,  label: "mechanic" },
    carpenter:   { delta: -1, label: "carpenter" },
    trader:      { delta: -4, label: "trader" },
    other:       { delta: -6, label: "work" }
  };

  function ngn(n) {
    n = Math.round(Number(n) || 0);
    try { return "₦" + n.toLocaleString("en-NG"); }
    catch (e) { return "₦" + n.toLocaleString(); }
  }

  // Ephemeral state — NOT persisted, so a refresh always resets the flow.
  function defaults() {
    return { balance: 0, score: 724, cashflow: 150000, trade: "electrician",
             azaAccount: true, approved: false, disbursed: false, offer: null, funded: null };
  }
  var state = defaults();

  // --- Eligibility / pricing helpers ---
  function scoreTier(score) {
    if (score < 480) return 20000;
    if (score < 600) return 75000;
    if (score < 680) return 150000;
    if (score < 760) return 300000;
    return 500000;
  }
  function maxLimit(score, cashflow) {
    var byCash = Math.max(0, Math.round((Number(cashflow) || 0) * CASHFLOW_FACTOR));
    return Math.min(scoreTier(score), byCash);
  }
  function effectiveAPR() { return state.azaAccount ? BASE_APR - AZA_DISCOUNT : BASE_APR; }
  function tradeMeta() { return OCC[state.trade] || OCC.other; }
  function approvalRate() {
    var scoreDelta = Math.round((state.score - 700) / 15); // ~+1 per 15 pts above 700
    return Math.max(55, Math.min(95, BASE_RATE + tradeMeta().delta + scoreDelta));
  }

  // The single source of truth — a pure function of the current inputs.
  function computeOffer() {
    var requested = parseInt(els.loanAmt.value, 10) || 0;
    var limit = maxLimit(state.score, state.cashflow);
    var rate = approvalRate();
    var apr = effectiveAPR();
    var base = { requested: requested, rate: rate, apr: apr, limit: limit,
                 approved: 0, fee: 0, total: 0, counterOffered: false };
    if (requested < 2000) return Object.assign(base, { eligible: false, reason: "Enter at least ₦2,000 to request an advance." });
    if (limit < 2000) return Object.assign(base, { eligible: false, reason: "Your cash flow and Trust Score qualify for too little right now — raise either to unlock a Bridge advance." });
    var raw = Math.round(requested * rate / 100);            // 85%-ish of the request
    var approved = Math.min(raw, limit);                     // capped by the cash-flow/score ceiling
    var fee = Math.round(approved * (apr / 100) * (TENOR_DAYS / 365));
    return Object.assign(base, { eligible: true, approved: approved, fee: fee, total: approved + fee, counterOffered: raw > limit });
  }

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    balance: $("balance"), scoreVal: $("scoreVal"), alert: $("alert"),
    scoreRange: $("scoreRange"), scoreOut: $("scoreOut"), maxLimit: $("maxLimit"), aprPreview: $("aprPreview"),
    cashflow: $("cashflow"), tradeChips: $("tradeChips"), azaToggle: $("azaToggle"),
    loanAmt: $("loanAmt"), approveBtn: $("approveBtn"), loanTerms: $("loanTerms"),
    step2: $("step2"), disburseBtn: $("disburseBtn"),
    topupChips: $("topupChips"), topupBtn: $("topupBtn"), resetBtn: $("resetBtn")
  };
  if (!els.balance) return; // not the sandbox page

  var selectedTopup = 5000;

  function showAlert(type, msg) {
    if (!els.alert) return;
    els.alert.className = "sbx-alert " + type;
    els.alert.textContent = msg;
    els.alert.hidden = false;
  }
  function clearAlert() { if (els.alert) { els.alert.hidden = true; els.alert.textContent = ""; } }

  function selectInGroup(container, btn) {
    var chips = container.querySelectorAll(".chip");
    for (var i = 0; i < chips.length; i++) {
      var on = chips[i] === btn;
      chips[i].classList.toggle("is-selected", on);
      chips[i].setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  function renderWallet() {
    els.balance.textContent = ngn(state.balance);
    if (els.scoreVal) els.scoreVal.textContent = state.score;
  }
  function renderEligibility() {
    if (els.scoreOut) els.scoreOut.textContent = state.score;
    if (els.maxLimit) els.maxLimit.textContent = ngn(maxLimit(state.score, state.cashflow));
    if (els.aprPreview) els.aprPreview.textContent = effectiveAPR() + "%";
  }

  // Live offer box — always reflects the current inputs (or the funded snapshot).
  function renderOffer() {
    if (!els.loanTerms) return;

    if (state.disbursed && state.funded) {
      var f = state.funded;
      els.loanTerms.hidden = false;
      els.loanTerms.className = "sbx-terms is-approved";
      els.loanTerms.innerHTML =
        "<b>Funded: " + ngn(f.approved) + "</b> &middot; " + f.rate + "% of " + ngn(f.requested) +
        " &middot; repay <b>" + ngn(f.total) + "</b> in " + TENOR_DAYS + " days." +
        "<br><span class=\"sbx-muted\">Disbursed to your wallet. Refresh or tap Reset to start a new advance.</span>";
      setStep2(true);
      return;
    }

    var o = computeOffer();
    state.offer = o;
    if (state.approved && !o.eligible) state.approved = false; // invalidated by a change

    if (!o.eligible) {
      els.loanTerms.hidden = false;
      els.loanTerms.className = "sbx-terms is-decline";
      els.loanTerms.textContent = o.reason;
      setStep2(false);
      return;
    }

    var head = state.approved ? "✓ Approved" : "Your live quote";
    var notes = "";
    if (o.counterOffered) notes += "<br><span class=\"sbx-muted\">Capped at your current limit of " + ngn(o.limit) + ".</span>";
    notes += "<br><span class=\"sbx-muted\">" +
      (state.azaAccount ? "✓ 2% AzaPay-account discount applied. " : "Tick the AzaPay option to save 2% APR. ") +
      "Rate " + o.rate + "% — from your " + tradeMeta().label + " trade and " + state.score + " Trust Score" +
      (o.rate < 95 ? "; raise your score for a higher rate." : ".") + "</span>";

    els.loanTerms.hidden = false;
    els.loanTerms.className = "sbx-terms" + (state.approved ? " is-approved" : "");
    els.loanTerms.innerHTML =
      "<b>" + head + ": " + ngn(o.approved) + "</b> — " + o.rate + "% of " + ngn(o.requested) +
      " &middot; APR " + o.apr + "% &middot; fee " + ngn(o.fee) + " over " + TENOR_DAYS + " days &middot; repay <b>" + ngn(o.total) + "</b>." + notes;
    setStep2(state.approved);
  }

  function setStep2(unlocked) {
    if (!els.step2) return;
    els.disburseBtn.disabled = !unlocked || state.disbursed;
    if (state.disbursed) {
      els.step2.classList.add("is-done");
      els.disburseBtn.textContent = "Disbursed ✓";
    } else {
      els.step2.classList.remove("is-done");
      var amt = (state.offer && state.offer.eligible) ? state.offer.approved : 0;
      els.disburseBtn.textContent = "Disburse " + ngn(amt);
    }
  }

  function recalc() { renderEligibility(); renderOffer(); }

  // ---- Step 1: approve (commit the current live quote) ----
  function approve() {
    if (state.disbursed) { showAlert("info", "This advance was already disbursed. Refresh or tap Reset to start a new one."); return; }
    clearAlert();
    var o = computeOffer();
    if (!o.eligible) { state.approved = false; renderOffer(); showAlert("err", o.reason); return; }
    state.approved = true;
    renderOffer();
    showAlert("ok", "Approved " + ngn(o.approved) + " — " + o.rate + "% of " + ngn(o.requested) + " for your " + tradeMeta().label + " work. Continue to funding.");
  }

  // ---- Step 2: same-day disbursement (simulated) ----
  function disburse() {
    if (!state.approved || state.disbursed) return;
    var o = computeOffer();
    if (!o.eligible) return;
    state.balance += o.approved;
    state.funded = o;
    state.disbursed = true;
    renderWallet();
    renderOffer();
    showAlert("ok", ngn(o.approved) + " funded to your wallet (same-day, simulated).");
  }

  // ---- Step 3: add money via Stripe test Checkout ----
  function startTopup() {
    clearAlert();
    els.topupBtn.disabled = true;
    var original = els.topupBtn.textContent;
    els.topupBtn.textContent = "Starting checkout…";
    fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: selectedTopup })
    }).then(function (r) {
      return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
    }).then(function (res) {
      if (res.ok && res.data && res.data.url) { window.location.href = res.data.url; return; }
      els.topupBtn.disabled = false;
      els.topupBtn.textContent = original;
      if (res.status === 503 || (res.data && res.data.error === "stripe_not_configured")) {
        showAlert("info", "Stripe isn't configured for this environment. Steps 1 & 2 work without it; see the README to add a test key.");
      } else {
        showAlert("err", (res.data && res.data.message) || "Could not start checkout. Please try again.");
      }
    }).catch(function () {
      els.topupBtn.disabled = false;
      els.topupBtn.textContent = original;
      showAlert("err", "Network error starting checkout.");
    });
  }

  // ---- Handle return from Stripe (state is ephemeral; URL is cleaned up front) ----
  function handleReturn() {
    var q = new URLSearchParams(window.location.search);
    var status = q.get("status");
    if (!status) return;
    var clean = function () { history.replaceState(null, "", window.location.pathname); };
    if (status === "cancelled") { showAlert("info", "Checkout cancelled — no payment was made."); clean(); return; }
    if (status === "success") {
      var sid = q.get("session_id");
      clean(); // strip the query so a refresh can't re-credit
      if (!sid) return;
      showAlert("info", "Confirming your test payment…");
      fetch("/api/checkout-session?session_id=" + encodeURIComponent(sid))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.payment_status === "paid") {
            var added = Math.round((d.amount_total || 0) / 100);
            state.balance += added;
            renderWallet();
            showAlert("ok", "Added " + ngn(added) + " to your wallet via a Stripe test payment. ✓");
          } else {
            showAlert("err", "Payment was not completed.");
          }
        })
        .catch(function () { showAlert("err", "Couldn't confirm the payment — tap “Add money via Stripe” to try again."); });
    }
  }

  function reset() {
    state = defaults();
    renderWallet();
    if (els.scoreRange) els.scoreRange.value = state.score;
    if (els.cashflow) els.cashflow.value = state.cashflow;
    if (els.azaToggle) els.azaToggle.checked = state.azaAccount;
    if (els.loanAmt) els.loanAmt.value = 50000;
    selectedTopup = 5000;
    if (els.tradeChips) {
      var t = els.tradeChips.querySelector('.chip[data-trade="' + state.trade + '"]') || els.tradeChips.querySelector(".chip");
      if (t) selectInGroup(els.tradeChips, t);
    }
    if (els.topupChips) {
      var tu = els.topupChips.querySelector('.chip[data-amt="5000"]') || els.topupChips.querySelector(".chip");
      if (tu) selectInGroup(els.topupChips, tu);
    }
    recalc();
    showAlert("info", "Sandbox reset.");
  }

  // ---- Wire up ----
  if (els.scoreRange) {
    els.scoreRange.value = state.score;
    els.scoreRange.addEventListener("input", function () { state.score = parseInt(els.scoreRange.value, 10); renderWallet(); recalc(); });
  }
  if (els.cashflow) {
    els.cashflow.value = state.cashflow;
    els.cashflow.addEventListener("input", function () { state.cashflow = Math.max(0, parseInt(els.cashflow.value, 10) || 0); recalc(); });
  }
  if (els.azaToggle) {
    els.azaToggle.checked = state.azaAccount;
    els.azaToggle.addEventListener("change", function () { state.azaAccount = els.azaToggle.checked; recalc(); });
  }
  if (els.loanAmt) {
    els.loanAmt.addEventListener("input", function () { renderOffer(); });
  }
  if (els.tradeChips) {
    var sel = els.tradeChips.querySelector('.chip[data-trade="' + state.trade + '"]');
    if (sel) selectInGroup(els.tradeChips, sel);
    els.tradeChips.addEventListener("click", function (e) {
      var btn = e.target.closest(".chip");
      if (!btn) return;
      selectInGroup(els.tradeChips, btn);
      state.trade = btn.getAttribute("data-trade");
      recalc();
    });
  }
  if (els.approveBtn) els.approveBtn.addEventListener("click", approve);
  if (els.disburseBtn) els.disburseBtn.addEventListener("click", disburse);
  if (els.topupBtn) els.topupBtn.addEventListener("click", startTopup);
  if (els.resetBtn) els.resetBtn.addEventListener("click", reset);
  if (els.topupChips) {
    els.topupChips.addEventListener("click", function (e) {
      var btn = e.target.closest(".chip");
      if (!btn) return;
      selectInGroup(els.topupChips, btn);
      selectedTopup = parseInt(btn.getAttribute("data-amt"), 10);
    });
  }

  // ---- Initial render (shows a live quote immediately) ----
  renderWallet();
  recalc();
  handleReturn();
})();
