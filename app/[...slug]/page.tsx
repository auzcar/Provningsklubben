import AuthGate from '../auth-gate';
// Every app address (/provningar/…, /profil/…, /arkiv …) loads the same app; club.tsx reads the path.
export default function AppPath(){return <AuthGate/>}
