// Firebase Messaging Service Worker
// This handles push notifications when the app is in the background

importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyA4I_DbmS9czeZDLeB80gacLnt1pR5UeOI',
  authDomain: 'mytick-cbcf0.firebaseapp.com',
  projectId: 'mytick-cbcf0',
  storageBucket: 'mytick-cbcf0.firebasestorage.app',
  messagingSenderId: '516718261323',
  appId: '1:516718261323:web:b24089355cfec4424809ce',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  if (title) {
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.svg',
      data: payload.data,
    });
  }
});
