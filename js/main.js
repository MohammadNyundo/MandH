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
  function setMenu(open) {
    header.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.documentElement.style.overflow = open ? "hidden" : "";
  }
  if (header && toggle) {
    toggle.addEventListener("click", function () { setMenu(!header.classList.contains("open")); });
    header.querySelectorAll(".nav a").forEach(function (a) {
      a.addEventListener("click", function () { setMenu(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.classList.contains("open")) setMenu(false);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 1100 && header.classList.contains("open")) setMenu(false);
    });
  }

  /* ---------- Home: transparent bar turns solid on scroll ---------- */
  if (header && header.classList.contains("overlay")) {
    var onScroll = function () { header.classList.toggle("scrolled", window.scrollY > 40); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Footer: keep the copyright year current ---------- */
  document.querySelectorAll(".footer-year").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- FAQ: reveal one answer at a time ---------- */
  var faqItems = document.querySelectorAll(".faq-item");
  function setFaq(item, open) {
    item.classList.toggle("open", open);
    item.querySelector(".faq-q").setAttribute("aria-expanded", open ? "true" : "false");
  }
  faqItems.forEach(function (item) {
    item.querySelector(".faq-q").addEventListener("click", function () {
      var willOpen = !item.classList.contains("open");
      faqItems.forEach(function (other) { setFaq(other, false); });
      if (willOpen) setFaq(item, true);
    });
  });

  /* ---------- Room photo pop-up (home page cards) ---------- */
  document.querySelectorAll("[data-room-gallery]").forEach(function (card) {
    var dlg = document.getElementById(card.getAttribute("data-room-gallery"));
    if (!dlg || typeof dlg.showModal !== "function") return; // no <dialog> support: link still works
    var track = dlg.querySelector(".rg-track");
    var slides = dlg.querySelectorAll(".rg-slide");
    var thumbs = dlg.querySelectorAll(".rg-thumb");
    var nowEl = dlg.querySelector(".rg-now");
    var index = 0, loaded = false;

    function loadImages() {
      if (loaded) return;
      dlg.querySelectorAll("img[data-src]").forEach(function (img) { img.src = img.getAttribute("data-src"); });
      loaded = true;
    }
    function go(i) {
      index = (i + slides.length) % slides.length;
      track.style.transform = "translateX(" + (-100 * index) + "%)";
      nowEl.textContent = index + 1;
      slides.forEach(function (s, k) { s.setAttribute("aria-hidden", k === index ? "false" : "true"); });
      thumbs.forEach(function (t, k) {
        t.classList.toggle("active", k === index);
        if (k === index) t.setAttribute("aria-current", "true"); else t.removeAttribute("aria-current");
      });
      if (thumbs[index]) thumbs[index].scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    function open(e) {
      e.preventDefault();
      loadImages(); go(0);
      dlg.showModal();
      document.documentElement.style.overflow = "hidden";
    }
    card.addEventListener("click", open);
    dlg.addEventListener("close", function () { document.documentElement.style.overflow = ""; card.focus(); });
    dlg.querySelector(".rg-close").addEventListener("click", function () { dlg.close(); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); }); // click the dark backdrop
    dlg.querySelector(".rg-prev").addEventListener("click", function () { go(index - 1); });
    dlg.querySelector(".rg-next").addEventListener("click", function () { go(index + 1); });
    thumbs.forEach(function (t, k) { t.addEventListener("click", function () { go(k); }); });
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    });
    // swipe on phones
    var x0 = null;
    track.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    track.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  });

  /* ---------- Booking page: pre-select the room from ?room= ---------- */
  var roomParam = new URLSearchParams(window.location.search).get("room");
  if (roomParam) {
    var roomStarts = { studio: "Studio", one: "One bedroom", two: "Two bedroom", three: "Three bedroom" };
    var want = roomStarts[roomParam];
    document.querySelectorAll("input[name=room]").forEach(function (r) {
      if (want && r.value.indexOf(want) === 0) r.checked = true;
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

  /* ---------- Food & Drinks: menu tabs (#food / #drinks) ---------- */
  var tabs = document.querySelectorAll(".menu-tabs [role=tab]");
  if (tabs.length) {
    function show(id) {
      tabs.forEach(function (t) {
        var on = t.getAttribute("aria-controls") === id;
        t.setAttribute("aria-selected", on);
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () {
        show(t.getAttribute("aria-controls"));
        history.replaceState(null, "", "#" + t.getAttribute("aria-controls"));
      });
      t.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        var next = tabs[(i + d + tabs.length) % tabs.length];
        next.click();
        next.focus();
      });
    });
    function fromHash() {
      var id = location.hash.slice(1);
      if (id === "food" || id === "drinks") {
        show(id);
        document.getElementById("menu").scrollIntoView();
      } else show("food");
    }
    window.addEventListener("hashchange", fromHash);
    fromHash();
  }
})();
