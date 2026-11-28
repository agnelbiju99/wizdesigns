// Coupon codes, checked on the server only (files starting with "_" are not public API routes).
// off = paise taken off the price; products = which product ids the code works on.
export const COUPONS = {
  // No active codes. Example: CODE: { off: 2000, products: /^board-exam(-|$)/ },
};

export function findCoupon(code, productId) {
  const key = String(code || "").trim().toUpperCase();
  const c = COUPONS[key];
  if (!c || !c.products.test(String(productId || ""))) return null;
  return { code: key, off: c.off };
}
