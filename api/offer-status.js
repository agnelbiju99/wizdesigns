import Razorpay from "razorpay";

// Tells the bundle-offer page whether a planner payment still qualifies for the ₹974 offer,
// and until when. Returns only valid/expiry — never names, phone numbers, emails or amounts.
const OFFER_WINDOW_SECONDS = 48 * 60 * 60;
const PLANNER_AMOUNTS = [69900, 79800, 8800, 18700, 27800, 37700, 13600, 32600];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const id = String((req.query && req.query.p) || "");
  if (!/^pay_[A-Za-z0-9]{6,30}$/.test(id)) {
    return res.status(200).json({ valid: false });
  }

  const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  try {
    const p = await instance.payments.fetch(id);
    const expiresAt = (p.created_at + OFFER_WINDOW_SECONDS) * 1000;
    const valid = p.status === "captured" && PLANNER_AMOUNTS.includes(p.amount) && Date.now() < expiresAt;
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(valid ? { valid: true, expiresAt } : { valid: false });
  } catch (err) {
    return res.status(200).json({ valid: false });
  }
}
