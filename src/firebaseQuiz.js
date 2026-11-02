import {initializeApp,getApps} from 'firebase/app';
import {getFirestore,doc,onSnapshot} from 'firebase/firestore';

const firebaseConfig={
 apiKey:'AIzaSyAHZITPF6SWN4-6AnvKW7EE_orZZeazr_o',
 authDomain:'avslutning-bc51f.firebaseapp.com',
 projectId:'avslutning-bc51f',
 storageBucket:'avslutning-bc51f.firebasestorage.app',
 messagingSenderId:'305334850275',
 appId:'1:305334850275:web:fd7dd67abf97dd80ab6bd6'
};
const app=getApps()[0]||initializeApp(firebaseConfig);
const firestore=getFirestore(app);
export function watchQuizResponses(onData,onError){
 return onSnapshot(doc(firestore,'quizPublic','live'),snapshot=>{
  if(snapshot.exists())onData(snapshot.data());
 },onError);
}
