import Razorpay from "razorpay";

// Recent real purchases, for the "someone just bought" pop-up.
// Returns only payment times and 24-hour / 7-day counts — never names, phone numbers, emails or payment IDs.
//   /api/recent-orders                 → Complete Bundle orders
//   /api/recent-orders?product=planner → AI Money Coach Planner orders
//   /api/recent-orders?product=wedding → Wedding Planning Dashboard orders

const PRODUCTS = {
  // All prices the bundle has been sold at, so recent sales keep showing after each price change:
  // ₹749 / ₹998, ₹979 / ₹1,228, ₹1,279 / ₹1,528, ₹1,328 (bundle + ₹49 planner add-on), ₹974 (planner-buyer offer).
  bundle: [74900, 99800, 97900, 122800, 127900, 152800, 132800, 97400],
  // Planner on its own and with the affirmation cards: ₹699 / ₹798, ₹88 / ₹187, ₹278 / ₹377 (from 20 Nov).
  // With one ₹48 add-on (Debt-Free Tracker or 2027 Year Reset): ₹136 / ₹326; with both: ₹184 / ₹374.
  planner: [69900, 79800, 8800, 18700, 27800, 37700, 13600, 32600, 18400, 37400],
  // Wedding Planning Dashboard on its own (₹174, now ₹134) and with the ₹49 planner add-on (₹223, now ₹183).
  wedding: [17400, 22300, 13400, 18300],
};
const MAX_AGE_DAYS = 30;
const MAX_RESULTS = 10;
const MAX_PAGES = 10; // up to 1,000 payments per request

// Your own test payments are left out so they never show as customer orders.
const EXCLUDE_PHONES = ["8301070364"];
const EXCLUDE_EMAILS = ["agnelbiju99@gmail.com"];

function isOwnPayment(p) {
  const phone = String(p.contact || "").replace(/\D/g, "");
  const email = String(p.email || "").toLowerCase();
  return EXCLUDE_PHONES.some((n) => phone.endsWith(n)) || EXCLUDE_EMAILS.includes(email);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const amounts = PRODUCTS[(req.query && req.query.product) || "bundle"] || PRODUCTS.bundle;

  const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  try {
    const now = Math.floor(Date.now() / 1000);
    const since = now - MAX_AGE_DAYS * 24 * 60 * 60;

    // Razorpay returns at most 100 payments per call, newest first, so page through them.
    const items = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await instance.payments.all({ from: since, count: 100, skip: page * 100 });
      const batch = result.items || [];
      items.push(...batch);
      if (batch.length < 100) break;
    }

    const times = items
      .filter((p) => p.status === "captured" && amounts.includes(p.amount) && !isOwnPayment(p))
      // Debt-Free Tracker combos share amounts with others (₹174 = old wedding price), so leave them out.
      .filter((p) => !String((p.notes && p.notes.product) || "").startsWith("debt-tracker"))
      .map((p) => p.created_at)
      .sort((a, b) => b - a);

    const last24h = times.filter((t) => t >= now - 24 * 60 * 60).length;
    const last7d = times.filter((t) => t >= now - 7 * 24 * 60 * 60).length;

    // Let Vercel cache this for 5 minutes so visitors don't each call Razorpay.
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ purchases: times.slice(0, MAX_RESULTS), last24h, last7d });
  } catch (err) {
    console.error("Recent orders fetch failed:", err);
    return res.status(500).json({ purchases: [], last24h: 0, last7d: 0 });
  }
}
