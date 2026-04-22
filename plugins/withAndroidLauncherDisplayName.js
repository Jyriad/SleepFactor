const { withStringsXml, AndroidConfig } = require("@expo/config-plugins");

/**
 * Sets Android `app_name` (launcher + install UI) from `extra.androidLauncherDisplayName`.
 * Keeps root `config.name` as "SleepFactor" for iOS/Xcode while allowing "Dev SleepFactor"
 * on dev builds. Runs as a strings.xml mod so it overrides the default name plugin.
 */
function withAndroidLauncherDisplayName(config) {
  const label =
    typeof config.extra?.androidLauncherDisplayName === "string"
      ? config.extra.androidLauncherDisplayName
      : config.name ?? "SleepFactor";

  return withStringsXml(config, (config) => {
    config.modResults = AndroidConfig.Strings.setStringItem(
      [
        AndroidConfig.Resources.buildResourceItem({
          name: "app_name",
          value: label,
        }),
      ],
      config.modResults
    );
    return config;
  });
}

module.exports = withAndroidLauncherDisplayName;
