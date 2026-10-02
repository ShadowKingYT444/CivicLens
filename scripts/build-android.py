#!/usr/bin/env python3
"""Build a signed demo APK with official Android SDK tools; no API keys embedded.

Requires JDK 17+ and SDK platforms;android-35, build-tools;35.0.0.
The generated standard debug/demo certificate is not a Play Store signing key.
"""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sdk", default=os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT"))
    args = parser.parse_args()
    if not args.sdk:
        parser.error("Set ANDROID_HOME to your Android SDK, or supply --sdk PATH.")
    sdk = Path(args.sdk).expanduser().resolve()
    root = Path(__file__).resolve().parent.parent
    source = root / "android/app/src/main"
    output = root / "artifacts/android"
    work = output / "build"
    work.mkdir(parents=True, exist_ok=True)
    tools = sdk / "build-tools/35.0.0"
    jar = sdk / "platforms/android-35/android.jar"
    windows = sys.platform == "win32"

    def tool(name):
        suffix = ".bat" if windows and name in {"d8", "apksigner"} else ".exe" if windows else ""
        executable = tools / (name + suffix)
        if not executable.is_file():
            raise RuntimeError(f"Missing {executable}; install build-tools;35.0.0 with SDK Manager.")
        return str(executable)

    def run(*command):
        subprocess.run([str(part) for part in command], check=True, cwd=root)

    if not jar.is_file():
        raise RuntimeError("Install platforms;android-35 with SDK Manager.")
    for executable in ["java", "keytool"]:
        if not shutil.which(executable):
            raise RuntimeError(f"{executable} is missing; install JDK 17+ and add its bin directory to PATH.")
    resources = work / "resources.zip"
    run(tool("aapt2"), "compile", "--dir", source / "res", "-o", resources)
    unsigned = work / "unsigned.apk"
    run(tool("aapt2"), "link", "-o", unsigned, "--manifest", source / "AndroidManifest.xml",
        "-I", jar, "--version-code", "1", "--version-name", "0.1.0-demo", resources)
    classes = work / "classes"
    if classes.exists():
        shutil.rmtree(classes)
    classes.mkdir()
    compiler = ["javac"] if shutil.which("javac") else ["java", "-m", "jdk.compiler/com.sun.tools.javac.Main"]
    run(*compiler, "-source", "8", "-target", "8", "-bootclasspath", jar,
        "-classpath", tools / "core-lambda-stubs.jar", "-d", classes,
        *sorted((source / "java").rglob("*.java")))
    dex = work / "dex"
    dex.mkdir(exist_ok=True)
    # Android's D8 consumes the Java bytecode; include Android APIs as its library.
    run(tool("d8"), "--lib", jar, "--min-api", "26", "--output", dex, *sorted(classes.rglob("*.class")))
    with zipfile.ZipFile(unsigned, "a", compression=zipfile.ZIP_DEFLATED) as archive:
        for item in dex.glob("*.dex"):
            archive.write(item, item.name)
    aligned = work / "aligned.apk"
    run(tool("zipalign"), "-f", "-p", "4", unsigned, aligned)
    certificate = output / "demo-signing.keystore"
    if not certificate.exists():
        run("keytool", "-genkeypair", "-keystore", certificate, "-storepass", "android",
            "-keypass", "android", "-alias", "androiddebugkey", "-dname", "CN=CivicLens Demo,O=CivicLens,C=US",
            "-keyalg", "RSA", "-keysize", "2048", "-validity", "3650", "-noprompt")
    apk = output / "CivicLens-demo.apk"
    run(tool("apksigner"), "sign", "--ks", certificate, "--ks-key-alias", "androiddebugkey",
        "--ks-pass", "pass:android", "--key-pass", "pass:android", "--out", apk, aligned)
    run(tool("apksigner"), "verify", "--verbose", apk)
    run(tool("zipalign"), "-c", "-p", "4", apk)
    print(f"Demo APK: {apk}\nRequires a running CivicLens server; configure HTTPS or USB in the app.")


if __name__ == "__main__":
    main()
