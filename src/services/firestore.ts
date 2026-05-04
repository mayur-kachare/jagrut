import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy,
  Timestamp,
  doc
} from 'firebase/firestore';
import { db } from './firebase';
import { Bill, ExpenseStats } from '../types';
import { AuthService } from './auth';

export class FirestoreService {
  private static readonly BILLS_COLLECTION = 'bills';

  // Check if bill exists
  static async checkBillExists(billNumber: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, this.BILLS_COLLECTION),
        where('billNumber', '==', billNumber)
      );
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking bill existence:', error);
      return false;
    }
  }

  // Save bill to Firestore
  static async saveBill(bill: Omit<Bill, 'id' | 'createdAt'>): Promise<string> {
    try {
      // Calculate CO2 Saved (Example: 0.5g per Rupee spent on public transport)
      const co2SavedValue = (bill.amount || 0) * 0.5;
      const co2SavedStr = `${co2SavedValue.toFixed(2)} g`;

      const docRef = await addDoc(collection(db, this.BILLS_COLLECTION), {
        ...bill,
        co2Saved: co2SavedStr,
        createdAt: Timestamp.now(),
      });
      
      // Trigger check for coupon generation
      this.checkAndGenerateCoupon(bill.userId).catch(e => console.error('Coupon check failed', e));

      return docRef.id;
    } catch (error) {
      console.error('Error saving bill:', error);
      throw error;
    }
  }

  // Get user bills
  static async getUserBills(userId: string): Promise<Bill[]> {
    try {
      const q = query(
        collection(db, this.BILLS_COLLECTION),
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      const bills: Bill[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const date = data.date && typeof data.date.toDate === 'function' 
          ? data.date.toDate() 
          : (data.date instanceof Date ? data.date : new Date());
        
        const createdAt = data.createdAt && typeof data.createdAt.toDate === 'function'
          ? data.createdAt.toDate()
          : (data.createdAt instanceof Date ? data.createdAt : new Date());

        bills.push({
          id: doc.id,
          ...data,
          date,
          createdAt,
        } as Bill);
      });
      
      // Sort by createdAt in JavaScript instead of Firestore
      bills.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      return bills;
    } catch (error) {
      console.error('Error getting user bills:', error);
      throw error;
    }
  }

  // Calculate expense statistics
  static async getExpenseStats(userId: string): Promise<ExpenseStats> {
    const bills = await this.getUserBills(userId);
    
    const totalExpenses = bills.reduce((sum, bill) => sum + bill.amount, 0);
    const billCount = bills.length;
    const averageExpense = billCount > 0 ? totalExpenses / billCount : 0;
    
    // Mock distance calculation - implement based on from/to locations
    const totalDistance = billCount * 50; // Mock: 50km per bill
    
    const totalCo2Saved = bills.reduce((sum, bill) => {
      if (bill.co2Saved) {
        const match = bill.co2Saved.match(/(\d+(?:\.\d+)?)/);
        if (match) {
          return sum + parseFloat(match[1]);
        }
      }
      return sum;
    }, 0);

    const coupons = await AuthService.getUserGeneratedCoupons(userId);
    const totalCoupons = coupons.length;
    const redeemedCoupons = coupons.filter(c => c.used).length;
    const openCoupons = totalCoupons - redeemedCoupons;

    return {
      totalExpenses,
      totalDistance,
      averageExpense,
      billCount,
      totalCo2Saved,
      totalCoupons,
      redeemedCoupons,
      openCoupons,
    };
  }

  static async checkAndGenerateCoupon(userId: string): Promise<void> {
    console.log(`[DEBUG] checkAndGenerateCoupon triggered for ${userId}`);
    const stats = await this.getExpenseStats(userId);
    const settings = await AuthService.getCouponSettings();
    
    console.log(`[DEBUG] Current CO2: ${stats.totalCo2Saved}, Threshold: ${settings.co2Threshold}, Active: ${settings.active}`);

    if (!settings.active || !settings.co2Threshold) {
      console.log("[DEBUG] Reward system inactive or threshold missing.");
      return;
    }

    const currentTotalCo2 = stats.totalCo2Saved;
    
    // Get user's current coupons to see how many they've earned
    const earnedCoupons = await AuthService.getUserGeneratedCoupons(userId);
    console.log(`[DEBUG] User already has ${earnedCoupons.length} coupons.`);

    const expectedCouponCount = Math.floor(currentTotalCo2 / settings.co2Threshold);
    console.log(`[DEBUG] Expected Coupons: ${expectedCouponCount}, Current Earned: ${earnedCoupons.length}`);

    if (expectedCouponCount > earnedCoupons.length) {
      console.log(`[DEBUG] Threshold reached! Attempting to generate coupon...`);
      
      try {
        // Fetch user data for phone number
        const userDoc = await getDoc(doc(db, 'users', userId));
        const phoneNumber = userDoc.exists() ? userDoc.data().phoneNumber : 'Unknown';
        
        // Generate only one new coupon per check to prevent accidental loops
        const code = await AuthService.generateUserCoupon(userId, phoneNumber);
        console.log(`[DEBUG] SUCCESS! Generated coupon code: ${code}`);
      } catch (genError) {
        console.error(`[DEBUG] FAILED to generate coupon for ${userId}:`, genError);
      }
    } else {
      console.log("[DEBUG] No new coupons to generate (Threshold not met or already generated).");
    }
  }
}
