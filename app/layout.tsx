import type {Metadata} from 'next';
import './globals.css';
export const metadata: Metadata={title:'Provningsklubben',description:'Smaka blint. Minns tillsammans.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="sv"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,800;1,9..144,500&family=Figtree:wght@400;500;600;700&display=swap"/><meta name="theme-color" content="#2a0f14"/></head><body>{children}</body></html>}
