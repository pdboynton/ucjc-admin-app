import admin from "firebase-admin";

// Use environment variable for security
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
// import serviceAccount from "service-account.json"; // adjust path if needed (use local file)

// Initialize Firebase Admin SDK once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { token, title, body } = req.body;

  console.log("Sending FCM to:", token);
  console.log("Title:", title);
  console.log("Body:", body);

  const message = {
    token,
    notification: {
      title,
      body,
      icon: "/icons/notification-icon.png"
    },
    android: {
      priority: "high"
    },
    apns: {
      payload: {
        aps: {
          sound: "default"
        }
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
