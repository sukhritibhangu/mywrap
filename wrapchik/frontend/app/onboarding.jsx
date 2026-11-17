import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import COLORS from '../constants/colors';
import Button from '../components/common/Button';
import Wrapoo from '../components/wrapoo/Wrapoo';

const SLIDES = [
  {
    wrapoo: 'cheer',
    title: 'Meet your little food companion',
    desc: 'Wrapoo knows the menu, celebrates your cravings and follows every order along the way.',
  },
  {
    wrapoo: 'happy',
    title: 'Skip the counter queue',
    desc: 'Fresh wraps, burgers, fries and cold coffee — ordered in a few happy taps.',
  },
  {
    wrapoo: 'tracking',
    title: 'Follow the cooking magic',
    desc: 'Watch your order travel from “received” to “ready”, then collect it hot at the counter.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      router.replace('/(auth)/login');
    }
  };

  const handleSkip = () => {
    router.replace('/(auth)/login');
  };

  const slide = SLIDES[currentSlide];

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Wrapoo size={132} mood={slide.wrapoo} />
        </View>

        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.desc}>{slide.desc}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentSlide && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <Button
          title={currentSlide === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          onPress={handleNext}
          style={styles.nextBtn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 24,
    justifyContent: 'space-between',
  },
  skipBtn: {
    alignSelf: 'flex-end',
    paddingTop: 20,
    paddingHorizontal: 8,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  iconCircle: {
    minHeight: 170,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  desc: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    marginBottom: 20,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  dotActive: {
    width: 24,
    backgroundColor: COLORS.primary,
  },
  nextBtn: {
    width: '100%',
  },
});
