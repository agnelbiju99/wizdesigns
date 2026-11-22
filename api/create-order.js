import Razorpay from "razorpay";

const PRODUCTS = {
  "zero-to-trader": { name: "From Zero to Trader", amount: 28900 },
  "screener-guide": { name: "NSE Stock Screener Guide", amount: 39900 },
  "chart-setups-bible": { name: "Chart Setups Bible", amount: 14900 },
  "price-action-strategies": { name: "Price Action Strategies", amount: 14900 },
  "combo-all-4": { name: "Complete Bundle (All 4 Products)", amount: 74900 },
  "combo-all-4-planner": { name: "Complete Bundle + AI Money Coach Planner", amount: 79800 },
  "money-planner": { name: "AI Money Coach Planner", amount: 8800 },
  "money-planner-cards": { name: "AI Money Coach Planner + Financial Affirmation Cards", amount: 18700 },
  "affirmation-cards": { name: "Financial Affirmation Cards", amount: 14900 },
  "combo-zero-screener": { name: "From Zero to Trader + NSE Screener Guide", amount: 54900 },
  "combo-price-chart": { name: "Price Action Strategies + Chart Setups Bible", amount: 17900 },
  "product-journey": { name: "What Is A Digital Product?", amount: 8900 },
  "wedding-planner": { name: "Wedding Planning Dashboard", amount: 13400 },
  "wedding-planner-money": { name: "Wedding Planning Dashboard + AI Money Coach Planner", amount: 18300 },
  // Thank-you offer for planner buyers: only valid with a recent planner payment (checked below).
  "combo-all-4-offer": { name: "Complete Bundle (Planner buyer offer)", amount: 97400 },
};

// Planner-buyer offer: the bundle at ₹974 within 48 hours of a paid planner order.
const OFFER_WINDOW_SECONDS = 48 * 60 * 60;
const PLANNER_AMOUNTS = [69900, 79800, 8800, 18700, 27800, 37700];

// Scheduled price change: from 4 Nov 2026, 12:00 AM IST these amounts are charged instead.
// The website switches the prices it shows at the same moment.
const PRICE_CHANGE_AT = Date.parse("2026-11-03T18:30:00Z");
const NEW_AMOUNTS = {
  "zero-to-trader": 49900,
  "screener-guide": 69900,
  "chart-setups-bible": 29900,
  "price-action-strategies": 29900,
  "combo-all-4": 127900,
  "combo-all-4-planner": 132800,
};

// Scheduled planner price change: from 26 Nov 2026, 12:00 AM IST
// (₹88 extended to the end of 25 Nov on customer request).
const PLANNER_CHANGE_AT = Date.parse("2026-11-25T18:30:00Z");
const PLANNER_NEW_AMOUNTS = {
  "money-planner": 27800,
  "money-planner-cards": 37700,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { productId, offerPaymentId } = req.body || {};
  const product = PRODUCTS[productId];

  if (!product) {
    return res.status(400).json({ error: "Invalid product" });
  }

  let amount = product.amount;
  if (Date.now() >= PRICE_CHANGE_AT && NEW_AMOUNTS[productId]) amount = NEW_AMOUNTS[productId];
  if (Date.now() >= PLANNER_CHANGE_AT && PLANNER_NEW_AMOUNTS[productId]) amount = PLANNER_NEW_AMOUNTS[productId];

  const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  const notes = { product: productId };
  if (productId === "combo-all-4-offer") {
    try {
      const p = await instance.payments.fetch(String(offerPaymentId || ""));
      const fresh = Math.floor(Date.now() / 1000) - p.created_at <= OFFER_WINDOW_SECONDS;
      if (p.status !== "captured" || !PLANNER_AMOUNTS.includes(p.amount) || !fresh) {
        return res.status(400).json({ error: "This offer has expired or isn't valid for this purchase." });
      }
      notes.offer_from = p.id;
    } catch (e) {
      return res.status(400).json({ error: "This offer has expired or isn't valid for this purchase." });
    }
  }

  try {
    const order = await instance.orders.create({
      amount,
      currency: "INR",
      notes,
    });

    return res.status(200).json({
      orderId: order.id,
      amount,
      keyId: process.env.RAZORPAY_KEY_ID,
      productName: product.name,
    });
  } catch (err) {
    console.error("Order creation failed:", err);
    return res.status(500).json({ error: "Could not create order" });
  }
}
