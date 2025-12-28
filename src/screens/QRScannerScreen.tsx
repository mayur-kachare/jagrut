import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Linking,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useAuth } from '../context/AuthContext';
import { FirestoreService } from '../services/firestore';
import type { Bill } from '../types';

const { width } = Dimensions.get('window');
const SCAN_SIZE = width * 0.7; // 70% of screen width

interface ParsedQRCode {
  raw: string;
  bill: Partial<Bill> | null;
}

export const QRScannerScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const [parsed, setParsed] = useState<ParsedQRCode | null>(null);

  // Auto-handle permissions
  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarcodeScanned = useCallback(
    ({ data }: BarcodeScanningResult) => {
      if (parsed) return;

      const parsedResult = parseQRCodeData(data);
      setParsed(parsedResult);

      if (!parsedResult.bill) {
        Alert.alert('QR Detected', 'QR code scanned but no structured data was found.');
      }
    },
    [parsed]
  );

  const saveBill = async () => {
    if (!user || !parsed?.bill) {
      Alert.alert('Error', 'Missing required data');
      return;
    }

    setProcessing(true);
    try {
      await FirestoreService.saveBill({
        userId: user.id,
        billNumber: parsed.bill.billNumber || '',
        amount: parsed.bill.amount || 0,
        date: parsed.bill.date || new Date(),
        from: parsed.bill.from || '',
        to: parsed.bill.to || '',
        extractedText: parsed.raw,
      });

      Alert.alert('Success', 'Bill saved successfully!', [
        { text: 'OK', onPress: () => navigation.navigate('Home') },
      ]);
      
      setParsed(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to save bill');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const handleRetake = () => {
    setParsed(null);
  };

  // 1. Loading / Permission Transition State
  if (!permission) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // 2. Permission Denied State
  if (!permission.granted) {
    return (
      <View style={styles.centerContent}>
        <Text style={styles.permissionText}>
          Camera permission is required to scan QR codes.
        </Text>
        <TouchableOpacity
          style={styles.captureButton}
          onPress={requestPermission}
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
            <Text style={{ color: '#007AFF', fontSize: 16 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 3. Camera Scanning State (No data parsed yet)
  if (!parsed) {
    return (
      <View style={styles.container}>
        <StatusBar hidden />
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcodeScanned}
        />
        
        {/* Dark Overlay with Transparent Center */}
        <View style={styles.overlayContainer}>
          <View style={styles.overlayTop}>
            <Text style={styles.scanText}>Scan QR Code</Text>
          </View>
          <View style={styles.overlayCenterRow}>
            <View style={styles.overlaySide} />
            <View style={styles.focusedContainer}>
              {/* Corner Markers */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom}>
            <Text style={styles.instructionText}>Align the QR code within the frame</Text>
          </View>
        </View>

        {/* Close Button */}
        <SafeAreaView style={styles.safeArea}>
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // 3. Results State (Data parsed)
  return (
    <ScrollView style={styles.resultContainer}>
      <StatusBar hidden={false} />
      <View style={styles.content}>
        <Text style={styles.title}>Scanned Details</Text>
        
        <View style={styles.dataContainer}>
            <Text style={styles.dataTitle}>Extracted Information</Text>
            {parsed.bill ? (
            <>
                <Text style={styles.dataText}>Bill : {parsed.bill.billNumber || '—'}</Text>
                <Text style={styles.dataText}>
                Date : {parsed.bill.date?.toLocaleDateString() || '—'}
                </Text>
                <Text style={styles.dataText}>From : {parsed.bill.from || '—'}</Text>
                <Text style={styles.dataText}>To : {parsed.bill.to || '—'}</Text>
                <Text style={styles.dataText}>Amount / Fare : ₹{parsed.bill.amount || '—'}</Text>
            </>
            ) : (
            <Text style={styles.dataText}>No structured data found in QR code.</Text>
            )}
        </View>

        <View style={styles.actionButtons}>
            <TouchableOpacity
            style={[styles.button, styles.retakeButton]}
            onPress={handleRetake}
            >
            <Text style={styles.buttonText}>Rescan</Text>
            </TouchableOpacity>

            {parsed.bill && (
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
      </View>
    </ScrollView>
  );
};

// ... parsing logic remains the same ...
const parseQRCodeData = (data: string): ParsedQRCode => {
  const trimmed = data.trim();

  try {
    const parsedJson = JSON.parse(trimmed);
    if (parsedJson && typeof parsedJson === 'object') {
      const normalized = normalizeBillFields(parsedJson as Record<string, unknown>);
      const hasStructured = hasBillValues(normalized);
      return {
        raw: trimmed,
        bill: hasStructured ? normalized : null,
      };
    }
  } catch (error) {
    // Ignore JSON parse errors
  }

  const kvPairs = extractKeyValuePairs(trimmed);
  const normalized = kvPairs ? normalizeBillFields(kvPairs) : null;
  let bill: Partial<Bill> | null = normalized && hasBillValues(normalized) ? normalized : null;

  if (!bill) {
    const customBill = parseCustomMetroPayload(trimmed);
    bill = customBill && hasBillValues(customBill) ? customBill : null;
  }

  if (!bill) {
    const textBill = extractBillFromFreeText(trimmed);
    bill = textBill && hasBillValues(textBill) ? textBill : null;
  }

  return {
    raw: trimmed,
    bill,
  };
};

const extractKeyValuePairs = (text: string): Record<string, string> | null => {
  const matches = Array.from(text.matchAll(/([A-Za-z ]{2,})[:=]\s*([^;\n]+)/g));
  if (!matches.length) {
    return null;
  }

  return matches.reduce<Record<string, string>>((acc, match) => {
    const key = match[1].trim().toLowerCase();
    acc[key] = match[2].trim();
    return acc;
  }, {});
};

const normalizeBillFields = (data: Record<string, unknown>): Partial<Bill> => {
  const getValue = (keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = data[key] ?? data[key.toLowerCase()];
      if (typeof value === 'string' && value.trim().length) {
        return value.trim();
      }
      if (typeof value === 'number') {
        return value.toString();
      }
    }
    return undefined;
  };

  const amountRaw = getValue(['amount', 'fare', 'total']);
  const amount = amountRaw ? parseFloat(amountRaw.replace(/[^0-9.]/g, '')) : undefined;
  const dateRaw = getValue(['date', 'billDate']);
  const date = dateRaw ? new Date(dateRaw) : undefined;

  return {
    billNumber: getValue(['billNumber', 'bill', 'ticket', 'invoice', 'bill_no']) || undefined,
    amount,
    from: getValue(['from', 'source']),
    to: getValue(['to', 'destination']),
    date: date && !Number.isNaN(date.getTime()) ? date : undefined,
  };
};

const hasBillValues = (bill: Partial<Bill>): boolean => {
  return Boolean(
    (bill.billNumber && bill.billNumber.length > 0) ||
      typeof bill.amount === 'number' ||
      (bill.from && bill.from.length > 0) ||
      (bill.to && bill.to.length > 0) ||
      bill.date,
  );
};

const extractBillFromFreeText = (text: string): Partial<Bill> | null => {
  if (!text) {
    return null;
  }

  const amountMatch = text.match(/(?:fare|total|amount|rs\.?|₹|inr)\s*[:=]?\s*(\d+(?:\.\d{1,2})?)/i);
  const billMatch = text.match(/(?:ticket|bill|invoice|receipt)\s*(?:no\.?|#|number|id)?\s*[:=]?\s*([A-Z0-9T-]+)/i);
  const dateMatch = text.match(/(?:date|dated|valid)\s*[:=]?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i);
  const fromMatch = text.match(/from\s*[:=]?\s*([A-Z0-9\s]+)/i);
  const toMatch = text.match(/to\s*[:=]?\s*([A-Z0-9\s]+)/i);

  let parsedDate: Date | undefined;
  if (dateMatch) {
    const replaced = dateMatch[1].replace(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/, '$2/$1/$3');
    const d = new Date(replaced);
    if (!Number.isNaN(d.getTime())) {
      parsedDate = d;
    }
  }

  return {
    billNumber: billMatch ? billMatch[1] : undefined,
    amount: amountMatch ? parseFloat(amountMatch[1]) : undefined,
    date: parsedDate,
    from: fromMatch ? fromMatch[1].trim() : undefined,
    to: toMatch ? toMatch[1].trim() : undefined,
  };
};

const parseCustomMetroPayload = (text: string): Partial<Bill> | null => {
  if (!text.includes('|')) {
    return null;
  }

  const braceSections = Array.from(text.matchAll(/\{([^{}]*)\}/g), (match) => match[1].trim()).filter(Boolean);

  const dataBlock = braceSections.find((block) => block.includes('|') && block.split('|').length >= 4);
  const routeBlock = braceSections.find((block) => block.includes('<') && block.includes('>'));

  let billNumber: string | undefined;
  let amount: number | undefined;
  let date: Date | undefined;
  let from: string | undefined;
  let to: string | undefined;

  const dataSegments = dataBlock ? dataBlock.split('|').map((segment) => segment.trim()).filter(Boolean) : [];

  if (dataSegments.length) {
    const segments = dataSegments;

    const sequentialCandidate = segments[4];
    if (sequentialCandidate) {
      const metroDate = parseMetroDateTime(sequentialCandidate);
      if (metroDate) {
        date = metroDate;
      } else {
        billNumber = sequentialCandidate;
      }
    }

    if (!billNumber) {
      const ticketCandidate = segments.find((segment) => /[A-Z].*\d/.test(segment) && segment.length >= 10);
      if (ticketCandidate) {
        billNumber = ticketCandidate;
      }
    }

    const hexFloat = segments.find((segment) => /^0x[0-9a-f]+(?:\.[0-9a-f]+)?p[+-]?\d+$/i.test(segment));
    if (hexFloat) {
      amount = parseHexFloat(hexFloat);
    }

    if (amount === undefined) {
      const numericAmount = segments.find((segment) => /^\d+(?:\.\d+)?$/.test(segment));
      if (numericAmount) {
        amount = parseFloat(numericAmount);
      }
    }

    if (!date) {
      const timestampCandidate = segments.find((segment) => /^\d{10,}$/.test(segment));
      if (timestampCandidate) {
        const rawValue = parseInt(timestampCandidate, 10);
        const millis = rawValue > 1e12 ? rawValue : rawValue * 1000;
        const candidate = new Date(millis);
        if (
          !Number.isNaN(candidate.getTime()) &&
          candidate.getFullYear() >= 2000 &&
          candidate.getFullYear() <= 2100
        ) {
          date = candidate;
        }
      }
    }

    if (!date) {
      const dateToken = segments.find((segment) => /T\d{3,}/.test(segment));
      if (dateToken) {
        date = parseMetroDateTime(dateToken) ?? date;
      }
    }

    if (!billNumber) {
      const fallbackTicket = segments.find((segment) => /\d{6,}/.test(segment));
      if (fallbackTicket) {
        billNumber = fallbackTicket;
      }
    }

    const fromCode = segments[7];
    const toCode = segments[8];

    if (!routeBlock) {
      const decodedFrom = decodeMetroStationCode(fromCode);
      const decodedTo = decodeMetroStationCode(toCode);
      if (decodedFrom) {
        from = decodedFrom;
      }
      if (decodedTo) {
        to = decodedTo;
      }
    }
  }

  if (routeBlock) {
    const segments = Array.from(routeBlock.matchAll(/<([^>]+)>/g), (match) => match[1]);
    if (segments.length >= 1) {
      from = formatRouteSegment(segments[0]);
    }
    if (segments.length >= 2) {
      to = formatRouteSegment(segments[1]);
    }
    if (!date && segments.length >= 3) {
      const dateParts = segments[2].split('|');
      if (dateParts.length >= 3) {
        const [dayStr, monthStr, yearStr] = dateParts;
        const day = parseInt(dayStr, 10);
        const month = parseInt(monthStr, 10);
        const yearTwoDigit = parseInt(yearStr, 10);
        if (!Number.isNaN(day) && !Number.isNaN(month) && !Number.isNaN(yearTwoDigit)) {
          const year = yearTwoDigit + (yearTwoDigit >= 70 ? 1900 : 2000);
          const constructed = new Date(year, Math.max(0, month - 1), day);
          if (!Number.isNaN(constructed.getTime())) {
            date = constructed;
          }
        }
      }
    }
  }

  if (dataSegments.length) {
    const fromCode = dataSegments[7];
    const toCode = dataSegments[8];

    if (!from || /metro/i.test(from)) {
      from = decodeMetroStationCode(fromCode) ?? from;
    } else if (fromCode) {
      const decoded = decodeMetroStationCode(fromCode);
      if (decoded) {
        from = `${from} (${decoded})`;
      }
    }

    if (!to || (from && to === from) || /metro/i.test(to)) {
      const decodedTo = decodeMetroStationCode(toCode);
      to = decodedTo ?? (fromCode === toCode ? undefined : to);
    } else if (toCode) {
      const decoded = decodeMetroStationCode(toCode);
      if (decoded) {
        to = `${to} (${decoded})`;
      }
    }
  }

  const bill: Partial<Bill> = {
    billNumber,
    amount,
    date,
    from,
    to,
  };

  if (billNumber || amount !== undefined || from || to || date) {
    console.log('🧾 Parsed metro payload', {
      billNumber,
      amount,
      date,
      from,
      to,
    });
  }

  return bill;
};

const parseMetroDateTime = (token: string): Date | undefined => {
  const normalized = token.replace(/[^0-9T]/g, '');
  const [dateSection, timeSection] = normalized.split('T');
  if (!dateSection || !timeSection) {
    return undefined;
  }

  if (dateSection.length !== 8) {
    return undefined;
  }

  const dateParts = dateSection.match(/\d{2}/g);
  if (!dateParts || dateParts.length < 4) {
    return undefined;
  }

  const [, yearPart, monthPart, dayPart] = dateParts;
  const year = 2000 + parseInt(yearPart, 10);
  const month = parseInt(monthPart, 10);
  const day = parseInt(dayPart, 10);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return undefined;
  }

  const paddedTime = timeSection.padEnd(6, '0');
  const hour = parseInt(paddedTime.slice(0, 2), 10);
  const minute = parseInt(paddedTime.slice(2, 4), 10);
  const second = parseInt(paddedTime.slice(4, 6), 10);
  const millisecondPart = timeSection.length > 6 ? timeSection.slice(6, 9) : '0';
  const millisecond = parseInt(millisecondPart.padEnd(3, '0'), 10);

  if ([hour, minute, second, millisecond].some((value) => Number.isNaN(value))) {
    return undefined;
  }

  const constructed = new Date(year, Math.max(0, month - 1), day, hour, minute, second, millisecond);
  if (Number.isNaN(constructed.getTime()) || constructed.getFullYear() !== year) {
    return undefined;
  }

  return constructed;
};

const parseHexFloat = (value: string): number | undefined => {
  const match = value.match(/^0x([0-9a-f]+)(?:\.[0-9a-f]+)?p([+-]?\d+)$/i);
  if (!match) {
    return undefined;
  }

  const [, integerPart, fractionPart = '0', exponentPart] = match;
  const integer = parseInt(integerPart, 16);
  let fraction = 0;
  for (let index = 0; index < fractionPart.length; index += 1) {
    const digit = parseInt(fractionPart[index], 16);
    if (Number.isNaN(digit)) {
      return undefined;
    }
    fraction += digit / 16 ** (index + 1);
  }

  const exponent = parseInt(exponentPart, 10);
  return (integer + fraction) * 2 ** exponent;
};

const formatRouteSegment = (segment: string): string | undefined => {
  if (!segment) {
    return undefined;
  }

  const cleaned = segment.replace(/^[^A-Za-z0-9]+/, '').split('|')[0]?.trim();
  return cleaned || undefined;
};

const decodeMetroStationCode = (code: string | undefined): string | undefined => {
  if (!code) {
    return undefined;
  }

  const normalized = code.trim();
  if (!normalized) {
    return undefined;
  }

  const knownStations: Record<string, string> = {
    // Replace with actual station mappings when available
  };

  const mapped = knownStations[normalized.toLowerCase()];
  if (mapped) {
    return mapped;
  }

  console.log('ℹ️ Unknown metro station code detected', normalized);
  return normalized.toUpperCase();
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  resultContainer: {
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
    backgroundColor: '#fff',
  },
  permissionText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
  },
  
  // Overlay Styles
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 20,
  },
  overlayCenterRow: {
    flexDirection: 'row',
    height: SCAN_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  focusedContainer: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    // Transparent center
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    paddingTop: 20,
  },
  scanText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  instructionText: {
    color: '#ccc',
    fontSize: 14,
  },
  
  // Corner Markers
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#fff',
    borderWidth: 4,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },

  // Close Button
  safeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  closeButton: {
    marginLeft: 20,
    marginTop: 10,
    width: 40,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});