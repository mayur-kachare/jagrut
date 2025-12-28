import * as ImageManipulator from 'expo-image-manipulator';

export class ImageCompressor {
  static async compressImage(uri: string): Promise<string> {
    try {
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }], // Resize to max width of 1024px
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      return manipulatedImage.uri;
    } catch (error) {
      console.error('Error compressing image:', error);
      throw error;
    }
  }
}
