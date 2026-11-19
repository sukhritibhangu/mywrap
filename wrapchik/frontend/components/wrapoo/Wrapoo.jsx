import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import COLORS from '../../constants/colors';
import useReducedMotion from '../../hooks/useReducedMotion';

/**
 * Wrapoo — a tiny smiling wrap with expressive eyes, little arms and a
 * floating chef's hat. Drawn from scratch as vectors so it stays crisp and
 * light on campus data connections. All motion is decorative and optional.
 */
const HAT_W = 46;

function Hat({ size }) {
  const hatWidth = size * (HAT_W / 120);
  return (
    <Svg width={hatWidth} height={hatWidth * 0.92} viewBox="0 0 46 42" fill="none">
      <Path d="M8 34h30v6.5a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V34Z" fill="#FFF9EA" stroke={COLORS.cocoa} strokeWidth="2" strokeLinejoin="round" />
      <Path d="M12 34c-4.4 0-8-3.4-8-7.6 0-3.7 2.8-6.8 6.4-7.4.4-5.3 4.8-9.5 10.2-9.5 3.8 0 7.1 2 8.9 5 1-.5 2.2-.8 3.5-.8 4.4 0 8 3.6 8 8 0 .6-.1 1.2-.2 1.8C43.6 24.4 45.5 27 45.5 30c0 2.6-1.3 4-2.9 4H12Z" fill="#FFFDF8" stroke={COLORS.cocoa} strokeWidth="2" strokeLinejoin="round" />
      <Path d="M8 34.5a2.5 2.5 0 0 1 2.5-2.5h25a2.5 2.5 0 0 1 2.5 2.5V36H8v-1.5Z" fill={COLORS.gold} />
      <Path d="m23 34.3.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L20.1 36.4l2-.3.9-1.8Z" fill="#FFF6DC" />
    </Svg>
  );
}

function Eyes({ mood, blink }) {
  const ink = COLORS.cocoa;
  if (blink) {
    return (
      <G>
        <Path d="M43 73q4 3 8 0" stroke={ink} strokeWidth="3.2" strokeLinecap="round" fill="none" />
        <Path d="M69 73q4 3 8 0" stroke={ink} strokeWidth="3.2" strokeLinecap="round" fill="none" />
      </G>
    );
  }
  if (mood === 'cheer' || mood === 'happy') {
    return (
      <G>
        <Path d="M42.5 75q4.5-6 9 0" stroke={ink} strokeWidth="3.4" strokeLinecap="round" fill="none" />
        <Path d="M68.5 75q4.5-6 9 0" stroke={ink} strokeWidth="3.4" strokeLinecap="round" fill="none" />
      </G>
    );
  }
  if (mood === 'tracking') {
    return (
      <G>
        <Ellipse cx="47" cy="72" rx="5.2" ry="6" fill={ink} />
        <Ellipse cx="73" cy="72" rx="5.2" ry="6" fill={ink} />
        <Circle cx="48.8" cy="70" r="1.7" fill="#FFFDF8" />
        <Circle cx="74.8" cy="70" r="1.7" fill="#FFFDF8" />
      </G>
    );
  }
  return (
    <G>
      <Ellipse cx="47" cy="72" rx="5" ry="6.4" fill={ink} />
      <Ellipse cx="73" cy="72" rx="5" ry="6.4" fill={ink} />
      <Circle cx="48.8" cy="69.8" r="1.8" fill="#FFFDF8" />
      <Circle cx="74.8" cy="69.8" r="1.8" fill="#FFFDF8" />
      <Circle cx="45.6" cy="74.3" r="1" fill="#FFFDF8" opacity="0.7" />
      <Circle cx="71.6" cy="74.3" r="1" fill="#FFFDF8" opacity="0.7" />
    </G>
  );
}

function Mouth({ mood }) {
  if (mood === 'cheer') {
    return <Path d="M53 84q7 10 14 0Z" fill={COLORS.cocoa} />;
  }
  if (mood === 'sleepy') {
    return <Path d="M55 87h10" stroke={COLORS.cocoa} strokeWidth="3" strokeLinecap="round" />;
  }
  if (mood === 'tracking') {
    return <Path d="M54 85q6 3.5 12 0" stroke={COLORS.cocoa} strokeWidth="3" strokeLinecap="round" fill="none" />;
  }
  return <Path d="M53 84q7 8 14 0" stroke={COLORS.cocoa} strokeWidth="3" strokeLinecap="round" fill="none" />;
}

// Friendly aliases so pages can ask for a feeling rather than a mouth shape.
const MOOD_ALIASES = {
  talking: 'cheer',
  celebrating: 'cheer',
  happy: 'happy',
  idle: 'idle',
  thinking: 'tracking',
  helping: 'happy',
  sleepy: 'sleepy',
  tracking: 'tracking',
  cheer: 'cheer',
};

const Wrapoo = ({
  size = 104,
  mood = 'idle',
  onPress,
  onPressHat,
  floating = true,
  style,
}) => {
  const reducedMotion = useReducedMotion();
  const bob = useRef(new Animated.Value(0)).current;
  const hatBob = useRef(new Animated.Value(0)).current;
  const jump = useRef(new Animated.Value(0)).current;
  const [blink, setBlink] = useState(false);
  const animate = floating && !reducedMotion;
  const shape = MOOD_ALIASES[mood] || 'idle';

  // A talking Rapo opens and closes his mouth so the voice has a face.
  const talking = mood === 'talking' && !reducedMotion;
  const [talkOpen, setTalkOpen] = useState(false);
  useEffect(() => {
    if (!talking) { setTalkOpen(false); return undefined; }
    const timer = setInterval(() => setTalkOpen((open) => !open), 190);
    return () => clearInterval(timer);
  }, [talking]);

  // A small celebratory hop when Rapo is asked to celebrate.
  useEffect(() => {
    if (mood !== 'celebrating' || reducedMotion) return undefined;
    const animation = Animated.sequence([
      Animated.timing(jump, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(jump, { toValue: 0, duration: 320, easing: Easing.bounce, useNativeDriver: Platform.OS !== 'web' }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [jump, mood, reducedMotion]);

  useEffect(() => {
    if (!animate) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(bob, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, bob]);

  useEffect(() => {
    if (!animate) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(420),
        Animated.timing(hatBob, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(hatBob, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, hatBob]);

  useEffect(() => {
    if (reducedMotion) { setBlink(false); return undefined; }
    let timeout;
    let blinkOffTimeout;
    let active = true;
    const schedule = () => {
      timeout = setTimeout(() => {
        if (!active) return;
        setBlink(true);
        blinkOffTimeout = setTimeout(() => { if (active) { setBlink(false); schedule(); } }, 140);
      }, 3400 + Math.random() * 2600);
    };
    schedule();
    return () => {
      active = false;
      clearTimeout(timeout);
      clearTimeout(blinkOffTimeout);
    };
  }, [reducedMotion]);

  const hop = jump.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const translateY = Animated.add(bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }), hop);
  const hatTranslate = hatBob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const hatRotate = hatBob.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] });

  return (
    <View style={[{ width: size, height: size * 1.1 }, style]} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.hatWrap,
          { width: size * (HAT_W / 120), height: size * 0.42, left: size * 0.37, top: -size * 0.02 },
          { transform: [{ translateY: hatTranslate }, { rotate: hatRotate }] },
        ]}
      >
        <Pressable
          accessibilityRole={onPressHat ? 'button' : 'image'}
          accessibilityLabel={onPressHat ? "Tap Wrapoo's floating chef hat for a surprise" : "Wrapoo's floating chef hat"}
          onPress={onPressHat}
          hitSlop={8}
        >
          <Hat size={size} />
        </Pressable>
      </Animated.View>

      <Animated.View style={{ transform: [{ translateY }, { rotate: shape === 'cheer' ? '-2deg' : '0deg' }] }}>
        <Pressable
          onPress={onPress}
          disabled={!onPress}
          accessibilityRole={onPress ? 'button' : 'image'}
          accessibilityLabel={onPress ? "Rapo. Tap to hear what he says." : 'Rapo, a smiling little wrap'}
          hitSlop={4}
        >
        <Svg width={size} height={size * 1.02} viewBox="0 0 120 122" fill="none" accessibilityLabel="Wrapoo, a smiling little wrap">
          {/* soft shadow */}
          <Ellipse cx="60" cy="116" rx="30" ry="4.5" fill={COLORS.cocoa} opacity="0.1" />

          {/* little arms */}
          <G>
            <Path d="M27 81c-7 1-11 6-11 11" stroke={COLORS.cocoa} strokeWidth="6" strokeLinecap="round" />
            <Path d="M93 81c7 1 11 6 11 11" stroke={COLORS.cocoa} strokeWidth="6" strokeLinecap="round" />
            <Circle cx="16" cy="93" r="4.6" fill={COLORS.creamDeep} stroke={COLORS.cocoa} strokeWidth="2.4" />
            <Circle cx="104" cy="93" r="4.6" fill={COLORS.creamDeep} stroke={COLORS.cocoa} strokeWidth="2.4" />
          </G>

          {/* tortilla body */}
          <Path
            d="M30 100c-9-13-9-38 4-49 8-7 44-7 52 0 13 11 13 36 4 49-8 12-52 12-60 0Z"
            fill="#F7DFBC"
            stroke={COLORS.cocoa}
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
          {/* toasted patches */}
          <Ellipse cx="42" cy="60" rx="6" ry="4" fill={COLORS.goldLight} opacity="0.9" />
          <Ellipse cx="82" cy="96" rx="5" ry="3.4" fill={COLORS.goldLight} opacity="0.9" />
          {/* filling peeking over the fold */}
          <Path d="M34 56c6-9 16-13 26-13s20 4 26 13c-8 5-17 6-26 6s-18-1-26-6Z" fill={COLORS.primary} opacity="0.92" />
          <Path d="M41 55c5-6 12-9 19-9s14 3 19 9" stroke="#FF9A64" strokeWidth="3" strokeLinecap="round" fill="none" />
          {/* wrap folds */}
          <Path d="M36 61c4 12 5 24 3 36" stroke="#E5C79C" strokeWidth="3" strokeLinecap="round" fill="none" />
          <Path d="M84 61c-4 12-5 24-3 36" stroke="#E5C79C" strokeWidth="3" strokeLinecap="round" fill="none" />
          <Path d="M46 100c4 2 24 2 28 0" stroke="#E5C79C" strokeWidth="3" strokeLinecap="round" fill="none" />

          {/* cheeks */}
          <Ellipse cx="38" cy="82" rx="5.4" ry="3.4" fill="#F6B39C" opacity="0.85" />
          <Ellipse cx="82" cy="82" rx="5.4" ry="3.4" fill="#F6B39C" opacity="0.85" />

          <Eyes mood={shape} blink={blink} />
          <Mouth mood={talking && talkOpen ? 'cheer' : shape} />

          {shape === 'cheer' ? (
            <G>
              <Path d="m20 38 1.6 4.2 4.2 1.6-4.2 1.6L20 49.6l-1.6-4.2-4.2-1.6 4.2-1.6L20 38Z" fill={COLORS.gold} />
              <Path d="m101 46 1.2 3.2 3.2 1.2-3.2 1.2-1.2 3.2-1.2-3.2-3.2-1.2 3.2-1.2 1.2-3.2Z" fill={COLORS.secondary} />
            </G>
          ) : null}
        </Svg>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  hatWrap: { position: 'absolute', zIndex: 3 },
});

export default Wrapoo;
