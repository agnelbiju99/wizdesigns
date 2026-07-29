// Razorpay webhook endpoint
// This URL is what you paste into Razorpay's "Webhook URL" field:
//   https://<your-vercel-project>.vercel.app/api/webhook
//
// Right now this just acknowledges requests so Razorpay's webhook test
// doesn't fail. Signature verification + email delivery logic gets added
// in the next build step.

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // TODO (next step):
  // 1. Verify Razorpay signature using RAZORPAY_WEBHOOK_SECRET
  // 2. Parse payment.captured event
  // 3. Look up product from order notes
  // 4. Generate unique download page entry
  // 5. Send email via Resend with the unique download link

  console.log("Webhook received:", JSON.stringify(req.body));
  return res.status(200).json({ status: "received" });
}
