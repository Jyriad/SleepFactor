import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DateHeaderProvider } from '../contexts/DateHeaderContext';
import HomeScreen from '../screens/HomeScreen';
import HabitLoggingScreen from '../screens/HabitLoggingScreen';
import { colors } from '../constants/colors';

const Stack = createNativeStackNavigator();

/**
 * Wraps the Home tab content. The date header at top has a 7-day strip and a handle;
 * swiping down or tapping the handle expands the calendar inline below the header.
 */
const HomeStackWrapper = () => {
  return (
    <DateHeaderProvider>
      <View style={styles.container}>
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName="Home"
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen
            name="HabitLogging"
            component={HabitLoggingScreen}
            options={{ contentStyle: { backgroundColor: colors.primary } }}
          />
        </Stack.Navigator>
      </View>
    </DateHeaderProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

export default HomeStackWrapper;
