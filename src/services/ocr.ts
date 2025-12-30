import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
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
      /*
      try {
        // Wrap in try-catch to prevent native crash from propagating if possible
        // Also, BarcodeScanning might be unstable on some devices with large images
        // Note: scan() only accepts one argument (uri) in this version of the library
        const barcodes = await BarcodeScanning.scan(scanUri);

        if (barcodes && barcodes.length > 0) {
          // Filter for QR codes if needed, or just take the first one
          const qrCode = barcodes.find(b => b.format === BarcodeFormat.QR_CODE) || barcodes[0];
          
          if (qrCode) {
             const rawValue = qrCode.value || qrCode.rawValue; // Handle potential property name differences
             console.log('✅ QR Code detected:', rawValue);
             if (rawValue) {
               qrData = OCRService.parseQRData(rawValue);
             }
          }
        } else {
          console.log('⚠️ No QR code found.');
        }
      } catch (qrError) {
        console.warn('⚠️ QR Scan failed (continuing to OCR):', qrError);
      }
      */

      // 2. Run OCR for text extraction (always needed for From/To)
      console.log('🔍 Running ML Kit OCR (Latin & Devanagari)...');
      let text = '';
      try {
         const [latinResult, devanagariResult] = await Promise.all([
            TextRecognition.recognize(scanUri, TextRecognitionScript.LATIN),
            TextRecognition.recognize(scanUri, TextRecognitionScript.DEVANAGARI),
         ]);
         text = [latinResult.text, devanagariResult.text].filter(Boolean).join('\n');
      } catch (ocrError) {
         console.error('❌ TextRecognition failed:', ocrError);
         // If OCR fails, but we have QR data, return that
         if (Object.keys(qrData).length > 0) {
            return { ...OCRService.getMockData(), ...qrData, extractedText: 'QR Only (OCR Failed)' };
         }
         throw ocrError;
      }

      if (!text) {
        console.log('⚠️ ML Kit returned no text.');
        // If we have QR data, return that at least
        if (Object.keys(qrData).length > 0) {
            return { ...OCRService.getMockData(), ...qrData, extractedText: 'QR Only' };
        }
        return OCRService.getMockData();
      }

      console.log('📦 --- RAW OCR PAYLOAD START ---');
      console.log(text);
      console.log('📦 --- RAW OCR PAYLOAD END ---');

      if (!OCRService.isValidPuneMetroTicket(text)) {
        throw new Error("This is not a valid Pune Metro Ticket or the Image is not capturing CO2");
      }

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
      if (error.message === "This is not a valid Pune Metro Ticket or the Image is not capturing CO2") {
        throw error;
      }
      return OCRService.getMockData();
    }
  }

  private static isValidPuneMetroTicket(text: string): boolean {
    const upper = text.toUpperCase();
    // Must have Ticket Number identifier AND CO2 identifier
    const hasTicketInfo = text.includes('तिकीट') ||
           (upper.includes('TICKET NO') && upper.includes('JOURNEY TICKET'));
           
    // Added '০' to allowed middle chars, and 'CO' as fallback
    const hasCO2 = /(?:C[O0o০]?|০০)2+|CO/i.test(text);

    return hasTicketInfo && hasCO2;
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
    const currencyMatch = text.match(/(?:INR|Rs|₹)\.?\s*(\d+(?:\.\d+)?)/i);
    if (currencyMatch) {
        amountVal = currencyMatch[0];
    } else {
        const floatMatch = text.match(/\b(\d+\.\d{1,2})\b/);
        if (floatMatch) amountVal = floatMatch[1];
    }

    /*
    const locationCandidates = rawLines.filter(line => {
        const upper = line.toUpperCase();
        if (line !== upper) return false; 
        if (line.length < 3) return false;
        // Removed PMC from exclusion list so it can be detected as a location
        if (/DATE|FROM|TO|FARE|TICKET|VALID|PLATFORM|INR|RS/.test(upper) && upper.length < 10) return false; 
        if (/\d/.test(line)) return false; 
        return true;
    });

    const fromVal = locationCandidates[0] || '';
    const toVal = locationCandidates[1] || '';
    */
    const fromVal = '';
    const toVal = '';

    // Extract CO2 saved
    let co2Saved = '';
    // Regex to capture number-like pattern before unit and CO2
    // Matches:
    // 1. Number part: digits, dots, spaces, Bengali 0 (০), Latin o/O (common OCR errors for 0), S/s (misread 5), Bengali 4 (৪ - misread 8)
    // 2. Unit: g, gm, gram, ग्रेम, ग्रेंम, प्रेम (misread), प्रेंम (misread), प्रम (misread), grams, प्म (misread), ग्रॅम, ग्रॉम, ग्म, गप्रेम (misread), म्रेम (misread), परम (misread), ग्रेभ (misread), फम (misread), म (misread), ग\s*्रम (split across lines), टरेम (misread), प्रे\s*म (split)
    // 3. CO2: C or 0/O/০, then optional O/0/০, then 2 (Handles "C2", "002", "০০2", "CO22" misreads) OR just "CO". Allows spaces.
    // Added support for leading parenthesis '(' before CO2
    // Added comma ',' to allowed chars in number part
    const co2Regex = /([0-9০oO\s.Ss৪,]+)\s*(?:g|gm|gram|ग्रेम|ग्रेंम|प्रेम|प्रेंम|प्रम|प्म|ग्रॅम|ग्रॉम|ग्म|गप्रेम|म्रेम|परम|ग्रेभ|फम|म|grams|ग\s*्रम|টरेम|प्रे\s*म)\s*(?:\(?\s*[C0O০o]\s*[O0০o]?\s*2+|CO)/i;
    const co2Match = text.match(co2Regex);
    
    if (co2Match) {
        let rawNumber = co2Match[1];
        // Clean up the number
        // 1. Normalize characters (Bengali 0, o/O -> 0, S/s -> 5, Bengali 4 -> 8)
        rawNumber = rawNumber
            .replace(/০/g, '0')
            .replace(/[oO]/gi, '0')
            .replace(/[sS]/g, '5')
            .replace(/৪/g, '8');

        // 2. Handle spaces
        if (rawNumber.includes('.')) {
            // If dot exists, spaces are just noise (e.g. "0 . 59")
            // Also remove commas which might be OCR noise near decimal (e.g. "1.,02")
            rawNumber = rawNumber.replace(/,/g, '').replace(/\s/g, '');
        } else {
            // If no dot, treat the first whitespace sequence as a decimal point
            // e.g. "0 59" -> "0.59", "0  59" -> "0.59"
            rawNumber = rawNumber.trim().replace(/\s+/, '.').replace(/\s/g, '');
        }
            
        // Verify it is a valid number
        let co2Value = parseFloat(rawNumber);
        if (!isNaN(co2Value)) {
             // Validation: CO2 is typically small, but can be > 1g (e.g. 1.02g)
             // Heuristic: If > 2, it's likely missing a decimal point (e.g. 59 -> 0.59)
             while (co2Value > 2) {
                 co2Value /= 10;
             }
             // Remove trailing zeros if needed, but toFixed(2) is standard
             co2Saved = `${parseFloat(co2Value.toFixed(2))} g CO2`;
        }
    }

    // 3. Label Beautification & Reconstruction
    const labels = ['Date', 'From', 'To', 'Fare', 'Charge', 'Amount', 'Ticket', 'Tickat', 'Bill', 'Invoice'];
    const reconstructedLines = rawLines.map(line => {
        // Check if this line IS one of our identified values, if so, we'll label it later or here
        const upper = line.toUpperCase();
        
        // If line is exactly one of our orphaned values, prefix it
        // if (line === fromVal) return `From : ${line}`;
        // if (line === toVal) return `To : ${line}`;
        if (line === dateVal) return `Date : ${line}`;
        if (line === amountVal || (amountVal.includes(line) && line.length > 2)) return `Fare : ${line}`;

        for (const label of labels) {
            if (line.toLowerCase().startsWith(label.toLowerCase())) {
                // Remove label, then remove separators, then remove "NO", "No", "#" etc.
                const value = line.substring(label.length)
                    .replace(/^[:\- 	]+/, '')
                    .replace(/^(?:NO|N0|Number|#)[:\- 	]*/i, '')
                    .trim();
                
                // Normalize label "Tickat" to "Ticket"
                const displayLabel = label === 'Tickat' ? 'Ticket' : label;
                
                if (value) return `${displayLabel} : ${value}`;
                return displayLabel; 
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

    let finalAmount = parseFloat(amountVal.replace(/[^0-9.]/g, '')) || 0;
    
    // Heuristic 1: If amount is 3 digits and starts with 2, the 2 is likely a misread '₹'
    // e.g. 214.0 -> 14.0, 200.0 -> 0.0 (or 20.0 if it was 220.0)
    if (finalAmount >= 200 && finalAmount < 300) {
        finalAmount -= 200;
    }

    // Heuristic 2: If amount is > 100 (and wasn't caught by above), it's likely missing a decimal point
    // Pune Metro fares are typically < 100. 
    // e.g. 105 -> 10.5, 150 -> 15.0, 300 -> 30.0
    if (finalAmount >= 100) {
        finalAmount /= 10;
    }

    // Try to find specific Pune Metro long ID format first: YYYYMMDD T HHMM O XXXX
    // e.g. 02251230T1100O0082
    // Allow for spaces and common OCR misreads (0 for O)
    const longIdMatch = text.match(/(\d{8}\s*T\s*\d{4}\s*[O0]\s*\d{4})/i);
    let billNo = longIdMatch ? longIdMatch[1].replace(/\s/g, '').replace(/0(?=\d{4}$)/, 'O') : '';

    if (!billNo) {
        // Fallback to generic "Ticket No" search
        // Added [-\/.] to allowed chars
        billNo = text.match(/(?:Tick[ae]t|Bill|Invoice|तिकीट\s*क्र\.?)\s*(?:N0|No|#|Number)?\s*[:\-]?\s*([A-Z0-9:\-\/.]+)/i)?.[1] || '';
    }

    return {
      billNumber: billNo || `BILL${Date.now()}`,
      amount: finalAmount,
      date: dateObj,
      from: fromVal || 'Unknown',
      to: toVal || 'Unknown',
      extractedText: cleanedText,
      co2Saved: co2Saved,
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