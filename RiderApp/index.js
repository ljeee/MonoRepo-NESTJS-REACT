import { registerRootComponent } from 'expo';

// Registrar las background tasks antes de cargar la App (React) para evitar
// crasheos por headless JS en Android al ejecutarse en segundo plano.
import './src/tasks/locationTask';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
