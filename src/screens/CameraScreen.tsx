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
  Linking,
} from 'react-native';
import ImageCropPicker from 'react-native-image-crop-picker';
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

  const takePhoto = async () => {
    console.log('📸 takePhoto called');
    try {
      const image = await ImageCropPicker.openCamera({
        width: 1024,
        height: 1024,
        cropping: true,
        freeStyleCropEnabled: true,
        mediaType: 'photo',
        compressImageQuality: 0.8,
      });

      console.log('📸 Camera result:', image.path);

      if (image.path) {
        try {
          const originalUri = image.path;
          // Ensure URI has file:// prefix for consistency if needed, though ImageCropPicker usually returns it or just path
          // But for consistency with previous logic:
          const uri = originalUri.startsWith('file://') ? originalUri : `file://${originalUri}`;
          
          console.log('📸 Compressing image before processing...');
          // We can skip extra compression if ImageCropPicker already compressed it, but keeping it for safety/consistency
          const compressedUri = await ImageCompressor.compressImage(uri);
          console.log('📸 Compression complete:', compressedUri);
          
          setImage(compressedUri);
          // Small delay to ensure file is ready and UI updates
          setTimeout(() => processImage(compressedUri), 500);
        } catch (error) {
          console.error('Error handling camera result:', error);
          Alert.alert('Error', 'Failed to process photo');
        }
      }
    } catch (error: any) {
      if (error.code !== 'E_PICKER_CANCELLED') {
        console.error('Error taking photo:', error);
        Alert.alert('Error', 'Failed to open camera: ' + error.message);
      }
    }
  };

  const pickImage = async () => {
    console.log('🖼️ pickImage called');
    try {
      const image = await ImageCropPicker.openPicker({
        width: 1024,
        height: 1024,
        cropping: true,
        freeStyleCropEnabled: true,
        mediaType: 'photo',
        compressImageQuality: 0.8,
      });

      console.log('🖼️ Image library result:', image.path);

      if (image.path) {
        try {
          const originalUri = image.path;
          const uri = originalUri.startsWith('file://') ? originalUri : `file://${originalUri}`;

          console.log('🖼️ Compressing image before processing...');
          const compressedUri = await ImageCompressor.compressImage(uri);
          console.log('🖼️ Compression complete:', compressedUri);
          
          setImage(compressedUri);
          // Small delay to ensure file is ready and UI updates
          setTimeout(() => processImage(compressedUri), 500);
        } catch (error) {
          console.error('Error handling gallery result:', error);
          Alert.alert('Error', 'Failed to process image');
        }
      }
    } catch (error: any) {
      if (error.code !== 'E_PICKER_CANCELLED') {
        console.error('Error picking image:', error);
        Alert.alert('Error', 'Failed to open gallery: ' + error.message);
      }
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

    if (!extractedData.billNumber) {
      Alert.alert('Error', 'Bill number is missing. Please enter it manually.');
      return;
    }

    setProcessing(true);
    try {
      // Check for duplicate bill
      /*
      const exists = await FirestoreService.checkBillExists(extractedData.billNumber);
      if (exists) {
        Alert.alert('Error', 'This bill number already exists in the system.');
        setProcessing(false);
        return;
      }
      */

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
            {image && <Image source={{ uri: image }} style={styles.image} />}
            
            {processing && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.processingText}>Processing image...</Text>
              </View>
            )}

            {extractedData && !processing && (
              <View style={styles.dataContainer}>
                <Text style={styles.dataTitle}>Extracted Information</Text>
                <Text style={styles.dataText}>Bill : {extractedData.billNumber || '—'}</Text>
                <Text style={styles.dataText}>
                  Date : {extractedData.date?.toLocaleDateString() || '—'}
                </Text>
                <Text style={styles.dataText}>From : {extractedData.from || '—'}</Text>
                <Text style={styles.dataText}>To : {extractedData.to || '—'}</Text>
                <Text style={styles.dataText}>Amount / Fare : ₹{extractedData.amount || '—'}</Text>
                
                {extractedData.extractedText && (
                  <View style={styles.rawTextContainer}>
                    <Text style={styles.rawTextTitle}>Raw Text:</Text>
                    <ScrollView style={styles.rawTextScroll} nestedScrollEnabled>
                      <Text style={styles.rawTextContent}>{extractedData.extractedText}</Text>
                    </ScrollView>
                  </View>
                )}
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
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
  },
  permissionText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
  },
  rawTextContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
  },
  rawTextTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#666',
  },
  rawTextScroll: {
    maxHeight: 150,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
  },
  rawTextContent: {
    fontSize: 12,
    color: '#333',
    fontFamily: 'monospace',
  },
});
