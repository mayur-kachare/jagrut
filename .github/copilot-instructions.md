# Copilot Instructions - Jagrut Project

## Project Overview
**Jagrut** is a React Native Expo mobile application for bill management and expense tracking. Users capture bills via camera, extract information using OCR, and track expenses with statistical analysis.

**Tech Stack:**
- React Native with Expo (TypeScript)
- Firebase (Firestore, Storage, Auth)
- React Navigation (Native Stack)
- expo-camera & expo-image-picker for image capture
- expo-image-manipulator for compression
- Mock OCR service (replace with actual OCR in production)

**Platform Support:** iOS and Android

## Development Workflow

### User Flow
1. **Authentication:** Phone number + OTP verification (currently mock - OTP: `123456`)
2. **Capture Bill:** Take photo or select from gallery
3. **OCR Processing:** Extract bill data (number, amount, date, from/to locations)
4. **Storage:** Compress image → Upload to Firebase Storage → Save to Firestore
5. **Analytics:** View total expenses, distance, and bill history

### Setup

```powershell
# Install dependencies
pnpm install

# Start development server
pnpm start

# Run on iOS
pnpm ios

# Run on Android
pnpm android
```

### Firebase Configuration
Update [src/services/firebase.ts](src/services/firebase.ts) with your Firebase project credentials:
- Replace placeholders in `firebaseConfig` object
- Required services: Authentication, Firestore, Storage

### Running the Project
```powershell
# Start Expo development server
pnpm start

# Or use specific platform
pnpm android  # Android emulator/device
pnpm ios      # iOS simulator/device
pnpm web      # Web browser (limited functionality)
```

**Testing Login:**
- Enter any phone number
- Use OTP: `123456` (mock authentication)

## Code Conventions

### File Organization
```
src/
├── components/     # Reusable UI components
├── context/        # React Context (AuthContext)
├── hooks/          # Custom React hooks
├── navigation/     # Navigation setup (AppNavigator)
├── screens/        # Screen components (Login, Home, Camera)
├── services/       # External services (Firebase, Auth, OCR, Firestore)
├── types/          # TypeScript interfaces
└── utils/          # Utility functions (imageCompressor)
```

### Key Files
- [App.tsx](App.tsx): Root component with AuthProvider
- [src/navigation/AppNavigator.tsx](src/navigation/AppNavigator.tsx): Navigation setup
- [src/context/AuthContext.tsx](src/context/AuthContext.tsx): Auth state management
- [src/services/auth.ts](src/services/auth.ts): Mock OTP authentication
- [src/services/ocr.ts](src/services/ocr.ts): Mock OCR (replace with real OCR)
- [src/services/firestore.ts](src/services/firestore.ts): Database operations

### Coding Style
- **TypeScript:** Strict typing, interfaces in [src/types/index.ts](src/types/index.ts)
- **Components:** Functional components with hooks
- **Styling:** StyleSheet API (no external styling libraries)
- **Navigation:** Type-safe navigation with `RootStackParamList`
- **State:** React Context for global state (auth), local state for screens

### Patterns
- **Service Layer:** All Firebase/external API calls in `src/services/`
- **Error Handling:** Try-catch with user-facing alerts
- **Loading States:** Boolean flags + ActivityIndicator
- **Image Handling:** Compress before upload (ImageCompressor utility)

## Key Integration Points

### Firebase Services
- **Firestore:** Bills collection with user-based queries
- **Storage:** Compressed bill images at `bills/{userId}/{timestamp}.jpg`
- **Auth:** Placeholder for Firebase Auth (currently using AsyncStorage mock)

### Image Processing Flow
1. Capture/select image → [CameraScreen.tsx](src/screens/CameraScreen.tsx)
2. OCR extraction → [src/services/ocr.ts](src/services/ocr.ts)
3. Compress → [src/utils/imageCompressor.ts](src/utils/imageCompressor.ts)
4. Upload → [src/services/firestore.ts](src/services/firestore.ts)

### Data Model (Firestore)
```typescript
Bill {
  userId: string
  billNumber: string
  amount: number
  date: Date
  from: string
  to: string
  imageUrl: string
  extractedText?: string
  createdAt: Date
}
```

## Common Tasks

### Adding New Features
1. Create interface in [src/types/index.ts](src/types/index.ts)
2. Add service methods in `src/services/`
3. Create screen in `src/screens/`
4. Add route to [AppNavigator.tsx](src/navigation/AppNavigator.tsx)

### Implementing Real OCR
Replace mock in [src/services/ocr.ts](src/services/ocr.ts) with:
- Google ML Kit Vision
- Tesseract.js
- AWS Textract
- Custom trained model

### Implementing Real Firebase Auth
Replace [src/services/auth.ts](src/services/auth.ts) mock with Firebase Phone Auth:
```typescript
import { signInWithPhoneNumber } from 'firebase/auth';
```

### Debugging
- **Metro Logs:** Check terminal for bundler errors
- **Console:** Use `console.log` for debugging (visible in terminal)
- **React DevTools:** Use Expo DevTools for component inspection
- **Network:** Firebase operations logged in console

### Testing Mock Features
- **Mock OTP:** Always `123456`
- **Mock OCR:** Returns random bill data after 1.5s delay
- **Mock Distance:** 50km per bill (hardcoded)

---

**Production Readiness Checklist:**
- [ ] Replace mock OTP with Firebase Phone Auth
- [ ] Implement real OCR service
- [ ] Add proper error tracking (Sentry/Bugsnag)
- [ ] Implement actual distance calculation (Google Maps API)
- [ ] Add input validation and data sanitization
- [ ] Set up CI/CD pipeline
- [ ] Configure app signing for iOS/Android
