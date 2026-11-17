import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { Plus, Pencil, Utensils } from 'lucide-react-native';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import tableService from '../../services/tableService';
import COLORS from '../../constants/colors';

const message = (title, text) => typeof window !== 'undefined' ? window.alert(`${title}\n\n${text}`) : Alert.alert(title, text);

export default function AdminTablesScreen() {
  const [tables, setTables] = useState([]); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState('');
  const [visible, setVisible] = useState(false); const [editing, setEditing] = useState(null); const [number, setNumber] = useState(''); const [label, setLabel] = useState(''); const [capacity, setCapacity] = useState('4'); const [saving, setSaving] = useState(false);
  const fetchTables = useCallback(async () => {
    try { const res = await tableService.getTables(); if (!Array.isArray(res?.tables)) throw new Error('Table data response was incomplete.'); setTables(res.tables); setError(''); }
    catch (e) { setError(e.message || 'Could not load tables.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { fetchTables(); }, [fetchTables]);
  const openForm = table => { setEditing(table || null); setNumber(table ? String(table.tableNumber) : ''); setLabel(table?.label || ''); setCapacity(String(table?.capacity || 4)); setVisible(true); };
  const save = async () => {
    const tableNo = Number(number), seats = Number(capacity);
    if (!Number.isInteger(tableNo) || tableNo < 1 || !Number.isInteger(seats) || seats < 1 || seats > 50) return message('Check table details', 'Enter a positive whole table number and capacity from 1 to 50.');
    setSaving(true);
    try { if (editing) await tableService.updateTable(editing._id, { label: label.trim(), capacity: seats }); else await tableService.createTable({ tableNumber: tableNo, label: label.trim(), capacity: seats }); await fetchTables(); setVisible(false); }
    catch (e) { message('Table not saved', e.message || 'Could not save this table.'); }
    finally { setSaving(false); }
  };
  const updateStatus = async table => {
    if (table.currentOrderId) return message('Active order', 'This table status follows its active dine-in order and cannot be manually changed.');
    const next = table.status === 'AVAILABLE' ? 'OCCUPIED' : 'AVAILABLE';
    try { await tableService.updateTable(table._id, { status: next }); await fetchTables(); }
    catch (e) { message('Status not changed', e.message || 'Could not update table status.'); }
  };
  if (loading) return <LoadingIndicator message="Loading tables…" />;
  return <View style={styles.container}>
    <Header title="Dine-in tables" showBack showCart={false} />
    <View style={styles.intro}><View><Text style={styles.eyebrow}>OUTLET OPERATIONS</Text><Text style={styles.title}>Table management</Text></View><TouchableOpacity style={styles.addButton} onPress={() => openForm(null)}><Plus size={16} color="#fff"/><Text style={styles.addText}>Add table</Text></TouchableOpacity></View>
    {!!error && <TouchableOpacity onPress={fetchTables} style={styles.error}><Text style={styles.errorText}>{error} · Tap to retry</Text></TouchableOpacity>}
    {tables.length === 0 ? <EmptyState title="No tables configured" message="Add the outlet’s existing dine-in tables here. This does not alter menu or order data." buttonTitle="Add table" onButtonPress={() => openForm(null)} /> : <FlatList data={tables} keyExtractor={item => item._id} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTables(); }} colors={[COLORS.primary]} />} renderItem={({ item }) => <View style={styles.card}>
      <View style={styles.cardHead}><View style={styles.tableIcon}><Utensils size={18} color={COLORS.primary}/></View><View style={{ flex: 1 }}><Text style={styles.tableTitle}>{item.label || `Table ${item.tableNumber}`}</Text><Text style={styles.tableMeta}>Table {item.tableNumber} · seats {item.capacity || 4}</Text></View><StatusBadge status={item.status}/></View>
      {item.currentOrderId ? <Text style={styles.linked}>Linked to active dine-in order</Text> : null}
      <View style={styles.actions}><TouchableOpacity style={styles.secondary} onPress={() => openForm(item)}><Pencil size={15} color={COLORS.textSecondary}/><Text style={styles.secondaryText}>Edit details</Text></TouchableOpacity><TouchableOpacity disabled={!!item.currentOrderId} onPress={() => updateStatus(item)} style={[styles.secondary, !!item.currentOrderId && { opacity: .45 }]}><Text style={styles.secondaryText}>{item.status === 'AVAILABLE' ? 'Mark occupied' : 'Mark available'}</Text></TouchableOpacity></View>
    </View>} />}
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.modalTitle}>{editing ? 'Edit table' : 'Add table'}</Text><Text style={styles.label}>Table number</Text><TextInput value={number} onChangeText={setNumber} editable={!editing} keyboardType="number-pad" style={[styles.input, editing && styles.disabled]} placeholder="e.g. 1"/><Text style={styles.label}>Display label</Text><TextInput value={label} onChangeText={setLabel} style={styles.input} placeholder="e.g. Window table"/><Text style={styles.label}>Seat capacity</Text><TextInput value={capacity} onChangeText={setCapacity} keyboardType="number-pad" style={styles.input} placeholder="4"/><View style={styles.modalActions}><Button title="Cancel" variant="outline" onPress={() => setVisible(false)} style={{ flex: 1 }}/><Button title={saving ? 'Saving…' : editing ? 'Save changes' : 'Create table'} onPress={save} disabled={saving} style={{ flex: 1 }}/></View></View></View></Modal>
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: COLORS.cream }, intro: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, eyebrow: { color: COLORS.goldDeep, fontSize: 10, letterSpacing: 1, fontWeight: '800' }, title: { color: COLORS.textPrimary, fontWeight: '900', fontSize: 22, marginTop: 4 }, addButton: { backgroundColor: COLORS.primary, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }, addText: { color: '#fff', fontWeight: '800', fontSize: 12 }, list: { padding: 16, paddingTop: 0, gap: 10 }, card: { backgroundColor: COLORS.cardBackground, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 14, shadowColor: '#5A3620', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 2 }, cardHead: { flexDirection: 'row', alignItems: 'center', gap: 11 }, tableIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' }, tableTitle: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '900' }, tableMeta: { fontSize: 12, color: COLORS.cocoaMuted, marginTop: 3 }, linked: { color: COLORS.warning, backgroundColor: COLORS.warningLight, padding: 9, borderRadius: 12, fontSize: 11, marginTop: 11, lineHeight: 16 }, actions: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 12, paddingTop: 10, flexDirection: 'row', gap: 8 }, secondary: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.inputBackground }, secondaryText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '800' }, overlay: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: COLORS.overlay }, modal: { backgroundColor: COLORS.cardBackground, borderRadius: 24, padding: 18, maxWidth: 500, width: '100%', alignSelf: 'center', borderWidth: 1, borderColor: COLORS.border }, modalTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '900', marginBottom: 10 }, label: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 9, marginBottom: 5 }, input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 11, color: COLORS.textPrimary, backgroundColor: COLORS.inputBackground }, disabled: { backgroundColor: COLORS.surfaceMuted }, modalActions: { flexDirection: 'row', gap: 8, marginTop: 17 }, error: { marginHorizontal: 16, backgroundColor: COLORS.dangerLight, padding: 10, borderRadius: 8 }, errorText: { color: COLORS.danger, fontSize: 12 } });
