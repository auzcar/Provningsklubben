import type {Metadata} from 'next';
import './globals.css';
export const metadata: Metadata={title:'Provningsklubben',description:'Smaka blint. Minns tillsammans.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="sv"><body>{children}</body></html>}
