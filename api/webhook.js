// Razorpay webhook — kept as a background record of payments, purely for
// your own logging/backup. Not used for delivery anymore (that now
// happens instantly on-page via /api/verify-payment). Safe to leave
// connected in Razorpay's dashboard as-is.

import crypto from "crypto";

export const config = {
  api: { bodyParser: false },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const rawBody = await readRawBody(req);
  const razorpaySignature = req.headers["x-razorpay-signature"];

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  if (razorpaySignature !== expectedSignature) {
    console.error("Webhook signature mismatch — rejecting request");
    return res.status(400).json({ error: "Invalid signature" });
  }

  const payload = JSON.parse(rawBody);

  if (payload.event === "payment.captured") {
    const payment = payload.payload.payment.entity;
    console.log(
      `Payment captured: ${payment.id}, order ${payment.order_id}, product ${payment.notes?.product}, amount ₹${payment.amount / 100}`
    );
  }

  return res.status(200).json({ status: "logged" });
}
