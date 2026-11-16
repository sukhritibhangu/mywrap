import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from './AuthContext';

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const { user, isLoading: authLoading } = useContext(AuthContext);
  const storageKey = user?._id ? `wrapchik_cart_items:${user._id}` : 'wrapchik_cart_items';
  const [cartItems, setCartItems] = useState([]);
  const [loadedStorageKey, setLoadedStorageKey] = useState(null);

  // Keep carts isolated by signed-in account. The legacy guest cart remains intact.
  useEffect(() => {
    let active = true;
    setLoadedStorageKey(null);
    setCartItems([]);
    if (authLoading) return () => { active = false; };

    AsyncStorage.getItem(storageKey)
      .then((storedCart) => {
        if (!active) return;
        if (!storedCart) return setCartItems([]);
        const parsed = JSON.parse(storedCart);
        setCartItems(Array.isArray(parsed) ? parsed : []);
      })
      .catch((error) => {
        console.error('[CartContext Error] Failed to load cached cart:', error);
        if (active) setCartItems([]);
      })
      .finally(() => {
        if (active) setLoadedStorageKey(storageKey);
      });

    return () => { active = false; };
  }, [authLoading, storageKey]);

  useEffect(() => {
    if (loadedStorageKey !== storageKey) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(cartItems)).catch((error) => {
      console.error('[CartContext Error] Failed to cache cart:', error);
    });
  }, [cartItems, loadedStorageKey, storageKey]);

  // Add item to cart with customization matching
  const addToCart = (product, selectedCustomizations = [], quantity = 1) => {
    setCartItems((prevItems) => {
      // Calculate unit price with customizations
      const custPrice = selectedCustomizations.reduce((sum, c) => sum + c.price, 0);
      const unitPrice = product.price + custPrice;

      // Unique cart key based on product ID & customization signatures
      const custKey = selectedCustomizations
        .map((c) => c.name)
        .sort()
        .join('|');
      const itemKey = `${product._id}_${custKey}`;

      const existingIndex = prevItems.findIndex((item) => item.cartKey === itemKey);

      if (existingIndex > -1) {
        const updated = [...prevItems];
        updated[existingIndex].quantity += quantity;
        return updated;
      } else {
        return [
          ...prevItems,
          {
            cartKey: itemKey,
            productId: product._id,
            name: product.name,
            basePrice: product.price,
            unitPrice,
            quantity,
            imageUrl: product.imageUrl,
            isVeg: product.isVeg,
            customizations: selectedCustomizations,
          },
        ];
      }
    });
  };

  // Update item quantity
  const updateQuantity = (cartKey, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(cartKey);
      return;
    }

    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.cartKey === cartKey ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  // Remove single item from cart
  const removeFromCart = (cartKey) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.cartKey !== cartKey));
  };

  // Clear entire cart
  const clearCart = async () => {
    setCartItems([]);
    try {
      await AsyncStorage.removeItem(storageKey);
    } catch (e) {
      console.error('[CartContext Error] Failed to clear cached cart:', e);
    }
  };

  // Calculations
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const taxAndFees = Math.round(subtotal * 0.05); // 5% GST
  const grandTotal = subtotal + taxAndFees;

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCount,
        subtotal,
        taxAndFees,
        grandTotal,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
