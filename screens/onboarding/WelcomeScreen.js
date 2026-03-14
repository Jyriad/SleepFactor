import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BannerLogoLight from '../../assets/BannerLogoLight.svg';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';

const BANNER_ASPECT_RATIO = 250 / 100;
const BANNER_MAX_WIDTH = 200;

const CAROUSEL_SLIDES = [
  {
    title: 'Auto-Sync',
    body: 'Your wearables do the work',
    sub: 'HealthKit / Health Connect',
  },
  {
    title: 'Smart Logging',
    body: 'Track caffeine and alcohol with pharmaceutical precision.',
    sub: '',
  },
];

const WelcomeScreen = ({ navigation }) => {
  const { width: windowWidth } = useWindowDimensions();
  const bannerWidth = Math.min(BANNER_MAX_WIDTH, windowWidth - spacing.xl * 2);
  const bannerHeight = bannerWidth / BANNER_ASPECT_RATIO;
  const [carouselIndex, setCarouselIndex] = useState(0);
  const scrollRef = useRef(null);

  const onScroll = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / windowWidth);
    if (index >= 0 && index < CAROUSEL_SLIDES.length) {
      setCarouselIndex(index);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <BannerLogoLight
          width={bannerWidth}
          height={bannerHeight}
          style={styles.banner}
          accessibilityLabel="SleepFactor"
        />
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          onMomentumScrollEnd={onScroll}
          showsHorizontalScrollIndicator={false}
          style={styles.carousel}
          contentContainerStyle={[styles.carouselContent, { width: windowWidth * CAROUSEL_SLIDES.length }]}
        >
          {CAROUSEL_SLIDES.map((slide, i) => (
            <View key={i} style={[styles.slide, { width: windowWidth }]}>
              <Text style={styles.slideTitle}>{slide.title}</Text>
              <Text style={styles.slideBody}>{slide.body}</Text>
              {slide.sub ? <Text style={styles.slideSub}>{slide.sub}</Text> : null}
            </View>
          ))}
        </ScrollView>
        <View style={styles.dots}>
          {CAROUSEL_SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === carouselIndex && styles.dotActive]}
            />
          ))}
        </View>
        <Button
          title="Get Started"
          onPress={() => navigation.navigate('OnboardingAuth')}
          style={styles.getStartedButton}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
  banner: {
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  carousel: {
    flexGrow: 0,
    marginBottom: spacing.regular,
  },
  carouselContent: {
    flexDirection: 'row',
  },
  slide: {
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  slideBody: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.body,
  },
  slideSub: {
    fontSize: typography.sizes.small,
    color: colors.textLight,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  getStartedButton: {
    minWidth: 200,
  },
});

export default WelcomeScreen;
