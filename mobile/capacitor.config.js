/**
 * Capacitor wraps the live Sewsiness website in an Android app.
 * The address comes from APP_URL (set by the GitHub Actions workflow), so the
 * app always shows the latest version of the site: no new APK per website change.
 */
const raw = (process.env.APP_URL || "").trim().replace(/\/+$/, "");
if (!/^https:\/\/[^\s/]+/i.test(raw)) {
  throw new Error("APP_URL must be your site's https address, e.g. https://your-app.up.railway.app");
}
const host = new URL(raw).host;

module.exports = {
  appId: "com.sewsiness.app",
  appName: "Sewsiness",
  webDir: "www",
  backgroundColor: "#FCF8F5",
  server: {
    url: raw,
    androidScheme: "https",
    allowNavigation: [host],
    errorPath: "offline.html",
  },
  android: {
    allowMixedContent: false,
  },
};
