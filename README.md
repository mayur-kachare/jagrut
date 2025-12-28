# Jagrut - Bill Management & Expense Tracker

A React Native Expo mobile app for capturing bills, extracting data via OCR, and tracking expenses with analytics.

## Features

- 📱 Phone number authentication with OTP
- 📷 Camera integration for bill capture
- 🔍 OCR text extraction (bill number, amount, date, locations)
- 💾 Firebase Firestore database
- 🗂️ Image compression and cloud storage
- 📊 Expense analytics and statistics
- 📍 Distance tracking

## Tech Stack

- React Native + Expo (TypeScript)
- Firebase (Firestore, Storage, Auth)
- React Navigation
- Expo Camera & Image Picker
- Image Manipulator

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Expo CLI
- iOS Simulator (Mac) or Android Emulator
- Firebase project

### Installation

```bash
# Install dependencies
pnpm install

# Configure Firebase
# Edit src/services/firebase.ts with your Firebase config
```

### Running the App

```bash
# Start development server
pnpm start

# Run on specific platform
pnpm ios        # iOS simulator
pnpm android    # Android emulator
pnpm web        # Web browser
```

### Development Login

Use mock OTP for testing:
- Enter any phone number
- OTP: `123456`

## Project Structure

```
src/
├── components/     # Reusable UI components
├── context/        # React Context (Auth)
├── hooks/          # Custom hooks
├── navigation/     # Navigation setup
├── screens/        # Screen components
│   ├── LoginScreen.tsx
│   ├── HomeScreen.tsx
│   └── CameraScreen.tsx
├── services/       # External services
│   ├── firebase.ts
│   ├── auth.ts
│   ├── firestore.ts
│   └── ocr.ts
├── types/          # TypeScript definitions
└── utils/          # Utilities
```

## Configuration

### Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Firestore Database
3. Enable Storage
4. Enable Authentication (Phone)
5. Copy config to `src/services/firebase.ts`

## Development Notes

### Mock Services

The app currently uses mock implementations for:
- **OTP Auth**: Accepts `123456` as valid OTP
- **OCR**: Returns random bill data
- **Distance**: Hardcoded 50km per bill

### Production TODO

- [ ] Implement real Firebase Phone Auth
- [ ] Integrate actual OCR service (Google ML Kit, Tesseract)
- [ ] Add real distance calculation API
- [ ] Error tracking (Sentry)
- [ ] Analytics (Firebase Analytics)
- [ ] CI/CD pipeline
- [ ] App store deployment

## License

MIT

## Contact

For questions or support, please open an issue.
