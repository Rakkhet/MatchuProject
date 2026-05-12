const crypto = require("node:crypto");
const { promisify } = require("node:util");
const { PrismaPg } = require("@prisma/adapter-pg");
const cors = require("cors");
const express = require("express");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

// ส่วนเริ่มต้นของ backend
// ใช้ Express รับ request จาก frontend และใช้ Prisma คุยกับ PostgreSQL
const app = express();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const scryptAsync = promisify(crypto.scrypt);
const port = Number(process.env.PORT) || 4000;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const adminLoginHandle = "adminowen";
const adminLoginEmail = "adminowen@glowmore.admin";
const adminLoginPassword = "1234";
const adminOrderStatuses = new Set([
  "UPLOADED",
  "UNDER_REVIEW",
  "PAID",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

// object พวกนี้เอาไว้ reuse ตอน query Prisma
// ข้อดีคือ response ที่ส่งกลับ frontend จะมี shape คงที่ และลดการเขียนซ้ำ
const publicUserSelect = {
  id: true,
  displayName: true,
  email: true,
  isActive: true,
  isAdmin: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

const storefrontProductSelect = {
  id: true,
  slug: true,
  collection: true,
  name: true,
  displayName: true,
  originLabel: true,
  originKey: true,
  sizeKey: true,
  subscriptionEnabled: true,
  cultivarKey: true,
  offeringKey: true,
  priceAmount: true,
  priceCurrency: true,
  badgeLabel: true,
  soldOut: true,
  imagePath: true,
  kitItemDescription: true,
  featuredOnHome: true,
  featuredInKit: true,
  includedInKit: true,
  sortOrder: true,
  trackInventory: true,
  stockQuantity: true,
  lowStockThreshold: true,
  allowBackorder: true,
};

const cartItemProductSelect = {
  id: true,
  slug: true,
};

const cartWithItemsInclude = {
  items: {
    include: {
      product: {
        select: cartItemProductSelect,
      },
    },
    orderBy: { id: "asc" },
  },
};

const orderWithItemsInclude = {
  items: {
    include: {
      product: {
        select: cartItemProductSelect,
      },
    },
    orderBy: { id: "asc" },
  },
  paymentRecord: {
    include: {
      submittedByUser: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  },
  history: {
    include: {
      changedByUser: {
        select: publicUserSelect,
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  },
};

const adminOrderInclude = {
  items: {
    include: {
      product: {
        select: cartItemProductSelect,
      },
    },
    orderBy: { id: "asc" },
  },
  user: {
    select: publicUserSelect,
  },
  paymentRecord: {
    include: {
      submittedByUser: {
        select: publicUserSelect,
      },
    },
  },
  history: {
    include: {
      changedByUser: {
        select: publicUserSelect,
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  },
};

const customerReviewSelect = {
  id: true,
  userId: true,
  orderId: true,
  rating: true,
  reviewText: true,
  authorNameSnapshot: true,
  locationLabel: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
};

const adminProductSelect = {
  id: true,
  slug: true,
  collection: true,
  name: true,
  displayName: true,
  originLabel: true,
  priceAmount: true,
  priceCurrency: true,
  badgeLabel: true,
  soldOut: true,
  imagePath: true,
  kitItemDescription: true,
  featuredOnHome: true,
  featuredInKit: true,
  includedInKit: true,
  stockQuantity: true,
  sortOrder: true,
  trackInventory: true,
  allowBackorder: true,
  createdAt: true,
  updatedAt: true,
};

app.use(cors());
app.use(express.json({ limit: "12mb" }));

// helper กลุ่มนี้ใช้จัดรูปข้อมูลจาก request ก่อนบันทึกลงฐานข้อมูล
// เช่น trim ช่องว่าง, จำกัดความยาว, หรือกรองตัวอักษรที่ไม่ควรมี
function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDisplayName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeOptionalText(value, maxLength) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "";
  }

  return normalized.slice(0, Number(maxLength) || normalized.length);
}

function normalizePhoneNumber(value) {
  return String(value || "")
    .trim()
    .replace(/[^\d+\-() ]+/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 40);
}

function normalizePostalCode(value) {
  return String(value || "")
    .trim()
    .replace(/[^\da-zA-Z\- ]+/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 20);
}

function normalizeLoginIdentifier(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeDisplayNameKey(value) {
  return normalizeDisplayName(value).toLowerCase();
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeProductCollection(value) {
  const normalized = normalizeText(value).toUpperCase();

  if (normalized === "MATCHA" || normalized === "TOOLS") {
    return normalized;
  }

  return "";
}

function normalizeUploadFileName(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._()\- ]+/g, "")
    .slice(0, 120);
}

function normalizeImageDataUrl(value, options) {
  const text = String(value || "").trim();
  const maxLength = Number(options && options.maxLength) || 0;

  if (!text || !text.startsWith("data:image/")) {
    return "";
  }

  if (maxLength && text.length > maxLength) {
    return "";
  }

  return text;
}

function normalizePaymentMethod(value) {
  const normalized = normalizeText(value).toUpperCase();

  if (normalized === "PROMPTPAY_QR") {
    return normalized;
  }

  return "";
}

function normalizeReviewRating(value) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    return null;
  }

  return parsed;
}

function normalizeReviewBody(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .split("\n")
    .map(function(line) {
      return normalizeText(line);
    })
    .filter(Boolean)
    .join(" ")
    .slice(0, 420);
}

function parseId(value) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function parseLineItemQuantity(value) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 99) {
    return null;
  }

  return parsed;
}

function parseOptionalInteger(value, options) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  const min = Number(options && options.min);
  const max = Number(options && options.max);

  if (!Number.isInteger(parsed)) {
    return null;
  }

  if (Number.isFinite(min) && parsed < min) {
    return null;
  }

  if (Number.isFinite(max) && parsed > max) {
    return null;
  }

  return parsed;
}

function validateAuthPayload(payload, options) {
  const requireDisplayName = Boolean(options && options.requireDisplayName);
  const displayName = normalizeDisplayName(payload.displayName);
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");

  if (requireDisplayName && displayName.length < 2) {
    return "Display name must be at least 2 characters.";
  }

  if (displayName.length > 80) {
    return "Display name must be 80 characters or fewer.";
  }

  if (!emailPattern.test(email)) {
    return "Please enter a valid email address.";
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  return null;
}

function validateLoginPayload(payload) {
  const identifier = normalizeLoginIdentifier(payload.email);
  const password = String(payload.password || "");

  if (!identifier || identifier.length > 120) {
    return "Please enter your email or admin username.";
  }

  if (password.length < 4) {
    return "Password must be at least 4 characters.";
  }

  return null;
}

async function hashPassword(password) {
  // ตอนสมัครหรือรีเซ็ตรหัสผ่าน จะไม่เก็บรหัสแบบ plain textแต่จะ hash ก่อนเพื่อให้ปลอดภัยขึ้น
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt, 64);
  return salt + ":" + Buffer.from(derivedKey).toString("hex");
}

async function verifyPassword(password, storedHash) {
  // ตอน login จะเอารหัสที่ผู้ใช้กรอกมา hash เทียบกับของเดิม
  // ถ้าตรงกันจึงถือว่าเข้าสู่ระบบได้
  const parts = String(storedHash || "").split(":");
  const salt = parts[0];
  const savedKeyHex = parts[1];

  if (!salt || !savedKeyHex) {
    return false;
  }

  const derivedKey = await scryptAsync(password, salt, 64);
  const savedKey = Buffer.from(savedKeyHex, "hex");
  const candidateKey = Buffer.from(derivedKey);

  if (savedKey.length !== candidateKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(savedKey, candidateKey);
}

async function ensureAdminUser() {
  // ทำให้มีบัญชี admin สำหรับเดโมระบบหลังบ้านเสมอ
  // ถ้ายังไม่มีจะ create ให้ ถ้ามีอยู่แล้วจะ update ค่าที่จำเป็นให้พร้อมใช้
  const passwordHash = await hashPassword(adminLoginPassword);
  const displayNameKey = normalizeDisplayNameKey(adminLoginHandle);

  await prisma.user.upsert({
    where: { email: adminLoginEmail },
    update: {
      displayName: adminLoginHandle,
      displayNameKey,
      passwordHash,
      isActive: true,
      isAdmin: true,
    },
    create: {
      displayName: adminLoginHandle,
      displayNameKey,
      email: adminLoginEmail,
      passwordHash,
      isActive: true,
      isAdmin: true,
    },
  });
}

function sendServerError(res, err, fallbackMessage) {
  console.error(err);
  res.status(500).json({ error: fallbackMessage });
}

function formatPrice(product) {
  return Number(product.priceAmount || 0).toFixed(2) + " B";
}

function parsePriceLabel(value) {
  const label = normalizeText(value);
  const numericText = label.replace(/[^0-9.]/g, "");
  const numericValue = numericText ? Number(numericText) : null;

  return {
    label,
    amount:
      typeof numericValue === "number" && Number.isFinite(numericValue)
        ? Math.round(numericValue)
        : null,
    currency: typeof numericValue === "number" && Number.isFinite(numericValue) ? "THB" : null,
  };
}

function formatMoneyAmount(amount, currency) {
  const numericAmount = Number(amount || 0);

  if (currency === "THB") {
    return numericAmount.toFixed(2) + " B";
  }

  return numericAmount.toFixed(2);
}

function isProductSoldOut(product) {
  if (!product) {
    return true;
  }

  if (product.soldOut) {
    return true;
  }

  if (product.trackInventory && !product.allowBackorder) {
    return Number(product.stockQuantity || 0) <= 0;
  }

  return false;
}

function buildOrderPricing(items) {
  // รวมราคาของทุกชิ้นใน cart เพื่อทำยอดสรุปก่อนสร้างออเดอร์
  // ตอนนี้ระบบนี้บังคับให้ 1 ออเดอร์มีสกุลเงินเดียวเพื่อคำนวณง่ายและไม่งง
  const currencySet = new Set();
  let subtotalAmount = 0;

  for (const item of items) {
    if (typeof item.unitAmount !== "number" || !item.priceCurrency) {
      return { error: "Every item in the cart needs a valid numeric price before checkout." };
    }

    currencySet.add(item.priceCurrency);
    subtotalAmount += item.unitAmount * item.quantity;
  }

  if (!currencySet.size) {
    return { error: "Could not calculate the order total." };
  }

  if (currencySet.size > 1) {
    return {
      error:
        "Please check out matcha and tools in separate orders for now so we can keep one real payment currency per order.",
    };
  }

  const totalCurrency = Array.from(currencySet)[0];
  const shippingAmount = 0;
  const discountAmount = 0;
  const totalAmount = subtotalAmount + shippingAmount - discountAmount;

  return {
    subtotalAmount,
    shippingAmount,
    discountAmount,
    totalAmount,
    totalCurrency,
    totalSummary: formatMoneyAmount(totalAmount, totalCurrency),
  };
}

function toOrderHistoryEntry(entry) {
  return {
    id: entry.id,
    eventType: entry.eventType,
    fromOrderStatus: entry.fromOrderStatus,
    toOrderStatus: entry.toOrderStatus,
    fromPaymentStatus: entry.fromPaymentStatus,
    toPaymentStatus: entry.toPaymentStatus,
    fromShippingStatus: entry.fromShippingStatus,
    toShippingStatus: entry.toShippingStatus,
    shippingCarrier: entry.shippingCarrier,
    trackingNumber: entry.trackingNumber,
    note: entry.note || "",
    createdAt: entry.createdAt,
    changedByUser: entry.changedByUser
      ? {
          id: entry.changedByUser.id,
          displayName: entry.changedByUser.displayName,
          email: entry.changedByUser.email,
          isAdmin: entry.changedByUser.isAdmin,
        }
      : null,
  };
}

function toHomeProductCard(product) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    origin: product.originLabel,
    price: formatPrice(product),
    badge: product.badgeLabel,
    soldOut: isProductSoldOut(product),
    image: product.imagePath,
  };
}

function toShopProductCard(product) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.displayName || product.name,
    origin: product.originLabel,
    price: formatPrice(product),
    badge: product.badgeLabel,
    soldOut: isProductSoldOut(product),
    image: product.imagePath,
    filters: {
      size: product.sizeKey,
      subscription: product.subscriptionEnabled ? "available" : "not-available",
      origin: product.originKey,
      cultivar: product.cultivarKey,
      offering: product.offeringKey,
    },
  };
}

function toKitCuratedProductCard(product) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.displayName || product.name,
    origin: product.originLabel,
    price: formatPrice(product),
    badge: product.badgeLabel,
    soldOut: isProductSoldOut(product),
    image: product.imagePath,
  };
}

function buildReviewLocationLabel(order) {
  const province = normalizeOptionalText(order && order.shippingProvince, 80);
  const country = normalizeOptionalText(order && order.shippingCountry, 80);

  if (province && country) {
    return province + ", " + country;
  }

  return province || country || "";
}

function toPublicReview(review) {
  return {
    id: review.id,
    userId: review.userId,
    orderId: review.orderId,
    rating: review.rating,
    text: review.reviewText,
    author: review.authorNameSnapshot,
    location: review.locationLabel || "Verified customer",
    createdAt: review.createdAt,
  };
}

async function buildReviewViewerState(userId, existingUser) {
  if (!userId) {
    return {
      canSubmit: false,
      hasCompletedPurchase: false,
      reviewedOrderCount: 0,
      eligibleOrderId: null,
      eligibleOrderLabel: "",
      message: "Sign in after your first paid order to leave a verified review.",
    };
  }

  const user = existingUser || (await loadActiveUser(userId));

  if (!user || !user.isActive) {
    return {
      canSubmit: false,
      hasCompletedPurchase: false,
      reviewedOrderCount: 0,
      eligibleOrderId: null,
      eligibleOrderLabel: "",
      message: "Sign in with an active account to leave a verified review.",
    };
  }

  const [eligibleOrder, paidOrderCount, reviewedOrderCount] = await Promise.all([
    prisma.order.findFirst({
      where: {
        userId: user.id,
        status: { not: "CANCELLED" },
        paymentStatus: "PAID",
        review: { is: null },
      },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
      },
    }),
    prisma.order.count({
      where: {
        userId: user.id,
        status: { not: "CANCELLED" },
        paymentStatus: "PAID",
      },
    }),
    prisma.customerReview.count({
      where: {
        userId: user.id,
        isPublished: true,
      },
    }),
  ]);

  if (eligibleOrder) {
    return {
      canSubmit: true,
      hasCompletedPurchase: true,
      reviewedOrderCount: reviewedOrderCount,
      eligibleOrderId: eligibleOrder.id,
      eligibleOrderLabel: "Order #" + eligibleOrder.id,
      message: "Your last paid order is ready for a verified review.",
    };
  }

  if (paidOrderCount > 0) {
    return {
      canSubmit: false,
      hasCompletedPurchase: true,
      reviewedOrderCount: reviewedOrderCount,
      eligibleOrderId: null,
      eligibleOrderLabel: "",
      message:
        reviewedOrderCount > 0
          ? "Thanks. You have already reviewed every paid order that can be reviewed right now."
          : "Your paid orders have already been used for reviews.",
    };
  }

  return {
    canSubmit: false,
    hasCompletedPurchase: false,
    reviewedOrderCount: reviewedOrderCount,
    eligibleOrderId: null,
    eligibleOrderLabel: "",
    message: "Reviews unlock after your first paid order is approved.",
  };
}

function toCartClientItem(item) {
  return {
    key:
      item.itemType === "KIT"
        ? item.configKey || "kit:" + item.id
        : "product:" +
          (item.product && item.product.slug
            ? item.product.slug
            : item.productId || item.id),
    itemType: item.itemType,
    productId: item.productId,
    configKey: item.configKey,
    name: item.nameSnapshot,
    image: item.imagePath,
    price: item.priceLabel,
    unitAmount: item.unitAmount,
    currency: item.priceCurrency,
    quantity: item.quantity,
    details: item.detailsSnapshot || "",
  };
}

function toOrderSummary(order) {
  // แปลงข้อมูล order จาก Prisma ให้เป็น shape ที่ frontend ใช้งานง่ายกว่า
  // เช่นรวมยอด, items, tracking และ payment info ให้อ่านตรงๆ ได้เลย
  const paymentRecord = order.paymentRecord || null;

  return {
    id: order.id,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    shippingStatus: order.shippingStatus,
    paymentReference: order.paymentReference,
    paymentQrStored: Boolean(paymentRecord && paymentRecord.qrImageData),
    paymentProofUploaded: Boolean(paymentRecord && paymentRecord.proofImageData),
    paymentQrCount: paymentRecord && paymentRecord.qrImageData ? 1 : 0,
    paymentProofCount: paymentRecord && paymentRecord.proofImageData ? 1 : 0,
    latestPaymentQr: paymentRecord && paymentRecord.qrImageData
      ? {
          id: paymentRecord.id,
          paymentReference: paymentRecord.paymentReference,
          createdAt: paymentRecord.createdAt,
        }
      : null,
    latestPaymentProof: paymentRecord && paymentRecord.proofImageData
      ? {
          id: paymentRecord.id,
          paymentReference: paymentRecord.paymentReference,
          originalFileName: paymentRecord.proofFileName,
          mimeType: paymentRecord.proofMimeType,
          uploadedAt: paymentRecord.submittedAt,
          uploadedByUserId: paymentRecord.submittedByUserId,
          uploadedByUser: paymentRecord.submittedByUser
            ? {
                id: paymentRecord.submittedByUser.id,
                displayName: paymentRecord.submittedByUser.displayName,
                email: paymentRecord.submittedByUser.email,
              }
            : null,
        }
      : null,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    shippingAddress: {
      line1: order.shippingAddressLine1,
      line2: order.shippingAddressLine2,
      district: order.shippingDistrict,
      province: order.shippingProvince,
      postalCode: order.shippingPostalCode,
      country: order.shippingCountry,
    },
    shippingCarrier: order.shippingCarrier,
    trackingNumber: order.trackingNumber,
    itemCount: order.itemCount,
    totalSummary: order.totalSummary,
    totals: {
      subtotalAmount: order.subtotalAmount,
      shippingAmount: order.shippingAmount,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      currency: order.totalCurrency,
      subtotalLabel:
        typeof order.subtotalAmount === "number" && order.totalCurrency
          ? formatMoneyAmount(order.subtotalAmount, order.totalCurrency)
          : null,
      shippingLabel:
        typeof order.shippingAmount === "number" && order.totalCurrency
          ? formatMoneyAmount(order.shippingAmount, order.totalCurrency)
          : null,
      discountLabel:
        typeof order.discountAmount === "number" && order.totalCurrency
          ? formatMoneyAmount(order.discountAmount, order.totalCurrency)
          : null,
      totalLabel:
        typeof order.totalAmount === "number" && order.totalCurrency
          ? formatMoneyAmount(order.totalAmount, order.totalCurrency)
          : order.totalSummary,
    },
    paidAt: order.paidAt,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
    cancelledAt: order.cancelledAt,
    createdAt: order.createdAt,
    history: Array.isArray(order.history) ? order.history.map(toOrderHistoryEntry) : [],
    items: order.items.map(function (item) {
      return {
        key:
          item.itemType === "KIT"
            ? item.configKey || "kit:" + item.id
            : "product:" +
              (item.product && item.product.slug
                ? item.product.slug
                : item.productId || item.id),
        itemType: item.itemType,
        productId: item.productId,
        configKey: item.configKey,
        name: item.nameSnapshot,
        image: item.imagePath,
        price: item.priceLabel,
        unitAmount: item.unitAmount,
        currency: item.priceCurrency,
        quantity: item.quantity,
        details: item.detailsSnapshot || "",
      };
    }),
  };
}

function toAdminProductSummary(product) {
  return {
    id: product.id,
    slug: product.slug,
    collection: product.collection,
    name: product.name,
    displayName: product.displayName,
    originLabel: product.originLabel || "",
    priceAmount: product.priceAmount,
    priceCurrency: product.priceCurrency,
    priceLabel: formatMoneyAmount(product.priceAmount, product.priceCurrency),
    badgeLabel: product.badgeLabel || "",
    soldOut: Boolean(product.soldOut),
    imagePath: product.imagePath,
    kitItemDescription: product.kitItemDescription || "",
    featuredOnHome: Boolean(product.featuredOnHome),
    featuredInKit: Boolean(product.featuredInKit),
    includedInKit: Boolean(product.includedInKit),
    stockQuantity: Number(product.stockQuantity || 0),
    sortOrder: Number(product.sortOrder || 0),
    trackInventory: Boolean(product.trackInventory),
    allowBackorder: Boolean(product.allowBackorder),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function getAdminOrderStatus(order) {
  const normalizedOrderStatus = String((order && order.status) || "").toUpperCase();
  const normalizedPaymentStatus = String((order && order.paymentStatus) || "").toUpperCase();
  const normalizedShippingStatus = String((order && order.shippingStatus) || "").toUpperCase();

  if (normalizedOrderStatus === "CANCELLED" || normalizedShippingStatus === "CANCELLED") {
    return "CANCELLED";
  }

  if (normalizedPaymentStatus === "UPLOADED" || normalizedPaymentStatus === "PENDING") {
    return "UPLOADED";
  }

  if (normalizedPaymentStatus === "UNDER_REVIEW") {
    return "UNDER_REVIEW";
  }

  if (normalizedShippingStatus === "DELIVERED") {
    return "DELIVERED";
  }

  if (normalizedShippingStatus === "SHIPPED") {
    return "SHIPPED";
  }

  if (normalizedShippingStatus === "PREPARING") {
    return "PREPARING";
  }

  return "PAID";
}

function toAdminOrderSummary(order) {
  const paymentRecord = order.paymentRecord || null;

  return Object.assign({}, toOrderSummary(order), {
    adminStatus: getAdminOrderStatus(order),
    user: order.user
      ? {
          id: order.user.id,
          displayName: order.user.displayName,
          email: order.user.email,
          isAdmin: order.user.isAdmin,
        }
      : null,
    notes: order.notes || "",
    proofImageData: paymentRecord ? paymentRecord.proofImageData : null,
    proofFileName: paymentRecord ? paymentRecord.proofFileName : null,
    proofMimeType: paymentRecord ? paymentRecord.proofMimeType : null,
    qrImageData: paymentRecord ? paymentRecord.qrImageData : null,
    paymentSubmittedAt: paymentRecord ? paymentRecord.submittedAt : null,
    inventoryCommitted:
      String((order && order.status) || "").toUpperCase() !== "CANCELLED" &&
      String((order && order.paymentStatus) || "").toUpperCase() === "PAID",
  });
}

async function loadActiveUser(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });
}

async function loadAdminUser(userId) {
  const user = await loadActiveUser(userId);

  if (!user || !user.isActive || !user.isAdmin) {
    return null;
  }

  return user;
}

function extractKitMatchaSlug(configKey) {
  const normalized = normalizeText(configKey);

  if (!normalized || normalized.indexOf("kit:") !== 0) {
    return "";
  }

  const slug = normalized.slice(4).trim().toLowerCase();

  if (!slug || slug === "none") {
    return "";
  }

  return slug;
}

function isInventoryCommitted(orderLike) {
  return (
    String((orderLike && orderLike.status) || "").toUpperCase() !== "CANCELLED" &&
    String((orderLike && orderLike.paymentStatus) || "").toUpperCase() === "PAID"
  );
}

async function buildInventoryRequirements(tx, orderItems) {
  const requirements = new Map();
  const kitQuantitiesByMatchaSlug = new Map();
  let kitBaseQuantity = 0;

  function addRequirement(productId, quantity) {
    if (!productId || !quantity) {
      return;
    }

    requirements.set(productId, (requirements.get(productId) || 0) + quantity);
  }

  orderItems.forEach(function(item) {
    if (item.itemType === "PRODUCT" && item.productId) {
      addRequirement(item.productId, item.quantity);
      return;
    }

    if (item.itemType === "KIT") {
      kitBaseQuantity += item.quantity;
      const selectedMatchaSlug = extractKitMatchaSlug(item.configKey);

      if (selectedMatchaSlug) {
        kitQuantitiesByMatchaSlug.set(
          selectedMatchaSlug,
          (kitQuantitiesByMatchaSlug.get(selectedMatchaSlug) || 0) + item.quantity
        );
      }
    }
  });

  if (kitBaseQuantity > 0) {
    const includedKitProducts = await tx.product.findMany({
      where: { includedInKit: true },
      select: storefrontProductSelect,
    });

    includedKitProducts.forEach(function(product) {
      addRequirement(product.id, kitBaseQuantity);
    });
  }

  if (kitQuantitiesByMatchaSlug.size) {
    const slugs = Array.from(kitQuantitiesByMatchaSlug.keys());
    const selectedMatchaProducts = await tx.product.findMany({
      where: { slug: { in: slugs } },
      select: storefrontProductSelect,
    });

    selectedMatchaProducts.forEach(function(product) {
      addRequirement(product.id, kitQuantitiesByMatchaSlug.get(product.slug) || 0);
    });
  }

  return requirements;
}

async function applyInventoryAdjustment(tx, requirements, direction) {
  const productIds = Array.from(requirements.keys());

  if (!productIds.length) {
    return [];
  }

  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: storefrontProductSelect,
  });
  const productMap = new Map(
    products.map(function(product) {
      return [product.id, product];
    })
  );
  const changedProducts = [];

  for (const productId of productIds) {
    const quantity = requirements.get(productId) || 0;
    const product = productMap.get(productId);

    if (!product || !product.trackInventory || quantity <= 0) {
      continue;
    }

    const currentStock = Number(product.stockQuantity || 0);

    if (direction === "decrement" && !product.allowBackorder && currentStock < quantity) {
      throw new Error(
        (product.displayName || product.name || "A product") +
          " does not have enough stock right now."
      );
    }

    const nextStock =
      direction === "restore"
        ? currentStock + quantity
        : Math.max(0, currentStock - quantity);

    await tx.product.update({
      where: { id: product.id },
      data: {
        stockQuantity: nextStock,
      },
    });

    changedProducts.push({
      id: product.id,
      name: product.displayName || product.name,
      quantity,
      nextStock,
      direction,
    });
  }

  return changedProducts;
}

function summarizeInventoryAdjustment(direction, changedProducts) {
  if (!changedProducts.length) {
    return "";
  }

  const actionLabel = direction === "restore" ? "Restored stock" : "Reserved stock";
  const lineItems = changedProducts.map(function(product) {
    return product.name + " x" + product.quantity;
  });

  return actionLabel + ": " + lineItems.join(", ");
}

function resolveAdminStatusSnapshot(statusKey, existingOrder, payload) {
  const now = new Date();
  const snapshot = {
    status: "PLACED",
    paymentStatus: existingOrder.paymentStatus,
    shippingStatus: existingOrder.shippingStatus,
    paidAt: existingOrder.paidAt,
    shippedAt: existingOrder.shippedAt,
    deliveredAt: existingOrder.deliveredAt,
    cancelledAt: existingOrder.cancelledAt,
    shippingCarrier: existingOrder.shippingCarrier,
    trackingNumber: existingOrder.trackingNumber,
  };

  if (payload && payload.shippingCarrier) {
    snapshot.shippingCarrier = payload.shippingCarrier;
  }

  if (payload && payload.trackingNumber) {
    snapshot.trackingNumber = payload.trackingNumber;
  }

  if (statusKey === "CANCELLED") {
    snapshot.status = "CANCELLED";
    snapshot.shippingStatus = "CANCELLED";
    snapshot.cancelledAt = existingOrder.cancelledAt || now;
    return snapshot;
  }

  if (statusKey === "UPLOADED") {
    snapshot.paymentStatus = "UPLOADED";
    snapshot.shippingStatus = "PENDING";
    snapshot.paidAt = null;
    snapshot.shippedAt = null;
    snapshot.deliveredAt = null;
    snapshot.cancelledAt = null;
    return snapshot;
  }

  if (statusKey === "UNDER_REVIEW") {
    snapshot.paymentStatus = "UNDER_REVIEW";
    snapshot.shippingStatus = "PENDING";
    snapshot.paidAt = null;
    snapshot.shippedAt = null;
    snapshot.deliveredAt = null;
    snapshot.cancelledAt = null;
    return snapshot;
  }

  snapshot.paymentStatus = "PAID";
  snapshot.paidAt = existingOrder.paidAt || now;
  snapshot.cancelledAt = null;

  if (statusKey === "PREPARING") {
    snapshot.shippingStatus = "PREPARING";
    snapshot.shippedAt = null;
    snapshot.deliveredAt = null;
    return snapshot;
  }

  if (statusKey === "SHIPPED") {
    snapshot.shippingStatus = "SHIPPED";
    snapshot.shippedAt = existingOrder.shippedAt || now;
    snapshot.deliveredAt = null;
    return snapshot;
  }

  if (statusKey === "DELIVERED") {
    snapshot.shippingStatus = "DELIVERED";
    snapshot.shippedAt = existingOrder.shippedAt || now;
    snapshot.deliveredAt = existingOrder.deliveredAt || now;
    return snapshot;
  }

  snapshot.shippingStatus = "PENDING";
  snapshot.shippedAt = null;
  snapshot.deliveredAt = null;
  return snapshot;
}

function buildHistoryEntriesForAdminTransition(existingOrder, nextSnapshot, actorUserId, note) {
  const entries = [];
  const hasOrderStatusChange = existingOrder.status !== nextSnapshot.status;
  const hasPaymentChange = existingOrder.paymentStatus !== nextSnapshot.paymentStatus;
  const hasShippingChange = existingOrder.shippingStatus !== nextSnapshot.shippingStatus;
  const hasTrackingChange =
    (existingOrder.shippingCarrier || "") !== (nextSnapshot.shippingCarrier || "") ||
    (existingOrder.trackingNumber || "") !== (nextSnapshot.trackingNumber || "");

  if (hasPaymentChange) {
    entries.push({
      changedByUserId: actorUserId,
      eventType: "PAYMENT_STATUS_CHANGED",
      fromOrderStatus: existingOrder.status,
      toOrderStatus: nextSnapshot.status,
      fromPaymentStatus: existingOrder.paymentStatus,
      toPaymentStatus: nextSnapshot.paymentStatus,
      fromShippingStatus: existingOrder.shippingStatus,
      toShippingStatus: nextSnapshot.shippingStatus,
      shippingCarrier: nextSnapshot.shippingCarrier || null,
      trackingNumber: nextSnapshot.trackingNumber || null,
      note: note || null,
    });
  }

  if (hasShippingChange || hasOrderStatusChange) {
    entries.push({
      changedByUserId: actorUserId,
      eventType: nextSnapshot.status === "CANCELLED" ? "ORDER_CANCELLED" : "SHIPPING_STATUS_CHANGED",
      fromOrderStatus: existingOrder.status,
      toOrderStatus: nextSnapshot.status,
      fromPaymentStatus: existingOrder.paymentStatus,
      toPaymentStatus: nextSnapshot.paymentStatus,
      fromShippingStatus: existingOrder.shippingStatus,
      toShippingStatus: nextSnapshot.shippingStatus,
      shippingCarrier: nextSnapshot.shippingCarrier || null,
      trackingNumber: nextSnapshot.trackingNumber || null,
      note: note || null,
    });
  }

  if (hasTrackingChange) {
    entries.push({
      changedByUserId: actorUserId,
      eventType: "TRACKING_UPDATED",
      fromOrderStatus: existingOrder.status,
      toOrderStatus: nextSnapshot.status,
      fromPaymentStatus: existingOrder.paymentStatus,
      toPaymentStatus: nextSnapshot.paymentStatus,
      fromShippingStatus: existingOrder.shippingStatus,
      toShippingStatus: nextSnapshot.shippingStatus,
      shippingCarrier: nextSnapshot.shippingCarrier || null,
      trackingNumber: nextSnapshot.trackingNumber || null,
      note: note || null,
    });
  }

  return entries;
}

async function normalizeCartItems(items) {
  const rawItems = Array.isArray(items) ? items : null;

  if (!rawItems) {
    return { error: "Cart items must be an array." };
  }

  const productIds = rawItems
    .filter(function (item) {
      return String(item && item.itemType || "").toUpperCase() === "PRODUCT";
    })
    .map(function (item) {
      return parseId(item.productId);
    })
    .filter(Boolean);

  const uniqueProductIds = Array.from(new Set(productIds));
  const products = uniqueProductIds.length
    ? await prisma.product.findMany({
        where: { id: { in: uniqueProductIds } },
        select: storefrontProductSelect,
      })
    : [];
  const productMap = new Map(
    products.map(function (product) {
      return [product.id, product];
    })
  );

  const normalizedItems = [];

  for (const rawItem of rawItems) {
    const itemType = String((rawItem && rawItem.itemType) || "").toUpperCase();
    const quantity = parseLineItemQuantity(rawItem && rawItem.quantity);

    if (!quantity) {
      return { error: "Each cart item needs a quantity between 1 and 99." };
    }

    if (itemType === "PRODUCT") {
      const productId = parseId(rawItem && rawItem.productId);
      const product = productId ? productMap.get(productId) : null;

      if (!product) {
        return { error: "One of the selected products no longer exists." };
      }

      if (isProductSoldOut(product)) {
        return {
          error:
            (product.displayName || product.name || "One selected product") +
            " is currently sold out.",
        };
      }

      if (
        product.trackInventory &&
        !product.allowBackorder &&
        Number(product.stockQuantity || 0) < quantity
      ) {
        return {
          error:
            (product.displayName || product.name || "One selected product") +
            " does not have enough stock for that quantity.",
        };
      }

      normalizedItems.push({
        itemType: "PRODUCT",
        productId: product.id,
        configKey: product.slug,
        nameSnapshot: product.displayName || product.name,
        imagePath: product.imagePath,
        detailsSnapshot: product.originLabel,
        priceLabel: formatPrice(product),
        unitAmount: product.priceAmount,
        priceCurrency: product.priceCurrency,
        quantity,
      });
      continue;
    }

    if (itemType === "KIT") {
      const name = normalizeText(rawItem && rawItem.name);
      const configKey = normalizeText(
        (rawItem && (rawItem.configKey || rawItem.key)) || "kit"
      ).slice(0, 120);
      const details = normalizeText(rawItem && rawItem.details);
      const image = normalizeText(rawItem && rawItem.image);
      const parsedPrice = parsePriceLabel(rawItem && rawItem.price);

      if (!name || !parsedPrice.label) {
        return { error: "Kit items need a valid name and price." };
      }

      normalizedItems.push({
        itemType: "KIT",
        productId: null,
        configKey,
        nameSnapshot: name,
        imagePath: image || null,
        detailsSnapshot: details || null,
        priceLabel: parsedPrice.label,
        unitAmount: parsedPrice.amount,
        priceCurrency: parsedPrice.currency,
        quantity,
      });
      continue;
    }

    return { error: "Unsupported cart item type." };
  }

  return { items: normalizedItems };
}

app.get("/", function (_req, res) {
  res.json({ message: "Glowmore API running" });
});

app.get("/api/health", async function (_req, res) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  } catch (err) {
    sendServerError(res, err, "Database connection failed.");
  }
});

app.get("/api/users", async function (_req, res) {
  try {
    const users = await prisma.user.findMany({
      select: publicUserSelect,
      orderBy: { createdAt: "desc" },
    });

    res.json(users);
  } catch (err) {
    sendServerError(res, err, "Could not load users.");
  }
});

app.get("/api/products", async function (req, res) {
  const collection = String(req.query.collection || "").trim().toUpperCase();
  const where = collection ? { collection } : undefined;

  try {
    const products = await prisma.product.findMany({
      where,
      select: storefrontProductSelect,
      orderBy: [{ collection: "asc" }, { sortOrder: "asc" }],
    });

    res.json(products);
  } catch (err) {
    sendServerError(res, err, "Could not load products.");
  }
});

// route กลุ่ม storefront ใช้สำหรับหน้าฝั่งลูกค้า
// เช่นหน้า home, หน้า shop, หน้า kit และหน้ารีวิว
app.get("/api/storefront/home", async function (_req, res) {
  try {
    const [matchaProducts, toolsProducts] = await Promise.all([
      prisma.product.findMany({
        where: { collection: "MATCHA", featuredOnHome: true },
        select: storefrontProductSelect,
        orderBy: { sortOrder: "asc" },
      }),
      prisma.product.findMany({
        where: { collection: "TOOLS", featuredOnHome: true },
        select: storefrontProductSelect,
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    res.json({
      matchaProducts: matchaProducts.map(toHomeProductCard),
      toolsProducts: toolsProducts.map(toHomeProductCard),
    });
  } catch (err) {
    sendServerError(res, err, "Could not load home storefront data.");
  }
});

app.get("/api/storefront/shop/matcha", async function (_req, res) {
  try {
    const products = await prisma.product.findMany({
      where: { collection: "MATCHA" },
      select: storefrontProductSelect,
      orderBy: { sortOrder: "asc" },
    });

    res.json({ products: products.map(toShopProductCard) });
  } catch (err) {
    sendServerError(res, err, "Could not load matcha products.");
  }
});

app.get("/api/storefront/shop/tools", async function (_req, res) {
  try {
    const products = await prisma.product.findMany({
      where: { collection: "TOOLS" },
      select: storefrontProductSelect,
      orderBy: { sortOrder: "asc" },
    });

    res.json({ products: products.map(toShopProductCard) });
  } catch (err) {
    sendServerError(res, err, "Could not load tool products.");
  }
});

app.get("/api/storefront/kit", async function (_req, res) {
  try {
    const [kitItems, matchaProducts, curatedProducts] = await Promise.all([
      prisma.product.findMany({
        where: { collection: "TOOLS", includedInKit: true },
        select: storefrontProductSelect,
        orderBy: { sortOrder: "asc" },
      }),
      prisma.product.findMany({
        where: { collection: "MATCHA" },
        select: storefrontProductSelect,
        orderBy: { sortOrder: "asc" },
      }),
      prisma.product.findMany({
        where: { collection: "MATCHA", featuredInKit: true },
        select: storefrontProductSelect,
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    res.json({
      basePrice: 3900,
      kitItems: kitItems.map(function (product) {
        return {
          id: product.id,
          name: product.name,
          desc: product.kitItemDescription,
          image: product.imagePath,
        };
      }),
      matchaOptions: [
        { value: "none", label: "No matcha", price: 0 },
      ].concat(
        matchaProducts.map(function (product) {
          return {
            id: product.id,
            value: product.slug,
            label: product.displayName || product.name,
            price: product.priceAmount,
          };
        })
      ),
      curatedProducts: curatedProducts.map(toKitCuratedProductCard),
    });
  } catch (err) {
    sendServerError(res, err, "Could not load kit storefront data.");
  }
});

app.get("/api/storefront/reviews", async function (req, res) {
  const userId = parseId(req.query.userId);

  try {
    const [reviews, viewer] = await Promise.all([
      prisma.customerReview.findMany({
        where: {
          isPublished: true,
          order: {
            status: { not: "CANCELLED" },
          },
        },
        select: customerReviewSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 6,
      }),
      buildReviewViewerState(userId),
    ]);

    return res.json({
      reviews: reviews.map(toPublicReview),
      viewer,
    });
  } catch (err) {
    return sendServerError(res, err, "Could not load customer reviews.");
  }
});

app.post("/api/reviews", async function (req, res) {
  // route นี้ให้ user ส่งรีวิวได้
  // แต่ backend จะเช็กก่อนว่าต้องเป็น user ที่มีออเดอร์จ่ายเงินจริงแล้วเท่านั้น
  const userId = parseId(req.body.userId);
  const orderId = parseId(req.body.orderId);
  const rating = normalizeReviewRating(req.body.rating);
  const reviewText = normalizeReviewBody(req.body.text);

  if (!userId) {
    return res.status(400).json({ error: "Please sign in before sharing a review." });
  }

  if (!orderId) {
    return res.status(400).json({ error: "We could not find an eligible paid order for this review." });
  }

  if (!rating) {
    return res.status(400).json({ error: "Please choose a rating between 1 and 5 stars." });
  }

  if (reviewText.length < 24) {
    return res.status(400).json({ error: "Please write at least 24 characters so your review feels useful to other customers." });
  }

  try {
    const user = await loadActiveUser(userId);

    if (!user || !user.isActive) {
      return res.status(404).json({ error: "User not found." });
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: user.id,
        status: { not: "CANCELLED" },
        paymentStatus: "PAID",
      },
      include: {
        review: true,
      },
    });

    if (!order) {
      return res.status(400).json({
        error: "Only paid customer orders can be used to leave a verified review.",
      });
    }

    if (order.review) {
      return res.status(409).json({
        error: "That order already has a review attached to it.",
      });
    }

    const review = await prisma.customerReview.create({
      data: {
        userId: user.id,
        orderId: order.id,
        rating,
        reviewText,
        authorNameSnapshot: user.displayName,
        locationLabel: buildReviewLocationLabel(order) || null,
        isPublished: true,
      },
      select: customerReviewSelect,
    });

    const viewer = await buildReviewViewerState(user.id, user);

    return res.status(201).json({
      review: toPublicReview(review),
      viewer,
    });
  } catch (err) {
    return sendServerError(res, err, "Could not save your review.");
  }
});

app.get("/api/cart", async function (req, res) {
  const userId = parseId(req.query.userId);

  if (!userId) {
    return res.status(400).json({ error: "A valid user is required." });
  }

  try {
    const user = await loadActiveUser(userId);

    if (!user || !user.isActive) {
      return res.status(404).json({ error: "User not found." });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: cartWithItemsInclude,
    });

    return res.json({
      items: cart ? cart.items.map(toCartClientItem) : [],
    });
  } catch (err) {
    return sendServerError(res, err, "Could not load your cart.");
  }
});

app.post("/api/cart/sync", async function (req, res) {
  // route นี้ใช้ sync cart จาก frontend ขึ้นฐานข้อมูล
  // โดยจะลบ cart_items ชุดเก่าแล้วสร้างใหม่ตามรายการล่าสุดที่ส่งมา
  const userId = parseId(req.body.userId);

  if (!userId) {
    return res.status(400).json({ error: "A valid user is required." });
  }

  try {
    const user = await loadActiveUser(userId);

    if (!user || !user.isActive) {
      return res.status(404).json({ error: "User not found." });
    }

    const normalized = await normalizeCartItems(req.body.items);

    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const cart = await prisma.$transaction(async function (tx) {
      const savedCart = await tx.cart.upsert({
        where: { userId },
        create: { userId },
        update: {},
        select: { id: true },
      });

      await tx.cartItem.deleteMany({
        where: { cartId: savedCart.id },
      });

      if (normalized.items.length) {
        await tx.cartItem.createMany({
          data: normalized.items.map(function (item) {
            return Object.assign({ cartId: savedCart.id }, item);
          }),
        });
      }

      return tx.cart.findUnique({
        where: { id: savedCart.id },
        include: cartWithItemsInclude,
      });
    });

    return res.json({
      items: cart ? cart.items.map(toCartClientItem) : [],
    });
  } catch (err) {
    return sendServerError(res, err, "Could not save your cart.");
  }
});

// route checkout เป็นจุดที่สำคัญที่สุดจุดหนึ่งของระบบ
// เพราะจะสร้าง order, order_items, payment และ history พร้อมกันใน transaction เดียว
app.post("/api/checkout", async function (req, res) {
  const userId = parseId(req.body.userId);
  const customerName = normalizeDisplayName(req.body.customerName);
  const customerEmail = normalizeEmail(req.body.customerEmail);
  const customerPhone = normalizePhoneNumber(req.body.customerPhone);
  const shippingAddressLine1 = normalizeOptionalText(req.body.shippingAddressLine1, 160);
  const shippingAddressLine2 = normalizeOptionalText(req.body.shippingAddressLine2, 160);
  const shippingDistrict = normalizeOptionalText(req.body.shippingDistrict, 120);
  const shippingProvince = normalizeOptionalText(req.body.shippingProvince, 120);
  const shippingPostalCode = normalizePostalCode(req.body.shippingPostalCode);
  const shippingCountry = normalizeOptionalText(req.body.shippingCountry, 80);
  const notes = normalizeText(req.body.notes);
  const paymentMethod = normalizePaymentMethod(req.body.paymentMethod);
  const paymentReference = normalizeText(req.body.paymentReference).slice(0, 80);
  const paymentQrCodeImage = normalizeImageDataUrl(req.body.paymentQrCodeImage, {
    maxLength: 250000,
  });
  const paymentProofImage = normalizeImageDataUrl(req.body.paymentProofImage, {
    maxLength: 8500000,
  });
  const paymentProofFileName = normalizeUploadFileName(req.body.paymentProofFileName);
  const paymentProofMimeType = normalizeText(req.body.paymentProofMimeType)
    .toLowerCase()
    .slice(0, 80);

  if (!userId) {
    return res.status(400).json({ error: "Please sign in before checking out." });
  }

  if (!customerName) {
    return res.status(400).json({ error: "Please provide your name for checkout." });
  }

  if (!emailPattern.test(customerEmail)) {
    return res.status(400).json({ error: "Please provide a valid checkout email." });
  }

  if (customerPhone.length < 7) {
    return res.status(400).json({ error: "Please provide a valid phone number for delivery." });
  }

  if (!shippingAddressLine1 || !shippingProvince || !shippingPostalCode || !shippingCountry) {
    return res.status(400).json({
      error: "Please complete your shipping address before checkout.",
    });
  }

  if (paymentMethod !== "PROMPTPAY_QR") {
    return res.status(400).json({ error: "Please complete payment with the QR code first." });
  }

  if (!paymentReference) {
    return res.status(400).json({ error: "Your payment reference is missing." });
  }

  if (!paymentQrCodeImage) {
    return res.status(400).json({ error: "Could not capture the QR code for this payment." });
  }

  if (!paymentProofImage) {
    return res.status(400).json({ error: "Please upload your payment proof before checkout." });
  }

  try {
    const user = await loadActiveUser(userId);

    if (!user || !user.isActive) {
      return res.status(404).json({ error: "User not found." });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: cartWithItemsInclude,
    });

    if (!cart || !cart.items.length) {
      return res.status(400).json({ error: "Your cart is empty." });
    }

    const pricing = buildOrderPricing(cart.items);

    if (pricing.error) {
      return res.status(400).json({ error: pricing.error });
    }

    const itemCount = cart.items.reduce(function (total, item) {
      return total + item.quantity;
    }, 0);

    const order = await prisma.$transaction(async function (tx) {
      const submittedAt = new Date();
      const createdOrder = await tx.order.create({
        data: {
          userId: user.id,
          status: "PLACED",
          paymentMethod,
          paymentStatus: "UPLOADED",
          shippingStatus: "PENDING",
          paymentReference,
          customerName,
          customerEmail,
          customerPhone,
          shippingAddressLine1,
          shippingAddressLine2: shippingAddressLine2 || null,
          shippingDistrict: shippingDistrict || null,
          shippingProvince,
          shippingPostalCode,
          shippingCountry,
          itemCount,
          totalSummary: pricing.totalSummary,
          subtotalAmount: pricing.subtotalAmount,
          shippingAmount: pricing.shippingAmount,
          discountAmount: pricing.discountAmount,
          totalAmount: pricing.totalAmount,
          totalCurrency: pricing.totalCurrency,
          notes: notes || null,
          paymentRecord: {
            create: {
              submittedByUserId: user.id,
              paymentReference,
              qrImageData: paymentQrCodeImage,
              proofImageData: paymentProofImage,
              proofFileName: paymentProofFileName || null,
              proofMimeType: paymentProofMimeType || null,
              submittedAt: submittedAt,
              createdAt: submittedAt,
            },
          },
          history: {
            create: {
              changedByUserId: user.id,
              eventType: "CHECKOUT_SUBMITTED",
              fromOrderStatus: null,
              toOrderStatus: "PLACED",
              fromPaymentStatus: null,
              toPaymentStatus: "UPLOADED",
              fromShippingStatus: null,
              toShippingStatus: "PENDING",
              note: "Payment proof uploaded and submitted for review.",
              createdAt: submittedAt,
            },
          },
          items: {
            create: cart.items.map(function (item) {
              return {
                itemType: item.itemType,
                productId: item.productId,
                configKey: item.configKey,
                nameSnapshot: item.nameSnapshot,
                imagePath: item.imagePath,
                detailsSnapshot: item.detailsSnapshot,
                priceLabel: item.priceLabel,
                unitAmount: item.unitAmount,
                priceCurrency: item.priceCurrency,
                quantity: item.quantity,
              };
            }),
          },
        },
        include: orderWithItemsInclude,
      });

      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return createdOrder;
    });

    return res.status(201).json({
      order: toOrderSummary(order),
    });
  } catch (err) {
    return sendServerError(res, err, "Could not place your order.");
  }
});

app.get("/api/orders", async function (req, res) {
  const userId = parseId(req.query.userId);

  if (!userId) {
    return res.status(400).json({ error: "A valid user is required." });
  }

  try {
    const user = await loadActiveUser(userId);

    if (!user || !user.isActive) {
      return res.status(404).json({ error: "User not found." });
    }

    const [orders, nonCancelledOrderCount] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        include: orderWithItemsInclude,
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.order.count({
        where: {
          userId,
          status: { not: "CANCELLED" },
        },
      }),
    ]);

    return res.json({
      orders: orders.map(toOrderSummary),
      nonCancelledOrderCount,
    });
  } catch (err) {
    return sendServerError(res, err, "Could not load your orders.");
  }
});

// route กลุ่ม admin ใช้เฉพาะบัญชีหลังบ้าน
// หน้าที่หลักคือดูออเดอร์ทั้งหมดและอัปเดตสถานะของแต่ละออเดอร์
app.get("/api/admin/orders", async function (req, res) {
  const userId = parseId(req.query.userId);

  if (!userId) {
    return res.status(400).json({ error: "A valid admin user is required." });
  }

  try {
    const adminUser = await loadAdminUser(userId);

    if (!adminUser) {
      return res.status(403).json({ error: "Admin access is required." });
    }

    const orders = await prisma.order.findMany({
      include: adminOrderInclude,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return res.json({
      orders: orders.map(toAdminOrderSummary),
    });
  } catch (err) {
    return sendServerError(res, err, "Could not load admin orders.");
  }
});

app.get("/api/admin/products", async function (req, res) {
  const userId = parseId(req.query.userId);

  if (!userId) {
    return res.status(400).json({ error: "A valid admin user is required." });
  }

  try {
    const adminUser = await loadAdminUser(userId);

    if (!adminUser) {
      return res.status(403).json({ error: "Admin access is required." });
    }

    const products = await prisma.product.findMany({
      select: adminProductSelect,
      orderBy: [{ collection: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    });

    return res.json({
      products: products.map(toAdminProductSummary),
    });
  } catch (err) {
    return sendServerError(res, err, "Could not load admin products.");
  }
});

app.post("/api/admin/products", async function (req, res) {
  const userId = parseId(req.body.userId);
  const collection = normalizeProductCollection(req.body.collection);
  const name = normalizeText(req.body.name).slice(0, 120);
  const displayName = normalizeText(req.body.displayName || req.body.name).slice(0, 120);
  const slug = normalizeSlug(req.body.slug || displayName || name);
  const originLabel = normalizeOptionalText(req.body.originLabel, 120);
  const imagePath = normalizeText(req.body.imagePath).slice(0, 200);
  const kitItemDescription = normalizeOptionalText(req.body.kitItemDescription, 180);
  const badgeLabel = normalizeOptionalText(req.body.badgeLabel, 40);
  const priceAmount = parseOptionalInteger(req.body.priceAmount, { min: 0, max: 999999 });
  const stockQuantity = parseOptionalInteger(req.body.stockQuantity, { min: 0, max: 99999 });
  const sortOrder = parseOptionalInteger(req.body.sortOrder, { min: 0, max: 99999 });
  const soldOut = Boolean(req.body.soldOut);
  const featuredOnHome = Boolean(req.body.featuredOnHome);
  const featuredInKit = Boolean(req.body.featuredInKit);
  const includedInKit = Boolean(req.body.includedInKit);

  if (!userId) {
    return res.status(400).json({ error: "A valid admin user is required." });
  }

  if (!collection) {
    return res.status(400).json({ error: "Please choose MATCHA or TOOLS." });
  }

  if (name.length < 2) {
    return res.status(400).json({ error: "Please enter a product name." });
  }

  if (displayName.length < 2) {
    return res.status(400).json({ error: "Please enter a display name." });
  }

  if (!slug) {
    return res.status(400).json({ error: "Please enter a valid slug." });
  }

  if (priceAmount === null) {
    return res.status(400).json({ error: "Please enter a valid product price in THB." });
  }

  if (!imagePath) {
    return res.status(400).json({ error: "Please enter the product image path." });
  }

  if (stockQuantity === null) {
    return res.status(400).json({ error: "Please enter a valid stock quantity." });
  }

  try {
    const adminUser = await loadAdminUser(userId);

    if (!adminUser) {
      return res.status(403).json({ error: "Admin access is required." });
    }

    const [existingProduct, lastSortedProduct] = await Promise.all([
      prisma.product.findUnique({
        where: { slug },
        select: { id: true },
      }),
      prisma.product.findFirst({
        orderBy: [{ sortOrder: "desc" }, { id: "desc" }],
        select: { sortOrder: true },
      }),
    ]);

    if (existingProduct) {
      return res.status(409).json({ error: "That slug is already being used by another product." });
    }

    const product = await prisma.product.create({
      data: {
        slug,
        collection,
        name,
        displayName,
        originLabel: originLabel || null,
        originKey: originLabel ? normalizeSlug(originLabel) : null,
        sizeKey: null,
        subscriptionEnabled: false,
        cultivarKey: null,
        offeringKey: null,
        priceAmount,
        priceCurrency: "THB",
        badgeLabel: badgeLabel || null,
        soldOut,
        imagePath,
        kitItemDescription: kitItemDescription || null,
        featuredOnHome,
        featuredInKit,
        includedInKit,
        sortOrder: sortOrder === null ? Number((lastSortedProduct && lastSortedProduct.sortOrder) || 0) + 10 : sortOrder,
        trackInventory: true,
        stockQuantity,
        lowStockThreshold: 5,
        allowBackorder: false,
      },
      select: adminProductSelect,
    });

    return res.status(201).json({
      product: toAdminProductSummary(product),
    });
  } catch (err) {
    return sendServerError(res, err, "Could not create that product.");
  }
});

app.post("/api/admin/products/:productId/delete", async function (req, res) {
  const userId = parseId(req.body.userId);
  const productId = parseId(req.params.productId);

  if (!userId || !productId) {
    return res.status(400).json({ error: "A valid admin user and product are required." });
  }

  try {
    const adminUser = await loadAdminUser(userId);

    if (!adminUser) {
      return res.status(403).json({ error: "Admin access is required." });
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });

    if (!existingProduct) {
      return res.status(404).json({ error: "Product not found." });
    }

    await prisma.$transaction(async function(tx) {
      await tx.cartItem.deleteMany({
        where: { productId: existingProduct.id },
      });

      await tx.product.delete({
        where: { id: existingProduct.id },
      });
    });

    return res.json({
      success: true,
      deletedProductId: existingProduct.id,
    });
  } catch (err) {
    return sendServerError(res, err, "Could not delete that product.");
  }
});

app.post("/api/admin/products/:productId/update", async function (req, res) {
  const userId = parseId(req.body.userId);
  const productId = parseId(req.params.productId);
  const name = normalizeText(req.body.name).slice(0, 120);
  const displayName = normalizeText(req.body.displayName || req.body.name).slice(0, 120);
  const slug = normalizeSlug(req.body.slug || displayName || name);
  const originLabel = normalizeOptionalText(req.body.originLabel, 120);
  const imagePath = normalizeText(req.body.imagePath).slice(0, 200);
  const kitItemDescription = normalizeOptionalText(req.body.kitItemDescription, 180);
  const badgeLabel = normalizeOptionalText(req.body.badgeLabel, 40);
  const priceAmount = parseOptionalInteger(req.body.priceAmount, { min: 0, max: 999999 });
  const stockQuantity = parseOptionalInteger(req.body.stockQuantity, { min: 0, max: 99999 });
  const sortOrder = parseOptionalInteger(req.body.sortOrder, { min: 0, max: 99999 });
  const soldOut = Boolean(req.body.soldOut);
  const featuredOnHome = Boolean(req.body.featuredOnHome);
  const featuredInKit = Boolean(req.body.featuredInKit);
  const includedInKit = Boolean(req.body.includedInKit);

  if (!userId || !productId) {
    return res.status(400).json({ error: "A valid admin user and product are required." });
  }

  if (name.length < 2) {
    return res.status(400).json({ error: "Please enter a product name." });
  }

  if (displayName.length < 2) {
    return res.status(400).json({ error: "Please enter a display name." });
  }

  if (!slug) {
    return res.status(400).json({ error: "Please enter a valid slug." });
  }

  if (priceAmount === null) {
    return res.status(400).json({ error: "Please enter a valid product price in THB." });
  }

  if (!imagePath) {
    return res.status(400).json({ error: "Please enter the product image path." });
  }

  if (stockQuantity === null) {
    return res.status(400).json({ error: "Please enter a valid stock quantity." });
  }

  try {
    const adminUser = await loadAdminUser(userId);

    if (!adminUser) {
      return res.status(403).json({ error: "Admin access is required." });
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, slug: true },
    });

    if (!existingProduct) {
      return res.status(404).json({ error: "Product not found." });
    }

    if (slug !== existingProduct.slug) {
      const slugConflict = await prisma.product.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (slugConflict) {
        return res.status(409).json({ error: "That slug is already being used by another product." });
      }
    }

    const updateData = {
      slug,
      name,
      displayName,
      originLabel: originLabel || null,
      originKey: originLabel ? normalizeSlug(originLabel) : null,
      priceAmount,
      badgeLabel: badgeLabel || null,
      soldOut,
      imagePath,
      kitItemDescription: kitItemDescription || null,
      featuredOnHome,
      featuredInKit,
      includedInKit,
      stockQuantity,
    };

    if (sortOrder !== null) {
      updateData.sortOrder = sortOrder;
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      select: adminProductSelect,
    });

    return res.json({
      product: toAdminProductSummary(product),
    });
  } catch (err) {
    return sendServerError(res, err, "Could not update that product.");
  }
});

app.post("/api/admin/orders/:orderId/status", async function (req, res) {
  // route นี้ให้ admin เปลี่ยนสถานะออเดอร์จริง
  // พร้อมใส่ carrier, tracking number และ note ได้ในครั้งเดียว
  const userId = parseId(req.body.userId);
  const orderId = parseId(req.params.orderId);
  const adminStatus = normalizeText(req.body.adminStatus).toUpperCase();
  const shippingCarrier = normalizeOptionalText(req.body.shippingCarrier, 80);
  const trackingNumber = normalizeOptionalText(req.body.trackingNumber, 80);
  const adminNote = normalizeOptionalText(req.body.adminNote, 240);

  if (!userId || !orderId) {
    return res.status(400).json({ error: "A valid admin user and order are required." });
  }

  if (!adminOrderStatuses.has(adminStatus)) {
    return res.status(400).json({ error: "Please choose a valid admin order status." });
  }

  try {
    const adminUser = await loadAdminUser(userId);

    if (!adminUser) {
      return res.status(403).json({ error: "Admin access is required." });
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: adminOrderInclude,
    });

    if (!existingOrder) {
      return res.status(404).json({ error: "Order not found." });
    }

    const nextSnapshot = resolveAdminStatusSnapshot(adminStatus, existingOrder, {
      shippingCarrier,
      trackingNumber,
    });

    if (
      (adminStatus === "SHIPPED" || adminStatus === "DELIVERED") &&
      (!nextSnapshot.shippingCarrier || !nextSnapshot.trackingNumber)
    ) {
      return res.status(400).json({
        error: "Please provide both the shipping carrier and tracking number before marking this order as shipped.",
      });
    }

    const inventoryHistory = (existingOrder.history || []).filter(function(e) {
      return e.eventType === "INVENTORY_ADJUSTED";
    });
    const lastInventoryEntry = inventoryHistory[0] || null;
    const inventoryCurrentlyReserved = lastInventoryEntry
      ? String(lastInventoryEntry.note || "").startsWith("Reserved stock")
      : false;
    const nextInventoryCommitted = isInventoryCommitted(nextSnapshot);
    const shouldDecrement = !inventoryCurrentlyReserved && nextInventoryCommitted;
    const shouldRestore = inventoryCurrentlyReserved && !nextInventoryCommitted;

    const updatedOrder = await prisma.$transaction(async function(tx) {
      if (shouldDecrement || shouldRestore) {
        const inventoryRequirements = await buildInventoryRequirements(tx, existingOrder.items);
        const direction = shouldDecrement ? "decrement" : "restore";
        const changedProducts = await applyInventoryAdjustment(
          tx,
          inventoryRequirements,
          direction
        );

        if (changedProducts.length) {
          await tx.orderStatusHistory.create({
            data: {
              orderId: existingOrder.id,
              changedByUserId: adminUser.id,
              eventType: "INVENTORY_ADJUSTED",
              fromOrderStatus: existingOrder.status,
              toOrderStatus: nextSnapshot.status,
              fromPaymentStatus: existingOrder.paymentStatus,
              toPaymentStatus: nextSnapshot.paymentStatus,
              fromShippingStatus: existingOrder.shippingStatus,
              toShippingStatus: nextSnapshot.shippingStatus,
              shippingCarrier: nextSnapshot.shippingCarrier || null,
              trackingNumber: nextSnapshot.trackingNumber || null,
              note: summarizeInventoryAdjustment(direction, changedProducts) || null,
            },
          });
        }
      }

      const orderData = {
        status: nextSnapshot.status,
        paymentStatus: nextSnapshot.paymentStatus,
        shippingStatus: nextSnapshot.shippingStatus,
        paidAt: nextSnapshot.paidAt,
        shippedAt: nextSnapshot.shippedAt,
        deliveredAt: nextSnapshot.deliveredAt,
        cancelledAt: nextSnapshot.cancelledAt,
        shippingCarrier: nextSnapshot.shippingCarrier || null,
        trackingNumber: nextSnapshot.trackingNumber || null,
      };

      const order = await tx.order.update({
        where: { id: orderId },
        data: orderData,
        include: adminOrderInclude,
      });

      const historyEntries = buildHistoryEntriesForAdminTransition(
        existingOrder,
        Object.assign({}, nextSnapshot, orderData),
        adminUser.id,
        adminNote
      );

      if (historyEntries.length) {
        await tx.orderStatusHistory.createMany({
          data: historyEntries.map(function(entry) {
            return Object.assign({ orderId: existingOrder.id }, entry);
          }),
        });
      }

      return tx.order.findUnique({
        where: { id: orderId },
        include: adminOrderInclude,
      });
    });

    return res.json({
      order: toAdminOrderSummary(updatedOrder),
    });
  } catch (err) {
    return sendServerError(res, err, "Could not update the order status.");
  }
});

// route กลุ่ม auth ใช้สำหรับสมัครสมาชิก, เข้าสู่ระบบ และรีเซ็ตรหัสผ่าน
app.post("/api/auth/register", async function (req, res) {
  const displayName = normalizeDisplayName(req.body.displayName);
  const displayNameKey = normalizeDisplayNameKey(displayName);
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  const validationError = validateAuthPayload(
    { displayName, email, password },
    { requireDisplayName: true }
  );

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  if (email === adminLoginEmail || normalizeLoginIdentifier(displayName) === adminLoginHandle) {
    return res.status(409).json({ error: "That account name is reserved." });
  }

  try {
    const [existingUser, existingDisplayNameUser] = await Promise.all([
      prisma.user.findUnique({
        where: { email },
        select: { id: true },
      }),
      prisma.user.findFirst({
        where: { displayNameKey },
        select: { id: true },
      }),
    ]);

    if (existingUser) {
      return res
        .status(409)
        .json({ error: "An account with that email already exists." });
    }

    if (existingDisplayNameUser) {
      return res.status(409).json({
        error: "That display name is already taken. Please choose a different one.",
      });
    }

    const passwordHash = await hashPassword(password);
    const now = new Date();
    const user = await prisma.user.create({
      data: {
        displayName,
        displayNameKey,
        email,
        passwordHash,
        lastLoginAt: now,
      },
      select: publicUserSelect,
    });

    return res.status(201).json({ user });
  } catch (err) {
    return sendServerError(res, err, "Could not create your account.");
  }
});

app.post("/api/auth/login", async function (req, res) {
  // login รองรับทั้ง user ปกติและ admin
  // ถ้าตรวจรหัสผ่านผ่านก็จะอัปเดต lastLoginAt แล้วส่งข้อมูล user กลับไป
  const identifier = normalizeLoginIdentifier(req.body.email);
  const password = String(req.body.password || "");
  const validationError = validateLoginPayload({ email: identifier, password });

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const user = identifier === adminLoginHandle
      ? await prisma.user.findFirst({
          where: {
            isAdmin: true,
            displayName: {
              equals: adminLoginHandle,
              mode: "insensitive",
            },
          },
        })
      : await prisma.user.findUnique({
          where: { email: normalizeEmail(identifier) },
        });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Incorrect login or password." });
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Incorrect login or password." });
    }

    const authenticatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      select: publicUserSelect,
    });

    return res.json({ user: authenticatedUser });
  } catch (err) {
    return sendServerError(res, err, "Could not sign you in.");
  }
});

app.post("/api/auth/reset-password", async function (req, res) {
  // โปรเจกต์นี้ใช้ reset password แบบตรงๆ ผ่านอีเมลในระบบ
  // ยังไม่ได้ส่งลิงก์เมลจริง แต่ flow หลักของการเปลี่ยนรหัสทำงานครบ
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");

  if (!emailPattern.test(email)) {
    return res.status(400).json({ error: "Please enter the email address on your account." });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Your new password must be at least 8 characters." });
  }

  if (email === adminLoginEmail) {
    return res.status(403).json({
      error: "The admin password cannot be reset from this form.",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(404).json({
        error: "We could not find an active account with that email.",
      });
    }

    const passwordHash = await hashPassword(password);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
      },
    });

    return res.json({
      message: "Password updated. Please sign in with your new password.",
    });
  } catch (err) {
    return sendServerError(res, err, "Could not reset that password right now.");
  }
});

ensureAdminUser()
  .then(function () {
    app.listen(port, function () {
      console.log("Server running on port " + port);
    });
  })
  .catch(function (err) {
    console.error("Could not ensure admin account.", err);
    process.exit(1);
  });
