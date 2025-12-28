# Quick Start Guide

## 🚀 First Time Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure Firebase:**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Create a new project or use existing
   - Enable Firestore Database
   - Enable Storage
   - Enable Authentication > Phone
   - Copy config from Project Settings > General > Your apps
   - Update `src/services/firebase.ts` with your config

3. **Start the app:**
   ```bash
   pnpm start
   ```

4. **Choose platform:**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Press `w` for web browser
   - Scan QR code with Expo Go app on physical device

## 🧪 Testing

**Login credentials (Mock):**
- Phone: Any number (e.g., +91 1234567890)
- OTP: `123456`

**Features to test:**
1. Login with mock OTP
2. Tap camera button (floating action button)
3. Take photo or select from gallery
4. Review extracted bill data (mock OCR)
5. Save bill
6. View expense statistics on home screen

## 📝 Current Implementation Status

✅ **Completed:**
- Project structure and navigation
- Mock OTP authentication
- Camera integration
- Image compression
- Mock OCR extraction
- Firestore integration
- Expense analytics display

⚠️ **Mock/Placeholder:**
- OTP verification (accepts `123456`)
- OCR extraction (returns random data)
- Distance calculation (50km per bill)

🔨 **Production TODO:**
- Replace mock OTP with Firebase Phone Auth
- Integrate real OCR service
- Add actual distance calculation
- Implement error tracking
- Add unit tests

## 🐛 Common Issues

**Metro bundler errors:**
- Clear cache: `pnpm start --clear`
- Restart: `Ctrl+C` and `pnpm start`

**Module not found:**
- Run `pnpm install` again
- Check imports in files

**Firebase errors:**
- Verify config in `src/services/firebase.ts`
- Check Firebase console for enabled services

**Camera not working:**
- Grant permissions when prompted
- Check device/simulator camera access

## 📚 Next Steps

1. Configure Firebase with real credentials
2. Test on physical device for camera functionality
3. Implement real OCR service
4. Add more analytics features
5. Customize UI/UX

---

For detailed documentation, see [README.md](README.md) and [.github/copilot-instructions.md](.github/copilot-instructions.md)
