declare module 'redux-persist-indexeddb-storage' {
  import { WebStorage } from 'redux-persist';
  
  function createPersistIndexedDBStorage(dbName: string): WebStorage;
  
  export default createPersistIndexedDBStorage;
} 