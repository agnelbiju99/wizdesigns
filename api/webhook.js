// Razorpay webhook — this is the URL you pasted into Razorpay's dashboard:
//   https://<your-domain>/api/webhook
//
// Flow:
// 1. Razorpay calls this URL the moment a payment is captured
// 2. We verify the request really came from Razorpay (signature check)
// 3. We look up which product was bought (from order notes)
// 4. We generate a signed, unique download link (no database needed)
// 5. We email that link to the buyer via Resend

import crypto from "crypto";
import { Resend } from "resend";

const PRODUCT_NAMES = {
  "zero-to-trader": "From Zero to Trader",
  "screener-guide": "NSE Stock Screener Guide",
};

// Vercel parses JSON bodies by default, but signature verification needs
// the exact raw bytes Razorpay sent — so we turn off the default parser
// and read the raw body ourselves.
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

function generateDownloadToken(orderId, productId) {
  const payload = `${orderId}:${productId}`;
  const signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
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

  // Only act on successful captured payments
  if (payload.event !== "payment.captured") {
    return res.status(200).json({ status: "ignored", event: payload.event });
  }

  const payment = payload.payload.payment.entity;
  const productId = payment.notes?.product;
  const buyerEmail = payment.email;
  const orderId = payment.order_id;

  if (!productId || !PRODUCT_NAMES[productId]) {
    console.error("Unknown product in webhook payload:", productId);
    return res.status(400).json({ error: "Unknown product" });
  }

  if (!buyerEmail) {
    console.error("No buyer email present on payment:", payment.id);
    return res.status(400).json({ error: "Missing buyer email" });
  }

  const token = generateDownloadToken(orderId, productId);
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const downloadUrl = `https://${host}/api/download?token=${token}`;

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      // Switch to an address on your own verified domain once wizdesigns.in
      // is set up in Resend. Until then, Resend's shared sandbox address works.
      from: "Wiz Designs <onboarding@resend.dev>",
      to: buyerEmail,
      subject: `Your ${PRODUCT_NAMES[productId]} download is ready`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#00C9A7;">Thanks for your purchase!</h2>
          <p>Your copy of <strong>${PRODUCT_NAMES[productId]}</strong> is ready to download.</p>
          <p style="margin: 24px 0;">
            <a href="${downloadUrl}" style="background:#00C9A7;color:#0D1117;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
              Download Your PDF
            </a>
          </p>
          <p style="color:#8B949E;font-size:13px;">
            If the button doesn't work, copy this link into your browser:<br/>
            ${downloadUrl}
          </p>
          <p style="color:#8B949E;font-size:13px;">Order ID: ${orderId}</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Email send failed:", err);
    return res.status(500).json({ error: "Payment received but email failed to send" });
  }

  return res.status(200).json({ status: "delivered" });
}
