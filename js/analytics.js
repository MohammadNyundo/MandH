/* M&H Boutique Hotel — visitor analytics
 * Paste the IDs below once the accounts exist; leave one empty to switch it off.
 *   GA4_ID      Google Analytics 4 → Admin → Data streams → Web → "Measurement ID" (G-XXXXXXXXXX)
 *   CLARITY_ID  Microsoft Clarity → Settings → Overview → "Project ID" (about 10 letters/numbers)
 * Tracking only runs on the real domain, so local testing and the old
 * vercel.app address don't pollute the numbers.
 */
(function () {
  "use strict";
  var GA4_ID = "";
  var CLARITY_ID = "";

  if (!/(^|\.)mandhboutiquehotel\.com$/.test(location.hostname)) return;

  function load(src) {
    var s = document.createElement("script");
    s.async = true; s.src = src;
    document.head.appendChild(s);
  }

  if (GA4_ID) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", GA4_ID);
    load("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA4_ID));
  }

  if (CLARITY_ID) {
    window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
    load("https://www.clarity.ms/tag/" + encodeURIComponent(CLARITY_ID));
  }
})();
