// Dynamic wrapper over app.json.
//
// MAYO_FREE_TEAM=1 strips the Sign in with Apple capability so the app can be
// built/signed with a FREE Apple ID ("personal team") for on-device testing —
// free teams cannot provision the applesignin entitlement, so a normal build
// fails at signing. The app handles the missing module gracefully (the Apple
// login button only shows when the capability is available). Paid-team and
// EAS builds are unaffected: without the env var this returns app.json as-is.
module.exports = ({ config }) => {
  if (process.env.MAYO_FREE_TEAM === '1') {
    return {
      ...config,
      ios: { ...config.ios, usesAppleSignIn: false },
      plugins: (config.plugins || []).filter((p) => p !== 'expo-apple-authentication'),
    };
  }
  return config;
};
