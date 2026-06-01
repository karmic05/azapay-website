/* =========================================================
   AzaPay — sandbox.js  (AzaPay Bridge simulation)
   Step 1: cash-flow-based Bridge approval (no payslips/tax returns),
           with a 2% APR discount for AzaPay-account holders.
   Step 2: same-day disbursement to the wallet (simulated).
   Step 3: add money via a real Stripe TEST-mode Checkout.
   Loan approval + disbursement are simulated client-side; only the
   top-up calls Stripe (via /api/create-checkout-session).
   ========================================================= */
(function () {
  "use strict";

  var STORAGE = "azapay_sandbox_v2";

  // --- Bridge pricing (illustrative, test-mode only) ---
  var BASE_APR = 24;          // annual %
  var AZA_DISCOUNT = 2;       // % off APR when paid into an AzaPay account
  var TENOR_DAYS = 30;        // bridge term
  var CASHFLOW_FACTOR = 0.5;  // approve up to 50% of monthly cash flow

  var TRADE_LABELS = {
    electrician: "electrician", plumber: "plumber", mechanic: "mechanic",
    carpenter: "carpenter", trader: "trader", other: "work"
  };

  function ngn(n) {
    n = Math.round(Number(n) || 0);
    try { return "₦" + n.toLocaleString("en-NG"); }
    catch (e) { return "₦" + n.toLocaleString(); }
  }

  function defaults() {
    return { balance: 0, score: 724, cashflow: 150000, trade: "electrician",
             azaAccount: true, loan: null, disbursed: false, lastSession: null };
  }
  function load() {
    try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(STORAGE) || "{}")); }
    catch (e) { return defaults(); }
  }
  function save() { try { localStorage.setItem(STORAGE, JSON.stringify(state)); } catch (e) { /* ignore */ } }

  var state = load();
  // Sanitise persisted values (valid JSON can still hold bad types from devtools edits).
  state.score = Math.min(850, Math.max(300, parseInt(state.score, 10) || 724));
  state.balance = Math.max(0, Math.round(Number(state.balance) || 0));
  state.cashflow = Math.min(5000000, Math.max(0, parseInt(state.cashflow, 10) || 150000));
  state.azaAccount = state.azaAccount !== false;
  if (!TRADE_LABELS[state.trade]) state.trade = "electrician";
  if (state.loan && typeof state.loan.approved !== "number") state.loan = null;

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
  function applyRate(loan) {
    loan.apr = effectiveAPR();
    loan.fee = Math.round(loan.approved * (loan.apr / 100) * (TENOR_DAYS / 365));
    loan.total = loan.approved + loan.fee;
    loan.saved = state.azaAccount;
  }

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    balance: $("balance"), scoreVal: $("scoreVal"), alert: $("alert"),
    scoreRange: $("scoreRange"), scoreOut: $("scoreOut"), maxLimit: $("maxLimit"), aprPreview: $("aprPreview"),
    cashflow: $("cashflow"), tradeChips: $("tradeChips"), azaToggle: $("azaToggle"),
    loanAmt: $("loanAmt"), approveBtn: $("approveBtn"), loanTerms: $("loanTerms"),
    step2: $("step2"), disburseBtn: $("disburseBtn"),
    topupChips: $("topupChips"), topupBtn: $("topupBtn"), setup: $("setup"), resetBtn: $("resetBtn")
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

  function renderLoan() {
    if (!els.loanTerms) return;
    if (!state.loan) { els.loanTerms.hidden = true; setStep2(false); return; }
    var l = state.loan;
    els.loanTerms.hidden = false;
    els.loanTerms.className = "sbx-terms";
    var saved = l.saved
      ? '<br><span class="sbx-muted">✓ 2% AzaPay-account discount applied.</span>'
      : '<br><span class="sbx-muted">Tick the AzaPay-account option above to save 2% APR.</span>';
    var counter = l.counterOffered
      ? '<br><span class="sbx-muted">Counter-offer: approved your current limit of ' + ngn(l.approved) + '.</span>'
      : "";
    els.loanTerms.innerHTML =
      "<b>Approved: " + ngn(l.approved) + "</b> &middot; APR " + l.apr + "% &middot; fee " + ngn(l.fee) +
      " over " + l.tenor + " days &middot; repay <b>" + ngn(l.total) + "</b>." + saved + counter;
    setStep2(true);
  }

  function setStep2(unlocked) {
    if (!els.step2) return;
    els.disburseBtn.disabled = !unlocked || state.disbursed;
    if (state.disbursed) {
      els.step2.classList.add("is-done");
      els.disburseBtn.textContent = "Disbursed ✓";
    } else {
      els.step2.classList.remove("is-done");
      els.disburseBtn.textContent = "Disburse " + (state.loan ? ngn(state.loan.approved) : ngn(0));
    }
  }

  // ---- Step 1: Bridge approval ----
  function approve() {
    if (state.loan && state.disbursed) {
      showAlert("info", "This advance was already disbursed. Tap Reset to start a new one.");
      return;
    }
    var need = parseInt(els.loanAmt.value, 10) || 0;
    var limit = maxLimit(state.score, state.cashflow);
    clearAlert();
    if (need < 2000) {
      state.loan = null;
      state.disbursed = false;
      save();
      setStep2(false);
      els.loanTerms.hidden = false;
      els.loanTerms.className = "sbx-terms is-decline";
      els.loanTerms.textContent = "Enter at least ₦2,000 to apply.";
      showAlert("err", "Enter at least ₦2,000 to apply.");
      return;
    }
    if (limit < 2000) {
      state.loan = null;
      state.disbursed = false;
      save();
      setStep2(false);
      els.loanTerms.hidden = false;
      els.loanTerms.className = "sbx-terms is-decline";
      els.loanTerms.textContent = "Your cash flow and score qualify for too little right now — raise either to unlock a Bridge advance.";
      showAlert("info", "Your cash flow and score qualify for too little right now — raise either to unlock a Bridge advance.");
      return;
    }
    var approved = Math.min(need, limit);
    var loan = { approved: approved, tenor: TENOR_DAYS, counterOffered: need > limit };
    applyRate(loan);
    state.loan = loan;
    state.disbursed = false;
    save();
    renderLoan();
    var label = TRADE_LABELS[state.trade] || "work";
    showAlert("ok", "Bridge advance approved for " + ngn(approved) + " (" + label + "). Continue to funding.");
  }

  // ---- Step 2: same-day disbursement (simulated) ----
  function disburse() {
    if (!state.loan || state.disbursed) return;
    state.balance += state.loan.approved;
    state.disbursed = true;
    save();
    renderWallet();
    setStep2(true);
    showAlert("ok", ngn(state.loan.approved) + " funded to your wallet (same-day, simulated).");
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
      if (res.ok && res.data && res.data.url) {
        window.location.href = res.data.url; // hand off to Stripe's hosted test checkout
        return;
      }
      els.topupBtn.disabled = false;
      els.topupBtn.textContent = original;
      if (res.status === 503 || (res.data && res.data.error === "stripe_not_configured")) {
        showAlert("info", "Stripe isn't configured yet — open “Enable live test payments” below to add a test key. (Steps 1 & 2 work without it.)");
        if (els.setup) els.setup.open = true;
      } else {
        showAlert("err", (res.data && res.data.message) || "Could not start checkout. Please try again.");
      }
    }).catch(function () {
      els.topupBtn.disabled = false;
      els.topupBtn.textContent = original;
      showAlert("err", "Network error starting checkout.");
    });
  }

  // ---- Handle return from Stripe ----
  function handleReturn() {
    var q = new URLSearchParams(window.location.search);
    var status = q.get("status");
    if (!status) return;
    var clean = function () { history.replaceState(null, "", window.location.pathname); };

    if (status === "cancelled") { showAlert("info", "Checkout cancelled — no payment was made."); clean(); return; }
    if (status === "success") {
      var sid = q.get("session_id");
      if (!sid) { clean(); return; }
      if (sid === state.lastSession) { clean(); return; }
      // Reserve the session and strip the URL up front so a refresh during the
      // in-flight confirm can't credit the wallet twice.
      state.lastSession = sid;
      save();
      clean();
      showAlert("info", "Confirming your test payment…");
      fetch("/api/checkout-session?session_id=" + encodeURIComponent(sid))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.payment_status === "paid") {
            var added = Math.round((d.amount_total || 0) / 100); // minor unit -> naira
            state.balance += added;
            save();
            renderWallet();
            showAlert("ok", "Added " + ngn(added) + " to your wallet via a Stripe test payment. ✓");
          } else {
            showAlert("err", "Payment was not completed.");
          }
        })
        .catch(function () {
          state.lastSession = null; save(); // release the reservation so a retry is possible
          showAlert("err", "Couldn't confirm the payment — no balance was added. Tap “Add money via Stripe” to try again.");
        });
    }
  }

  function reset() {
    state = defaults();
    save();
    renderWallet();
    renderEligibility();
    if (els.scoreRange) els.scoreRange.value = state.score;
    if (els.cashflow) els.cashflow.value = state.cashflow;
    if (els.azaToggle) els.azaToggle.checked = state.azaAccount;
    if (els.tradeChips) {
      var first = els.tradeChips.querySelector('.chip[data-trade="' + state.trade + '"]') || els.tradeChips.querySelector(".chip");
      if (first) selectInGroup(els.tradeChips, first);
    }
    if (els.loanAmt) els.loanAmt.value = 50000;
    selectedTopup = 5000;
    if (els.topupChips) {
      var firstTopup = els.topupChips.querySelector('.chip[data-amt="5000"]') || els.topupChips.querySelector(".chip");
      if (firstTopup) selectInGroup(els.topupChips, firstTopup);
    }
    if (els.loanTerms) els.loanTerms.hidden = true;
    setStep2(false);
    if (els.disburseBtn) { els.disburseBtn.disabled = true; els.disburseBtn.textContent = "Disburse ₦0"; }
    if (els.step2) els.step2.classList.remove("is-done");
    showAlert("info", "Sandbox reset.");
  }

  // ---- Wire up ----
  if (els.scoreRange) {
    els.scoreRange.value = state.score;
    els.scoreRange.addEventListener("input", function () {
      state.score = parseInt(els.scoreRange.value, 10);
      renderEligibility(); renderWallet(); save();
    });
  }
  if (els.cashflow) {
    els.cashflow.value = state.cashflow;
    els.cashflow.addEventListener("input", function () {
      state.cashflow = Math.max(0, parseInt(els.cashflow.value, 10) || 0);
      renderEligibility(); save();
    });
  }
  if (els.azaToggle) {
    els.azaToggle.checked = state.azaAccount;
    els.azaToggle.addEventListener("change", function () {
      state.azaAccount = els.azaToggle.checked;
      renderEligibility();
      if (state.loan && !state.disbursed) { applyRate(state.loan); renderLoan(); }
      save();
    });
  }
  if (els.tradeChips) {
    // reflect persisted trade
    var sel = els.tradeChips.querySelector('.chip[data-trade="' + state.trade + '"]');
    if (sel) selectInGroup(els.tradeChips, sel);
    els.tradeChips.addEventListener("click", function (e) {
      var btn = e.target.closest(".chip");
      if (!btn) return;
      selectInGroup(els.tradeChips, btn);
      state.trade = btn.getAttribute("data-trade");
      save();
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

  // ---- Initial render ----
  renderWallet();
  renderEligibility();
  renderLoan();
  handleReturn();
})();
