import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { OCRService } from '../services/ocr';
import { FirestoreService } from '../services/firestore';
import { ImageCompressor } from '../utils/imageCompressor';
import { useAuth } from '../context/AuthContext';
import { Bill } from '../types';

export const CameraScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [image, setImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<Partial<Bill> | null>(null);
  const { user } = useAuth();

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is required to take photos');
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      await processImage(result.assets[0].uri);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      await processImage(result.assets[0].uri);
    }
  };

  const processImage = async (imageUri: string) => {
    setProcessing(true);
    try {
      // Extract text using OCR
      const data = await OCRService.extractTextFromImage(imageUri);
      setExtractedData(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to process image');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const saveBill = async () => {
    if (!extractedData || !user) {
      Alert.alert('Error', 'Missing required data');
      return;
    }

    setProcessing(true);
    try {
      // Save bill to Firestore (without image upload)
      await FirestoreService.saveBill({
        userId: user.id,
        billNumber: extractedData.billNumber || '',
        amount: extractedData.amount || 0,
        date: extractedData.date || new Date(),
        from: extractedData.from || '',
        to: extractedData.to || '',
        extractedText: extractedData.extractedText,
      });

      Alert.alert('Success', 'Bill saved successfully!', [
        { text: 'OK', onPress: () => navigation.navigate('Home') },
      ]);
      
      // Reset state
      setImage(null);
      setExtractedData(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to save bill');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Capture Bill</Text>

        {!image ? (
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.captureButton} onPress={takePhoto}>
              <Text style={styles.buttonText}>📷 Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.captureButton} onPress={pickImage}>
              <Text style={styles.buttonText}>🖼️ Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Image source={{ uri: image }} style={styles.image} />
            
            {processing && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.processingText}>Processing image...</Text>
              </View>
            )}

            {extractedData && !processing && (
              <View style={styles.dataContainer}>
                <Text style={styles.dataTitle}>Extracted Information:</Text>
                <Text style={styles.dataText}>Bill #: {extractedData.billNumber}</Text>
                <Text style={styles.dataText}>Amount: ₹{extractedData.amount}</Text>
                <Text style={styles.dataText}>From: {extractedData.from}</Text>
                <Text style={styles.dataText}>To: {extractedData.to}</Text>
                <Text style={styles.dataText}>
                  Date: {extractedData.date?.toLocaleDateString()}
                </Text>
              </View>
            )}

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.button, styles.retakeButton]}
                onPress={() => {
                  setImage(null);
                  setExtractedData(null);
                }}
              >
                <Text style={styles.buttonText}>Retake</Text>
              </TouchableOpacity>
              
              {extractedData && (
                <TouchableOpacity
                  style={[styles.button, styles.saveButton, processing && styles.buttonDisabled]}
                  onPress={saveBill}
                  disabled={processing}
                >
                  <Text style={styles.buttonText}>
                    {processing ? 'Saving...' : 'Save Bill'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    gap: 16,
  },
  captureButton: {
    backgroundColor: '#007AFF',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 20,
  },
  processingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  processingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  dataContainer: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  dataTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  dataText: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  retakeButton: {
    backgroundColor: '#666',
  },
  saveButton: {
    backgroundColor: '#34C759',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
