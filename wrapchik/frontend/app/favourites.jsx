import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Heart } from 'lucide-react-native';
import Header from '../components/common/Header';
import ProductCard from '../components/product/ProductCard';
import EmptyState from '../components/common/EmptyState';
import LoadingIndicator from '../components/common/LoadingIndicator';
import ErrorState from '../components/common/ErrorState';
import COLORS from '../constants/colors';
import favouriteService from '../services/favouriteService';
import { AuthContext } from '../context/AuthContext';

export default function FavouritesScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useContext(AuthContext);
  const [favourites, setFavourites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const fetchFavourites = async () => {
    try {
      const response = await favouriteService.getFavourites();
      if (!response?.success || !Array.isArray(response.favourites)) throw new Error('Favourites could not be loaded.');
      setFavourites(response.favourites);
      setError(false);
    } catch (error) {
      console.warn('Failed to fetch favourites:', error);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) fetchFavourites();
  }, [authLoading, user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFavourites();
  };

  const handleRemoveFavourite = async (productId) => {
    try {
      const response = await favouriteService.removeFavourite(productId);
      if (!response?.success) throw new Error(response?.message || 'The item was not removed.');
      setFavourites(prev => prev.filter(item => item._id !== productId));
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to remove from favourites');
    }
  };

  return (
    <View style={styles.container}>
      <Header title="My Favourites" showBack showCart={false} />

      {authLoading ? (
        <LoadingIndicator message="Restoring your session…" />
      ) : !user ? (
        <EmptyState title="Sign in to view favourites" message="Your saved foods are linked to your Wrapchik account." buttonTitle="Sign in" onButtonPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: 'favourites' } })} />
      ) : loading && !refreshing ? (
        <LoadingIndicator message="Loading your saved items…" />
      ) : error ? (
        <ErrorState title="Could not load favourites" message="Your saved items are still safe. Try again." onRetry={onRefresh} retrying={refreshing} />
      ) : favourites.length === 0 ? (
        <EmptyState
          title="No Favourites Saved"
          message="Heart your favourite food items to save them here for quick re-ordering."
          buttonTitle="Explore Menu"
          onButtonPress={() => router.push('/(tabs)/home')}
        />
      ) : (
        <FlatList
          data={favourites}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
          renderItem={({ item }) => (
            <View style={styles.itemContainer}>
              <ProductCard
                product={item}
                showFavourite={false}
                onPress={() => router.push(`/product/${item._id}`)}
              />
              <TouchableOpacity
                style={styles.heartButton}
                onPress={() => handleRemoveFavourite(item._id)}
              >
                <Heart size={20} color={COLORS.primary} fill={COLORS.primary} />
              </TouchableOpacity>
            </View>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
  },
  itemContainer: {
    position: 'relative',
  },
  heartButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    padding: 6,
    zIndex: 10,
  }
});
