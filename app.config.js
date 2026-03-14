// Dynamic configuration based on build environment
const IS_DEV = process.env.APP_VARIANT === 'development' || process.env.EAS_BUILD_PROFILE === "development";
const IS_PRODUCTION = process.env.EAS_BUILD_PROFILE === "production";

// Import version from package.json
import packageInfo from './package.json';
const BASE_VERSION = process.env.APP_VERSION || packageInfo.version;
// Append " Dev" suffix in development builds to distinguish from production
const VERSION = IS_DEV ? `${BASE_VERSION} Dev` : BASE_VERSION;

export default {
  // App name changes based on build variant
  name: IS_DEV ? "SleepFactor Dev" : "SleepFactor",
  slug: "SleepFactor",
  scheme: "sleepfactor",
  version: VERSION,
  orientation: "portrait",
  icon: "./assets/AppLogo.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    image: "./assets/AppLogo.png",
    resizeMode: "contain",
    backgroundColor: "#FFFFFF"
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: IS_DEV ? "com.sleepfactor.app.dev" : "com.sleepfactor.app"
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/AppLogo.png",
      backgroundColor: "#1E3A8A"
    },
    edgeToEdgeEnabled: true,
    package: IS_DEV ? "com.sleepfactor.app.dev" : "com.sleepfactor.app",
    permissions: [
      "android.permission.health.READ_SLEEP",
      "android.permission.health.READ_STEPS",
      "android.permission.health.READ_HEART_RATE",
      "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
      "android.permission.health.READ_TOTAL_CALORIES_BURNED",
      "android.permission.health.READ_EXERCISE",
      "android.permission.health.READ_RESPIRATORY_RATE",
      "android.permission.health.READ_BLOOD_GLUCOSE",
      "android.permission.health.READ_BLOOD_PRESSURE",
      "android.permission.health.READ_BODY_TEMPERATURE",
      "android.permission.health.READ_OXYGEN_SATURATION",
      "android.permission.health.READ_WEIGHT",
      "android.permission.health.READ_HEIGHT",
      "android.permission.health.READ_BODY_FAT",
      "android.permission.health.READ_RESTING_HEART_RATE"
    ]
  },
  web: {
    favicon: "./assets/AppLogo.png"
  },
  plugins: [
    [
      "expo-splash-screen",
      {
        backgroundColor: "#FFFFFF",
        image: "./assets/AppLogo.png",
        resizeMode: "contain",
        imageWidth: 200
      }
    ],
    "./plugins/withAndroidSplashIconBackground.js",
    [
      "expo-health-connect",
      {
        permissions: [
          "android.permission.health.READ_SLEEP",
          "android.permission.health.READ_STEPS",
          "android.permission.health.READ_HEART_RATE",
          "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
          "android.permission.health.READ_TOTAL_CALORIES_BURNED",
          "android.permission.health.READ_EXERCISE",
          "android.permission.health.READ_RESPIRATORY_RATE",
          "android.permission.health.READ_BLOOD_GLUCOSE",
          "android.permission.health.READ_BLOOD_PRESSURE",
          "android.permission.health.READ_BODY_TEMPERATURE",
          "android.permission.health.READ_OXYGEN_SATURATION",
          "android.permission.health.READ_WEIGHT",
          "android.permission.health.READ_HEIGHT",
          "android.permission.health.READ_BODY_FAT",
          "android.permission.health.READ_RESTING_HEART_RATE"
        ]
      }
    ],
    [
      "@kingstinct/react-native-healthkit",
      {
        NSHealthShareUsageDescription: "SleepFactor needs access to your health data to analyze how your habits affect your sleep quality.",
        NSHealthUpdateUsageDescription: "SleepFactor needs to write sleep data to help track your sleep patterns.",
        background: false
      }
    ],
    [
      "expo-build-properties",
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 34,
          minSdkVersion: 26
        }
      }
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/AppLogo.png",
        color: "#1E3A8A",
        sounds: [],
        androidMode: "default"
      }
    ]
  ],
  extra: {
    eas: {
      projectId: "430fa5de-f870-4b36-99b7-f5563e95a1f2"
    }
  },
  owner: "jyriad",
  // Use base version only so EAS Configure expo-updates and the build agree (avoids "1.327" vs "1.327 Dev" mismatch).
  runtimeVersion: BASE_VERSION,
  updates: {
    url: "https://u.expo.dev/430fa5de-f870-4b36-99b7-f5563e95a1f2"
  }
};
