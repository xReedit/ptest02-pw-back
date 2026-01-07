// Import the functions you need from the SDKs you need
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc, updateDoc, setDoc, doc, getDoc } = require("firebase/firestore");



const firebaseConfig = {
  apiKey: "AIzaSyBJ5B_38FwRPqaUVetoha_P8r-Ab5Nj6fM",
  authDomain: "push-notification-app-papaya.firebaseapp.com",
  databaseURL: "https://push-notification-app-papaya.firebaseio.com",
  projectId: "push-notification-app-papaya",
  storageBucket: "push-notification-app-papaya.appspot.com",
  messagingSenderId: "343768699541",
  appId: "1:343768699541:web:1485174309a7004102819c",
  measurementId: "G-KZWNT2SN2M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const repartidorCollection = collection(db, 'repartidor');


const admin = require('firebase-admin');

if (!admin.apps.length) {
	const serviceAccount = require('./serviceAccountKey.json');
	admin.initializeApp({
		credential: admin.credential.cert(serviceAccount)
	});
}

const messaging = admin.messaging();

async function sendPushNotification(token, notification) {
  const message = {
    token: token,
    notification: {
      title: notification.title,
      body: notification.body,
    },
    android: {
      notification: {
        // icon: notification.icon,
        color: '#f45342',
      },
    },
    apns: {
      payload: {
        aps: {
          badge: 42,
        },
      },
    },
  };

  try {
    const response = await messaging.send(message);
    console.log('Successfully sent message:', response);
  } catch (error) {
    console.log('Error sending message:', error);
  }
}

module.exports = {
  repartidorCollection,
  addDoc,
  updateDoc,
  setDoc,
  doc,
  getDoc,
  sendPushNotification,
  admin,
  messaging
};


// const analytics = getAnalytics(app);

