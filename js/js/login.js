// login.js
import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {

    // ================= 📧 1. ระบบล็อกอินด้วย Email & Password =================
    const formLogin = document.getElementById("form-login");
    if (formLogin) {
        formLogin.onsubmit = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const emailVal = document.getElementById("login-email").value.trim();
            const passwordVal = document.getElementById("login-password").value;

            if (!emailVal || !passwordVal) {
                alert("🔒 กรุณากรอกข้อมูลอีเมลและรหัสผ่านให้ครบถ้วน");
                return;
            }

            try {
                const userCredential = await signInWithEmailAndPassword(auth, emailVal, passwordVal);
                if (userCredential.user) {
                    alert("🔒 เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับกลับเข้าสู่ระบบครับ");
                    window.location.replace("profile.html"); // เปลี่ยนไปหน้า profile หรือ dashboard ตามต้องการ
                }
            } catch (error) {
                console.error("Login Error Details:", error);
                alert("❌ อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
            }
        };
    }

    // ================= 👤 ฟังก์ชันช่วยลงทะเบียนข้อมูลสมาชิกลง Firestore =================
    async function handleSocialUserRecord(user) {
        if (!user) return;
        const userDocRef = doc(db, "users", user.uid);

        try {
            const userDoc = await getDoc(userDocRef);
            if (!userDoc.exists()) {
                // บันทึกข้อมูลเริ่มต้นสำหรับทำหน้า Behance Profile
                await setDoc(userDocRef, {
                    uid: user.uid,
                    name: user.displayName || "Anonymous Creator",
                    email: user.email || "",
                    phone: "-",
                    line: "-",
                    role: "creator",
                    bio: "สวัสดี! ฉันเป็นครีเอเตอร์บน VG HUB", // เพิ่ม Bio สำหรับหน้า Behance
                    coverImage: "https://via.placeholder.com/1200x400", // เพิ่มรูป Cover สำหรับ Profile
                    avatar: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}`,
                    createdAt: new Date().getTime(),
                    lastActive: new Date().getTime()
                });
            } else {
                // อัปเดตเวลาเข้าใช้งานล่าสุด
                await setDoc(userDocRef, { lastActive: new Date().getTime() }, { merge: true });
            }
        } catch (err) {
            console.error("Firestore บันทึกประวัติ Google User ผิดพลาด:", err);
        }
    }

    // ================= 🍏 2. ระบบล็อกอินด้วย Google Sign-In =================
    const btnGoogle = document.getElementById("btn-google-login");
    if (btnGoogle) {
        btnGoogle.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            
            try {
                const result = await signInWithPopup(auth, provider);
                if (result.user) {
                    await handleSocialUserRecord(result.user);
                    alert("✨ เข้าสู่ระบบผ่านบัญชี Google สำเร็จเรียบร้อยแล้ว!");
                    window.location.replace("profile.html"); // ส่งต่อไปยังหน้าโปรไฟล์ครีเอเตอร์
                }
            } catch (error) {
                console.error("Google Authentication Error Details:", error);
                alert("❌ ไม่สามารถเข้าสู่ระบบด้วย Google ได้: " + error.message);
            }
        };
    }

    // ================= 🔄 3. ระบบลืมรหัสผ่าน (Forgot Password Engine) =================
    const modalForgot = document.getElementById("modal-forgot-password");
    const btnForgotTrigger = document.getElementById("btn-forgot-password-trigger");
    const btnForgotClose = document.getElementById("btn-forgot-password-close");
    const formForgot = document.getElementById("form-forgot-password");

    // เปิดหน้าต่างลืมรหัสผ่าน
    if (btnForgotTrigger && modalForgot) {
        btnForgotTrigger.onclick = (e) => {
            e.preventDefault();
            modalForgot.classList.remove("hidden");
        };
    }

    // ปิดหน้าต่างลืมรหัสผ่าน
    if (btnForgotClose && modalForgot) {
        btnForgotClose.onclick = (e) => {
            e.preventDefault();
            modalForgot.classList.add("hidden");
            if (formForgot) formForgot.reset();
        };
    }

    // ส่งอีเมลรีเซ็ตรหัสผ่านเมื่อกด Submit ฟอร์ม
    if (formForgot) {
        formForgot.onsubmit = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const forgotEmailInput = document.getElementById("forgot-email");
            const emailVal = forgotEmailInput.value.trim();

            if (!emailVal) return;

            try {
                await sendPasswordResetEmail(auth, emailVal);
                alert(`📩 ระบบได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปที่อีเมล: ${emailVal} เรียบร้อยแล้ว!`);
                
                modalForgot.classList.add("hidden");
                formForgot.reset();
            } catch (error) {
                console.error("Password Reset Error:", error);
                if (error.code === "auth/user-not-found") {
                    alert("❌ ไม่พบอีเมลนี้ในระบบสมัครสมาชิก กรุณาตรวจสอบอีเมลอีกครั้ง");
                } else if (error.code === "auth/invalid-email") {
                    alert("❌ รูปแบบอีเมลไม่ถูกต้อง");
                } else {
                    alert("❌ เกิดข้อผิดพลาดจากระบบ: " + error.message);
                }
            }
        };
    }

});