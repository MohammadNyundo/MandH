/* M&H Boutique Hotel — site scripts */
(function () {
  "use strict";

  // Where booking requests and reviews go.
  // If FORM_ENDPOINT is empty, forms open the visitor's email app (mailto).
  // To receive submissions directly, create a free form at formspree.io (or similar)
  // and paste its URL here, e.g. "https://formspree.io/f/xxxxxxx".
  var FORM_ENDPOINT = "";
  var HOTEL_EMAIL = "mandhboutiquehotel@gmail.com";

  /* ---------- Mobile navigation ---------- */
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  if (header && toggle) {
    toggle.addEventListener("click", function () {
      var open = header.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    header.querySelectorAll(".nav a").forEach(function (a) {
      a.addEventListener("click", function () {
        header.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Shared submit helper ---------- */
  function send(subject, fields, statusEl, onDone) {
    var lines = Object.keys(fields).map(function (k) { return k + ": " + fields[k]; });

    if (!FORM_ENDPOINT) {
      window.location.href = "mailto:" + HOTEL_EMAIL +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(lines.join("\n"));
      if (statusEl) statusEl.textContent = "Your email app should open with your message ready to send.";
      if (onDone) onDone(true);
      return;
    }

    if (statusEl) statusEl.textContent = "Sending…";
    var data = Object.assign({ _subject: subject }, fields);
    fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(data)
    }).then(function (r) {
      if (!r.ok) throw new Error("bad status");
      if (statusEl) statusEl.textContent = "Thank you! We have received your message.";
      if (onDone) onDone(true);
    }).catch(function () {
      if (statusEl) statusEl.textContent = "Sorry, something went wrong. Please email " + HOTEL_EMAIL + ".";
      if (onDone) onDone(false);
    });
  }

  /* ---------- Booking form ---------- */
  var booking = document.getElementById("booking-form");
  if (booking) {
    booking.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = booking.elements;
      var room = booking.querySelector("input[name=room]:checked");
      var fields = {
        "First name": f["first_name"].value,
        "Last name": f["last_name"].value,
        "Email": f["email"].value,
        "Phone": f["phone"].value,
        "Arrival date": f["arrival_date"].value,
        "Arrival from (time)": f["arrival_time"].value,
        "Departure date": f["departure_date"].value,
        "Departure till (time)": f["departure_time"].value,
        "Room": room ? room.value : "",
        "Number of nights": f["nights"].value,
        "Number of guests": f["guests"].value
      };
      send("Hotel reservation – " + fields["First name"] + " " + fields["Last name"],
        fields, document.getElementById("booking-status"),
        function (ok) { if (ok && FORM_ENDPOINT) booking.reset(); });
    });
  }

  /* ---------- Add-your-review modal ---------- */
  var modal = document.getElementById("review-modal");
  if (modal) {
    var openBtns = document.querySelectorAll("[data-open-review]");
    var textarea = modal.querySelector("textarea");
    var status = modal.querySelector(".review-status");
    function openModal() { modal.classList.add("open"); setTimeout(function () { textarea.focus(); }, 50); }
    function closeModal() { modal.classList.remove("open"); }
    openBtns.forEach(function (b) { b.addEventListener("click", openModal); });
    modal.querySelector(".overlay").addEventListener("click", closeModal);
    modal.querySelector(".close").addEventListener("click", closeModal);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });
    modal.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      if (!textarea.value.trim()) { textarea.focus(); return; }
      send("New guest review", { "Review": textarea.value }, status, function (ok) {
        if (ok && FORM_ENDPOINT) { textarea.value = ""; setTimeout(closeModal, 1500); }
      });
    });
    if (location.hash === "#add-review") openModal();
  }
})();
