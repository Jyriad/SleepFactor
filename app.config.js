// Dynamic configuration based on build environment
const IS_DEV = process.env.APP_VARIANT === 'development' || process.env.EAS_BUILD_PROFILE === "development";
const IS_PRODUCTION = process.env.EAS_BUILD_PROFILE === "production";

// Import version from package.json
import packageInfo from './package.json';
const BASE_VERSION = process.env.APP_VERSION || packageInfo.version;

/** iOS Google Sign-In URL scheme derived from Google Cloud "iOS" OAuth client ID (set in .env / EAS). */
const GOOGLE_IOS_CLIENT_ID_FOR_PLUGIN = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
const googleIosUrlSchemeFromEnv =
  GOOGLE_IOS_CLIENT_ID_FOR_PLUGIN.endsWith('.apps.googleusercontent.com')
    ? `com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID_FOR_PLUGIN.replace('.apps.googleusercontent.com', '')}`
    : '';
/** Always use the non-Firebase plugin path (this repo has no google-services.json). */
const googleIosUrlScheme = googleIosUrlSchemeFromEnv.startsWith('com.googleusercontent.apps.')
  ? googleIosUrlSchemeFromEnv
  : 'com.googleusercontent.apps.unconfigured';
// Apple requires CFBundleShortVersionString to be numeric only (e.g. 1.327), not "1.327 Dev".
// Dev vs prod is distinguished by bundle ID and CFBundleDisplayName.

export default {
  // Always "SleepFactor" so EAS finds the iOS target; display name is set per-platform below
  name: "SleepFactor",
  slug: "SleepFactor",
  scheme: "sleepfactor",
  version: BASE_VERSION,
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
    bundleIdentifier: IS_DEV ? "com.sleepfactor.app.dev" : "com.sleepfactor.app",
    usesAppleSignIn: true,
    infoPlist: {
      CFBundleDisplayName: IS_DEV ? "SleepFactor Dev" : "SleepFactor"
    }
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
    ],
    ["@react-native-google-signin/google-signin", { iosUrlScheme: googleIosUrlScheme }],
    "expo-apple-authentication"
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
