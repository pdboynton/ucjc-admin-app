importScripts("https://www.gstatic.com/firebasejs/10.5.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.5.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDV34G66jQ58MBPBJq3MfmhZF8mOdifVqg",
  projectId: "ucjcconvocation",
  messagingSenderId: "698752970791",
  appId: "1:698752970791:web:0ae1b0094858609579de02"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  console.log("Received background message:", payload);
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/icons/notification-icon.png"
  });
});
