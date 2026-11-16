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
      <View style={styles.actions}><TouchableOpacity style={styles.secondary} onPress={() => openForm(item)}><Pencil size={15} color="#525A62"/><Text style={styles.secondaryText}>Edit details</Text></TouchableOpacity><TouchableOpacity disabled={!!item.currentOrderId} onPress={() => updateStatus(item)} style={[styles.secondary, !!item.currentOrderId && { opacity: .45 }]}><Text style={styles.secondaryText}>{item.status === 'AVAILABLE' ? 'Mark occupied' : 'Mark available'}</Text></TouchableOpacity></View>
    </View>} />}
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.modalTitle}>{editing ? 'Edit table' : 'Add table'}</Text><Text style={styles.label}>Table number</Text><TextInput value={number} onChangeText={setNumber} editable={!editing} keyboardType="number-pad" style={[styles.input, editing && styles.disabled]} placeholder="e.g. 1"/><Text style={styles.label}>Display label</Text><TextInput value={label} onChangeText={setLabel} style={styles.input} placeholder="e.g. Window table"/><Text style={styles.label}>Seat capacity</Text><TextInput value={capacity} onChangeText={setCapacity} keyboardType="number-pad" style={styles.input} placeholder="4"/><View style={styles.modalActions}><Button title="Cancel" variant="outline" onPress={() => setVisible(false)} style={{ flex: 1 }}/><Button title={saving ? 'Saving…' : editing ? 'Save changes' : 'Create table'} onPress={save} disabled={saving} style={{ flex: 1 }}/></View></View></View></Modal>
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#F6F4F1' }, intro: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, eyebrow: { color: '#89776A', fontSize: 10, letterSpacing: 1, fontWeight: '800' }, title: { color: '#252B33', fontWeight: '900', fontSize: 22, marginTop: 4 }, addButton: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }, addText: { color: '#fff', fontWeight: '800', fontSize: 12 }, list: { padding: 16, paddingTop: 0, gap: 10 }, card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8E4DE', borderRadius: 10, padding: 14 }, cardHead: { flexDirection: 'row', alignItems: 'center', gap: 11 }, tableIcon: { width: 38, height: 38, borderRadius: 8, backgroundColor: '#FFF0EB', alignItems: 'center', justifyContent: 'center' }, tableTitle: { fontSize: 15, color: '#2D333B', fontWeight: '900' }, tableMeta: { fontSize: 12, color: '#7A8188', marginTop: 3 }, linked: { color: '#A85D12', backgroundColor: '#FFF4DF', padding: 8, borderRadius: 6, fontSize: 11, marginTop: 11 }, actions: { borderTopWidth: 1, borderTopColor: '#EFECE8', marginTop: 12, paddingTop: 10, flexDirection: 'row', gap: 8 }, secondary: { borderWidth: 1, borderColor: '#DEDAD4', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }, secondaryText: { color: '#4F565E', fontSize: 11, fontWeight: '800' }, overlay: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(20,22,24,.5)' }, modal: { backgroundColor: '#fff', borderRadius: 12, padding: 18, maxWidth: 500, width: '100%', alignSelf: 'center' }, modalTitle: { color: '#252B33', fontSize: 18, fontWeight: '900', marginBottom: 10 }, label: { color: '#626970', fontSize: 12, fontWeight: '700', marginTop: 9, marginBottom: 5 }, input: { borderWidth: 1, borderColor: '#DDD9D3', borderRadius: 8, padding: 11, color: '#252B33' }, disabled: { backgroundColor: '#F3F2F0' }, modalActions: { flexDirection: 'row', gap: 8, marginTop: 17 }, error: { marginHorizontal: 16, backgroundColor: '#FCEBE8', padding: 10, borderRadius: 8 }, errorText: { color: '#97372B', fontSize: 12 } });
