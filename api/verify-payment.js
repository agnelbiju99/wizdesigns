import crypto from "crypto";
import Razorpay from "razorpay";

const ZERO_TO_TRADER = "https://drive.google.com/file/d/1WUH-JyctTKCeYb7d5OA5NIgyymOKeBHJ/view?usp=sharing";
const SCREENER_GUIDE = "https://drive.google.com/file/d/1bCGHwBVjoOmcaCyIO5xd6bthgoT_7KH6/view?usp=sharing";
const CHART_SETUPS_BIBLE = "https://drive.google.com/drive/folders/1EsqJa6mxVbJ4f3QZl6uyzD7vbxFGnYxB?usp=drive_link";
const PRICE_ACTION_STRATEGIES = "https://drive.google.com/file/d/1ZGTOkevnGxMnDw8JH41OXJkJ9QB9F7pM/view?usp=sharing";
const PRODUCT_JOURNEY = "https://drive.google.com/file/d/1ZPNMTz7gwHV4HU3ID5-bUoerLGnjr0BR/view?usp=sharing";
// AI Money Coach Planner: Google Drive folder holding
// finance_productivity_planner.html + README.txt (share: "Anyone with the link").
// Financial Affirmation Cards PDF, hosted on this site (the file name is hard to guess on purpose).
const AFFIRMATION_CARDS = "/financial-affirmation-cards-0517e912d076.pdf";
// Wedding Planning Dashboard: Google Drive folder (share: "Anyone with the link").
const WEDDING_PLANNER = "https://drive.google.com/drive/folders/1eZ2M4a_Y5du5x7OhKDQASVO0HoRLZLxr?usp=drive_link";
// 2027 Year Reset app: Google Drive folder (share: "Anyone with the link").
const YEAR_RESET = "https://drive.google.com/drive/folders/1POBtLWwvBAY1VCNHHdNs7m_XtDuDdzUO?usp=drive_link";
// Debt-Free Tracker: the app itself, hosted on this site at a hard-to-guess address (not linked anywhere, not indexed).
const DEBT_TRACKER = "/debt-free-tracker-app-6c0b6ccc4898.html";
// Job Hunt Tracker: the app itself, hosted on this site at a hard-to-guess address (not linked anywhere, not indexed).
const JOB_TRACKER = "/job-hunt-tracker-app-d058450e2f9d.html";
// Offer Check: the app itself, hosted on this site at a hard-to-guess address (not linked anywhere, not indexed).
const OFFER_CHECK = "/offer-check-app-661c4fb86337.html";
// Budget Meal Planner: the app itself, hosted on this site at a hard-to-guess address (not linked anywhere, not indexed).
const MEAL_PLANNER = "/meal-planner-app-11a8f92c6f8b.html";
const MONEY_PLANNER = "https://drive.google.com/drive/folders/1ZWEOXSbZQ6lVgjLlLZ_xgkUHIBJY1Mh5?usp=sharing";
// Online versions hosted on this site at hard-to-guess addresses (not linked anywhere).
// Buyers get "Open … online" first, plus the Drive folder to download a copy.
const MONEY_PLANNER_APP = "/money-planner-app-ff302d7d542a.html";
const WEDDING_PLANNER_APP = "/wedding-planner-app-51204f2737cf.html";
const PLANNER_FILES = [
  { label: "Open AI Money Coach Planner online", url: MONEY_PLANNER_APP },
  { label: "Download the planner (Drive)", url: MONEY_PLANNER },
];
const WEDDING_FILES = [
  { label: "Open Wedding Planning Dashboard online", url: WEDDING_PLANNER_APP },
  { label: "Download the wedding planner + guide (Drive)", url: WEDDING_PLANNER },
];

const PRODUCT_NAMES = {
  "zero-to-trader": "From Zero to Trader",
  "screener-guide": "NSE Stock Screener Guide",
  "chart-setups-bible": "Chart Setups Bible",
  "price-action-strategies": "Price Action Strategies",
  "combo-all-4": "Complete Bundle (All 4 Products)",
  "combo-all-4-offer": "Complete Bundle (All 4 Products)",
  "combo-all-4-planner": "Complete Bundle + AI Money Coach Planner",
  "money-planner": "AI Money Coach Planner",
  "money-planner-cards": "AI Money Coach Planner + Financial Affirmation Cards",
  "money-planner-debt": "AI Money Coach Planner + Debt-Free Tracker",
  "money-planner-yr": "AI Money Coach Planner + 2027 Year Reset",
  "money-planner-debt-yr": "AI Money Coach Planner + Debt-Free Tracker + 2027 Year Reset",
  "affirmation-cards": "Financial Affirmation Cards",
  "combo-zero-screener": "From Zero to Trader + NSE Screener Guide",
  "combo-price-chart": "Price Action Strategies + Chart Setups Bible",
  "product-journey": "What Is A Digital Product?",
  "wedding-planner": "Wedding Planning Dashboard",
  "wedding-planner-money": "Wedding Planning Dashboard + AI Money Coach Planner",
  "wedding-planner-debt": "Wedding Planning Dashboard + Debt-Free Tracker",
  "wedding-planner-money-debt": "Wedding Planning Dashboard + AI Money Coach Planner + Debt-Free Tracker",
  "year-reset": "2027 Year Reset",
  "year-reset-money": "2027 Year Reset + AI Money Coach Planner",
  "year-reset-debt": "2027 Year Reset + Debt-Free Tracker",
  "year-reset-money-debt": "2027 Year Reset + AI Money Coach Planner + Debt-Free Tracker",
  "debt-tracker": "Debt-Free Tracker",
  "debt-tracker-money": "Debt-Free Tracker + AI Money Coach Planner",
  "debt-tracker-yr": "Debt-Free Tracker + 2027 Year Reset",
  "debt-tracker-money-yr": "Debt-Free Tracker + AI Money Coach Planner + 2027 Year Reset",
  "job-tracker": "Job Hunt Tracker",
  "job-tracker-money": "Job Hunt Tracker + AI Money Coach Planner",
  "job-tracker-yr": "Job Hunt Tracker + 2027 Year Reset",
  "job-tracker-money-yr": "Job Hunt Tracker + AI Money Coach Planner + 2027 Year Reset",
  "job-tracker-offer": "Job Hunt Tracker + Offer Check",
  "job-tracker-money-offer": "Job Hunt Tracker + AI Money Coach Planner + Offer Check",
  "job-tracker-yr-offer": "Job Hunt Tracker + 2027 Year Reset + Offer Check",
  "job-tracker-money-yr-offer": "Job Hunt Tracker + AI Money Coach Planner + 2027 Year Reset + Offer Check",
  "offer-check": "Offer Check",
  "offer-check-job": "Offer Check + Job Hunt Tracker",
  "offer-check-money": "Offer Check + AI Money Coach Planner",
  "offer-check-job-money": "Offer Check + Job Hunt Tracker + AI Money Coach Planner",
  "meal-planner": "Budget Meal Planner",
  "meal-planner-money": "Budget Meal Planner + AI Money Coach Planner",
  "meal-planner-debt": "Budget Meal Planner + Debt-Free Tracker",
  "meal-planner-money-debt": "Budget Meal Planner + AI Money Coach Planner + Debt-Free Tracker",
};

const BUNDLE_FILES = [
  { label: "From Zero to Trader", url: ZERO_TO_TRADER },
  { label: "NSE Stock Screener Guide", url: SCREENER_GUIDE },
  { label: "Chart Setups Bible", url: CHART_SETUPS_BIBLE },
  { label: "Price Action Strategies", url: PRICE_ACTION_STRATEGIES },
];

const PRODUCT_FILES = {
  "zero-to-trader": [{ label: "From Zero to Trader", url: ZERO_TO_TRADER }],
  "screener-guide": [{ label: "NSE Stock Screener Guide", url: SCREENER_GUIDE }],
  "chart-setups-bible": [{ label: "Chart Setups Bible", url: CHART_SETUPS_BIBLE }],
  "price-action-strategies": [{ label: "Price Action Strategies", url: PRICE_ACTION_STRATEGIES }],
  "combo-all-4": BUNDLE_FILES,
  "combo-all-4-offer": BUNDLE_FILES,
  "combo-all-4-planner": [...BUNDLE_FILES, ...PLANNER_FILES],
  "money-planner": PLANNER_FILES,
  "money-planner-cards": [
    ...PLANNER_FILES,
    { label: "Financial Affirmation Cards", url: AFFIRMATION_CARDS },
  ],
  "money-planner-debt": [
    ...PLANNER_FILES,
    { label: "Open Debt-Free Tracker", url: DEBT_TRACKER },
  ],
  "money-planner-yr": [
    ...PLANNER_FILES,
    { label: "2027 Year Reset", url: YEAR_RESET },
  ],
  "money-planner-debt-yr": [
    ...PLANNER_FILES,
    { label: "Open Debt-Free Tracker", url: DEBT_TRACKER },
    { label: "2027 Year Reset", url: YEAR_RESET },
  ],
  "affirmation-cards": [{ label: "Financial Affirmation Cards", url: AFFIRMATION_CARDS }],
  "combo-zero-screener": [
    { label: "From Zero to Trader", url: ZERO_TO_TRADER },
    { label: "NSE Stock Screener Guide", url: SCREENER_GUIDE },
  ],
  "combo-price-chart": [
    { label: "Price Action Strategies", url: PRICE_ACTION_STRATEGIES },
    { label: "Chart Setups Bible", url: CHART_SETUPS_BIBLE },
  ],
  "product-journey": [{ label: "What Is A Digital Product?", url: PRODUCT_JOURNEY }],
  "wedding-planner": WEDDING_FILES,
  "wedding-planner-money": [
    ...WEDDING_FILES,
    ...PLANNER_FILES,
  ],
  "wedding-planner-debt": [
    ...WEDDING_FILES,
    { label: "Open Debt-Free Tracker", url: DEBT_TRACKER },
  ],
  "wedding-planner-money-debt": [
    ...WEDDING_FILES,
    ...PLANNER_FILES,
    { label: "Open Debt-Free Tracker", url: DEBT_TRACKER },
  ],
  "year-reset": [{ label: "2027 Year Reset", url: YEAR_RESET }],
  "year-reset-money": [
    { label: "2027 Year Reset", url: YEAR_RESET },
    ...PLANNER_FILES,
  ],
  "year-reset-debt": [
    { label: "2027 Year Reset", url: YEAR_RESET },
    { label: "Open Debt-Free Tracker", url: DEBT_TRACKER },
  ],
  "year-reset-money-debt": [
    { label: "2027 Year Reset", url: YEAR_RESET },
    ...PLANNER_FILES,
    { label: "Open Debt-Free Tracker", url: DEBT_TRACKER },
  ],
  "debt-tracker": [{ label: "Open Debt-Free Tracker", url: DEBT_TRACKER }],
  "debt-tracker-money": [
    { label: "Open Debt-Free Tracker", url: DEBT_TRACKER },
    ...PLANNER_FILES,
  ],
  "debt-tracker-yr": [
    { label: "Open Debt-Free Tracker", url: DEBT_TRACKER },
    { label: "2027 Year Reset", url: YEAR_RESET },
  ],
  "debt-tracker-money-yr": [
    { label: "Open Debt-Free Tracker", url: DEBT_TRACKER },
    ...PLANNER_FILES,
    { label: "2027 Year Reset", url: YEAR_RESET },
  ],
  "job-tracker": [{ label: "Open Job Hunt Tracker", url: JOB_TRACKER }],
  "job-tracker-money": [
    { label: "Open Job Hunt Tracker", url: JOB_TRACKER },
    ...PLANNER_FILES,
  ],
  "job-tracker-yr": [
    { label: "Open Job Hunt Tracker", url: JOB_TRACKER },
    { label: "2027 Year Reset", url: YEAR_RESET },
  ],
  "job-tracker-money-yr": [
    { label: "Open Job Hunt Tracker", url: JOB_TRACKER },
    ...PLANNER_FILES,
    { label: "2027 Year Reset", url: YEAR_RESET },
  ],
  "job-tracker-offer": [
    { label: "Open Job Hunt Tracker", url: JOB_TRACKER },
    { label: "Open Offer Check", url: OFFER_CHECK },
  ],
  "job-tracker-money-offer": [
    { label: "Open Job Hunt Tracker", url: JOB_TRACKER },
    ...PLANNER_FILES,
    { label: "Open Offer Check", url: OFFER_CHECK },
  ],
  "job-tracker-yr-offer": [
    { label: "Open Job Hunt Tracker", url: JOB_TRACKER },
    { label: "2027 Year Reset", url: YEAR_RESET },
    { label: "Open Offer Check", url: OFFER_CHECK },
  ],
  "job-tracker-money-yr-offer": [
    { label: "Open Job Hunt Tracker", url: JOB_TRACKER },
    ...PLANNER_FILES,
    { label: "2027 Year Reset", url: YEAR_RESET },
    { label: "Open Offer Check", url: OFFER_CHECK },
  ],
  "offer-check": [{ label: "Open Offer Check", url: OFFER_CHECK }],
  "offer-check-job": [
    { label: "Open Offer Check", url: OFFER_CHECK },
    { label: "Open Job Hunt Tracker", url: JOB_TRACKER },
  ],
  "offer-check-money": [
    { label: "Open Offer Check", url: OFFER_CHECK },
    ...PLANNER_FILES,
  ],
  "offer-check-job-money": [
    { label: "Open Offer Check", url: OFFER_CHECK },
    { label: "Open Job Hunt Tracker", url: JOB_TRACKER },
    ...PLANNER_FILES,
  ],
  "meal-planner": [{ label: "Open Budget Meal Planner", url: MEAL_PLANNER }],
  "meal-planner-money": [
    { label: "Open Budget Meal Planner", url: MEAL_PLANNER },
    ...PLANNER_FILES,
  ],
  "meal-planner-debt": [
    { label: "Open Budget Meal Planner", url: MEAL_PLANNER },
    { label: "Open Debt-Free Tracker", url: DEBT_TRACKER },
  ],
  "meal-planner-money-debt": [
    { label: "Open Budget Meal Planner", url: MEAL_PLANNER },
    ...PLANNER_FILES,
    { label: "Open Debt-Free Tracker", url: DEBT_TRACKER },
  ],
};

function driveDirectDownloadUrl(shareUrl) {
  if (shareUrl.includes("/drive/folders/")) {
    return shareUrl;
  }
  const match = shareUrl.match(/\/d\/([^/]+)/);
  const fileId = match ? match[1] : null;
  return fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : shareUrl;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body || {};

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return res.status(400).json({ error: "Missing payment details" });
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    console.error("Payment signature verification failed for order:", razorpay_order_id);
    return res.status(400).json({ error: "Payment verification failed" });
  }

  const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  try {
    const order = await instance.orders.fetch(razorpay_order_id);
    const productId = order.notes?.product;

    if (!productId || !PRODUCT_FILES[productId]) {
      console.error("Unknown product on verified order:", razorpay_order_id);
      return res.status(400).json({ error: "Unknown product for this order" });
    }

    const files = PRODUCT_FILES[productId].map((f) => ({
      label: f.label,
      url: driveDirectDownloadUrl(f.url),
    }));

    return res.status(200).json({
      productName: PRODUCT_NAMES[productId],
      files,
    });
  } catch (err) {
    console.error("Order fetch failed:", err);
    return res.status(500).json({ error: "Could not verify order" });
  }
}
