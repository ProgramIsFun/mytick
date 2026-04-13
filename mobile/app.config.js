export default {
  expo: {
    name: "mobile",
    slug: "mytick",
    version: "1.0.0",
    scheme: "mytick",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      infoPlist: {
        UIBackgroundModes: ["remote-notification"],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.mytick.app",
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#1a73e8",
        },
      ],
    ],
    extra: {
      router: {},
      eas: {
        projectId: "b358db95-c197-4a9f-b8a7-0f975600ea63",
      },
    },
  },
};
