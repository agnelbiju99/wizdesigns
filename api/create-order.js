// Creates a Razorpay order when a customer clicks "Buy Now".
// Called from index.html via fetch("/api/create-order", { method: "POST", body: { productId } })

import Razorpay from "razorpay";

// Prices are in paise (₹1 = 100 paise). Update here if prices change.
const PRODUCTS = {
  "zero-to-trader": { name: "From Zero to Trader", amount: 23900 },
  "screener-guide": { name: "NSE Stock Screener Guide", amount: 24900 },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { productId } = req.body || {};
  const product = PRODUCTS[productId];

  if (!product) {
    return res.status(400).json({ error: "Invalid product" });
  }

  const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  try {
    const order = await instance.orders.create({
      amount: product.amount,
      currency: "INR",
      // notes.product is how the webhook later knows which PDF to deliver
      notes: { product: productId },
    });

    return res.status(200).json({
      orderId: order.id,
      amount: product.amount,
      keyId: process.env.RAZORPAY_KEY_ID,
      productName: product.name,
    });
  } catch (err) {
    console.error("Order creation failed:", err);
    return res.status(500).json({ error: "Could not create order" });
  }
}
