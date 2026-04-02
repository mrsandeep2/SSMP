import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCorIHb4nMUNMohBV4TuEa42_ByZo_5E3o",
  authDomain: "ssmp-89e30.firebaseapp.com",
  projectId: "ssmp-89e30",
  storageBucket: "ssmp-89e30.firebasestorage.app",
  messagingSenderId: "474341508530",
  appId: "1:474341508530:web:7fb6bd3443823814aa10ab",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);