import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

console.log('📦 Starting app from index.js...');

import App from './App';

console.log('🎯 App imported, registering root component...');

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

console.log('✅ Root component registered successfully');
