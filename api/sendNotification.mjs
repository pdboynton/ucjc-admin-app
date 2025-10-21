export default async function handler(req, res) {
  console.log("Incoming request:", req.method);

  let admin;
  try {
    const { default: importedAdmin } = await import("firebase-admin");
    admin = importedAdmin;

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    console.log("Firebase Admin initialized");
  } catch (err) {
    console.error("Firebase Admin SDK init failed:", err);
    return res.status(500).json({ success: false, error: "Firebase Admin SDK init failed" });
  }

  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { token, title, body } = req.body;

  if (!token || !title || !body) {
    return res.status(400).json({ error: "Missing required fields" });
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
    console.log("Notification sent:", response);
    res.status(200).json({ success: true, response });
  } catch (err) {
    console.error("FCM error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
