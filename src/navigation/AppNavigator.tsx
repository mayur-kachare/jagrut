import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { CameraScreen } from '../screens/CameraScreen';
import { QRScannerScreen } from '../screens/QRScannerScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { CO2SummaryScreen } from '../screens/CO2SummaryScreen';
import { AdminDashboardScreen } from '../screens/AdminDashboardScreen';
import { AdminCompanyProfileScreen } from '../screens/AdminCompanyProfileScreen';
import { AdminUserManagementScreen } from '../screens/AdminUserManagementScreen';
import { AdminCouponManagementScreen } from '../screens/AdminCouponManagementScreen';
import { Bill } from '../types';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Camera: undefined;
  QRScanner: undefined;
  Profile: undefined;
  AdminDashboard: undefined;
  AdminCompanyProfile: undefined;
  AdminUserManagement: undefined;
  AdminCouponManagement: undefined;
  CO2Summary: { bills: Bill[] };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return null; // Or a loading screen
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          animation: 'default',
        }}
      >
        {!user ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{
              headerShown: false,
            }}
          />
        ) : (
          <>
            {user.role === 'admin' ? (
              <>
                <Stack.Screen
                  name="AdminDashboard"
                  component={AdminDashboardScreen}
                  options={{
                    title: 'Admin Dashboard',
                    headerLeft: () => null, // Prevent back button on landing page
                  }}
                />
                <Stack.Screen name="AdminCompanyProfile" component={AdminCompanyProfileScreen} options={{ title: 'Company Profile' }} />
                <Stack.Screen name="AdminUserManagement" component={AdminUserManagementScreen} options={{ title: 'User Management' }} />
                <Stack.Screen name="AdminCouponManagement" component={AdminCouponManagementScreen} options={{ title: 'Coupon Management' }} />
              </>
            ) : (
              <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{
                  headerShown: false,
                }}
              />
            )}

            {/* Also keep the non-landing screens available */}
            {user.role === 'admin' ? (
              <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{
                  headerShown: false,
                }}
              />
            ) : (
              <Stack.Screen
                name="AdminDashboard"
                component={AdminDashboardScreen}
                options={{
                  title: 'Admin Dashboard',
                }}
              />
            )}
            
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{
                title: 'Edit Profile',
              }}
            />

            <Stack.Screen
              name="Camera"
              component={CameraScreen}
              options={{
                headerShown: true,
                title: 'Capture Bill',
              }}
            />
            <Stack.Screen
              name="QRScanner"
              component={QRScannerScreen}
              options={{
                headerShown: true,
                title: 'Scan QR Code',
              }}
            />
            <Stack.Screen
              name="CO2Summary"
              component={CO2SummaryScreen}
              options={{
                headerShown: false,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
