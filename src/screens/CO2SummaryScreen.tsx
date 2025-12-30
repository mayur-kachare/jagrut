import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Bill } from '../types';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Define a type for bills passed via navigation where dates might be strings
interface SerializableBill extends Omit<Bill, 'date' | 'createdAt'> {
  date: string | Date;
  createdAt: string | Date;
}

interface CO2SummaryScreenProps {
  route: {
    params: {
      bills: SerializableBill[];
    };
  };
  navigation: any;
}

export const CO2SummaryScreen: React.FC<CO2SummaryScreenProps> = ({ route, navigation }) => {
  const { bills } = route.params;

  const chartData = useMemo(() => {
    // 1. Filter bills with CO2 data
    const billsWithCo2 = bills.filter(b => b.co2Saved);

    // 2. Sort by date ascending
    billsWithCo2.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 3. Aggregate by Date (simple version: just take last 7 entries for readability)
    // For a real app, you might want to group by day/month.
    // Let's group by day.
    const groupedByDate: { [key: string]: number } = {};
    
    billsWithCo2.forEach(bill => {
      if (!bill.co2Saved) return;
      const dateStr = new Date(bill.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
      
      const match = bill.co2Saved.match(/(\d+(?:\.\d+)?)/);
      const val = match ? parseFloat(match[1]) : 0;
      
      groupedByDate[dateStr] = (groupedByDate[dateStr] || 0) + val;
    });

    const labels = Object.keys(groupedByDate);
    const data = Object.values(groupedByDate);

    // Limit to last 6 data points to fit screen
    const sliceIndex = Math.max(0, labels.length - 6);
    
    return {
      labels: labels.slice(sliceIndex),
      datasets: [
        {
          data: data.slice(sliceIndex),
        },
      ],
    };
  }, [bills]);

  const totalSaved = useMemo(() => {
    return bills.reduce((sum, bill) => {
      if (bill.co2Saved) {
        const match = bill.co2Saved.match(/(\d+(?:\.\d+)?)/);
        return sum + (match ? parseFloat(match[1]) : 0);
      }
      return sum;
    }, 0);
  }, [bills]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>CO2 Savings Summary</Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total CO2 Saved</Text>
        <Text style={styles.summaryValue}>{totalSaved.toFixed(2)} g</Text>
        <Text style={styles.summarySubtext}>Keep up the good work! 🌱</Text>
      </View>

      {chartData.labels.length > 0 ? (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Savings Trend</Text>
          <LineChart
            data={chartData}
            width={SCREEN_WIDTH - 32}
            height={220}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 2,
              color: (opacity = 1) => `rgba(46, 125, 50, ${opacity})`, // Green color
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              style: {
                borderRadius: 16,
              },
              propsForDots: {
                r: '6',
                strokeWidth: '2',
                stroke: '#2E7D32',
              },
            }}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
          />
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No CO2 data available yet.</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  summaryCard: {
    margin: 16,
    padding: 24,
    backgroundColor: '#2E7D32',
    borderRadius: 16,
    alignItems: 'center',
  },
  summaryLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    marginBottom: 8,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  summarySubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
  },
  chartContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
});
