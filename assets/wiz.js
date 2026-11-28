/* Wiz Designs shared script — used by the homepage and product pages.
   (combo-all-4.html keeps its own copy of this logic inline.)
   Any <button class="buy" data-product data-name data-amount> starts a Razorpay checkout. */

// ---------- Scheduled price change: 4 Dec 2026, 12:00 AM IST ----------
// The ₹749-bundle prices are back as a sale until 3 Dec, 11:59 PM IST (first switch was 4 Nov).
// Before this moment those prices show; from it, every price on the page switches
// to the new one. The server (api/create-order.js) switches what it charges at the same moment.
const PRICE_CHANGE_AT = Date.parse("2026-12-03T18:30:00Z");
const PRICE_TEXT_AFTER = {
  "749": "1,279", "998": "1,528", "986": "1,796", "237": "517",
  "289": "499", "399": "699", "149": "299",
  "688": "1,198", "298": "598", "139": "649", "119": "419",
  "460": "780", "350": "580", "600": "980", "299": "829", "798": "1,328"
};
const PRICE_AMOUNT_AFTER = { "28900": "49900", "39900": "69900", "14900": "29900", "74900": "127900", "99800": "152800", "79800": "132800" };
const newPricesLive = () => Date.now() >= PRICE_CHANGE_AT;
function newPriceText(t) {
  return t.replace(/₹([\d,]+)/g, (m, v) => (PRICE_TEXT_AFTER[v] ? "₹" + PRICE_TEXT_AFTER[v] : m));
}
if (newPricesLive()) {
  document.querySelectorAll(".price-countdown").forEach((el) => el.remove());
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeValue.indexOf("₹") !== -1 && !node.parentElement.closest("[data-price-fixed]")) node.nodeValue = newPriceText(node.nodeValue);
  }
  document.querySelectorAll("[data-amount]").forEach((b) => {
    if (PRICE_AMOUNT_AFTER[b.dataset.amount] && !b.closest("[data-price-fixed]")) b.dataset.amount = PRICE_AMOUNT_AFTER[b.dataset.amount];
  });
}

// ---------- Scheduled planner price change: 3 Dec 2026, 12:00 AM IST (₹88 extended by one week, to 2 Dec, on customer request) ----------
// Elements marked data-later / data-amount-later switch to the new planner price at that moment.
// The server (api/create-order.js) changes what it charges at the same time.
const PLANNER_CHANGE_AT = Date.parse("2026-12-02T18:30:00Z");
const plannerPriceLive = () => Date.now() >= PLANNER_CHANGE_AT;
if (plannerPriceLive()) {
  document.querySelectorAll(".offer-countdown").forEach((el) => el.remove());
  document.querySelectorAll("[data-later]").forEach((el) => { el.textContent = el.dataset.later; });
  document.querySelectorAll("[data-amount-later]").forEach((b) => { b.dataset.amount = b.dataset.amountLater; });
}

// ---------- Sale prices inside fixed-price areas (until 4 Dec 2026, 12:00 AM IST) ----------
// data-sale-text / data-sale-amount show the sale price; data-sale-text-later is used once the planner is ₹278.
if (!newPricesLive()) {
  document.querySelectorAll("[data-sale-text]").forEach((el) => {
    el.textContent = plannerPriceLive() && el.dataset.saleTextLater ? el.dataset.saleTextLater : el.dataset.saleText;
  });
  document.querySelectorAll("[data-sale-amount]").forEach((b) => { b.dataset.amount = b.dataset.saleAmount; });
}

// ============ SETTINGS — EDIT THIS ============
// Your WhatsApp Business number with country code, digits only. Example: "919876543210"
// While this is empty, all WhatsApp buttons stay hidden.
const WHATSAPP_NUMBER = "918301070364";
// ===============================================

function waLink(msg) {
  return "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(msg);
}

document.querySelectorAll(".js-wa, .js-wa-hint").forEach((el) => {
  if (!WHATSAPP_NUMBER) { el.style.display = "none"; return; }
  if (el.classList.contains("js-wa")) {
    el.href = waLink(el.dataset.msg || "Hi!");
    el.target = "_blank";
    el.rel = "noopener";
    el.addEventListener("click", () => {
      if (typeof fbq === "function") fbq("track", "Contact");
    });
  }
});

// ---------- Checkout ----------
let currentRzp = null;

function openCheckoutSafely(rzp) {
  currentRzp = rzp;
  // Push a history entry so the phone's back button closes the checkout
  // instead of leaving the page.
  history.pushState({ wizCheckoutOpen: true }, "", location.href);
  rzp.open();
}

// Remove the extra history entry once checkout closes by any other means,
// so the next back press works normally.
function clearCheckoutHistory() {
  if (history.state && history.state.wizCheckoutOpen) history.back();
}

window.addEventListener("popstate", function () {
  if (currentRzp) {
    const rzp = currentRzp;
    currentRzp = null;
    try { rzp.close(); } catch (e) {}
  }
});

function setStatus(msg) {
  const el = document.getElementById("status-message");
  if (!el) return;
  el.textContent = msg;
  if (msg) el.scrollIntoView({ block: "center" });
}

function startCheckout(btn) {
  const productId = btn.dataset.product;
  const productName = btn.dataset.name;
  const amountRupees = parseInt(btn.dataset.amount, 10) / 100;

  if (typeof fbq === "function") {
    fbq("track", "InitiateCheckout", {
      content_ids: [productId], content_name: productName, content_type: "product",
      value: amountRupees, currency: "INR", num_items: 1
    });
  }

  if (typeof Razorpay === "undefined") {
    setStatus("Payment page is still loading — please tap the button again in a second.");
    return;
  }

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = "Opening checkout...";
  setStatus("");

  fetch("/api/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, offerPaymentId: btn.dataset.offer || undefined, coupon: btn.dataset.coupon || undefined }),
  })
    .then((orderRes) => {
      if (!orderRes.ok) throw new Error("Could not start checkout. Please try again.");
      return orderRes.json();
    })
    .then((order) => {
      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: "INR",
        name: "Wiz Designs",
        description: productName,
        order_id: order.orderId,
        handler: async function (response) {
          currentRzp = null;
          clearCheckoutHistory();
          setStatus("Payment received — verifying...");
          try {
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (!verifyRes.ok) throw new Error("Could not verify payment.");
            const result = await verifyRes.json();

            if (typeof fbq === "function") {
              fbq("track", "Purchase", {
                value: amountRupees,
                currency: "INR",
                content_name: productName,
                content_ids: [productId],
                content_type: "product",
              }, { eventID: response.razorpay_payment_id });
            }

            setStatus("");
            showDownloadLink(result.productName, result.files, response.razorpay_payment_id, productId);
          } catch (err) {
            setStatus(
              "Payment succeeded but we couldn't fetch your download link automatically. " +
              (WHATSAPP_NUMBER
                ? "Please WhatsApp us your payment ID (" + response.razorpay_payment_id + ") and we'll send it right away."
                : "Please DM us your payment ID (" + response.razorpay_payment_id + ") on Instagram @agnel_biju and we'll send it right away.")
            );
          }
        },
        modal: {
          ondismiss: function () {
            btn.disabled = false;
            btn.textContent = originalText;
            if (currentRzp) { currentRzp = null; clearCheckoutHistory(); }
            showCheckoutHelp(btn);
          },
        },
        theme: { color: "#00C9A7" },
      };

      const rzp = new Razorpay(options);
      rzp.on("payment.failed", function () {
        setStatus("Payment didn't go through. No money was taken — please try again, or try a different UPI app.");
        btn.disabled = false;
        btn.textContent = originalText;
      });

      openCheckoutSafely(rzp);
      btn.disabled = false;
      btn.textContent = originalText;
    })
    .catch((err) => {
      setStatus(err.message || "Something went wrong. Please try again.");
      btn.disabled = false;
      btn.textContent = originalText;
    });
}

document.querySelectorAll("button[data-product]").forEach((btn) => {
  btn.addEventListener("click", () => startCheckout(btn));
});

// Extra Buy buttons (final section + sticky bar) all trigger the main one.
// ---------- Closed-checkout help prompt ----------
// Shown when someone closes the Razorpay window without paying: offers WhatsApp help or a retry.
// Appears at most once per page visit so it never nags.
let checkoutHelpShown = false;
function showCheckoutHelp(btn) {
  if (checkoutHelpShown) return;
  checkoutHelpShown = true;
  const name = btn.dataset.name;
  const price = "₹" + parseInt(btn.dataset.amount, 10) / 100;
  let box = document.getElementById("checkout-help");
  if (!box) {
    box = document.createElement("div");
    box.className = "checkout-help";
    box.id = "checkout-help";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Need help with your payment?");
    box.innerHTML =
      '<div class="ch-card">' +
        '<button class="ch-x" aria-label="Close">&times;</button>' +
        "<h3>Didn't go through, or still deciding?</h3>" +
        "<p>No money was taken. If your UPI app didn't open or you have a question, message me on WhatsApp — I'll help you finish, or you can pay by direct UPI.</p>" +
        '<div class="ch-actions">' +
          '<a class="ch-wa" target="_blank" rel="noopener">💬 Chat on WhatsApp</a>' +
          '<button class="ch-retry">Try again</button>' +
        "</div>" +
        '<span class="ch-note">Tap Try again to reopen the secure payment window.</span>' +
      "</div>";
    document.body.appendChild(box);
    box.querySelector(".ch-x").addEventListener("click", () => box.classList.remove("open"));
  }
  const wa = box.querySelector(".ch-wa");
  if (WHATSAPP_NUMBER) {
    wa.href = waLink("Hi! I was buying " + name + " (" + price + ") on your website but didn't finish. Can you help?");
    wa.onclick = () => {
      if (typeof fbq === "function") fbq("track", "Contact", { content_name: name });
      box.classList.remove("open");
    };
  } else {
    wa.style.display = "none";
  }
  box.querySelector(".ch-retry").onclick = () => {
    box.classList.remove("open");
    btn.click();
  };
  document.getElementById("buy-toast") && document.getElementById("buy-toast").classList.remove("show");
  box.classList.add("open");
  if (typeof fbq === "function") fbq("trackCustom", "CheckoutClosed", { content_name: name, value: parseInt(btn.dataset.amount, 10) / 100, currency: "INR" });
}

const mainBuyBtn = document.getElementById("buy-btn");
document.querySelectorAll(".js-buy-proxy").forEach((b) => {
  b.addEventListener("click", () => mainBuyBtn && mainBuyBtn.click());
});

// Checkout only opens by itself for links that ask for it: page.html?buy=1
if (mainBuyBtn && new URLSearchParams(location.search).get("buy") === "1") {
  window.addEventListener("load", () => setTimeout(() => mainBuyBtn.click(), 600));
}

function showDownloadLink(productName, files, paymentId, productId) {
  document.getElementById("success-product-name").textContent = productName + " is ready!";

  const container = document.getElementById("success-download-links");
  container.innerHTML = files
    .map(
      (f) =>
        '<a href="' + f.url + '" target="_blank" rel="noopener" class="download-btn">Download: ' + f.label + "</a>"
    )
    .join("");

  const successWa = document.getElementById("success-wa");
  if (WHATSAPP_NUMBER && successWa) {
    successWa.href = waLink("Hi! I just bought " + productName + ". Payment ID: " + paymentId + ". Please send me the files here too.");
  }

  // Thank-you offer for planner buyers: the bundle at ₹974 for 48 hours (checked on the server).
  const old = document.getElementById("offer-box");
  if (old) old.remove();
  // The ₹974 thank-you offer is paused during the ₹749 sale (the regular bundle is cheaper then).
  if ((productId === "money-planner" || productId === "money-planner-cards" || productId === "money-planner-debt" || productId === "money-planner-yr" || productId === "money-planner-debt-yr") && newPricesLive()) {
    const box = document.createElement("div");
    box.className = "offer-box";
    box.id = "offer-box";
    box.innerHTML =
      '<div class="ob-top">🎁 Thank-you offer · next 48 hours</div>' +
      '<div class="ob-title">All 4 trading guides for <b>₹974</b> <s>₹1,279</s></div>' +
      '<p class="ob-text">From Zero to Trader, NSE Screener Guide, Chart Setups Bible and Price Action Strategies — only for planner buyers.</p>' +
      '<a class="ob-btn" href="/bundle-offer.html?p=' + encodeURIComponent(paymentId) + '" target="_blank" rel="noopener">See the offer →</a>';
    document.querySelector("#success-overlay .success-box").insertBefore(box, document.querySelector("#success-overlay .close-note").nextSibling);
    if (typeof fbq === "function") fbq("trackCustom", "OfferShown", { content_name: "Planner buyer bundle offer" });
  }

  document.getElementById("success-overlay").classList.add("open");

  if (files.length === 1) {
    window.open(files[0].url, "_blank", "noopener");
  }
}

function closeSuccessModal() {
  document.getElementById("success-overlay").classList.remove("open");
}

// ---------- Sticky buy bar ----------
const stickyBar = document.getElementById("sticky-bar");
const buyBox = document.getElementById("buy-box");
if (stickyBar && buyBox && "IntersectionObserver" in window) {
  new IntersectionObserver((entries) => {
    const e = entries[0];
    // show only after the main buy box has scrolled up past the top
    const on = !e.isIntersecting && e.boundingClientRect.top < 0;
    stickyBar.classList.toggle("show", on);
    document.body.classList.toggle("sticky-on", on);
  }).observe(buyBox);
}

// ---------- Scroll reveal + count-up ----------
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function countUp(el) {
  const to = parseInt(el.dataset.to, 10);
  const fmt = (n) => el.dataset.format === "in" ? n.toLocaleString("en-IN") : String(n);
  if (reduceMotion) { el.textContent = fmt(to); return; }
  const start = performance.now(), dur = 1400;
  (function tick(now) {
    const p = Math.min(1, (now - start) / dur);
    el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(tick);
  })(start);
}

if ("IntersectionObserver" in window && !reduceMotion) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      e.target.querySelectorAll(".count").forEach(countUp);
      io.unobserve(e.target);
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
} else {
  document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
}

// ---------- Lightbox ----------
let gallery = [], lightboxIndex = 0;

function openGallery(srcs, i) {
  gallery = srcs;
  lightboxIndex = (i + gallery.length) % gallery.length;
  document.getElementById("lightbox-img").src = gallery[lightboxIndex];
  document.getElementById("lightbox-overlay").classList.add("open");
}
function stepLightbox(d) { openGallery(gallery, lightboxIndex + d); }
function closeLightbox() { document.getElementById("lightbox-overlay").classList.remove("open"); }

document.addEventListener("keydown", (e) => {
  const lb = document.getElementById("lightbox-overlay");
  if (!lb || !lb.classList.contains("open")) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") stepLightbox(-1);
  if (e.key === "ArrowRight") stepLightbox(1);
});

// Any image with class "zoomable" opens on its own.
document.querySelectorAll("img.zoomable").forEach((img) => {
  img.style.cursor = "zoom-in";
  img.addEventListener("click", () => openGallery([img.getAttribute("src")], 0));
});

// ---------- Look-inside carousel ----------
const peekTrack = document.getElementById("peek-track");
if (peekTrack) {
  const peekImgs = Array.from(peekTrack.querySelectorAll("img"));
  const peekCount = document.getElementById("peek-count");
  const peekSrcs = peekImgs.map((img) => img.getAttribute("src"));

  const currentPeek = () => {
    const mid = peekTrack.scrollLeft + peekTrack.clientWidth / 2;
    let best = 0, bestDist = Infinity;
    peekTrack.querySelectorAll(".peek").forEach((el, i) => {
      const d = Math.abs(el.offsetLeft - peekTrack.offsetLeft + el.offsetWidth / 2 - mid);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  };

  peekTrack.addEventListener("scroll", () => {
    if (peekCount) peekCount.textContent = (currentPeek() + 1) + " / " + peekImgs.length;
  }, { passive: true });

  document.querySelectorAll(".peek-btn").forEach((b) => {
    b.addEventListener("click", () => {
      const i = Math.min(peekImgs.length - 1, Math.max(0, currentPeek() + parseInt(b.dataset.dir, 10)));
      const el = peekTrack.querySelectorAll(".peek")[i];
      peekTrack.scrollTo({ left: el.offsetLeft - peekTrack.offsetLeft - (peekTrack.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
    });
  });

  peekImgs.forEach((img, i) => img.addEventListener("click", () => openGallery(peekSrcs, i)));
}

// ---------- Instagram reels: load Instagram's player only when the section is near ----------
(function () {
  const reels = document.getElementById("reels");
  if (!reels) return;
  let loaded = false;
  function loadInstagram() {
    if (loaded) return;
    loaded = true;
    const sc = document.createElement("script");
    sc.async = true;
    sc.src = "https://www.instagram.com/embed.js";
    sc.onload = () => { if (window.instgrm) window.instgrm.Embeds.process(); };
    document.body.appendChild(sc);
  }
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { loadInstagram(); io.disconnect(); }
    }, { rootMargin: "600px 0px" });
    io.observe(reels);
  } else {
    loadInstagram();
  }
})();

// ---------- Recent purchase pop-up (real orders only, from /api/recent-orders) ----------
(function () {
  const toast = document.getElementById("buy-toast");
  // No purchase pop-up on the wedding planner page.
  if (!toast || toast.dataset.product === "wedding") return;
  const when = document.getElementById("bt-when");
  // Each pop-up stays 6 seconds, then a 3-second pause before the next one.
  const FIRST_DELAY = 2000, SHOW_FOR = 6000, PAUSE = 3000, GAP = SHOW_FOR + PAUSE, MAX_SHOWN = 6;
  let dismissed = false;
  try { dismissed = sessionStorage.getItem("wizToastClosed") === "1"; } catch (e) {}
  if (dismissed) return;

  function ago(ts) {
    const s = Math.max(60, Math.floor(Date.now() / 1000) - ts);
    const m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (d >= 1) return d === 1 ? "1 day ago" : d + " days ago";
    if (h >= 1) return h === 1 ? "1 hour ago" : h + " hours ago";
    return m === 1 ? "1 minute ago" : m + " minutes ago";
  }

  // Don't pop up over the checkout, a zoomed image or the download screen.
  function busy() {
    return currentRzp || document.querySelector(".lightbox-overlay.open, .success-overlay.open, .checkout-help.open");
  }

  document.getElementById("bt-close").addEventListener("click", () => {
    toast.classList.remove("show");
    dismissed = true;
    try { sessionStorage.setItem("wizToastClosed", "1"); } catch (e) {}
  });

  // Fetch right away so the first pop-up can appear exactly FIRST_DELAY after the page opens.
  const pageStart = Date.now();
  const product = toast.dataset.product || "bundle";
  fetch("/api/recent-orders" + (product === "bundle" ? "" : "?product=" + encodeURIComponent(product)))
    .then((r) => (r.ok ? r.json() : { purchases: [] }))
    .then((data) => {
      // Real order counts, each shown once there are enough to mean something.
      // Planner page: the 7-day count only. Other pages: the 24-hour count.
      const count = document.getElementById("bt-count");
      if (count) {
        const lines = [];
        if (product === "planner") {
          if (data.last7d >= 3) lines.push("🔥 " + data.last7d + " orders in the last 7 days");
        } else if (data.last24h >= 3) {
          lines.push("🔥 " + data.last24h + " orders in the last 24 hours");
        }
        count.textContent = "";
        lines.forEach((t) => { const s = document.createElement("span"); s.textContent = t; s.style.display = "block"; count.appendChild(s); });
        count.hidden = lines.length === 0;
      }
      const list = (data.purchases || []).slice(0, MAX_SHOWN);
      const waited = Date.now() - pageStart;
      list.forEach((ts, i) => {
        setTimeout(() => {
          if (dismissed || busy()) return;
          when.textContent = ago(ts);
          toast.classList.add("show");
          setTimeout(() => toast.classList.remove("show"), SHOW_FOR);
        }, Math.max(0, FIRST_DELAY - waited) + i * GAP);
      });
    })
    .catch(() => {});
})();

// ---------- 3D avatars on reviews ----------
(function () {
  const avatarTpl = document.getElementById("avatar-tpl");
  if (!avatarTpl) return;
  document.querySelectorAll(".review").forEach((card, n) => {
    const av = card.querySelector(".avatar");
    if (!av) return;
    const svg = avatarTpl.content.firstElementChild.cloneNode(true);
    // give each avatar's gradients unique ids so colours don't clash
    svg.querySelectorAll("[id]").forEach((node) => {
      const id = node.id, uid = id + "-" + n;
      node.id = uid;
      svg.querySelectorAll("[fill='url(#" + id + ")'], [clip-path='url(#" + id + ")']").forEach((ref) => {
        if (ref.getAttribute("fill") === "url(#" + id + ")") ref.setAttribute("fill", "url(#" + uid + ")");
        if (ref.getAttribute("clip-path") === "url(#" + id + ")") ref.setAttribute("clip-path", "url(#" + uid + ")");
      });
    });
    av.style.setProperty("--h", card.dataset.hue || "168");
    av.appendChild(svg);
    const ini = document.createElement("span");
    ini.className = "ini";
    ini.textContent = av.dataset.initial || "";
    av.appendChild(ini);
  });
})();

// ---------- Auto-scrolling marquees ----------
// The track's content is duplicated so the loop is seamless. Touch/hover pauses it.
// Runs even with "reduce motion" on: battery-saver modes switch that on and left the strips stuck.
{
  document.querySelectorAll(".marquee").forEach((marquee) => {
    const track = marquee.querySelector(".marquee-track");
    Array.from(track.children).forEach((child) => {
      const clone = child.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      track.appendChild(clone);
    });
    let resumeTimer;
    marquee.addEventListener("touchstart", () => { clearTimeout(resumeTimer); marquee.classList.add("paused"); }, { passive: true });
    marquee.addEventListener("touchend", () => { resumeTimer = setTimeout(() => marquee.classList.remove("paused"), 2500); }, { passive: true });
  });
}

// ---------- Bundle add-on: AI Money Coach Planner ----------
(function () {
  const check = document.getElementById("addon-check");
  const btn = document.getElementById("buy-btn");
  if (!check || !btn) return;
  const BASE = { product: "combo-all-4", name: "Complete Bundle (All 4 Products)", amount: 74900, label: "Get All 4 Guides — ₹749", short: "Get All 4 Guides", price: "₹749" };
  const PLUS = { product: "combo-all-4-planner", name: "Complete Bundle + AI Money Coach Planner", amount: 79800, label: "Get Bundle + Planner — ₹798", short: "Get Bundle + Planner", price: "₹798" };
  if (newPricesLive()) {
    [BASE, PLUS].forEach((o) => {
      o.amount = +PRICE_AMOUNT_AFTER[o.amount];
      o.label = newPriceText(o.label);
      o.price = newPriceText(o.price);
    });
  }
  const PLANNER_IMGS = ["images/planner-cover.jpg", "images/planner-daily.jpg", "images/planner-payday.jpg", "images/planner-goals.jpg", "images/planner-ai-coach.jpg"];

  function apply() {
    const o = check.checked ? PLUS : BASE;
    document.getElementById("addon").classList.toggle("on", check.checked);
    btn.dataset.product = o.product;
    btn.dataset.name = o.name;
    btn.dataset.amount = o.amount;
    btn.textContent = o.label;
    document.querySelectorAll(".js-buy-proxy").forEach((b) => {
      b.textContent = b.closest(".sticky-bar") ? o.short : o.label;
    });
    document.querySelectorAll(".sticky-bar .now").forEach((el) => { el.textContent = o.price; });
  }
  check.addEventListener("change", () => {
    apply();
    if (check.checked && typeof fbq === "function") fbq("trackCustom", "AddPlannerAddon", { value: 49, currency: "INR" });
  });
  apply();

  // The picture and "See the planner" open the preview instead of ticking the box.
  function preview(e) {
    e.preventDefault();
    e.stopPropagation();
    openGallery(PLANNER_IMGS, 0);
  }
  document.getElementById("addon-preview").addEventListener("click", preview);
  const thumb = document.getElementById("addon-thumb");
  thumb.addEventListener("click", preview);
  thumb.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") preview(e); });
})();

// ---------- Two ₹48 add-ons on one buy box (planner page, Debt-Free Tracker page) ----------
// Each add-on is a <label class="addon" id="ID"> with #ID-check, #ID-thumb and #ID-preview.
// combos maps the ticked add-on keys (joined with "+", in the order listed) to the product sold.
function setupAddons(cfg) {
  const btn = document.getElementById("buy-btn");
  const checks = cfg.addons.map((a) => document.getElementById(a.id + "-check"));
  if (!btn || checks.some((c) => !c)) return;

  function apply() {
    const on = cfg.addons.filter((a, i) => checks[i].checked);
    const key = on.map((a) => a.key).join("+");
    const c = cfg.combos[key];
    const cp = window.WIZ_COUPON;   // set by the coupon box (checked by the server)
    const total = cfg.basePrice + on.reduce((s, a) => s + a.price, 0) - (cp ? cp.off / 100 : 0);
    if (cp) btn.dataset.coupon = cp.code; else delete btn.dataset.coupon;
    cfg.addons.forEach((a, i) => document.getElementById(a.id).classList.toggle("on", checks[i].checked));
    btn.dataset.product = c.product;
    btn.dataset.name = c.name;
    btn.dataset.amount = total * 100;
    btn.textContent = c.label + " — ₹" + total;
    document.querySelectorAll(".js-buy-proxy").forEach((b) => {
      b.textContent = b.closest(".sticky-bar") ? c.short : c.label + " — ₹" + total;
    });
    document.querySelectorAll(".sticky-bar .now").forEach((el) => { el.textContent = "₹" + total; });
  }

  cfg.addons.forEach((a, i) => {
    checks[i].addEventListener("change", () => {
      apply();
      if (checks[i].checked && typeof fbq === "function") fbq("trackCustom", a.event, { value: a.price, currency: "INR", source: cfg.source });
    });
    // The picture and the preview link open the gallery instead of ticking the box.
    const preview = (e) => { e.preventDefault(); e.stopPropagation(); openGallery(a.imgs, 0); };
    document.getElementById(a.id + "-preview").addEventListener("click", preview);
    const thumb = document.getElementById(a.id + "-thumb");
    thumb.addEventListener("click", preview);
    thumb.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") preview(e); });
  });
  apply();
  window.WIZ_REFRESH_PRICE = apply;
}

// Planner page: Debt-Free Tracker ₹48 and 2027 Year Reset ₹48, only with the planner.
setupAddons({
  source: "money-planner",
  basePrice: plannerPriceLive() ? 278 : 88,   // planner price: ₹88 until 2 Dec, then ₹278
  addons: [
    { id: "debt-addon", key: "debt", price: 48, event: "AddDebtTrackerAddon", imgs: ["images/dft-cover.jpg", "images/dft-m-laptop.jpg", "images/dft-m-plan.jpg", "images/dft-m-cards.jpg", "images/dft-m-malayalam.jpg", "images/dft-m-dark.jpg"] },
    { id: "pl-yr-addon", key: "yr", price: 48, event: "AddYearResetAddon", imgs: ["images/yr-cover.jpg", "images/yr-phone-dashboard.jpg", "images/yr-app-goals.jpg", "images/yr-vision-phone.jpg", "images/yr-habits-phone.jpg", "images/yr-malayalam-phone.jpg"] },
  ],
  combos: {
    "":        { product: "money-planner", name: "AI Money Coach Planner", label: "Get the planner", short: "Get the planner" },
    "debt":    { product: "money-planner-debt", name: "AI Money Coach Planner + Debt-Free Tracker", label: "Get Planner + Debt Tracker", short: "Get Planner + Tracker" },
    "yr":      { product: "money-planner-yr", name: "AI Money Coach Planner + 2027 Year Reset", label: "Get Planner + Year Reset", short: "Get Planner + Year Reset" },
    "debt+yr": { product: "money-planner-debt-yr", name: "AI Money Coach Planner + Debt-Free Tracker + 2027 Year Reset", label: "Get all 3", short: "Get all 3" },
  },
});

// Wedding planner page: AI Money Coach Planner ₹58 and Debt-Free Tracker ₹48, only with the wedding planner.
setupAddons({
  source: "wedding",
  basePrice: 134,
  addons: [
    { id: "wedding-addon", key: "money", price: 58, event: "AddPlannerAddon", imgs: ["images/planner-cover.jpg", "images/planner-daily.jpg", "images/planner-payday.jpg", "images/planner-goals.jpg", "images/planner-ai-coach.jpg"] },
    { id: "wedding-debt-addon", key: "debt", price: 48, event: "AddDebtTrackerAddon", imgs: ["images/dft-cover.jpg", "images/dft-m-laptop.jpg", "images/dft-m-plan.jpg", "images/dft-m-cards.jpg", "images/dft-m-malayalam.jpg", "images/dft-m-dark.jpg"] },
  ],
  combos: {
    "":           { product: "wedding-planner", name: "Wedding Planning Dashboard", label: "Get the wedding planner", short: "Get the wedding planner" },
    "money":      { product: "wedding-planner-money", name: "Wedding Planning Dashboard + AI Money Coach Planner", label: "Get Wedding + Money Planner", short: "Get both" },
    "debt":       { product: "wedding-planner-debt", name: "Wedding Planning Dashboard + Debt-Free Tracker", label: "Get Wedding + Debt Tracker", short: "Get both" },
    "money+debt": { product: "wedding-planner-money-debt", name: "Wedding Planning Dashboard + AI Money Coach Planner + Debt-Free Tracker", label: "Get all 3", short: "Get all 3" },
  },
});

// Year Reset page: AI Money Coach Planner ₹58 and Debt-Free Tracker ₹48, only with the Year Reset.
setupAddons({
  source: "year-reset",
  basePrice: 89,
  addons: [
    { id: "yr-addon", key: "money", price: 58, event: "AddPlannerAddon", imgs: ["images/planner-cover.jpg", "images/planner-daily.jpg", "images/planner-payday.jpg", "images/planner-goals.jpg", "images/planner-ai-coach.jpg"] },
    { id: "yr-debt-addon", key: "debt", price: 48, event: "AddDebtTrackerAddon", imgs: ["images/dft-cover.jpg", "images/dft-m-laptop.jpg", "images/dft-m-plan.jpg", "images/dft-m-cards.jpg", "images/dft-m-malayalam.jpg", "images/dft-m-dark.jpg"] },
  ],
  combos: {
    "":           { product: "year-reset", name: "2027 Year Reset", label: "Get the Year Reset", short: "Get the Year Reset" },
    "money":      { product: "year-reset-money", name: "2027 Year Reset + AI Money Coach Planner", label: "Get Year Reset + Money Planner", short: "Get both" },
    "debt":       { product: "year-reset-debt", name: "2027 Year Reset + Debt-Free Tracker", label: "Get Year Reset + Debt Tracker", short: "Get both" },
    "money+debt": { product: "year-reset-money-debt", name: "2027 Year Reset + AI Money Coach Planner + Debt-Free Tracker", label: "Get all 3", short: "Get all 3" },
  },
});

// Debt-Free Tracker page: AI Money Coach Planner ₹58 and 2027 Year Reset ₹48, only with the tracker.
setupAddons({
  source: "debt-tracker",
  basePrice: 78,
  addons: [
    { id: "dft-addon", key: "money", price: 58, event: "AddPlannerAddon", imgs: ["images/planner-cover.jpg", "images/planner-daily.jpg", "images/planner-payday.jpg", "images/planner-goals.jpg", "images/planner-ai-coach.jpg"] },
    { id: "dft-yr-addon", key: "yr", price: 48, event: "AddYearResetAddon", imgs: ["images/yr-cover.jpg", "images/yr-phone-dashboard.jpg", "images/yr-app-goals.jpg", "images/yr-vision-phone.jpg", "images/yr-habits-phone.jpg", "images/yr-malayalam-phone.jpg"] },
  ],
  combos: {
    "":         { product: "debt-tracker", name: "Debt-Free Tracker", label: "Get the tracker", short: "Get the tracker" },
    "money":    { product: "debt-tracker-money", name: "Debt-Free Tracker + AI Money Coach Planner", label: "Get Tracker + Money Planner", short: "Get both" },
    "yr":       { product: "debt-tracker-yr", name: "Debt-Free Tracker + 2027 Year Reset", label: "Get Tracker + Year Reset", short: "Get both" },
    "money+yr": { product: "debt-tracker-money-yr", name: "Debt-Free Tracker + AI Money Coach Planner + 2027 Year Reset", label: "Get all 3", short: "Get all 3" },
  },
});

// Job Hunt Tracker page: AI Money Coach Planner ₹48, 2027 Year Reset ₹48 and Offer Check ₹39, only with the tracker.
setupAddons({
  source: "job-tracker",
  basePrice: 44,
  addons: [
    { id: "jht-addon", key: "money", price: 48, event: "AddPlannerAddon", imgs: ["images/planner-cover.jpg", "images/planner-daily.jpg", "images/planner-payday.jpg", "images/planner-goals.jpg", "images/planner-ai-coach.jpg"] },
    { id: "jht-yr-addon", key: "yr", price: 48, event: "AddYearResetAddon", imgs: ["images/yr-cover.jpg", "images/yr-phone-dashboard.jpg", "images/yr-app-goals.jpg", "images/yr-vision-phone.jpg", "images/yr-habits-phone.jpg", "images/yr-malayalam-phone.jpg"] },
    { id: "jht-oc-addon", key: "offer", price: 39, event: "AddOfferCheckAddon", imgs: ["images/oc-cover-v3.jpg", "images/oc-p-realpay-hd.jpg", "images/oc-p-steps-hd.jpg", "images/oc-p-kerala-hd.jpg", "images/oc-m-sheet.jpg"] },
  ],
  combos: {
    "":         { product: "job-tracker", name: "Job Hunt Tracker", label: "Get the tracker", short: "Get the tracker" },
    "money":    { product: "job-tracker-money", name: "Job Hunt Tracker + AI Money Coach Planner", label: "Get Tracker + Money Planner", short: "Get both" },
    "yr":       { product: "job-tracker-yr", name: "Job Hunt Tracker + 2027 Year Reset", label: "Get Tracker + Year Reset", short: "Get both" },
    "money+yr": { product: "job-tracker-money-yr", name: "Job Hunt Tracker + AI Money Coach Planner + 2027 Year Reset", label: "Get all 3", short: "Get all 3" },
    "offer":          { product: "job-tracker-offer", name: "Job Hunt Tracker + Offer Check", label: "Get Tracker + Offer Check", short: "Get both" },
    "money+offer":    { product: "job-tracker-money-offer", name: "Job Hunt Tracker + AI Money Coach Planner + Offer Check", label: "Get all 3", short: "Get all 3" },
    "yr+offer":       { product: "job-tracker-yr-offer", name: "Job Hunt Tracker + 2027 Year Reset + Offer Check", label: "Get all 3", short: "Get all 3" },
    "money+yr+offer": { product: "job-tracker-money-yr-offer", name: "Job Hunt Tracker + AI Money Coach Planner + 2027 Year Reset + Offer Check", label: "Get all 4", short: "Get all 4" },
  },
});

// Offer Check page: Job Hunt Tracker ₹39 and AI Money Coach Planner ₹48, only with Offer Check.
setupAddons({
  source: "offer-check",
  basePrice: 44,
  addons: [
    { id: "oc-job-addon", key: "job", price: 39, event: "AddJobTrackerAddon", imgs: ["images/jht-cover-v2.jpg", "images/jht-p-interviews.jpg", "images/jht-m-message.jpg", "images/jht-p-flatlay.jpg", "images/jht-p-laptop.jpg"] },
    { id: "oc-money-addon", key: "money", price: 48, event: "AddPlannerAddon", imgs: ["images/planner-cover.jpg", "images/planner-daily.jpg", "images/planner-payday.jpg", "images/planner-goals.jpg", "images/planner-ai-coach.jpg"] },
  ],
  combos: {
    "":          { product: "offer-check", name: "Offer Check", label: "Get Offer Check", short: "Get Offer Check" },
    "job":       { product: "offer-check-job", name: "Offer Check + Job Hunt Tracker", label: "Get Offer Check + Job Tracker", short: "Get both" },
    "money":     { product: "offer-check-money", name: "Offer Check + AI Money Coach Planner", label: "Get Offer Check + Money Planner", short: "Get both" },
    "job+money": { product: "offer-check-job-money", name: "Offer Check + Job Hunt Tracker + AI Money Coach Planner", label: "Get all 3", short: "Get all 3" },
  },
});

// Budget Meal Planner page: AI Money Coach Planner ₹58 and Debt-Free Tracker ₹48, only with the meal planner.
setupAddons({
  source: "meal-planner",
  basePrice: 44,
  addons: [
    { id: "meal-money-addon", key: "money", price: 58, event: "AddPlannerAddon", imgs: ["images/planner-cover.jpg", "images/planner-daily.jpg", "images/planner-payday.jpg", "images/planner-goals.jpg", "images/planner-ai-coach.jpg"] },
    { id: "meal-debt-addon", key: "debt", price: 48, event: "AddDebtTrackerAddon", imgs: ["images/dft-cover.jpg", "images/dft-m-laptop.jpg", "images/dft-m-plan.jpg", "images/dft-m-cards.jpg", "images/dft-m-malayalam.jpg", "images/dft-m-dark.jpg"] },
  ],
  combos: {
    "":           { product: "meal-planner", name: "Budget Meal Planner", label: "Get the meal planner", short: "Get the meal planner" },
    "money":      { product: "meal-planner-money", name: "Budget Meal Planner + AI Money Coach Planner", label: "Get Meal + Money Planner", short: "Get both" },
    "debt":       { product: "meal-planner-debt", name: "Budget Meal Planner + Debt-Free Tracker", label: "Get Meal Planner + Debt Tracker", short: "Get both" },
    "money+debt": { product: "meal-planner-money-debt", name: "Budget Meal Planner + AI Money Coach Planner + Debt-Free Tracker", label: "Get all 3", short: "Get all 3" },
  },
});

// Digital Detox page: 2027 Year Reset ₹48 and AI Money Coach Planner ₹58, only with the challenge.
setupAddons({
  source: "digital-detox",
  basePrice: 44,
  addons: [
    { id: "detox-yr-addon", key: "yr", price: 48, event: "AddYearResetAddon", imgs: ["images/yr-cover.jpg", "images/yr-phone-dashboard.jpg", "images/yr-app-goals.jpg", "images/yr-vision-phone.jpg", "images/yr-habits-phone.jpg", "images/yr-malayalam-phone.jpg"] },
    { id: "detox-money-addon", key: "money", price: 58, event: "AddPlannerAddon", imgs: ["images/planner-cover.jpg", "images/planner-daily.jpg", "images/planner-payday.jpg", "images/planner-goals.jpg", "images/planner-ai-coach.jpg"] },
  ],
  combos: {
    "":         { product: "digital-detox", name: "Digital Detox 30-Day Challenge", label: "Start the challenge", short: "Start the challenge" },
    "yr":       { product: "digital-detox-yr", name: "Digital Detox + 2027 Year Reset", label: "Get Detox + Year Reset", short: "Get both" },
    "money":    { product: "digital-detox-money", name: "Digital Detox + AI Money Coach Planner", label: "Get Detox + Money Planner", short: "Get both" },
    "yr+money": { product: "digital-detox-yr-money", name: "Digital Detox + 2027 Year Reset + AI Money Coach Planner", label: "Get all 3", short: "Get all 3" },
  },
});

// Board Exam Tracker page: Digital Detox ₹39 and 2027 Year Reset ₹48, only with the exam tracker.
setupAddons({
  source: "board-exam",
  basePrice: 149,
  addons: [
    { id: "board-detox-addon", key: "detox", price: 39, event: "AddDetoxAddon", imgs: ["images/detox-cover-v2.jpg", "images/detox-p-urge.jpg", "images/detox-p-plan.jpg", "images/detox-p-kerala.jpg", "images/detox-p-wallchart.jpg"] },
    { id: "board-yr-addon", key: "yr", price: 48, event: "AddYearResetAddon", imgs: ["images/yr-cover.jpg", "images/yr-phone-dashboard.jpg", "images/yr-app-goals.jpg", "images/yr-vision-phone.jpg", "images/yr-habits-phone.jpg", "images/yr-malayalam-phone.jpg"] },
  ],
  combos: {
    "":         { product: "board-exam", name: "Board Exam Tracker 2027", label: "Get the exam tracker", short: "Get the exam tracker" },
    "detox":    { product: "board-exam-detox", name: "Board Exam Tracker 2027 + Digital Detox", label: "Get Exam Tracker + Detox", short: "Get both" },
    "yr":       { product: "board-exam-yr", name: "Board Exam Tracker 2027 + 2027 Year Reset", label: "Get Exam Tracker + Year Reset", short: "Get both" },
    "detox+yr": { product: "board-exam-detox-yr", name: "Board Exam Tracker 2027 + Digital Detox + 2027 Year Reset", label: "Get all 3", short: "Get all 3" },
  },
});

// ---------- Demo video on product pages ----------
// A muted, looping preview plays in the .demo-hero box once the page has loaded and it is near the screen (not on data saver
// or reduced motion: then the poster shows with a play button). Tapping it, or "Watch with sound",
// opens the full demo with sound in a pop-up. The full video only downloads when opened.
(function () {
  document.querySelectorAll(".demo-hero").forEach((box) => {
    const frame = box.querySelector(".demo-frame");
    const conn = navigator.connection || {};
    const lite = reduceMotion || conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "");
    let preview = null;
    if (!lite) {
      const start = () => {
        preview = document.createElement("video");
        ["muted", "playsinline", "loop", "autoplay"].forEach((a) => preview.setAttribute(a, ""));
        preview.muted = true; preview.preload = "auto"; preview.src = box.dataset.demoPreview;
        preview.addEventListener("playing", () => frame.classList.add("playing"));
        frame.insertBefore(preview, frame.firstChild.nextSibling);
        const p = preview.play(); if (p && p.catch) p.catch(() => {});
      };
      // start only once the page has loaded and the video is near the screen
      const whenLoaded = (fn) => (document.readyState === "complete" ? fn() : window.addEventListener("load", fn));
      if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); whenLoaded(start); } }, { rootMargin: "300px 0px" });
        io.observe(frame);
      } else whenLoaded(start);
    }
    const open = () => {
      if (preview) preview.pause();
      const o = document.createElement("div");
      o.className = "demo-overlay"; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "Demo video");
      o.innerHTML = '<video controls playsinline autoplay preload="auto"></video><button class="demo-close" aria-label="Close video">&times;</button>';
      const v = o.querySelector("video"); v.src = box.dataset.demoFull; v.poster = box.dataset.demoPoster;
      const close = () => { v.pause(); v.removeAttribute("src"); v.load(); o.remove(); document.removeEventListener("keydown", esc); if (preview) { const p = preview.play(); if (p && p.catch) p.catch(() => {}); } };
      const esc = (e) => { if (e.key === "Escape") close(); };
      o.addEventListener("click", (e) => { if (e.target === o) close(); });
      o.querySelector(".demo-close").addEventListener("click", close);
      document.addEventListener("keydown", esc);
      document.body.appendChild(o); o.querySelector(".demo-close").focus();
      const p = v.play(); if (p && p.catch) p.catch(() => {});
      if (typeof fbq === "function") fbq("trackCustom", "WatchDemo", { product: box.dataset.product || "" });
    };
    frame.addEventListener("click", open);
    const btn = box.querySelector(".demo-sound"); if (btn) btn.addEventListener("click", open);
  });
})();

// ---------- Coupon box (Board Exam Tracker page) ----------
// The server says whether a code works (api/check-coupon); the checkout checks it again.
// A link like page.html?coupon=RSRV fills in and applies the code automatically.
(function () {
  const box = document.getElementById("coupon-box"); if (!box) return;
  const input = document.getElementById("coupon-input"), msg = document.getElementById("coupon-msg");
  const priceEls = [document.querySelector(".price-block .now"), document.querySelector(".title-price b")].filter(Boolean);
  const base = box.dataset.base, product = box.dataset.product;
  async function apply(code) {
    code = String(code || "").trim(); if (!code) return;
    msg.textContent = "Checking…";
    try {
      const r = await fetch("/api/check-coupon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, productId: product }) });
      const d = await r.json();
      if (!d.ok) { window.WIZ_COUPON = null; msg.textContent = "That code isn't valid for this product."; box.classList.remove("ok"); }
      else {
        window.WIZ_COUPON = { code: d.code, off: d.off };
        const now = parseInt(base, 10) - d.off / 100;
        priceEls.forEach((el) => { el.innerHTML = '<s class="coupon-was">₹' + base + "</s> ₹" + now; });
        msg.textContent = "Code " + d.code + " applied: ₹" + now + " instead of ₹" + base + ".";
        box.classList.add("ok"); input.value = d.code;
        if (typeof fbq === "function") fbq("trackCustom", "CouponApplied", { code: d.code, product });
      }
    } catch (e) { msg.textContent = "Couldn't check the code. Please try again."; }
    if (window.WIZ_REFRESH_PRICE) window.WIZ_REFRESH_PRICE();
  }
  document.getElementById("coupon-apply").addEventListener("click", () => apply(input.value));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); apply(input.value); } });
  const fromLink = new URLSearchParams(location.search).get("coupon");
  if (fromLink) { box.open = true; input.value = fromLink; apply(fromLink); }
})();

// ---------- Offer countdowns (any .offer-countdown with data-deadline) ----------
document.querySelectorAll(".offer-countdown[data-deadline]").forEach((box) => {
  const end = Date.parse(box.dataset.deadline);
  const pad = (n) => String(n).padStart(2, "0");
  function tick() {
    const ms = end - Date.now();
    if (ms <= 0) { location.reload(); return; }   // reload so every price switches together
    const s = Math.floor(ms / 1000);
    box.querySelector(".pc-d").textContent = Math.floor(s / 86400);
    box.querySelector(".pc-h").textContent = pad(Math.floor((s % 86400) / 3600));
    box.querySelector(".pc-m").textContent = pad(Math.floor((s % 3600) / 60));
    box.querySelector(".pc-s").textContent = pad(s % 60);
  }
  tick();
  setInterval(tick, 1000);
});

// ---------- Planner-buyer bundle offer page (bundle-offer.html?p=pay_...) ----------
(function () {
  const page = document.getElementById("offer-page");
  if (!page) return;
  // During the ₹749 sale the regular bundle is cheaper than this offer, so send buyers there.
  if (!newPricesLive()) { location.replace("/combo-all-4.html"); return; }
  const pid = new URLSearchParams(location.search).get("p") || "";
  const show = (id) => { ["offer-checking", "offer-valid", "offer-expired"].forEach((x) => { document.getElementById(x).hidden = x !== id; }); };
  fetch("/api/offer-status?p=" + encodeURIComponent(pid))
    .then((r) => r.json())
    .then((d) => {
      if (!d.valid) { show("offer-expired"); return; }
      show("offer-valid");
      document.querySelectorAll("button[data-product='combo-all-4-offer']").forEach((b) => { b.dataset.offer = pid; });
      const pad = (n) => String(n).padStart(2, "0");
      const tick = () => {
        const ms = d.expiresAt - Date.now();
        if (ms <= 0) { show("offer-expired"); return; }
        const s = Math.floor(ms / 1000);
        document.getElementById("of-h").textContent = pad(Math.floor(s / 3600));
        document.getElementById("of-m").textContent = pad(Math.floor((s % 3600) / 60));
        document.getElementById("of-s").textContent = pad(s % 60);
      };
      tick();
      setInterval(tick, 1000);
    })
    .catch(() => show("offer-expired"));
})();
