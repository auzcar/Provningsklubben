// Browser side of sign-in. In Clerk mode every API call carries a fresh session
// token; the server verifies it. In gateway mode the gateway adds identity itself.
let tokenSource:()=>Promise<string|null>=async()=>null;
export function setTokenSource(fn:()=>Promise<string|null>){tokenSource=fn;}
// Admin test mode (app/test-mode.tsx): the chosen test person is kept per tab. The server
// only honours it for a verified admin and only for test users.
const TEST_KEY='testUser';
export function testUser(){try{return sessionStorage.getItem(TEST_KEY);}catch{return null;}}
export function setTestUser(id:string|null){try{if(id)sessionStorage.setItem(TEST_KEY,id);else sessionStorage.removeItem(TEST_KEY);}catch{}}
export async function authHeaders():Promise<Record<string,string>>{const t=await tokenSource(),test=testUser();return {...(t?{Authorization:'Bearer '+t}:{}),...(test?{'X-Test-User':test}:{})};}

// Clerk serves its browser bundles from the instance's Frontend API, encoded in the publishable key.
const CLERK_JS='@clerk/clerk-js@6/dist/clerk.browser.js',CLERK_UI='@clerk/ui@1/dist/ui.browser.js';
export function frontendApi(publishableKey:string){const host=atob(publishableKey.split('_')[2]||'').replace(/\$$/,'');if(!/^[a-z0-9.-]+$/i.test(host))throw Error('Ogiltig Clerk-nyckel.');return host;}
function script(src:string,attrs:Record<string,string>={}){return new Promise<void>((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=true;s.crossOrigin='anonymous';for(const [k,v] of Object.entries(attrs))s.setAttribute(k,v);s.onload=()=>resolve();s.onerror=()=>reject(Error('Inloggningen kunde inte laddas. Kontrollera nätverket och försök igen.'));document.head.appendChild(s);});}
export async function loadClerk(publishableKey:string){
 const w=window as any;
 if(!w.Clerk){
  const host=frontendApi(publishableKey);
  await script(`https://${host}/npm/${CLERK_UI}`);
  await script(`https://${host}/npm/${CLERK_JS}`,{'data-clerk-publishable-key':publishableKey});
 }
 const {svSE}=await import('@clerk/localizations/sv-SE');
 await w.Clerk.load({ui:{ClerkUI:w.__internal_ClerkUICtor},localization:svSE,appearance:{variables:{colorPrimary:'#254d3d',fontFamily:'Arial, Helvetica, sans-serif',borderRadius:'5px'}}});
 return w.Clerk;
}
