import Razorpay from "razorpay";

// Recent real Complete Bundle purchases, for the "someone just bought" pop-up.
// Returns only payment times — never names, phone numbers, emails or payment IDs.

const BUNDLE_AMOUNT = 74900;
const MAX_AGE_DAYS = 30;
const MAX_RESULTS = 10;

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

  const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  try {
    const since = Math.floor(Date.now() / 1000) - MAX_AGE_DAYS * 24 * 60 * 60;
    const result = await instance.payments.all({ from: since, count: 100 });

    const times = (result.items || [])
      .filter((p) => p.status === "captured" && p.amount === BUNDLE_AMOUNT && !isOwnPayment(p))
      .map((p) => p.created_at)
      .sort((a, b) => b - a)
      .slice(0, MAX_RESULTS);

    // Let Vercel cache this for 5 minutes so visitors don't each call Razorpay.
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ purchases: times });
  } catch (err) {
    console.error("Recent orders fetch failed:", err);
    return res.status(500).json({ purchases: [] });
  }
}
