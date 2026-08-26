// register.js
import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const formRegister = document.getElementById("form-register");

if (formRegister) {
    formRegister.onsubmit = async (e) => {
        e.preventDefault();

        // ดึงค่าจากฟอร์มหน้าเว็บ
        const nameVal = document.getElementById("reg-name").value.trim();
        const phoneVal = document.getElementById("reg-phone").value.trim();
        const lineVal = document.getElementById("reg-line").value.trim();
        const emailVal = document.getElementById("reg-email").value.trim();
        const passwordVal = document.getElementById("reg-password").value;

        try {
            // 1. สร้างบัญชีผู้ใช้ในระบบ Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, emailVal, passwordVal);
            const user = userCredential.user;

            // 2. บันทึกข้อมูลโปรไฟล์ตั้งต้นลง Firestore คอลเลกชัน "users" 
            // โดยใช้ ID เอกสารให้ตรงกับ UID ของผู้ใช้งานที่เพิ่งสมัครสำเร็จ
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                name: nameVal,
                phone: phoneVal,
                line: lineVal,
                email: emailVal,
                role: "user",          // ยศเริ่มต้นเป็นผู้ใช้งานธรรมดา (Creator)
                avatar: "",            // รูปโปรไฟล์ว่างไว้ก่อนให้ไปอัปเดตใน Dashboard
                lastActive: new Date().getTime()
            });

            alert("✨ สมัครสมาชิกสำเร็จ! ระบบกำลังนำคุณไปยังหน้าแดชบอร์ดส่วนตัว");
            window.location.href = "dashboard.html";

        } catch (error) {
            console.error("Registration Error:", error);
            
            // ดักจับข้อผิดพลาดเบื้องต้นจาก Firebase
            if (error.code === "auth/email-already-in-use") {
                alert("❌ อีเมลนี้ถูกใช้งานในระบบแล้วครับ");
            } else if (error.code === "auth/weak-password") {
                alert("❌ รหัสผ่านคาดเดาได้ง่ายเกินไป (กรุณาตั้งอย่างน้อย 6 ตัวอักษร)");
            } else {
                alert("❌ เกิดข้อผิดพลาด: " + error.message);
            }
        }
    };
}