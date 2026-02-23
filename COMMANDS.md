# TrailWise — Working Commands

## Android Emulator

```bash
# Start ADB server
adb start-server

# Launch emulator
emulator -avd pixel6 -gpu auto &

# Check connected devices
adb devices

# Kill emulator
adb emu kill
```

## Flutter

```bash
# Run on connected device/emulator
flutter run

# Run on specific device
flutter run -d emulator-5554

# Hot reload (while app is running)
# Press 'r' in terminal

# Hot restart
# Press 'R' in terminal

# Build APK (debug)
flutter build apk --debug

# Build APK (release)
flutter build apk --release

# Analyze code for issues
flutter analyze

# Run tests
flutter test

# Check environment
flutter doctor -v

# Clean build artifacts
flutter clean

# Get dependencies
flutter pub get
```

## ADB Useful Commands

```bash
# Restart ADB if emulator not detected
adb kill-server && adb start-server

# Install APK manually
adb install build/app/outputs/flutter-apk/app-debug.apk

# View device logs
adb logcat -s flutter

# Screenshot from emulator
adb exec-out screencap -p > screenshot.png
```
