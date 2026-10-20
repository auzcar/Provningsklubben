// Test mode: an admin can use the app as one of these made-up members to try a tasting
// from the host's and the participants' side on a single device. Their ids cannot clash
// with real ones (Clerk ids start with user_), and their tastings never mix with real ones.
export const TEST_PREFIX='test:';
export const TEST_USERS=[{id:'test:host',name:'Testvärden'},{id:'test:1',name:'Testa Testsson'},{id:'test:2',name:'Provi Provsson'},{id:'test:3',name:'Smakis Smaksson'}];
export const isTestUser=(id:string)=>id.startsWith(TEST_PREFIX);
