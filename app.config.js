// Dynamic configuration based on build environment
const IS_DEV = process.env.APP_VARIANT === 'development' || process.env.EAS_BUILD_PROFILE === "development";
const IS_PRODUCTION = process.env.EAS_BUILD_PROFILE === "production";
/** Home screen / launcher label (dev puts "Dev" first so it stays visible when truncated). */
const DISPLAY_NAME = IS_DEV ? "Dev SleepFactor" : "SleepFactor";

/** App icon assets by platform. */
const APP_ICON_FULLYSAFE = "./assets/branding/app-icon/1024x1024/AppLogoFullySafe.png";
const APP_ICON_FULLYSAFE_COTTON = "./assets/branding/app-icon/1024x1024/AppLogoFullySafeCotton.png";
const IOS_APP_ICON = IS_DEV ? APP_ICON_FULLYSAFE_COTTON : APP_ICON_FULLYSAFE;
const ANDROID_LAUNCHER_ICON = APP_ICON_FULLYSAFE;

/** iOS splash keeps the wordmark; Android 12+ draws splash inside a rounded square, so use the FullySafe mark there. */
const SPLASH_WORDMARK = "./assets/branding/splash/primary-logo-white-background.png";
const ANDROID_SPLASH_IMAGE = ANDROID_LAUNCHER_ICON;

// Import version from package.json
import packageInfo from './package.json';
const BASE_VERSION = process.env.APP_VERSION || packageInfo.version;

/** iOS Google Sign-In URL scheme: dev vs prod OAuth client (EAS prebuild uses IS_DEV). */
const GOOGLE_IOS_DEV = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_DEV || '';
const GOOGLE_IOS_PROD = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_PROD || '';
const GOOGLE_IOS_LEGACY = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID_FOR_PLUGIN = IS_DEV
  ? (GOOGLE_IOS_DEV || GOOGLE_IOS_LEGACY)
  : (GOOGLE_IOS_PROD || GOOGLE_IOS_LEGACY);
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
  icon: IOS_APP_ICON,
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    image: SPLASH_WORDMARK,
    resizeMode: "contain",
    backgroundColor: "#FFFFFF"
  },
  ios: {
    icon: IOS_APP_ICON,
    supportsTablet: true,
    bundleIdentifier: IS_DEV ? "com.sleepfactor.app.dev" : "com.sleepfactor.app",
    // CFBundleVersion — must increase on every upload to App Store Connect (production profile).
    buildNumber: "1332",
    usesAppleSignIn: true,
    infoPlist: {
      CFBundleDisplayName: DISPLAY_NAME,
      // App Store export compliance; avoids EAS interactive prompt when not using custom encryption
      ITSAppUsesNonExemptEncryption: false
    },
    splash: {
      image: SPLASH_WORDMARK,
      resizeMode: "contain",
      backgroundColor: "#FFFFFF"
    }
  },
  android: {
    // Launcher icon only (iOS uses top-level `icon`).
    icon: ANDROID_LAUNCHER_ICON,
    adaptiveIcon: {
      foregroundImage: ANDROID_LAUNCHER_ICON,
      backgroundColor: "#2469B2"
    },
    edgeToEdgeEnabled: true,
    package: IS_DEV ? "com.sleepfactor.app.dev" : "com.sleepfactor.app",
    // versionCode must increase for every new Android production binary.
    versionCode: 1332,
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
    ],
    splash: {
      image: ANDROID_SPLASH_IMAGE,
      resizeMode: "contain",
      backgroundColor: "#FFFFFF"
    }
  },
  web: {
    favicon: "./assets/branding/web/pwa-icon-192.png"
  },
  plugins: [
    "expo-font",
    [
      "@sentry/react-native/expo",
      {
        url: "https://sentry.io/",
        project: "react-native",
        organization: "sleepfactor"
      }
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#FFFFFF",
        resizeMode: "contain",
        imageWidth: 280,
        ios: {
          image: SPLASH_WORDMARK
        },
        android: {
          image: ANDROID_SPLASH_IMAGE,
          backgroundColor: "#FFFFFF",
          resizeMode: "contain",
          imageWidth: 280
        }
      }
    ],
    "./plugins/withAndroidSplashIconBackground.js",
    "./plugins/withAndroidAdiRegistration.js",
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
          targetSdkVersion: 35,
          minSdkVersion: 26
        }
      }
    ],
    "./plugins/withSentryIosPodfileFix.js",
    [
      "expo-notifications",
      {
        icon: ANDROID_LAUNCHER_ICON,
        color: "#2469B2",
        sounds: [],
        androidMode: "default"
      }
    ],
    ["@react-native-google-signin/google-signin", { iosUrlScheme: googleIosUrlScheme }],
    "expo-apple-authentication",
    "./plugins/withAndroidLauncherDisplayName.js"
  ],
  extra: {
    eas: {
      projectId: "430fa5de-f870-4b36-99b7-f5563e95a1f2"
    },
    androidLauncherDisplayName: DISPLAY_NAME
  },
  owner: "jyriad",
  // Use base version only so EAS Configure expo-updates and the build agree (avoids "1.327" vs "1.327 Dev" mismatch).
  runtimeVersion: BASE_VERSION,
  updates: {
    url: "https://u.expo.dev/430fa5de-f870-4b36-99b7-f5563e95a1f2"
  }
};
