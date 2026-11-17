import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Text, TouchableOpacity, Alert } from 'react-native';
import Header from '../../components/common/Header';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import EmptyState from '../../components/common/EmptyState';
import api from '../../services/api';
import COLORS from '../../constants/colors';

export default function AdminIssuesScreen() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchIssues = async () => {
    try {
      const res = await api.get('/admin/issues');
      if (res.success) {
        setIssues(res.issues || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchIssues();
  };

  const handleResolve = (id) => {
    Alert.prompt(
      'Resolve Issue',
      'Enter resolution summary:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Resolve', 
          onPress: async (resolution) => {
            try {
              const res = await api.put(`/admin/issues/${id}/resolve`, { adminResponse: resolution, resolution });
              if (res.success) {
                Alert.alert('Success', 'Issue marked as resolved.');
                fetchIssues();
              }
            } catch (e) {
              Alert.alert('Error', 'Failed to resolve issue.');
            }
          }
        }
      ],
      'plain-text'
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Manage Issues" showBack showCart={false} />

      {loading ? (
        <LoadingIndicator message="Loading issues..." />
      ) : issues.length === 0 ? (
        <EmptyState title="No Issues" message="There are no reported issues." />
      ) : (
        <FlatList
          data={issues}
          keyExtractor={item => item._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          renderItem={({ item }) => (
            <View style={styles.issueCard}>
              <View style={styles.header}>
                <Text style={styles.orderNo}>Order #{item.orderId?.orderNumber || item.orderId?._id || item.orderId}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.category}</Text>
                </View>
                <View style={[styles.badge, item.status === 'RESOLVED' ? styles.resolvedBadge : styles.openBadge]}>
                  <Text style={[styles.badgeText, item.status === 'RESOLVED' ? styles.resolvedText : styles.openText]}>{item.status}</Text>
                </View>
              </View>
              
              <Text style={styles.desc}>{item.description}</Text>
              
              {item.status !== 'RESOLVED' && (
                <TouchableOpacity style={styles.resolveBtn} onPress={() => handleResolve(item._id)}>
                  <Text style={styles.resolveBtnText}>Resolve</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: 16 },
  issueCard: { backgroundColor: COLORS.cardBackground, padding: 16, borderRadius: 18, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#5A3620', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 2 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  orderNo: { fontWeight: 'bold', fontSize: 16, flex: 1 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: COLORS.surfaceMuted },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  openBadge: { backgroundColor: COLORS.warningLight },
  openText: { color: COLORS.warning },
  resolvedBadge: { backgroundColor: COLORS.successLight },
  resolvedText: { color: COLORS.success },
  desc: { color: COLORS.textSecondary, marginBottom: 12 },
  resolveBtn: { backgroundColor: COLORS.primary, paddingVertical: 11, borderRadius: 999, alignItems: 'center' },
  resolveBtnText: { color: '#fff', fontWeight: 'bold' }
});
