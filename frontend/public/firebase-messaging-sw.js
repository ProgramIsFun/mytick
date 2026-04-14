// Firebase Messaging Service Worker
// This handles push notifications when the app is in the background

importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'TODO_FILL_ME',
  authDomain: 'mytick-cbcf0.firebaseapp.com',
  projectId: 'mytick-cbcf0',
  storageBucket: 'mytick-cbcf0.firebasestorage.app',
  messagingSenderId: '516718261323',
  appId: 'TODO_FILL_ME',
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
