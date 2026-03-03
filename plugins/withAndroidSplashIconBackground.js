const { withAndroidStyles } = require("@expo/config-plugins");

/**
 * Config plugin that sets the Android 12+ splash screen icon background color
 * to match the splash screen background. This removes the default light circle
 * (shadow/ring) that Android draws behind the splash icon when the attribute
 * is not set.
 *
 * Must run after expo-splash-screen so Theme.App.SplashScreen already exists.
 */
function withAndroidSplashIconBackground(config) {
  return withAndroidStyles(config, (config) => {
    const styles = config.modResults?.resources?.style;
    if (!Array.isArray(styles)) return config;

    const splashStyle = styles.find(
      (s) =>
        s.$?.name === "Theme.App.SplashScreen" &&
        s.$?.parent === "Theme.SplashScreen"
    );
    if (!splashStyle) return config;

    // Use Theme.SplashScreen.IconBackground so windowSplashScreenIconBackgroundColor is applied
    splashStyle.$.parent = "Theme.SplashScreen.IconBackground";

    // Set icon circle background to same as screen background (removes the ring/shadow)
    const iconBgItem = {
      $: { name: "windowSplashScreenIconBackgroundColor" },
      _: "@color/splashscreen_background",
    };
    const items = Array.isArray(splashStyle.item) ? splashStyle.item : [];
    const hasIconBg = items.some(
      (i) => i.$?.name === "windowSplashScreenIconBackgroundColor"
    );
    if (!hasIconBg) {
      splashStyle.item = [...items, iconBgItem];
    }

    return config;
  });
}

module.exports = withAndroidSplashIconBackground;
