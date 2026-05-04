import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { spacing } from '../constants';
import DateHeader from './DateHeader';
import { useDateHeader } from '../contexts/DateHeaderContext';
import GlassChromeBar from './GlassChromeBar';

const HEADER_BOTTOM_RADIUS = 12;

/**
 * Fixed date-picker header (top row + 7-day strip + handle).
 * Frosted glass chrome (blur) with dark controls; floats above scroll content when overlay is true.
 */
const ScrollableDateHeaderBar = ({
  rightElement = null,
  showBackButton: showBackButtonProp = false,
  onBackPress = null,
  onLayoutHeight = null,
  /** When true, header is absolute top so list/scroll can extend underneath for blur */
  overlay = true,
  /** Increment after sleep sync writes rows so the week strip re-fetches bed icons from local data */
  sleepStripRefreshKey = 0,
}) => {
  const ctx = useDateHeader();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const topPadding = insets.top;

  /** Synced from DateHeader (top row + drawer); avoids stale onLayout after Reanimated collapse. */
  const [dateHeaderChromeHeight, setDateHeaderChromeHeight] = useState(140);

  useEffect(() => {
    if (typeof onLayoutHeight === 'function') {
      onLayoutHeight(topPadding + dateHeaderChromeHeight);
    }
  }, [topPadding, dateHeaderChromeHeight, onLayoutHeight]);

  const isHabitLogging = showBackButtonProp || route.name === 'HabitLogging';
  const handleBack = onBackPress ?? (() => navigation.goBack());

  if (!ctx) return null;

  const handleExpandChange = (expanded) => {
    ctx.setHeaderExpanded(expanded);
  };

  const backButton = isHabitLogging ? (
    <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
    </TouchableOpacity>
  ) : null;

  const inner = (
    <GlassChromeBar bottomRadius={HEADER_BOTTOM_RADIUS}>
      <View style={[styles.headerInner, { paddingTop: topPadding }]}>
        <DateHeader
          selectedDate={ctx.selectedDate}
          onDateChange={ctx.setSelectedDate}
          loggedDates={ctx.loggedDates}
          datesWithUnsavedChanges={ctx.datesWithUnsavedChanges}
          leftElement={backButton}
          rightElement={rightElement}
          onExpandChange={handleExpandChange}
          onChromeHeightChange={setDateHeaderChromeHeight}
          sleepStripRefreshKey={sleepStripRefreshKey}
          glass
        />
      </View>
    </GlassChromeBar>
  );

  return (
    <View style={overlay ? styles.overlayWrap : styles.inlineWrap}>
      {inner}
    </View>
  );
};

const styles = StyleSheet.create({
  overlayWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    ...Platform.select({
      android: { elevation: 24 },
    }),
  },
  inlineWrap: {
    width: '100%',
    zIndex: 10,
    ...Platform.select({
      android: { elevation: 10 },
    }),
  },
  headerInner: {
    paddingTop: 0,
  },
  backButton: {
    padding: spacing.xs,
  },
});

export default ScrollableDateHeaderBar;
