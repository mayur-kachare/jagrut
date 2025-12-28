import TextRecognition from '@react-native-ml-kit/text-recognition';
import BarcodeScanning, { BarcodeFormat } from '@react-native-ml-kit/barcode-scanning';
import { Bill } from '../types';

export class OCRService {
  static async extractTextFromImage(imageUri: string): Promise<Partial<Bill>> {
    if (!imageUri) {
      return OCRService.getMockData();
    }

    try {
      // Ensure URI is proper format for the lib (file://)
      const scanUri = imageUri.startsWith('file://') ? imageUri : `file://${imageUri}`;

      // 1. Try to scan QR code first
      console.log('🔍 Scanning for QR codes...');
      let qrData: Partial<Bill> = {};
      try {
        const barcodes = await BarcodeScanning.scan(scanUri, {
          formats: [BarcodeFormat.QR_CODE],
        });

        if (barcodes && barcodes.length > 0) {
          const rawValue = barcodes[0].rawValue;
          console.log('✅ QR Code detected:', rawValue);
          if (rawValue) {
            qrData = OCRService.parseQRData(rawValue);
          }
        } else {
          console.log('⚠️ No QR code found.');
        }
      } catch (qrError) {
        console.warn('⚠️ QR Scan failed:', qrError);
      }

      // 2. Run OCR for text extraction (always needed for From/To)
      console.log('🔍 Running ML Kit OCR...');
      const result = await TextRecognition.recognize(scanUri);

      if (!result || !result.text) {
        console.log('⚠️ ML Kit returned no text.');
        // If we have QR data, return that at least
        if (Object.keys(qrData).length > 0) {
            return { ...OCRService.getMockData(), ...qrData, extractedText: 'QR Only' };
        }
        return OCRService.getMockData();
      }

      const text = result.text;
      console.log('📦 --- RAW OCR PAYLOAD START ---');
      console.log(text);
      console.log('📦 --- RAW OCR PAYLOAD END ---');

      const ocrData = OCRService.parseWithHeuristics(text);
      
      // 3. Merge Data: QR takes precedence for BillNo, Date, Amount
      const finalData: Partial<Bill> = {
        ...ocrData,
        ...qrData, // Overwrite with QR data if available
        // Ensure From/To are preserved from OCR if QR doesn't have them (which it shouldn't based on requirements)
        from: ocrData.from || qrData.from || 'Unknown',
        to: ocrData.to || qrData.to || 'Unknown',
      };

      console.log('✅ Final Structured Bill Data:', JSON.stringify(finalData, null, 2));
      return finalData;

    } catch (error: any) {
      console.error('❌ OCR Error:', error);
      return OCRService.getMockData();
    }
  }

  private static parseQRData(rawValue: string): Partial<Bill> {
    // Attempt to parse JSON first
    try {
      const json = JSON.parse(rawValue);
      return {
        billNumber: json.billNumber || json.billNo || json.id,
        amount: parseFloat(json.amount || json.fare || json.total || '0'),
        date: json.date ? new Date(json.date) : undefined,
      };
    } catch (e) {
      // Not JSON, try simple text parsing
      // Expected format example: "Bill:123, Date:2023-01-01, Fare:100"
      const billMatch = rawValue.match(/(?:Bill|Ticket|No)[:\s-]*([A-Z0-9]+)/i);
      const amountMatch = rawValue.match(/(?:Fare|Amount|INR|Rs)[:\s-]*(\d+(?:\.\d+)?)/i);
      const dateMatch = rawValue.match(/(\d{4}-\d{2}-\d{2}|\d{2}[\/-]\d{2}[\/-]\d{4})/);

      let dateObj: Date | undefined;
      if (dateMatch) {
         dateObj = new Date(dateMatch[0]);
      }

      return {
        billNumber: billMatch ? billMatch[1] : undefined,
        amount: amountMatch ? parseFloat(amountMatch[1]) : undefined,
        date: dateObj,
      };
    }
  }

  private static parseWithHeuristics(text: string): Partial<Bill> {
    // 1. Initial Clean: splits columns into newlines
    const rawLines = text
      .replace(/[ 	]{2,}/g, '\n') 
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // 2. Identify orphaned values first
    let dateVal = '';
    const dateMatch = text.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/);
    if (dateMatch) dateVal = dateMatch[1];

    let amountVal = '';
    const inrMatch = text.match(/INR\s*(\d+(?:\.\d+)?)/i);
    if (inrMatch) {
        amountVal = `INR ${inrMatch[1]}`;
    } else {
        const floatMatch = text.match(/\b(\d+\.\d{1,2})\b/);
        if (floatMatch) amountVal = floatMatch[1];
    }

    const locationCandidates = rawLines.filter(line => {
        const upper = line.toUpperCase();
        if (line !== upper) return false; 
        if (line.length < 3) return false;
        // Removed PMC from exclusion list so it can be detected as a location
        if (/DATE|FROM|TO|FARE|TICKET|VALID|PLATFORM|INR/.test(upper) && upper.length < 10) return false; 
        if (/\d/.test(line)) return false; 
        return true;
    });

    const fromVal = locationCandidates[0] || '';
    const toVal = locationCandidates[1] || '';

    // 3. Label Beautification & Reconstruction
    const labels = ['Date', 'From', 'To', 'Fare', 'Charge', 'Amount', 'Ticket', 'Bill', 'Invoice'];
    const reconstructedLines = rawLines.map(line => {
        // Check if this line IS one of our identified values, if so, we'll label it later or here
        const upper = line.toUpperCase();
        
        // If line is exactly one of our orphaned values, prefix it
        if (line === fromVal) return `From : ${line}`;
        if (line === toVal) return `To : ${line}`;
        if (line === dateVal) return `Date : ${line}`;
        if (line === amountVal || (amountVal.includes(line) && line.length > 2)) return `Fare : ${line}`;

        for (const label of labels) {
            if (line.toLowerCase().startsWith(label.toLowerCase())) {
                const value = line.substring(label.length).replace(/^[:\- 	]+/, '').trim();
                if (value) return `${label} : ${value}`;
                return label; 
            }
        }
        return line;
    });

    // Remove duplicate-looking labels (e.g. if we had "From:" and "From : STATION")
    const finalLines = reconstructedLines.filter((line, index) => {
        const isBareLabel = labels.some(l => line === l);
        if (isBareLabel) {
            // Only keep bare label if the NEXT line isn't the beautified version
            const nextLine = reconstructedLines[index + 1] || '';
            if (nextLine.startsWith(line + ' :')) return false;
        }
        return true;
    });

    const cleanedText = finalLines.join('\n');

    // 4. Final Object Assembly
    let dateObj = new Date();
    if (dateVal) {
        const parts = dateVal.split(/[\/-]/);
        dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }

    return {
      billNumber: text.match(/(?:Ticket|Bill)\s*(?:N0|No|#)\s*[:\-]?\s*([A-Z0-9T]+)/i)?.[1] || `BILL${Date.now()}`,
      amount: parseFloat(amountVal.replace(/[^0-9.]/g, '')) || 0,
      date: dateObj,
      from: fromVal || 'Unknown',
      to: toVal || 'Unknown',
      extractedText: cleanedText,
    };
  }

  private static getMockData(): Partial<Bill> {
    return {
      billNumber: `MOCK${Date.now()}`,
      amount: 0,
      date: new Date(),
      from: 'Unknown',
      to: 'Unknown',
      extractedText: 'OCR Failed',
    };
  }
}