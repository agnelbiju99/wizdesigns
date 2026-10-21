/* Wiz Designs shared script — used by the homepage and product pages.
   (combo-all-4.html keeps its own copy of this logic inline.)
   Any <button class="buy" data-product data-name data-amount> starts a Razorpay checkout. */

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
    body: JSON.stringify({ productId }),
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
            showDownloadLink(result.productName, result.files, response.razorpay_payment_id);
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
const mainBuyBtn = document.getElementById("buy-btn");
document.querySelectorAll(".js-buy-proxy").forEach((b) => {
  b.addEventListener("click", () => mainBuyBtn && mainBuyBtn.click());
});

// Checkout only opens by itself for links that ask for it: page.html?buy=1
if (mainBuyBtn && new URLSearchParams(location.search).get("buy") === "1") {
  window.addEventListener("load", () => setTimeout(() => mainBuyBtn.click(), 600));
}

function showDownloadLink(productName, files, paymentId) {
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
  if (!toast) return;
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
    return currentRzp || document.querySelector(".lightbox-overlay.open, .success-overlay.open");
  }

  document.getElementById("bt-close").addEventListener("click", () => {
    toast.classList.remove("show");
    dismissed = true;
    try { sessionStorage.setItem("wizToastClosed", "1"); } catch (e) {}
  });

  // Fetch right away so the first pop-up can appear exactly FIRST_DELAY after the page opens.
  const pageStart = Date.now();
  fetch("/api/recent-orders")
    .then((r) => (r.ok ? r.json() : { purchases: [] }))
    .then((data) => {
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
if (!reduceMotion) {
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
  const PLUS = { product: "combo-all-4-planner", name: "Complete Bundle + AI Money Coach Planner", amount: 99800, label: "Get Bundle + Planner — ₹998", short: "Get Bundle + Planner", price: "₹998" };
  const PLANNER_IMGS = ["images/planner-daily.jpg", "images/planner-insights.jpg", "images/planner-payday.jpg", "images/planner-goals.jpg"];

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
    if (check.checked && typeof fbq === "function") fbq("trackCustom", "AddPlannerAddon", { value: 249, currency: "INR" });
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
