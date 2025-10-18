navigator.serviceWorker.register("firebase-messaging-sw.js");
let access_token = null;
let fcmToken = null;

let numButtonClicks = 0;
function buttonClicked() {
    numButtonClicks = numButtonClicks + 1;
    document.getElementById("mainDiv").textContent =
        "Button Clicked times: " + numButtonClicks;
}

const CLIENT_ID = "698752970791-4u301ft12476gefotj313sb1t3ovn5p1.apps.googleusercontent.com";
const API_KEY = "AIzaSyDV34G66jQ58MBPBJq3MfmhZF8mOdifVqg";
const CALENDAR_ID = "c_ab7c60e65ae19abaea378c282b6770147ad855d3c58c442c8fa611b7e5be2934@group.calendar.google.com";
const SCOPES = "https://www.googleapis.com/auth/calendar";

let tokenClient;

window.onload = () => {
  initFirebase(); // initialize Firebase messaging
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: "https://www.googleapis.com/auth/calendar",
    callback: (tokenResponse) => {
      access_token = tokenResponse.access_token;
      gapiLoadCalendar();
    }
  });
};

document.getElementById("authorize-btn").addEventListener("click", () => {
  tokenClient.requestAccessToken();
});

function gapiLoadCalendar() {
  gapi.load("client", async () => {
    // Only initialize with access token, not API key
    await gapi.client.init({});

    gapi.client.setToken({ access_token }); // Set token explicitly
    await gapi.client.load("calendar", "v3");
    console.log("Google Calendar API loaded");
    loadEvents();
  });
}


document.getElementById("event-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("event-id").value;
  const event = {
    summary: document.getElementById("event-title").value,
    description: document.getElementById("event-description").value,
    location: document.getElementById("event-location").value,
    start: { dateTime: new Date(document.getElementById("event-start").value).toISOString() },
    end: { dateTime: new Date(document.getElementById("event-end").value).toISOString() }
  };

  // Set access token manually
  gapi.client.setToken({ access_token });

  try {
    if (id) {
      await gapi.client.calendar.events.update({
        calendarId: CALENDAR_ID,
        eventId: id,
        resource: event
      });
      alert("Event updated!");
    } else {
      await gapi.client.calendar.events.insert({
        calendarId: CALENDAR_ID,
        resource: event
      });
      alert("Event created!");
    }

    loadEvents();
  } catch (err) {
    console.error("Calendar API error:", err);
    alert("Failed to submit event. Check authorization and scopes.");
  }
});


document.getElementById("filter-select").addEventListener("change", () => {
  loadEvents();
});

async function loadEvents() {
  const now = new Date().toISOString();
  const res = await gapi.client.calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: now,
    singleEvents: true,
    orderBy: "startTime"
  });

  const selectedTag = document.getElementById("filter-select").value;
  const events = res.result.items || [];
  const filtered = selectedTag === "All" ? events
    : events.filter(ev => (ev.description || "").includes(selectedTag));

  const list = document.getElementById("event-list");
  list.innerHTML = "";

  filtered.forEach(ev => {
    const start = new Date(ev.start.dateTime || ev.start.date).toLocaleString();
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${ev.summary}</strong><br/>
      ${start}<br/>
      ${ev.location || ""}<br/>
      <div class="event-actions">
        <button onclick="editEvent('${ev.id}')">Edit</button>
        <button onclick="deleteEvent('${ev.id}')">Delete</button>
      </div>
    `;
    list.appendChild(li);
  });
}

function editEvent(id) {
  gapi.client.calendar.events.get({ calendarId: CALENDAR_ID, eventId: id }).then(res => {
    const ev = res.result;
    document.getElementById("event-id").value = ev.id;
    document.getElementById("event-title").value = ev.summary;
    document.getElementById("event-description").value = ev.description || "";
    document.getElementById("event-location").value = ev.location || "";
    document.getElementById("event-start").value = ev.start.dateTime?.slice(0,16) || "";
    document.getElementById("event-end").value = ev.end.dateTime?.slice(0,16) || "";

    // Switch to Event Form section
    document.querySelectorAll("section").forEach(sec => sec.classList.remove("active"));
    document.getElementById("event-form-section").classList.add("active");

    // Highlight the Event Form nav button
    document.querySelectorAll(".nav-bar button").forEach(b => b.classList.remove("active"));
    document.querySelector('[data-target="event-form-section"]').classList.add("active");
  });
}

function deleteEvent(id) {
  if (confirm("Delete this event?")) {
    gapi.client.calendar.events.delete({ calendarId: CALENDAR_ID, eventId: id }).then(() => {
      alert("Event deleted.");
      loadEvents();
    });
  }
}

document.querySelectorAll(".nav-bar button").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-target");
    document.querySelectorAll("section").forEach(sec => sec.classList.remove("active"));
    document.getElementById(target)?.classList.add("active");

    document.querySelectorAll(".nav-bar button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// Firebase Push Notification (same as before)fi

// Firebase Setup
function initFirebase() {
  const config = {
    apiKey: "AIzaSyDV34G66jQ58MBPBJq3MfmhZF8mOdifVqg",
    authDomain: "ucjcconvocation.firebaseapp.com",
    projectId: "ucjcconvocation",
    storageBucket: "ucjcconvocation.firebasestorage.app",
    messagingSenderId: "698752970791",
    appId: "1:698752970791:web:0ae1b0094858609579de02",
    measurementId: "G-0M5WBTR83N"
  };

  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  Notification.requestPermission().then(permission => {
    if (permission === "granted") {
      navigator.serviceWorker.ready.then(reg => {
        messaging.getToken({
          vapidKey: "BBrSRxtM6M6j_FQoWdGPpjf2QodXhGyevf-5ng_MqXhdHV6OJQVcQful0X1wKWYxUpt3Gc_6IN-sfyDTbHGXGO8",
          serviceWorkerRegistration: reg
        }).then(token => {
          console.log("FCM Token:", token);
        }).catch(err => console.error("FCM token error:", err));
      });
    }
  });
}

async function sendPushNotification(token) {
  const payload = {
    to: token,
    notification: {
      title: "UCJC Update",
      body: "New event or update posted!",
      icon: "/icons/notification-icon.png"
    }
  };

  try {
    if (id) {
      await gapi.client.calendar.events.update({
        calendarId: CALENDAR_ID,
        eventId: id,
        resource: event
      });
      alert("Event updated!");
    } else {
      await gapi.client.calendar.events.insert({
        calendarId: CALENDAR_ID,
        resource: event
      });
      alert("Event created!");
    }

    // Send push notification
    await sendPushNotification(fcmToken);

    loadEvents();
  } catch (err) {
    console.error("Calendar API error:", err);
    alert("Failed to submit event. Check authorization and scopes.");
  }

}

document.getElementById("manual-notify-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("notify-title").value;
  const body = document.getElementById("notify-body").value;

  await fetch("/api/sendNotification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: fcmToken, title, body })
  });

  alert("Manual notification sent!");
});
