// Tells the product page whether a coupon code works for a product, and how much it takes off.
// The list of codes stays on the server; the page only learns about the code the buyer typed.
import { findCoupon } from "./_coupons.js";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  const { code, productId } = req.body || {};
  const c = findCoupon(code, productId);
  return res.status(200).json(c ? { ok: true, code: c.code, off: c.off } : { ok: false });
}
