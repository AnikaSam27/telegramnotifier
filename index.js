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

// Firestore Listener
console.log("🔥 Order listener started...");

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
      console.log("Sent Telegram Notification:", order.orderId);
    }
  });
});

