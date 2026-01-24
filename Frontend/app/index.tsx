import { Redirect } from 'expo-router';

export default function Index() {
    // Redirigir automáticamente a la página de crear orden
    return <Redirect href="/crear-orden" as any />;
}
