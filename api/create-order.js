// Creates a Razorpay order when a customer clicks "Buy Now"
// Real implementation added in the next build step, once Razorpay keys
// are added to Vercel environment variables.

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // TODO (next step):
  // 1. Read product ID + amount from req.body
  // 2. Call Razorpay Orders API using RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET
  // 3. Attach { product: productId } in order notes
  // 4. Return order ID to frontend to open Razorpay Checkout

  return res.status(200).json({ status: "placeholder — not yet implemented" });
}
