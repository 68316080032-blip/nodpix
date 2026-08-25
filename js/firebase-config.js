import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// ➕ เพิ่มตัวนี้เข้ามารองรับพื้นที่เก็บรูปภาพ
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyCJzeCRVWEWNV1on9ZCreYoBphqawxAqBk",
    authDomain: "vghub-9b27c.firebaseapp.com",
    projectId: "vghub-9b27c",
    storageBucket: "vghub-9b27c.firebasestorage.app",
    messagingSenderId: "938682573346",
    appId: "1:938682573346:web:a4924950a9c9f78116e07b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app); // ➕ ส่งออกแบบนี้เพื่อให้ settings.html ดึงไปใช้ได้