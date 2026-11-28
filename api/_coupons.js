// Coupon codes, checked on the server only (files starting with "_" are not public API routes).
// off = paise taken off the price; products = which product ids the code works on.
export const COUPONS = {
  // Old-school students: Board Exam Tracker for ₹88 instead of ₹149 (add-ons still added on top).
  RSRV: { off: 6100, products: /^board-exam(-|$)/ },
};

export function findCoupon(code, productId) {
  const key = String(code || "").trim().toUpperCase();
  const c = COUPONS[key];
  if (!c || !c.products.test(String(productId || ""))) return null;
  return { code: key, off: c.off };
}
