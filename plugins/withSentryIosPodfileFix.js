const { withPodfile } = require("@expo/config-plugins");
const { mergeContents } = require("@expo/config-plugins/build/utils/generateCode");

/**
 * Xcode 16 (Release) can fail compiling the Sentry Cocoa pod with:
 *   Module '_SentryPrivate' not found (in target 'Sentry' from project 'Pods')
 * Disabling explicit Swift modules for Pods avoids the broken dependency scan order.
 * @see https://github.com/getsentry/sentry-react-native/issues/5652
 */
function withSentryIosPodfileFix(config) {
  return withPodfile(config, (config) => {
    const tag = "sentry-ios-swift-explicit-modules";
    const newSrc = [
      "    # Workaround: Xcode 16 + Sentry Cocoa (Release) — _SentryPrivate module resolution",
      "    installer.pods_project.targets.each do |target|",
      "      target.build_configurations.each do |bc|",
      "        bc.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO'",
      "      end",
      "    end",
      "",
    ].join("\n");

    try {
      const { contents, didMerge } = mergeContents({
        tag,
        src: config.modResults.contents,
        newSrc,
        anchor: /^\s*# This is necessary for Xcode 14/,
        offset: 0,
        comment: "#",
      });
      if (didMerge) {
        config.modResults.contents = contents;
      }
    } catch (e) {
      if (e?.code === "ERR_NO_MATCH") {
        throw new Error(
          "withSentryIosPodfileFix: Could not find the expected Expo Podfile anchor (# Xcode 14 resource bundles). Update the plugin if the Podfile template changed."
        );
      }
      throw e;
    }
    return config;
  });
}

module.exports = withSentryIosPodfileFix;
