import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function SignupScreen() {
  const { returnTo } = useLocalSearchParams();
  return <Redirect href={{ pathname: '/(auth)/login', params: typeof returnTo === 'string' ? { returnTo } : {} }} />;
}
