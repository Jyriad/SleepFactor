import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import AuthScreen from '../screens/AuthScreen';
import TabNavigator from './TabNavigator';
import HabitLoggingScreen from '../screens/HabitLoggingScreen';
import AccountScreen from '../screens/AccountScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  console.log('🧭 AppNavigator component rendering...');
  const { isAuthenticated, loading, user } = useAuth();
  console.log('🔐 Auth state:', { isAuthenticated, loading, user: user ? 'exists' : 'null' });

  // Keep showing loading screen until we're absolutely sure about auth state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated && user ? (
          <>
            <Stack.Screen name="MainTabs" component={TabNavigator} />
            <Stack.Screen
              name="HabitLogging"
              component={HabitLoggingScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen name="Account" component={AccountScreen} />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});

export default AppNavigator;

