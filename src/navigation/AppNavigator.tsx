import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { CameraScreen } from '../screens/CameraScreen';
import { QRScannerScreen } from '../screens/QRScannerScreen';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Camera: undefined;
  QRScanner: undefined;
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
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{
                headerShown: false,
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
