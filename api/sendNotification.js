import admin from "firebase-admin";
import path from "path";
import fs from "fs";

export default async function handler(req, res) {
  console.log("Incoming request:", req.method, req.body);
  console.log("Server time (UTC):", new Date().toISOString());

  try {
    const serviceAccountPath = path.join(process.cwd(), "config/service-account.json");
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

    console.log("Loaded service account email:", serviceAccount.client_email);
    console.log("Loaded service account project ID:", serviceAccount.project_id);
    console.log("Loaded service account key ID:", serviceAccount.private_key_id);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
  } catch (initError) {
    console.error("Firebase Admin initialization failed:", initError);
    return res.status(500).json({ success: false, error: "Firebase Admin SDK init failed" });
  }

  if (req.method !== "POST") {
    console.warn("Rejected non-POST request");
    return res.status(405).end();
  }

  const { token, title, body } = req.body;

  if (!token || typeof token !== "string" || token.trim() === "") {
    console.error("Missing or invalid FCM token:", token);
    return res.status(400).json({ error: "Missing or invalid FCM token" });
  }

  if (!title || !body) {
    console.error("Missing title or body:", { title, body });
    return res.status(400).json({ error: "Missing title or body" });
  }

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

  try {
    const response = await admin.messaging().send(message);
    console.log("Successfully sent message:", response);
    res.status(200).json({ success: true, response });
  } catch (err) {
    console.error("FCM error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
