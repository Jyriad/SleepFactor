import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

const RestedFeelingSlider = ({ value = 5, onChange }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>How rested do you feel?</Text>
        <Text style={styles.optional}>Optional</Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={10}
        step={1}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
      />
      <View style={styles.labels}>
        <Text style={styles.label}>Not at all</Text>
        <Text style={styles.label}>Very rested</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.regular,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.regular,
  },
  title: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
  optional: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  label: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
});

export default RestedFeelingSlider;

