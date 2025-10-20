// /api/sendNotification.js

import admin from "firebase-admin";
const path = require("path");
const fs = require("fs");

const serviceAccountPath = path.join(__dirname, "../config/service-account.json");
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { token, title, body } = req.body;

  try {
    const message = {
      token,
      notification: {
        title,
        body,
        icon: "/icons/notification-icon.png"
      },
      android: { priority: "high" },
      apns: {
        payload: {
          aps: { sound: "default" }
        }
      }
    };

    const response = await admin.messaging().send(message);
    res.status(200).json({ success: true, response });
  } catch (err) {
    console.error("FCM error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
