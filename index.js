import admin from "firebase-admin";
import fetch from "node-fetch";
import fs from "fs";

// Load Firebase service account key safely
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Telegram Details
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Already notified orders tracking
const notified = new Set();
const notifiedProducts = new Set(); // MOVE here, top level

// Function to send telegram message
async function sendTelegram(msg) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: msg,
      parse_mode: "Markdown",
    }),
  });
}

// ============================
// 🔔 SERVICE LISTENER
// ============================
console.log("🔥 Service Order listener started...");

db.collection("orders").onSnapshot(async (snapshot) => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === "added") {
      const order = { id: change.doc.id, ...change.doc.data() };

      if (order.status !== "booked") return;
      if (notified.has(order.id)) return;

      notified.add(order.id);

      const message = `
📦 *New Order Booked!*
🧾 Order ID: ${order.orderId}
👤 Name: ${order.customerName}
📞 Phone: ${order.customerPhone}
💰 Total: ₹${order.totalAmount}
🕒 Time: ${order.date}
      `;

      await sendTelegram(message);
      console.log("Sent Service Telegram Notification:", order.orderId);
    }
  });
});

// ============================
// 🛒 PRODUCT LISTENER
// ============================
console.log("🔥 Product Order listener started...");

db.collection("productOrders").onSnapshot(async (snapshot) => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === "added" || change.type === "modified") {
      const order = { id: change.doc.id, ...change.doc.data() };

      // Determine if we should notify
      const shouldNotify =
        (order.paymentMethod === "COD" && order.status === "PLACED") ||
        (order.paymentMethod === "ONLINE" && order.paymentStatus === "PAID");

      if (!shouldNotify) return;
      if (order.telegramNotified) return;
      if (notifiedProducts.has(order.id)) return;

      notifiedProducts.add(order.id);

      let paymentLabel =
        order.paymentMethod === "COD"
          ? "💵 *COD ORDER*"
          : "🔥 *PREPAID ORDER*";

      let itemsText = "";
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item) => {
          itemsText += `• ${item.productName || item.name} x${item.quantity} = ₹${item.price * item.quantity}\n`;
        });
      }

      const message = `
🛒 *New Product Order!*

${paymentLabel}

🧾 Order ID: ${order.orderId}
👤 User ID: ${order.userId}
📞 Phone: ${order.customerPhone || "Not Provided"}
📍 City: ${order.city}
📮 Area: ${order.area || order.pincode || "N/A"}

📦 Items:
${itemsText}

💰 Total: ₹${order.total}
💳 Payment Mode: ${order.paymentMethod}
🕒 Time: ${new Date(order.timestamp).toLocaleString()}
`;

      await sendTelegram(message);

      // Mark as notified
      await change.doc.ref.update({ telegramNotified: true });

      console.log("Sent Product Telegram Notification:", order.orderId);
    }
  });
});

