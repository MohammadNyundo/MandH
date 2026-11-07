/* M&H Boutique Hotel — room status & booking engine (accommodation page)
 *
 * HOW THIS IS ORGANISED
 *  1. CONFIG   — prices, VAT, payment methods, the units themselves.
 *  2. STORE    — where reservations and customers are saved.
 *                Right now this is the browser's localStorage, so data stays on
 *                the device that made the booking. To connect the web app, replace
 *                the four STORE functions with calls to your API; nothing else
 *                in this file needs to change.
 *  3. STATUS   — works out "Occupied / Vacant" for each unit from the reservations.
 *  4. BOOKING  — the 3-step modal: Details → Payment → Reserve.
 *
 * PRIVACY: customer search shows names and ID numbers of past guests. Once this is
 * backed by a real database, put it behind a staff login — never expose it publicly.
 */
(function () {
  "use strict";

  /* ======================= 1. CONFIG ======================= */
  var CONFIG = {
    currency: "$",
    vatRate: 0.16,        // Kenya VAT 16%
    vatInclusive: false,  // false = VAT is added on top of the nightly rate
    paymentModes: ["M-Pesa", "Cash", "Card", "Bank transfer"]
  };

  // One entry per bookable unit. `id` is what gets saved with each reservation.
  var UNITS = {
    "studio-1": { name: "Studio 1", type: "Studio", rate: 80, maxGuests: 2 },
    "studio-2": { name: "Studio 2", type: "Studio", rate: 80, maxGuests: 2 },
    "studio-3": { name: "Studio 3", type: "Studio", rate: 80, maxGuests: 2 },
    "studio-4": { name: "Studio 4", type: "Studio", rate: 80, maxGuests: 2 },
    "one-bedroom":   { name: "1 Bedroom house", type: "1 Bedroom", rate: 95,  maxGuests: 2 },
    "two-bedroom":   { name: "2 Bedroom house", type: "2 Bedroom", rate: 125, maxGuests: 4 },
    "three-bedroom": { name: "3 Bedroom house", type: "3 Bedroom", rate: 155, maxGuests: 6 }
  };

  /* ======================= 2. STORE ======================= */
  var KEYS = { reservations: "mh_reservations", customers: "mh_customers" };
  function readList(key) {
    try { var v = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function writeList(key, list) {
    try { localStorage.setItem(key, JSON.stringify(list)); return true; } catch (e) { return false; }
  }
  var STORE = {
    getReservations: function () { return readList(KEYS.reservations); },
    addReservation: function (r) { var l = readList(KEYS.reservations); l.push(r); return writeList(KEYS.reservations, l); },
    getCustomers: function () { return readList(KEYS.customers); },
    saveCustomer: function (c) {
      var l = readList(KEYS.customers);
      var key = c.idNumber.toLowerCase();
      var i = l.findIndex(function (x) { return (x.idNumber || "").toLowerCase() === key; });
      if (i >= 0) l[i] = c; else l.push(c);
      return writeList(KEYS.customers, l);
    }
  };

  /* ======================= helpers ======================= */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function addDaysISO(iso, n) {
    var p = iso.split("-"), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }
  function nightsBetween(a, b) {
    if (!a || !b) return 0;
    var pa = a.split("-"), pb = b.split("-");
    return Math.round((Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 864e5);
  }
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function niceDate(iso) { var p = iso.split("-"); return +p[2] + " " + MONTHS[+p[1] - 1] + " " + p[0]; }
  function shortDate(iso) { var p = iso.split("-"); return +p[2] + " " + MONTHS[+p[1] - 1]; }
  function money(n) {
    var v = Math.round(n * 100) / 100;
    return CONFIG.currency + v.toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  }
  function overlaps(aStart, aEnd, bStart, bEnd) { return aStart < bEnd && aEnd > bStart; }
  function maskId(id) { return id.length <= 4 ? id : "•••• " + id.slice(-4); }
  function newRef() {
    var t = todayISO().replace(/-/g, "").slice(2);
    var r = Math.random().toString(36).slice(2, 6).toUpperCase();
    return "MH-" + t + "-" + r;
  }
  function priceFor(rate, nights) {
    var base = rate * nights, vat, total, subtotal;
    if (CONFIG.vatInclusive) { total = base; vat = total - total / (1 + CONFIG.vatRate); subtotal = total - vat; }
    else { subtotal = base; vat = base * CONFIG.vatRate; total = subtotal + vat; }
    return { subtotal: subtotal, vat: vat, total: total };
  }

  /* ======================= 3. STATUS ======================= */
  function currentStay(unitId, today) {
    return STORE.getReservations().filter(function (r) {
      return r.unitId === unitId && r.checkIn <= today && today < r.checkOut;
    })[0] || null;
  }
  function nextStay(unitId, today) {
    return STORE.getReservations().filter(function (r) { return r.unitId === unitId && r.checkIn > today; })
      .sort(function (a, b) { return a.checkIn < b.checkIn ? -1 : 1; })[0] || null;
  }

  var board = document.querySelector("[data-unit-board]");
  if (!board) return;
  var cards = Array.prototype.slice.call(document.querySelectorAll(".unit-card"));
  var filterBtns = document.querySelectorAll(".unit-filter button");
  var activeFilter = "all";

  function renderStatus() {
    var today = todayISO(), vacant = 0;
    cards.forEach(function (card) {
      var id = card.getAttribute("data-unit");
      var stay = currentStay(id, today);
      var badge = card.querySelector(".unit-status");
      var note = card.querySelector(".unit-note");
      card.setAttribute("data-status", stay ? "occupied" : "vacant");
      if (stay) {
        badge.textContent = "Occupied";
        note.textContent = "Until " + shortDate(stay.checkOut) + ", book from then";
      } else {
        vacant++;
        badge.textContent = "Vacant";
        var nxt = nextStay(id, today);
        note.textContent = nxt ? "Free until " + shortDate(nxt.checkIn) : "Available tonight";
      }
    });
    var total = cards.length;
    document.querySelector("[data-count=vacant]").textContent = vacant;
    document.querySelector("[data-count=total]").textContent = total;
    document.querySelectorAll("[data-filter-count]").forEach(function (el) {
      var f = el.getAttribute("data-filter-count");
      el.textContent = f === "all" ? total : f === "vacant" ? vacant : total - vacant;
    });
    applyFilter();
  }
  function applyFilter() {
    cards.forEach(function (c) {
      c.hidden = !(activeFilter === "all" || c.getAttribute("data-status") === activeFilter);
    });
    document.querySelectorAll(".unit-group").forEach(function (g) {
      g.hidden = !g.querySelector(".unit-card:not([hidden])");
    });
    var empty = document.querySelector(".unit-empty");
    if (empty) empty.hidden = !!document.querySelector(".unit-card:not([hidden])");
  }
  filterBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      activeFilter = b.getAttribute("data-filter");
      filterBtns.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      applyFilter();
    });
  });

  /* ======================= 4. BOOKING MODAL ======================= */
  var dlg = document.getElementById("booking-modal");
  var form = document.getElementById("booking-steps");
  var steps = dlg.querySelectorAll(".bk-step");
  var stepTabs = dlg.querySelectorAll(".bk-progress li");
  var backBtn = dlg.querySelector(".bk-back");
  var nextBtn = dlg.querySelector(".bk-next");
  var reserveBtn = dlg.querySelector(".bk-reserve");
  var f = form.elements;
  var unit = null, unitId = null, step = 0, lastTrigger = null;

  var paySelect = f.payment;
  CONFIG.paymentModes.forEach(function (m) {
    var o = document.createElement("option"); o.value = m; o.textContent = m; paySelect.appendChild(o);
  });
  dlg.querySelector("[data-vat-label]").textContent =
    "VAT (" + Math.round(CONFIG.vatRate * 100) + "%" + (CONFIG.vatInclusive ? ", included" : "") + ")";

  function setError(name, msg) {
    var input = f[name], err = dlg.querySelector('[data-error-for="' + name + '"]');
    if (input) input.setAttribute("aria-invalid", msg ? "true" : "false");
    if (err) err.textContent = msg || "";
  }
  function clearErrors() {
    dlg.querySelectorAll("[data-error-for]").forEach(function (e) { e.textContent = ""; });
    dlg.querySelectorAll("[aria-invalid]").forEach(function (e) { e.setAttribute("aria-invalid", "false"); });
  }

  function clash(checkIn, checkOut) {
    return STORE.getReservations().filter(function (r) {
      return r.unitId === unitId && overlaps(checkIn, checkOut, r.checkIn, r.checkOut);
    })[0] || null;
  }

  function updateNights() {
    var n = nightsBetween(f.checkIn.value, f.checkOut.value);
    var out = dlg.querySelector("[data-nights]");
    out.textContent = n > 0 ? n + (n === 1 ? " night" : " nights") : "Choose your dates";
    out.classList.toggle("ready", n > 0);
    if (f.checkIn.value) f.checkOut.min = addDaysISO(f.checkIn.value, 1);
    updatePrice();
  }
  function updatePrice() {
    var n = Math.max(0, nightsBetween(f.checkIn.value, f.checkOut.value));
    var p = priceFor(unit ? unit.rate : 0, n);
    dlg.querySelector("[data-line-rate]").textContent = unit ? money(unit.rate) + " × " + n + (n === 1 ? " night" : " nights") : "";
    dlg.querySelector("[data-subtotal]").textContent = money((unit ? unit.rate : 0) * n);
    dlg.querySelector("[data-vat]").textContent = money(p.vat);
    dlg.querySelector("[data-total]").textContent = money(p.total);
    f.vat.value = p.vat.toFixed(2);
    f.total.value = p.total.toFixed(2);
  }
  f.checkIn.addEventListener("change", function () {
    if (f.checkOut.value && f.checkOut.value <= f.checkIn.value) f.checkOut.value = addDaysISO(f.checkIn.value, 1);
    updateNights();
  });
  f.checkOut.addEventListener("change", updateNights);

  function validate(s) {
    var ok = true;
    function need(name, msg) { if (!f[name].value.trim()) { setError(name, msg); ok = false; } else setError(name, ""); }
    if (s === 0) {
      var name = f.clientName.value.trim();
      if (name.length < 2) { setError("clientName", "Enter the client's full name."); ok = false; } else setError("clientName", "");
      need("idNumber", "Enter an ID or passport number.");
      var phone = f.phone.value.replace(/[\s-]/g, "");
      if (!/^\+?\d{9,15}$/.test(phone)) { setError("phone", "Enter a valid phone number, e.g. +254 712 345 678."); ok = false; } else setError("phone", "");
      var g = +f.guests.value;
      if (!g || g < 1 || g > unit.maxGuests) { setError("guests", "This unit sleeps up to " + unit.maxGuests + "."); ok = false; } else setError("guests", "");
      var today = todayISO();
      if (!f.checkIn.value) { setError("checkIn", "Choose a check-in date."); ok = false; }
      else if (f.checkIn.value < today) { setError("checkIn", "Check-in can't be in the past."); ok = false; }
      else setError("checkIn", "");
      if (!f.checkOut.value) { setError("checkOut", "Choose a check-out date."); ok = false; }
      else if (nightsBetween(f.checkIn.value, f.checkOut.value) < 1) { setError("checkOut", "Check-out must be after check-in."); ok = false; }
      else setError("checkOut", "");
      if (ok) {
        var c = clash(f.checkIn.value, f.checkOut.value);
        if (c) {
          setError("checkOut", unit.name + " is already booked " + shortDate(c.checkIn) + " – " + shortDate(c.checkOut) + ". Please choose other dates.");
          ok = false;
        }
      }
    }
    if (s === 1) need("payment", "Select a payment method.");
    if (!ok) { var first = dlg.querySelector('.bk-step.active [aria-invalid="true"]'); if (first) first.focus(); }
    return ok;
  }

  function fillReview() {
    var n = nightsBetween(f.checkIn.value, f.checkOut.value), p = priceFor(unit.rate, n);
    var rows = [
      ["Unit", unit.name],
      ["Client", f.clientName.value.trim()],
      ["ID / Passport", f.idNumber.value.trim()],
      ["Phone", f.phone.value.trim()],
      ["Guests", f.guests.value],
      ["Check-in", niceDate(f.checkIn.value)],
      ["Check-out", niceDate(f.checkOut.value)],
      ["Nights", n],
      ["Payment", f.payment.value + (f.reference.value.trim() ? " · " + f.reference.value.trim() : "")],
      ["Room charges", money(unit.rate) + " × " + n + " = " + money(unit.rate * n)],
      [dlg.querySelector("[data-vat-label]").textContent, money(p.vat)]
    ];
    var dl = dlg.querySelector(".bk-review");
    dl.innerHTML = "";
    rows.forEach(function (r) {
      var dt = document.createElement("dt"), dd = document.createElement("dd");
      dt.textContent = r[0]; dd.textContent = r[1]; dl.appendChild(dt); dl.appendChild(dd);
    });
    dlg.querySelector("[data-review-total]").textContent = money(p.total);
  }

  function showStep(s) {
    step = s;
    steps.forEach(function (el, i) { el.classList.toggle("active", i === s); el.hidden = i !== s; });
    stepTabs.forEach(function (li, i) {
      li.classList.toggle("done", i < s); li.classList.toggle("current", i === s);
      if (i === s) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    backBtn.hidden = s === 0 || s === 3;
    nextBtn.hidden = s >= 2;
    reserveBtn.hidden = s !== 2;
    dlg.querySelector(".bk-progress").hidden = s === 3;
    dlg.querySelector(".bk-foot").hidden = s === 3;
    if (s === 2) fillReview();
    var focusable = steps[s].querySelector("input, select, button, [tabindex]");
    if (focusable && s < 3) focusable.focus();
    dlg.querySelector(".bk-body").scrollTop = 0;
  }
  nextBtn.addEventListener("click", function () { if (validate(step)) showStep(step + 1); });
  backBtn.addEventListener("click", function () { showStep(step - 1); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (step < 2) { if (validate(step)) showStep(step + 1); return; }
    if (!validate(0) || !validate(1)) { showStep(!validate(0) ? 0 : 1); return; }
    var c = clash(f.checkIn.value, f.checkOut.value);
    if (c) { showStep(0); validate(0); return; }
    var n = nightsBetween(f.checkIn.value, f.checkOut.value), p = priceFor(unit.rate, n);
    var res = {
      ref: newRef(), unitId: unitId, unitName: unit.name,
      clientName: f.clientName.value.trim(), idNumber: f.idNumber.value.trim(), phone: f.phone.value.trim(),
      guests: +f.guests.value, checkIn: f.checkIn.value, checkOut: f.checkOut.value, nights: n,
      rate: unit.rate, subtotal: +p.subtotal.toFixed(2), vat: +p.vat.toFixed(2), total: +p.total.toFixed(2),
      vatRate: CONFIG.vatRate, vatInclusive: CONFIG.vatInclusive,
      payment: f.payment.value, reference: f.reference.value.trim(),
      createdAt: new Date().toISOString()
    };
    var saved = STORE.addReservation(res);
    STORE.saveCustomer({ name: res.clientName, idNumber: res.idNumber, phone: res.phone });
    dlg.querySelector("[data-done-ref]").textContent = res.ref;
    dlg.querySelector("[data-done-text]").textContent =
      res.unitName + " is reserved for " + res.clientName + ", " + niceDate(res.checkIn) + " to " + niceDate(res.checkOut) +
      " (" + n + (n === 1 ? " night" : " nights") + "). Total " + money(res.total) + " by " + res.payment + ".";
    dlg.querySelector("[data-done-warning]").hidden = saved;
    showStep(3);
    renderStatus();
    dlg.querySelector(".bk-done-close").focus();
  });

  function openBooking(id, trigger) {
    unitId = id; unit = UNITS[id]; lastTrigger = trigger;
    form.reset(); clearErrors(); hideSuggest();
    dlg.querySelector("[data-unit-name]").textContent = unit.name;
    dlg.querySelector("[data-unit-rate]").textContent = money(unit.rate);
    f.guests.max = unit.maxGuests;
    f.guests.value = Math.min(2, unit.maxGuests);
    dlg.querySelector("[data-guest-hint]").textContent = "Sleeps up to " + unit.maxGuests;
    var today = todayISO();
    var stay = currentStay(id, today);
    var start = stay ? stay.checkOut : today;
    f.checkIn.min = today;
    f.checkIn.value = start;
    f.checkOut.min = addDaysISO(start, 1);
    f.checkOut.value = addDaysISO(start, 1);
    updateNights();
    dlg.showModal();
    document.documentElement.style.overflow = "hidden";
    showStep(0);
  }
  function closeBooking() { dlg.close(); }
  dlg.addEventListener("close", function () {
    document.documentElement.style.overflow = "";
    if (lastTrigger) lastTrigger.focus();
  });
  dlg.querySelectorAll("[data-close]").forEach(function (b) { b.addEventListener("click", closeBooking); });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) closeBooking(); });

  board.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-book]");
    if (!btn) return;
    e.preventDefault();
    openBooking(btn.closest(".unit-card").getAttribute("data-unit"), btn);
  });

  /* ---- client name search (existing customers, min. 2 characters) ---- */
  var nameInput = f.clientName;
  var list = document.getElementById("bk-suggest");
  var matches = [], activeIdx = -1;
  function hideSuggest() { list.hidden = true; list.innerHTML = ""; nameInput.setAttribute("aria-expanded", "false"); activeIdx = -1; }
  function pick(c) {
    nameInput.value = c.name; f.idNumber.value = c.idNumber; f.phone.value = c.phone;
    setError("clientName", ""); setError("idNumber", ""); setError("phone", "");
    hideSuggest();
    dlg.querySelector("[data-customer-note]").textContent = "Returning guest: details filled in.";
  }
  nameInput.addEventListener("input", function () {
    dlg.querySelector("[data-customer-note]").textContent = "";
    var q = nameInput.value.trim().toLowerCase();
    if (q.length < 2) { hideSuggest(); return; }
    matches = STORE.getCustomers().filter(function (c) { return c.name.toLowerCase().indexOf(q) !== -1; }).slice(0, 6);
    list.innerHTML = "";
    if (!matches.length) {
      var li = document.createElement("li"); li.className = "bk-suggest-empty"; li.setAttribute("role", "presentation");
      li.textContent = "No existing customer found, new client.";
      list.appendChild(li);
    }
    matches.forEach(function (c, i) {
      var li = document.createElement("li");
      li.id = "bk-opt-" + i; li.setAttribute("role", "option");
      var strong = document.createElement("strong"); strong.textContent = c.name;
      var small = document.createElement("span"); small.textContent = "ID " + maskId(c.idNumber) + " · " + c.phone;
      li.appendChild(strong); li.appendChild(small);
      li.addEventListener("mousedown", function (ev) { ev.preventDefault(); pick(c); });
      list.appendChild(li);
    });
    list.hidden = false; nameInput.setAttribute("aria-expanded", "true"); activeIdx = -1;
  });
  nameInput.addEventListener("keydown", function (e) {
    if (list.hidden || !matches.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      activeIdx = (activeIdx + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
      list.querySelectorAll("[role=option]").forEach(function (o, i) { o.classList.toggle("active", i === activeIdx); });
      nameInput.setAttribute("aria-activedescendant", "bk-opt-" + activeIdx);
    } else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); pick(matches[activeIdx]); }
    else if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); hideSuggest(); }
  });
  nameInput.addEventListener("blur", function () { setTimeout(hideSuggest, 120); });

  /* ---- start ---- */
  renderStatus();
  // Re-check status at midnight-ish and when the tab comes back into view.
  document.addEventListener("visibilitychange", function () { if (!document.hidden) renderStatus(); });

  // Deep link from the home page: accommodation.html?room=studio|one|two|three
  var want = new URLSearchParams(location.search).get("room");
  var map = { studio: "studio-1", one: "one-bedroom", two: "two-bedroom", three: "three-bedroom" };
  if (want && map[want]) {
    var target = want === "studio"
      ? cards.filter(function (c) { return c.getAttribute("data-unit").indexOf("studio") === 0 && c.getAttribute("data-status") === "vacant"; })[0]
        || document.querySelector('[data-unit="studio-1"]')
      : document.querySelector('[data-unit="' + map[want] + '"]');
    if (target) {
      target.scrollIntoView({ block: "center" });
      target.classList.add("highlight");
      // came from a "Book now" button for this room: go straight to the booking form
      openBooking(target.getAttribute("data-unit"), target.querySelector("[data-book]"));
    }
  }
})();
