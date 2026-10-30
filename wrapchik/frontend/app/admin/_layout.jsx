import React, { useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { AuthContext } from '../../context/AuthContext';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import Button from '../../components/common/Button';
import COLORS from '../../constants/colors';

export default function AdminLayout() {
  const { isLoading, isAuthenticated, isAdmin, user, logout } = useContext(AuthContext);
  const router = useRouter();
  if (isLoading) return <LoadingIndicator message="Checking your account..." />;
  if (!isAuthenticated || !isAdmin) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Admin sign-in required</Text>
        <Text style={styles.message}>{isAuthenticated
          ? 'You are signed in as ' + (user?.name || 'a student') + '. Student accounts cannot view all orders or change shop settings.'
          : 'Sign in with a shopkeeper admin account to manage orders and shop settings.'}</Text>
        <Button title="Sign in as admin" onPress={async () => { await logout(); router.replace('/(auth)/login'); }} />
        {isAuthenticated && <Button title="Back to my orders" variant="outline" style={{marginTop:12}} onPress={() => router.replace('/(tabs)/orders')} />}
      </View>
    );
  }
  return <Stack screenOptions={{headerShown:false}} />;
}
const styles=StyleSheet.create({
  container:{flex:1,justifyContent:'center',padding:24,backgroundColor:COLORS.background},
  title:{fontSize:24,fontWeight:'800',color:COLORS.textPrimary,marginBottom:12},
  message:{fontSize:16,color:COLORS.textSecondary,marginBottom:24,lineHeight:24},
});
