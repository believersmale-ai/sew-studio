# Sewsiness Android app (APK)

This folder wraps the live Sewsiness website in an Android app with
[Capacitor](https://capacitorjs.com). The app opens your site, so website
changes show up in the app straight away: you only rebuild the APK to change
the app name, icon or version.

## Build an APK (no computer setup needed)

1. In GitHub open **Settings > Secrets and variables > Actions > Variables** and add
   a variable **`APP_URL`** with your site's address, for example
   `https://your-app.up.railway.app`.
2. Open the **Actions** tab, choose **Build Android APK**, press **Run workflow**.
3. When it finishes (about 5 to 10 minutes), open the run and download the
   **Sewsiness-apk** file. Unzip it and install `Sewsiness-debug.apk` on a phone
   (allow "install unknown apps" when asked).

The debug APK is fine for testing and sharing with your team. For the Play Store
or a long-lived signed app, build a **release** APK:

## Signed release APK

1. Create a keystore once, on any computer with Java:
   `keytool -genkeypair -v -keystore sewsiness.keystore -alias sewsiness -keyalg RSA -keysize 2048 -validity 10000`
   Keep this file and its passwords safe. If you lose them you cannot update the app.
2. Turn it into text: `base64 -w0 sewsiness.keystore` (on Windows PowerShell:
   `[Convert]::ToBase64String([IO.File]::ReadAllBytes("sewsiness.keystore"))`).
3. In **Settings > Secrets and variables > Actions > Secrets** add:
   `ANDROID_KEYSTORE_BASE64` (the text from step 2), `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS` (`sewsiness` above) and `ANDROID_KEY_PASSWORD`.
4. Run the workflow with **build_type = release**, or push a tag such as `v1.0.0`
   to build a release and attach `Sewsiness.apk` to the GitHub Releases page.

## Notes

- The app needs an internet connection (it shows an offline screen otherwise).
- Change the app name, package id or colours in `capacitor.config.js`.
- The icon comes from `public/icon-512.png`.
