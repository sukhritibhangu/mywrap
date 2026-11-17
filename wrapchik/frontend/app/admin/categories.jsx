import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { Plus, Trash2, Edit2 } from 'lucide-react-native';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import categoryService from '../../services/categoryService';
import COLORS from '../../constants/colors';

export default function AdminCategoriesScreen() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await categoryService.getCategories();
      if (!Array.isArray(res?.categories)) throw new Error('Category response was incomplete.');
      setCategories(res.categories); setError('');
    } catch (e) {
      console.error('[Admin Categories Fetch Error]:', e);
      setError(e.message || 'Could not load categories.');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setName('');
    setImageUrl('');
    setDisplayOrder(String(categories.length));
    setModalVisible(true);
  };

  const openEditModal = (cat) => {
    setEditingId(cat._id);
    setName(cat.name);
    setImageUrl(cat.imageUrl || '');
    setDisplayOrder(String(cat.displayOrder ?? 0));
    setModalVisible(true);
  };

  const handleSaveCategory = async () => {
    const order = Number(displayOrder);
    if (!name.trim() || !imageUrl.trim() || !Number.isInteger(order) || order < 0) {
      showMessage('Check category details', 'Name, image URL and a non-negative whole display order are required.');
      return;
    }

    const payload = {
      name: name.trim(), imageUrl: imageUrl.trim(), displayOrder: order,
    };

    try {
      setSaving(true);
      if (editingId) await categoryService.updateCategory(editingId, payload);
      else await categoryService.createCategory(payload);
      await fetchCategories();
      setModalVisible(false);
      setName('');
      setImageUrl('');
    } catch (e) {
      showMessage('Category not saved', e.message || 'Could not save this category.');
    } finally { setSaving(false); }
  };

  const showMessage = (title, text) => typeof window !== 'undefined' ? window.alert(`${title}\n\n${text}`) : Alert.alert(title, text);

  const deleteCategory = async id => {
    try { await categoryService.deleteCategory(id); setCategories(prev => prev.filter(c => c._id !== id)); }
    catch (e) { showMessage('Category not deleted', e.message || 'Deletion failed. Categories with products cannot be removed.'); }
  };

  const handleDeleteCategory = (id) => {
    if (typeof window !== 'undefined') {
      if (confirm('Are you sure you want to delete this category?')) {
        deleteCategory(id);
      }
    } else {
      Alert.alert('Delete Category', 'Are you sure you want to delete this category?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCategory(id);
          },
        },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Manage Categories" showBack showCart={false} />

      <View style={styles.topBar}>
        <Text style={styles.countText}>{categories.length} Categories</Text>
        <Button title="+ Add Category" onPress={openAddModal} style={styles.addBtn} />
      </View>
      {!!error && <TouchableOpacity onPress={fetchCategories} style={styles.error}><Text style={styles.errorText}>{error} · Tap to retry</Text></TouchableOpacity>}

      {loading ? (
        <LoadingIndicator message="Fetching categories..." />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.catCard}>
              <View><Text style={styles.catName}>{item.name}</Text><Text style={styles.orderText}>Menu order {item.displayOrder ?? 0}</Text></View>
              <View style={{flexDirection: 'row', gap: 12}}>
                <TouchableOpacity onPress={() => openEditModal(item)} style={styles.deleteBtn}>
                  <Edit2 size={18} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteCategory(item._id)} style={styles.deleteBtn}>
                  <Trash2 size={18} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Category' : 'Add Category'}</Text>
            <Input label="Category Name" value={name} onChangeText={setName} placeholder="e.g. Desserts" />
            <Input label="Image URL" value={imageUrl} onChangeText={setImageUrl} placeholder="https://..." />
            <Text style={styles.fieldLabel}>Display order</Text><TextInput value={displayOrder} onChangeText={setDisplayOrder} keyboardType="number-pad" style={styles.orderInput} />

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={() => setModalVisible(false)} style={styles.modalBtn} />
              <Button title={saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Category'} onPress={handleSaveCategory} disabled={saving} style={styles.modalBtn} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  error: { marginHorizontal: 16, marginBottom: 10, backgroundColor: COLORS.dangerLight, borderRadius: 16, padding: 10 }, errorText: { color: COLORS.danger, fontSize: 12 },
  countText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  addBtn: {
    height: 40,
    paddingHorizontal: 14,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  catCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    shadowColor: '#5A3620',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  catName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  orderText: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3 }, fieldLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 6, marginBottom: 5 }, orderInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 10, color: COLORS.textPrimary },
  deleteBtn: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  modalBtn: {
    flex: 1,
  },
});
