# Android demo client

This Java/WebView app connects to CivicLens's running Next.js server. API routes and NIM keys stay on that server. There is no bundled offline AI model.

## Install and connect

Requirements: Android 8+, current Android System WebView/Chrome, Android Platform Tools, a USB data cable, and authorized USB debugging.

From the repository, run `pnpm build` then `pnpm device` for live enabled providers, or `pnpm demo:build` then `pnpm demo` for templates/samples. In another terminal:

```sh
adb devices
adb reverse tcp:3100 tcp:3100
adb install -r downloads/CivicLens-demo.apk
```

Launch CivicLens and choose **Use USB demo**. Keep the server/USB forwarding active. A different server origin has separate local learning progress. A newly generated signing key may require uninstalling the previous package; uninstalling clears progress.

For an emulator, enter `http://10.0.2.2:3100` in **Server** settings. For an independently accessible phone, enter your deployed **HTTPS root URL**. No public deployment is supplied. GitHub Pages cannot run the required server/API routes. External source links open in the browser. Location permission is requested only after **Use my location**; typed-address/sample lookup remains available when permission is denied.

## Build

Install Python 3 and JDK 17+, then the official SDK packages with Android Studio SDK Manager or:

```sh
sdkmanager "platforms;android-35" "build-tools;35.0.0" "platform-tools"
python scripts/build-android.py --sdk /path/to/Android/Sdk
```

Windows PowerShell: `python scripts/build-android.py --sdk "$env:LOCALAPPDATA\Android\Sdk"`. Set `ANDROID_HOME` to use `pnpm android:build`. The script uses aapt2, Java compilation, D8, zipalign, and apksigner, without Gradle or native npm dependencies.

Output: `artifacts/android/CivicLens-demo.apk`. The demo key remains in that ignored directory. Preserve it for repeated installs; never commit signing keys. Copy only the public APK into `downloads/` and update its SHA-256 after an intentional rebuild.

## Scope

Package `org.civiclens.app`, minimum API 26, target API 35. Cleartext is limited to USB/emulator loopback hosts. File/content URL access, mixed content, WebView debugging, and JavaScript/native bridges are disabled. The self-signed demo certificate is not a Play Store production credential. Store distribution needs policy review, a stable hosted server, and proper release-signing ownership.

Compilation, dexing, alignment, and signatures were verified in cloud. No physical Android phone was attached. Before recording, test install, keyboard, rotation, back/navigation, source links, server retry, learning persistence, and allowed/denied location permission on your phone. Existing `mobile:check` audits Android Chrome; it does not certify the APK shell.
