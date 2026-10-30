import React, {
  useState,
  useContext,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';

import { useRouter } from 'expo-router';

import { AuthContext } from '../../context/AuthContext';

import Input from '../../components/common/Input';
import Button from '../../components/common/Button';

import COLORS from '../../constants/colors';

export default function SignupScreen() {
  const router = useRouter();

  const {
    register,
    isLoading,
  } = useContext(AuthContext);

  const [name, setName] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [phone, setPhone] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [errors, setErrors] =
    useState({});

  const validate = () => {
    const err = {};

    if (!name.trim()) {
      err.name =
        'Name is required';
    }

    if (!email.includes('@')) {
      err.email =
        'Enter a valid email';
    }

    if (
      phone
        .replace(/\D/g, '')
        .length !== 10
    ) {
      err.phone =
        'Enter a valid 10 digit phone number';
    }

    if (
      !/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(
        password
      )
    ) {
      err.password =
        '8+ characters with a letter and number';
    }

    if (
      password !==
      confirmPassword
    ) {
      err.confirmPassword =
        'Passwords do not match';
    }

    setErrors(err);

    return (
      Object.keys(err)
        .length === 0
    );
  };

  const handleSignup = async () => {
    if (!validate()) {
      return;
    }

    const result =
      await register(
        name,
        email,
        phone,
        password
      );

    if (!result.success) {
      setErrors({ form: result.message || 'Unable to create account' });
      return;
    }

    router.replace('/(auth)/login');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={
        styles.content
      }
    >
      <Text style={styles.brand}>
        WRAPCHIK
      </Text>

      <Text style={styles.title}>
        Create your account
      </Text>

      <Text style={styles.subtitle}>
        Order your campus food
        in seconds
      </Text>

      <Input
        label="Full Name"
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        error={errors.name}
      />

      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        error={errors.email}
      />

      <Input
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        placeholder="9876543210"
        keyboardType="phone-pad"
        error={errors.phone}
      />

      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="8+ characters"
        secureTextEntry
        error={errors.password}
      />

      <Input
        label="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Repeat password"
        secureTextEntry
        error={errors.confirmPassword}
      />

      {errors.form ? <Text style={{ color: COLORS.danger }}>{errors.form}</Text> : null}

      <Button
        title="Create Account"
        onPress={handleSignup}
        loading={isLoading}
        style={{
          marginTop: 10,
        }}
      />

      <Text style={styles.loginText}>
        Already have an account?
      </Text>

      <Button
        title="Sign In"
        variant="outline"
        onPress={() =>
          router.push(
            '/(auth)/login'
          )
        }
        style={{
          marginTop: 10,
        }}
      />
    </ScrollView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        '#FFFFFF',
    },

    content: {
      padding: 24,
      paddingTop: 70,
    },

    brand: {
      fontSize: 32,
      fontWeight: '900',
      color: COLORS.primary,
      marginBottom: 20,
    },

    title: {
      fontSize: 28,
      fontWeight: '900',
      color: COLORS.textPrimary,
    },

    subtitle: {
      marginTop: 6,
      marginBottom: 30,
      color: COLORS.textSecondary,
    },

    loginText: {
      textAlign: 'center',
      marginTop: 25,
      color: COLORS.textSecondary,
    },
  });