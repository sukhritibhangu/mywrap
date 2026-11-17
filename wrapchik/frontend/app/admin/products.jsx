import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Switch, TouchableOpacity, Alert, Modal, ScrollView, TextInput, Image } from 'react-native';
import { Plus, Edit2, Trash2 } from 'lucide-react-native';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import productService from '../../services/productService';
import categoryService from '../../services/categoryService';
import COLORS from '../../constants/colors';

export default function AdminProductsScreen() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [categoryId, setCategoryId] = useState('');
  const [isVeg, setIsVeg] = useState(true);
  const [available, setAvailable] = useState(true);
  const [addons, setAddons] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  // Form modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const [res, catRes] = await Promise.all([productService.getProducts(), categoryService.getCategories()]);
      if (!Array.isArray(res?.products) || !Array.isArray(catRes?.categories)) throw new Error('Menu data response was incomplete.');
      setProducts(res.products);
      setCategories(catRes.categories);
      setLoadError('');
    } catch (e) {
      console.error('[Admin Products Fetch Error]:', e);
      setLoadError(e.message || 'Could not load the menu. Refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAvailability = async (id, currentVal) => {
    setBusyId(id);
    try {
      const result = await productService.toggleAvailability(id, !currentVal);
      const next = typeof result?.available === 'boolean' ? result.available : !currentVal;
      setProducts(prev => prev.map(p => p._id === id ? { ...p, available: next } : p));
    } catch (e) {
      showMessage('Availability not changed', e.message || 'Could not update availability.');
    } finally { setBusyId(null); }
  };

  const showMessage = (title, message) => typeof window !== 'undefined' ? window.alert(`${title}\n\n${message}`) : Alert.alert(title, message);

  const deleteProduct = async id => {
    setBusyId(id);
    try {
      await productService.deleteProduct(id);
      setProducts(prev => prev.filter(p => p._id !== id));
    } catch (e) { showMessage('Product not deleted', e.message || 'Could not delete this product.'); }
    finally { setBusyId(null); }
  };

  const handleDeleteProduct = (id) => {
    if (typeof window !== 'undefined') {
      if (confirm('Are you sure you want to delete this product from menu?')) {
        deleteProduct(id);
      }
    } else {
      Alert.alert('Delete Product', 'Are you sure you want to delete this product from menu?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteProduct(id);
          },
        },
      ]);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setName('');
    setPrice('');
    setDescription('');
    setImageUrl('');
    setCategoryId(categories[0]?._id || ''); setIsVeg(true); setAvailable(true); setAddons('');
    setModalVisible(true);
  };

  const openEditModal = (product) => {
    setEditingId(product._id);
    setName(product.name);
    setPrice(product.price.toString());
    setDescription(product.description);
    setImageUrl(product.imageUrl);
    setCategoryId(typeof product.categoryId === 'object' ? product.categoryId?._id : product.categoryId || '');
    setIsVeg(product.isVeg !== false); setAvailable(product.available !== false);
    setAddons((product.customizations || []).map(option => `${option.name}:${option.price}`).join('\n'));
    setModalVisible(true);
  };

  const handleSaveProduct = async () => {
    if (!name.trim() || price === '' || !Number.isFinite(Number(price)) || Number(price) < 0 || !description.trim() || !imageUrl.trim() || !categoryId) {
      showMessage('Check product details', 'Name, non-negative price, description, image URL and a backend category are required.');
      return;
    }

    let customizations;
    try {
      customizations = addons.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
        const [optionName, optionPrice] = line.split(':');
        if (!optionName?.trim() || optionPrice === undefined || !Number.isFinite(Number(optionPrice)) || Number(optionPrice) < 0) throw new Error('Enter each add-on as Name:price, one per line.');
        return { name: optionName.trim(), price: Number(optionPrice) };
      });
    } catch (e) { showMessage('Check add-ons', e.message); return; }

    const payload = {
      name: name.trim(),
      price: Number(price),
      description: description.trim(),
      imageUrl: imageUrl.trim(),
      categoryId, isVeg, available, customizations,
    };

    try {
      setSaving(true);
      if (editingId) await productService.updateProduct(editingId, payload);
      else await productService.createProduct(payload);
      await fetchProducts();
      setModalVisible(false);
    } catch (e) {
      showMessage('Product not saved', e.message || 'Could not save product.');
    } finally { setSaving(false); }
  };

  const visibleProducts = products.filter(p => `${p.name} ${p.description}`.toLowerCase().includes(search.toLowerCase()) && (categoryFilter === 'ALL' || (typeof p.categoryId === 'object' ? p.categoryId?._id : p.categoryId) === categoryFilter));

  return (
    <View style={styles.container}>
      <Header title="Product Inventory" showBack showCart={false} />

      <View style={styles.topBar}>
        <Text style={styles.countText}>{products.length} menu items</Text>
        <Button title="+ Add Product" onPress={openAddModal} style={styles.addBtn} />
      </View>

      <View style={styles.filters}><TextInput value={search} onChangeText={setSearch} placeholder="Search menu" style={styles.searchInput} /><ScrollView horizontal showsHorizontalScrollIndicator={false}>{[['ALL', 'All'], ...categories.map(c => [c._id, c.name])].map(([id, label]) => <TouchableOpacity key={id} onPress={() => setCategoryFilter(id)} style={[styles.chip, categoryFilter === id && styles.chipActive]}><Text style={[styles.chipText, categoryFilter === id && styles.chipTextActive]}>{label}</Text></TouchableOpacity>)}</ScrollView></View>

      {!!loadError && <TouchableOpacity style={styles.errorBanner} onPress={fetchProducts}><Text style={styles.errorText}>{loadError} · Tap to retry</Text></TouchableOpacity>}

      {loading ? (
        <LoadingIndicator message="Loading menu inventory..." />
      ) : (
        <FlatList
          data={visibleProducts}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.productCard}>
              {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.productImage} /> : null}
              <View style={styles.cardInfo}>
                <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.price}>₹{item.price}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {typeof item.categoryId === 'object' ? item.categoryId?.name : 'Menu item'} · {item.isVeg === false ? 'Non-veg' : 'Veg'}
                </Text>
                <Text style={styles.desc} numberOfLines={1}>
                  {item.description}
                </Text>
              </View>

              <View style={styles.cardActions}>
                <Switch
                  value={item.available === true}
                  disabled={busyId === item._id}
                  onValueChange={() => handleToggleAvailability(item._id, item.available)}
                  trackColor={{ false: COLORS.surfaceMuted, true: COLORS.primaryLight }}
                  thumbColor={item.available ? COLORS.primary : COLORS.cocoaMuted}
                  style={styles.availabilitySwitch}
                  accessibilityLabel={`${item.name} availability`}
                />

                <View style={{flexDirection: 'row', gap: 10, marginTop: 4}}>
                  <TouchableOpacity
                    onPress={() => openEditModal(item)}
                    style={styles.deleteBtn}
                  >
                    <Edit2 size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteProduct(item._id)}
                    style={styles.deleteBtn}
                  >
                    <Trash2 size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* Add / Edit Product Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Product' : 'Add New Menu Item'}</Text>

            <ScrollView style={styles.formScroll}>
              <Input label="Product Name" value={name} onChangeText={setName} placeholder="e.g. Paneer Wrap" />
              <Input label="Price (₹)" value={price} onChangeText={setPrice} placeholder="e.g. 120" keyboardType="numeric" />
              <Input label="Description" value={description} onChangeText={setDescription} placeholder="Description of ingredients..." />
              <Input label="Image URL" value={imageUrl} onChangeText={setImageUrl} placeholder="https://..." />
              <Text style={styles.formLabel}>Category (required)</Text>
              <View style={styles.categoryChoices}>{categories.map(category => <TouchableOpacity key={category._id} onPress={() => setCategoryId(category._id)} style={[styles.chip, categoryId === category._id && styles.chipActive]}><Text style={[styles.chipText, categoryId === category._id && styles.chipTextActive]}>{category.name}</Text></TouchableOpacity>)}</View>
              <View style={styles.formSwitch}><Text style={styles.formLabel}>Vegetarian</Text><Switch value={isVeg} onValueChange={setIsVeg} /></View>
              <View style={styles.formSwitch}><Text style={styles.formLabel}>Available to order</Text><Switch value={available} onValueChange={setAvailable} /></View>
              <Text style={styles.formLabel}>Add-ons · one per line as Name:price</Text>
              <TextInput value={addons} onChangeText={setAddons} multiline placeholder={'Extra cheese:20\nJalapeños:15'} style={styles.addonsInput} />
            </ScrollView>

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={() => setModalVisible(false)} style={styles.modalBtn} />
              <Button title={saving ? 'Saving…' : editingId ? "Save Changes" : "Save Product"} onPress={handleSaveProduct} disabled={saving} style={styles.modalBtn} />
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
  filters: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  searchInput: { backgroundColor: COLORS.cardBackground, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.textPrimary },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardBackground, marginRight: 6 },
  chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary }, chipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '700' }, chipTextActive: { color: '#fff' },
  errorBanner: { marginHorizontal: 16, marginBottom: 10, backgroundColor: COLORS.dangerLight, borderRadius: 16, padding: 11 }, errorText: { color: COLORS.danger, fontSize: 12 },
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
    paddingBottom: 24,
  },
  productCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    padding: 14,
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
  productImage: { width: 56, height: 56, borderRadius: 14, marginRight: 11, backgroundColor: COLORS.surfaceMuted },
  cardInfo: {
    flex: 1,
    marginRight: 10,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  price: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginTop: 3,
  },
  meta: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.cocoaMuted,
    marginTop: 1,
  },
  desc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  cardActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  availabilitySwitch: {
    transform: [{ scale: 0.86 }],
    marginRight: -4,
  },
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
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  formScroll: {
    marginBottom: 16,
  },
  formLabel: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 8, marginBottom: 6 },
  categoryChoices: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  formSwitch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  addonsInput: { minHeight: 74, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 10, color: COLORS.textPrimary, textAlignVertical: 'top' },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
  },
});
