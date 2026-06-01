/* =========================================================
   AzaPay — sandbox.js
   Simulates the AzaPay journey: loan approval -> disbursement
   -> add money to wallet (a real Stripe TEST-mode Checkout).
   Loan approval + disbursement are simulated client-side; only
   the top-up step calls Stripe (via /api/create-checkout-session).
   ========================================================= */
(function () {
  "use strict";

  var STORAGE = "azapay_sandbox_v1";

  function ngn(n) {
    n = Math.round(Number(n) || 0);
    try { return "₦" + n.toLocaleString("en-NG"); }
    catch (e) { return "₦" + n.toLocaleString(); }
  }

  function defaults() { return { balance: 0, score: 724, loan: null, disbursed: false, lastSession: null }; }
  function load() {
    try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(STORAGE) || "{}")); }
    catch (e) { return defaults(); }
  }
  function save() { try { localStorage.setItem(STORAGE, JSON.stringify(state)); } catch (e) { /* ignore */ } }
  var state = load();
  // Sanitise persisted values (valid JSON can still hold bad types from devtools edits).
  state.score = Math.min(850, Math.max(300, parseInt(state.score, 10) || 724));
  state.balance = Math.max(0, Math.round(Number(state.balance) || 0));
  if (state.loan && typeof state.loan.approved !== "number") state.loan = null;

  // Trust Score -> maximum approved limit (mirrors the credit ladder).
  function maxLimit(score) {
    if (score < 480) return 20000;     // thin file -> nano advance
    if (score < 600) return 75000;
    if (score < 680) return 150000;
    if (score < 760) return 300000;
    return 500000;
  }

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    balance: $("balance"), scoreVal: $("scoreVal"), alert: $("alert"),
    scoreRange: $("scoreRange"), scoreOut: $("scoreOut"), maxLimit: $("maxLimit"),
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

  function renderWallet() {
    els.balance.textContent = ngn(state.balance);
    if (els.scoreVal) els.scoreVal.textContent = state.score;
  }
  function renderEligibility() {
    if (els.scoreOut) els.scoreOut.textContent = state.score;
    if (els.maxLimit) els.maxLimit.textContent = ngn(maxLimit(state.score));
  }

  function renderLoan() {
    if (!els.loanTerms) return;
    if (!state.loan) { els.loanTerms.hidden = true; setStep2(false); return; }
    var l = state.loan;
    els.loanTerms.hidden = false;
    els.loanTerms.className = "sbx-terms";
    var note = l.counterOffered
      ? '<br><span class="sbx-muted">Counter-offer: approved your current limit of ' + ngn(l.approved) + '.</span>'
      : "";
    els.loanTerms.innerHTML =
      "<b>Approved: " + ngn(l.approved) + "</b> &middot; one-off fee (7%) " + ngn(l.fee) +
      " &middot; total repayable <b>" + ngn(l.total) + "</b> in " + l.tenor + " days." + note;
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

  // ---- Step 1: approval ----
  function approve() {
    if (state.loan && state.disbursed) {
      showAlert("info", "This loan was already disbursed. Tap Reset to start a new one.");
      return;
    }
    var need = parseInt(els.loanAmt.value, 10) || 0;
    var max = maxLimit(state.score);
    var approved = Math.min(need, max);
    clearAlert();
    if (need < 2000) {
      els.loanTerms.hidden = false;
      els.loanTerms.className = "sbx-terms is-decline";
      els.loanTerms.textContent = "Enter at least ₦2,000 to apply.";
      return;
    }
    var fee = Math.round(approved * 0.07);
    state.loan = { approved: approved, fee: fee, total: approved + fee, tenor: 30, counterOffered: need > max };
    state.disbursed = false;
    save();
    renderLoan();
    showAlert("ok", "Loan approved for " + ngn(approved) + ". Continue to disbursement.");
  }

  // ---- Step 2: disbursement (simulated) ----
  function disburse() {
    if (!state.loan || state.disbursed) return;
    state.balance += state.loan.approved;
    state.disbursed = true;
    save();
    renderWallet();
    setStep2(true);
    showAlert("ok", ngn(state.loan.approved) + " disbursed to your wallet (simulated).");
  }

  // ---- Step 3: add money via Stripe test Checkout ----
  function selectTopup(amt, btn) {
    selectedTopup = amt;
    var chips = els.topupChips.querySelectorAll(".chip");
    for (var i = 0; i < chips.length; i++) {
      var on = chips[i] === btn;
      chips[i].classList.toggle("is-selected", on);
      chips[i].setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

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

    if (status === "cancelled") {
      showAlert("info", "Checkout cancelled — no payment was made.");
      clean();
      return;
    }
    if (status === "success") {
      var sid = q.get("session_id");
      if (!sid) { clean(); return; }
      if (sid === state.lastSession) { clean(); return; } // already processed
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
        .catch(function () { showAlert("err", "Could not confirm the payment. Reload to retry."); });
    }
  }

  function reset() {
    state = defaults();
    save();
    renderWallet();
    renderEligibility();
    if (els.scoreRange) els.scoreRange.value = state.score;
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
      renderEligibility();
      renderWallet();
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
      selectTopup(parseInt(btn.getAttribute("data-amt"), 10), btn);
    });
  }

  // ---- Initial render ----
  renderWallet();
  renderEligibility();
  renderLoan();
  handleReturn();
})();
