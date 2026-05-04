import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { User } from '../types';

// Mock OTP authentication service with Firestore integration
export class AuthService {
  private static readonly STORAGE_KEY = 'user_data';
  private static readonly USERS_COLLECTION = 'users';

  // Mock OTP - In production, this should use Firebase Auth
  static async sendOTP(phoneNumber: string): Promise<boolean> {
    // Simulate sending OTP
    console.log(`Mock OTP sent to ${phoneNumber}: 123456`);
    return true;
  }

  static async verifyOTP(phoneNumber: string, otp: string, name?: string, photoUrl?: string): Promise<User | null> {
    const isAdmin = phoneNumber.toLowerCase().trim() === 'admin';

    // Mock verification - accept "123456" as valid OTP
    if (otp !== '123456') {
      return null;
    }

    const userId = isAdmin ? 'admin_user_id' : phoneNumber.toLowerCase().trim();

    // 1. Build user object immediately — don't wait for Firestore
    const user: User = {
      id: userId,
      phoneNumber,
      name: isAdmin ? 'Administrator' : (name || ''),
      photoUrl: photoUrl || '',
      role: isAdmin ? 'admin' : 'user',
      createdAt: new Date(),
    };

    // 2. Save to AsyncStorage immediately so navigation works right away
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
      console.log('✅ User saved locally:', phoneNumber);
    } catch (storageError) {
      console.error('❌ AsyncStorage error:', storageError);
      // Even if storage fails, return the user so navigation proceeds
    }

    // 3. Sync to Firestore in background — non-blocking, never delays login
    AuthService.syncUserToFirestore(userId, phoneNumber, name, photoUrl).catch((e) =>
      console.warn('⚠️ Firestore sync failed (non-critical):', e)
    );

    return user;
  }

  // Background Firestore sync — never blocks the login flow
  private static async syncUserToFirestore(
    userId: string,
    phoneNumber: string,
    name?: string,
    photoUrl?: string
  ): Promise<void> {
    try {
      const q = query(
        collection(db, AuthService.USERS_COLLECTION),
        where('phoneNumber', '==', phoneNumber)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // New user — create in Firestore
        await setDoc(doc(db, AuthService.USERS_COLLECTION, userId), {
          phoneNumber,
          name: name || (phoneNumber.toLowerCase().trim() === 'admin' ? 'Administrator' : ''),
          photoUrl: photoUrl || '',
          role: phoneNumber.toLowerCase().trim() === 'admin' ? 'admin' : 'user',
          createdAt: new Date(),
        });
        console.log('✅ New user synced to Firestore:', phoneNumber);
      } else {
        // Existing user — refresh local cache with Firestore data
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        const firestoreUser: User = {
          id: userDoc.id,
          phoneNumber: userData.phoneNumber,
          name: userData.name,
          photoUrl: userData.photoUrl,
          role: userData.role || (userData.phoneNumber.toLowerCase().trim() === 'admin' ? 'admin' : 'user'),
          createdAt: userData.createdAt?.toDate?.() ?? new Date(),
        };
        await AsyncStorage.setItem(AuthService.STORAGE_KEY, JSON.stringify(firestoreUser));
        console.log('✅ Existing user data refreshed from Firestore:', phoneNumber);
      }
    } catch (error) {
      console.warn('⚠️ Background Firestore sync failed (non-critical):', error);
    }
  }

  static async getCurrentUser(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem(AuthService.STORAGE_KEY);
      if (!userData) return null;

      const user = JSON.parse(userData);

      // Ensure createdAt is a Date object
      if (user.createdAt && typeof user.createdAt === 'string') {
        user.createdAt = new Date(user.createdAt);
      }

      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  static async logout(): Promise<void> {
    await AsyncStorage.removeItem(AuthService.STORAGE_KEY);
    console.log('✅ User logged out');
  }

  static async updateProfile(userId: string, data: { name?: string; photoUrl?: string }): Promise<void> {
    try {
      // Update in Firestore
      const userRef = doc(db, AuthService.USERS_COLLECTION, userId);
      await setDoc(userRef, data, { merge: true });

      // Update in AsyncStorage
      const currentUser = await AuthService.getCurrentUser();
      if (currentUser) {
        const updatedUser = { ...currentUser, ...data };
        await AsyncStorage.setItem(AuthService.STORAGE_KEY, JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  // --- ADMIN FUNCTIONS ---
  static async verifyAdminPassword(password: string): Promise<boolean> {
    try {
      const adminDoc = await getDocs(query(collection(db, 'settings'), where('__name__', '==', 'adminSettings')));
      if (adminDoc.empty) {
        return password === 'Pass'; // Default fallback
      }
      return adminDoc.docs[0].data().password === password;
    } catch (e) {
      console.warn("Failed to fetch admin password, using fallback 'Pass'", e);
      return password === 'Pass';
    }
  }

  static async updateAdminPassword(newPassword: string): Promise<void> {
    try {
      await setDoc(doc(db, 'settings', 'adminSettings'), { password: newPassword }, { merge: true });
    } catch (e) {
      console.error('Error updating admin password', e);
      throw e;
    }
  }

  static async getCompanyProfile(): Promise<any> {
    try {
      const q = query(collection(db, 'settings'), where('__name__', '==', 'companyProfile'));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return snapshot.docs[0].data();
      }
      return null;
    } catch (e) {
      console.error('Error fetching company profile', e);
      return null;
    }
  }

  static async updateCompanyProfile(data: any): Promise<void> {
    try {
      await setDoc(doc(db, 'settings', 'companyProfile'), data, { merge: true });
    } catch (e) {
      console.error('Error updating company profile', e);
      throw e;
    }
  }

  static async createUserByAdmin(phoneNumber: string, password?: string, role: 'user' | 'admin' = 'user'): Promise<void> {
    try {
      const userId = phoneNumber.toLowerCase().trim();
      await setDoc(doc(db, AuthService.USERS_COLLECTION, userId), {
        phoneNumber,
        username: phoneNumber,
        password: password || '', // Store password for the user
        role: role,
        updatedAt: new Date(),
        createdBy: 'admin'
      }, { merge: true });
    } catch (e) {
      console.error('Error creating user by admin', e);
      throw e;
    }
  }

  static async saveCoupon(couponCode: string, discountAmount: string): Promise<void> {
    try {
      // Store coupon in settings/coupons or a new collection. Using settings/coupons doc with an array or subcollection.
      // Let's use a standalone doc in 'coupons' collection
      await setDoc(doc(db, 'coupons', couponCode.toUpperCase()), {
        code: couponCode.toUpperCase(),
        discountAmount,
        createdAt: new Date(),
        active: true
      });
    } catch (e) {
      console.error('Error saving coupon', e);
      throw e;
    }
  }

  static async getAllUsers(): Promise<any[]> {
    try {
      const q = query(collection(db, AuthService.USERS_COLLECTION));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.error('Error fetching users', e);
      return [];
    }
  }

  // --- COUPON REWARD SYSTEM ---
  static async getCouponSettings(): Promise<any> {
    try {
      const docRef = doc(db, 'settings', 'couponRewardSettings');
      const snapshot = await getDocs(query(collection(db, 'settings'), where('__name__', '==', 'couponRewardSettings')));
      if (!snapshot.empty) {
        return snapshot.docs[0].data();
      }
      return { co2Threshold: 500, active: true }; // Default 500g
    } catch (e) {
      return { co2Threshold: 500, active: true };
    }
  }

  static async updateCouponSettings(data: any): Promise<void> {
    try {
      await setDoc(doc(db, 'settings', 'couponRewardSettings'), data, { merge: true });
    } catch (e) {
      console.error('Error updating coupon settings', e);
      throw e;
    }
  }

  static async getUserGeneratedCoupons(userId: string): Promise<any[]> {
    console.log(`[DEBUG] getUserGeneratedCoupons: userId="${userId}"`);
    try {
      const path = `users/${userId}/generatedCoupons`;
      console.log(`[DEBUG] Attempting fetch from path: "${path}"`);
      const colRef = collection(db, path);
      const snapshot = await getDocs(colRef);
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort manually to avoid index requirements
      results.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });

      console.log(`[DEBUG] Fetch complete. Found ${results.length} coupons.`);
      return results;
    } catch (e) {
      console.error('[DEBUG] FATAL error in getUserGeneratedCoupons:', e);
      return [];
    }
  }

  static async generateUserCoupon(userId: string, phoneNumber: string): Promise<string> {
    try {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const length = Math.floor(Math.random() * 7) + 14; // 14 to 20
      let code = '';
      for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      await setDoc(doc(db, `users/${userId}/generatedCoupons`, code), {
        code,
        phoneNumber,
        createdAt: new Date(),
        used: false
      });

      return code;
    } catch (e) {
      console.error('Error generating user coupon', e);
      throw e;
    }
  }
}
