import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

/**
 * Shared chrome for sheet-presented screens: grab handle, chevron-down dismiss,
 * optional title, scroll body with safe bottom inset.
 */
export default function AppSheetLayout({
  title,
  subtitle,
  onDismiss,
  headerRight,
  children,
  scroll = true,
  keyboardAvoid = false,
  contentContainerStyle,
  /** When true on iOS inside a native form sheet, hide duplicate handle/chevron  use system grabber. */
  nativePresentation = false,
  /** When true inside NestedSheetOverlay, hide the in-layout handle (overlay supplies it). */
  hideHandle = false,
  contentFlexGrow = true,
  /** `'dismiss'` closes the sheet; `'back'` pops one screen (for pushes inside a sheet stack). */
  leadingAction = 'dismiss',
  /** Hide the leading chevron (sheet root uses the system grabber instead). */
  hideLeading = false,
  /** Optional layer above the body (e.g. Account pushed inside the same form sheet). */
  overlay = null,
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const navigation = useNavigation();
  const [headerHeight, setHeaderHeight] = useState(56);
  const dismiss = onDismiss ?? (() => {
    if (navigation.canGoBack()) navigation.goBack();
  });

  const bottomPad = Math.max(insets.bottom, spacing.md) + spacing.lg;
  const useNativeChrome = nativePresentation && Platform.OS === 'ios';
  const showHandle = !useNativeChrome && !hideHandle;

  /** iOS form sheets often ignore flex height  cap scroll body to visible sheet area. */
  const iosSheetBodyMaxHeight = useMemo(() => {
    if (Platform.OS !== 'ios') return undefined;
    const handleAllowance = showHandle ? 18 : 0;
    return Math.max(
      240,
      windowHeight - headerHeight - insets.top - handleAllowance - spacing.sm,
    );
  }, [showHandle, windowHeight, headerHeight, insets.top]);

  const iosSheetScrollStyle = useMemo(
    () => (iosSheetBodyMaxHeight != null ? { maxHeight: iosSheetBodyMaxHeight } : null),
    [iosSheetBodyMaxHeight],
  );

  /** scroll={false} bodies need min + max or inner ScrollViews collapse to zero height. */
  const iosSheetNonScrollSizeStyle = useMemo(
    () =>
      iosSheetBodyMaxHeight != null
        ? { minHeight: iosSheetBodyMaxHeight, maxHeight: iosSheetBodyMaxHeight }
        : null,
    [iosSheetBodyMaxHeight],
  );

  const header = (
    <View
      style={[styles.header, useNativeChrome && styles.headerNative]}
      collapsable={false}
      onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
    >
      {useNativeChrome || hideLeading ? (
        <View style={styles.dismissButton} />
      ) : (
        <Pressable
          onPress={dismiss}
          style={styles.dismissButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={leadingAction === 'back' ? 'Go back' : 'Close'}
        >
          <Ionicons
            name={leadingAction === 'back' ? 'chevron-back' : 'chevron-down'}
            size={leadingAction === 'back' ? 28 : 26}
            color={colors.textPrimary}
          />
        </Pressable>
      )}
      <View style={styles.headerCenter}>
        {title ? (
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.headerRight}>{headerRight ?? null}</View>
    </View>
  );

  const bodyInner = scroll ? (
    <ScrollView
      style={[
        styles.scroll,
        iosSheetScrollStyle,
      ]}
      contentContainerStyle={[
        styles.scrollContent,
        contentFlexGrow ? styles.scrollContentGrow : null,
        { paddingBottom: bottomPad },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.nonScrollBody,
        { paddingBottom: bottomPad },
        contentContainerStyle,
        iosSheetNonScrollSizeStyle,
      ]}
    >
      <View style={styles.nonScrollBodyInner}>{children}</View>
    </View>
  );

  const body = keyboardAvoid ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      {bodyInner}
    </KeyboardAvoidingView>
  ) : (
    bodyInner
  );

  const sheetInner = (
    <>
      {!showHandle ? null : (
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>
      )}
      {header}
      {body}
    </>
  );

  if (Platform.OS === 'android') {
    return (
      <View style={styles.androidRoot}>
        <Pressable style={styles.androidBackdrop} onPress={dismiss} accessibilityLabel="Close" />
        <View style={[styles.androidSheet, { paddingBottom: 0 }]}>
          {sheetInner}
        </View>
      </View>
    );
  }

  // iOS native form sheet: header + ScrollView must be direct children of the screen for scroll to work.
  if (useNativeChrome && scroll && !keyboardAvoid) {
    return (
      <>
        {header}
        {bodyInner}
        {overlay ? <View style={styles.sheetOverlay}>{overlay}</View> : null}
      </>
    );
  }

  return (
    <View style={[styles.iosRoot, useNativeChrome && styles.iosRootNative]}>
      {sheetInner}
      {overlay ? <View style={styles.sheetOverlay}>{overlay}</View> : null}
    </View>
  );
}

const SHEET_TOP_RADIUS = 20;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  androidRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  androidBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 41, 75, 0.45)',
  },
  androidSheet: {
    maxHeight: '94%',
    minHeight: '50%',
    backgroundColor: colors.background,
    borderTopLeftRadius: SHEET_TOP_RADIUS,
    borderTopRightRadius: SHEET_TOP_RADIUS,
    overflow: 'hidden',
  },
  iosRoot: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.background,
  },
  iosRootNative: {
    paddingTop: 0,
  },
  headerNative: {
    paddingTop: spacing.sm,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: spacing.xs,
    paddingBottom: 2,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.regular,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dismissButton: {
    width: 40,
    alignItems: 'flex-start',
    paddingTop: 2,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  headerRight: {
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.regular,
  },
  scrollContentGrow: {
    flexGrow: 1,
  },
  nonScrollBody: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.regular,
  },
  nonScrollBodyInner: {
    flex: 1,
    minHeight: 0,
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
    backgroundColor: colors.background,
  },
});
