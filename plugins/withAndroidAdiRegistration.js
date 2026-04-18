const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

/**
 * Injects android/app/src/main/assets/adi-registration.properties for Google's
 * Android Developer Identity (ADI) package-name verification (one-time APK upload).
 *
 * Provide the snippet from Play Console via either:
 * - env ADI_REGISTRATION_SNIPPET (e.g. EAS Secret for cloud builds), or
 * - a local gitignored file: .adi-registration.properties (project root, one line = snippet)
 *
 * Only runs for production Android prebuild (com.sleepfactor.app), not development.
 */
function withAndroidAdiRegistration(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const isProduction =
        process.env.APP_VARIANT === "production" ||
        process.env.EAS_BUILD_PROFILE === "production";

      if (!isProduction) {
        return config;
      }

      let snippet = (process.env.ADI_REGISTRATION_SNIPPET || "").trim();
      const localFile = path.join(projectRoot, ".adi-registration.properties");
      if (!snippet && fs.existsSync(localFile)) {
        snippet = fs.readFileSync(localFile, "utf8").trim();
        // Allow a single-line file; strip # comments and blank lines
        const lines = snippet
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("#"));
        snippet = lines.join("\n").trim();
      }

      if (!snippet) {
        console.warn(
          "[withAndroidAdiRegistration] Skipping: set ADI_REGISTRATION_SNIPPET or add .adi-registration.properties for Google ADI verification APK builds."
        );
        return config;
      }

      const assetsDir = path.join(
        projectRoot,
        "android",
        "app",
        "src",
        "main",
        "assets"
      );
      fs.mkdirSync(assetsDir, { recursive: true });
      const target = path.join(assetsDir, "adi-registration.properties");
      fs.writeFileSync(target, snippet + "\n", "utf8");
      console.warn(
        "[withAndroidAdiRegistration] Wrote adi-registration.properties for production Android build."
      );
      return config;
    },
  ]);
}

module.exports = withAndroidAdiRegistration;
