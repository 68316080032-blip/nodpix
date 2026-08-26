import { db, auth } from "./firebase-config.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { updateProfile, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { convertDriveUrl } from "./utils.js";

// DOM Basic Elements
const firstNameInput = document.getElementById("first-name");
const lastNameInput = document.getElementById("last-name");
const headlineInput = document.getElementById("headline");
const companyInput = document.getElementById("company");
const locationSelect = document.getElementById("location");
const cityInput = document.getElementById("city");
const websiteInput = document.getElementById("website-url");

// DOM Social Inputs
const socialInstagramInput = document.getElementById("social-instagram");
const socialFacebookInput = document.getElementById("social-facebook");
const socialTwitterInput = document.getElementById("social-twitter");
const socialGithubInput = document.getElementById("social-github");

// Tab & Section Elements
const tabBasic = document.getElementById("tab-basic");
const tabSocial = document.getElementById("tab-social");
const sectionBasicInfo = document.getElementById("section-basic-info");
const sectionSocialLinks = document.getElementById("section-social-links");

const profileForm = document.getElementById("edit-profile-form");
const avatarImg = document.getElementById("profile-avatar-img");
const avatarPlaceholder = document.getElementById("profile-avatar-placeholder");
const btnReplace = document.getElementById("btn-replace-avatar");
const avatarFileInput = document.getElementById("avatar-file-input");
const btnSave = document.getElementById("btn-save-changes");

const navAvatarImg = document.getElementById("nav-avatar-img");
const navAvatarPlaceholder = document.getElementById("nav-avatar-placeholder");
const btnBackToProfile = document.getElementById("btn-back-to-profile");

// Crop Modal Elements
const cropModal = document.getElementById("crop-modal");
const cropImageElement = document.getElementById("crop-image-element");
const btnCancelCrop = document.getElementById("btn-cancel-crop");
const btnCancelCropIcon = document.getElementById("btn-cancel-crop-icon");
const btnApplyCrop = document.getElementById("btn-apply-crop");

let currentUser = null;
let base64AvatarString = ""; 
let cropperInstance = null;  

// สลับแท็บในหน้าเดิม
function switchTab(activeTab) {
    const activeClasses = ["font-bold", "text-orange-600", "bg-orange-50", "border-l-4", "border-orange-500", "rounded-r-xl"];
    const inactiveClasses = ["font-medium", "text-slate-600", "hover:bg-slate-50", "hover:text-slate-900", "rounded-xl"];

    if (activeTab === "basic") {
        sectionBasicInfo?.classList.remove("hidden");
        sectionSocialLinks?.classList.add("hidden");

        tabBasic?.classList.add(...activeClasses);
        tabBasic?.classList.remove(...inactiveClasses);

        tabSocial?.classList.remove(...activeClasses);
        tabSocial?.classList.add(...inactiveClasses);
    } else {
        sectionBasicInfo?.classList.add("hidden");
        sectionSocialLinks?.classList.remove("hidden");

        tabSocial?.classList.add(...activeClasses);
        tabSocial?.classList.remove(...inactiveClasses);

        tabBasic?.classList.remove(...activeClasses);
        tabBasic?.classList.add(...inactiveClasses);
    }
}

tabBasic?.addEventListener("click", () => switchTab("basic"));
tabSocial?.addEventListener("click", () => switchTab("social"));

// แสดงผลรูปโปรไฟล์
function renderAvatar(imageUrl, imgElement, placeholderElement, nameFallback = "U") {
    if (!imgElement) return;

    if (imageUrl && imageUrl.trim() !== "") {
        const formattedUrl = convertDriveUrl(imageUrl);
        imgElement.src = formattedUrl;
        imgElement.classList.remove("hidden");
        if (placeholderElement) placeholderElement.classList.add("hidden");

        imgElement.onerror = () => {
            imgElement.classList.add("hidden");
            if (placeholderElement) {
                placeholderElement.innerText = nameFallback.charAt(0).toUpperCase();
                placeholderElement.classList.remove("hidden");
            }
        };
    } else {
        imgElement.classList.add("hidden");
        if (placeholderElement) {
            placeholderElement.innerText = nameFallback.charAt(0).toUpperCase();
            placeholderElement.classList.remove("hidden");
        }
    }
}

// 1. ตรวจสอบผู้ใช้และดึงข้อมูลโปรไฟล์
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;

    if (btnBackToProfile) {
        btnBackToProfile.href = `profile.html?id=${user.uid}`;
    }

    try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        let data = userDoc.exists() ? userDoc.data() : {};

        const fullName = data.name || data.displayName || user.displayName || "";
        const nameParts = fullName.split(" ");
        const defaultFirstName = data.firstName || nameParts[0] || "";
        const defaultLastName = data.lastName || nameParts.slice(1).join(" ") || "";

        // ดึงข้อมูล Basic Info
        if (firstNameInput) firstNameInput.value = defaultFirstName;
        if (lastNameInput) lastNameInput.value = defaultLastName;
        if (headlineInput) headlineInput.value = data.headline || "";
        if (companyInput) companyInput.value = data.company || "";
        if (locationSelect) locationSelect.value = data.location || "Thailand";
        if (cityInput) cityInput.value = data.city || "";
        if (websiteInput) websiteInput.value = data.websiteUrl || data.website || "";

        // ดึงข้อมูล Social Links
        const social = data.socialLinks || {};
        if (socialInstagramInput) socialInstagramInput.value = social.instagram || "";
        if (socialFacebookInput) socialFacebookInput.value = social.facebook || "";
        if (socialTwitterInput) socialTwitterInput.value = social.twitter || "";
        if (socialGithubInput) socialGithubInput.value = social.github || "";

        // ดึงรูปโปรไฟล์โดยเช็กจาก Firestore ก่อน ถ้าไม่มีให้ใช้รูปจาก Auth
        base64AvatarString = data.avatarUrl || data.avatarBase64 || data.avatar || user.photoURL || "";
        
        renderAvatar(base64AvatarString, avatarImg, avatarPlaceholder, defaultFirstName || "U");
        renderAvatar(base64AvatarString, navAvatarImg, navAvatarPlaceholder, defaultFirstName || "U");

    } catch (error) {
        console.error("Error fetching profile:", error);
    }
});

// 2. เลือกไฟล์รูปภาพ
if (btnReplace && avatarFileInput) {
    btnReplace.onclick = () => avatarFileInput.click();
}

// 3. เปิด Crop Modal เมื่อเลือกรูป
if (avatarFileInput) {
    avatarFileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (cropImageElement) {
                    cropImageElement.src = event.target.result;
                    if (cropModal) cropModal.classList.remove("hidden");

                    if (cropperInstance) {
                        cropperInstance.destroy();
                    }

                    cropperInstance = new Cropper(cropImageElement, {
                        aspectRatio: 1,
                        viewMode: 1,
                        autoCropArea: 0.9,
                        responsive: true,
                        background: false
                    });
                }
            };
            reader.readAsDataURL(file);
        }
    };
}

// 4. ปิดและยกเลิก Crop Modal
const closeCropModal = () => {
    if (cropModal) cropModal.classList.add("hidden");
    if (avatarFileInput) avatarFileInput.value = "";
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }
};

btnCancelCrop?.addEventListener("click", closeCropModal);
btnCancelCropIcon?.addEventListener("click", closeCropModal);

// 5. ตัดรูปภาพและแปลงเป็น Base64
if (btnApplyCrop) {
    btnApplyCrop.onclick = () => {
        if (!cropperInstance) return;

        const canvas = cropperInstance.getCroppedCanvas({
            width: 300,
            height: 300
        });

        base64AvatarString = canvas.toDataURL("image/jpeg", 0.85);

        if (avatarImg) {
            avatarImg.src = base64AvatarString;
            avatarImg.classList.remove("hidden");
            if (avatarPlaceholder) avatarPlaceholder.classList.add("hidden");
        }

        // อัปเดตรูปบน Nav ด้วยทันทีเมื่อเซฟรูปตัดใหม่
        if (navAvatarImg) {
            navAvatarImg.src = base64AvatarString;
            navAvatarImg.classList.remove("hidden");
            if (navAvatarPlaceholder) navAvatarPlaceholder.classList.add("hidden");
        }

        closeCropModal();
    };
}

// 6. บันทึกข้อมูลลง Firestore และ Firebase Auth
if (profileForm) {
    profileForm.onsubmit = async (e) => {
        e.preventDefault();
        if (!currentUser) return;

        try {
            if (btnSave) {
                btnSave.disabled = true;
                btnSave.innerText = "Saving...";
            }

            const firstName = firstNameInput ? firstNameInput.value.trim() : "";
            const lastName = lastNameInput ? lastNameInput.value.trim() : "";
            const fullDisplayName = `${firstName} ${lastName}`.trim();

            const profileData = {
                uid: currentUser.uid,
                firstName: firstName,
                lastName: lastName,
                name: fullDisplayName,
                displayName: fullDisplayName,
                headline: headlineInput ? headlineInput.value.trim() : "",
                company: companyInput ? companyInput.value.trim() : "",
                location: locationSelect ? locationSelect.value : "Thailand",
                city: cityInput ? cityInput.value.trim() : "",
                websiteUrl: websiteInput ? websiteInput.value.trim() : "",
                avatarUrl: base64AvatarString, 
                avatarBase64: base64AvatarString,
                socialLinks: {
                    instagram: socialInstagramInput ? socialInstagramInput.value.trim() : "",
                    facebook: socialFacebookInput ? socialFacebookInput.value.trim() : "",
                    twitter: socialTwitterInput ? socialTwitterInput.value.trim() : "",
                    github: socialGithubInput ? socialGithubInput.value.trim() : ""
                },
                updatedAt: new Date().toISOString()
            };

            // 1. บันทึกลง Firestore
            await setDoc(doc(db, "users", currentUser.uid), profileData, { merge: true });

            // 2. บันทึกทั้งชื่อและรูปภาพลง Firebase Auth (แก้อาการรูป Navbar ไม่ตรง)
            await updateProfile(currentUser, {
                displayName: fullDisplayName,
                photoURL: base64AvatarString
            });

            alert("Saved profile successfully!");
            
            // นำทางกลับไปยัง profile.html?id=UID
            window.location.href = `profile.html?id=${currentUser.uid}`;

        } catch (error) {
            console.error("Save Profile Error:", error);
            alert("Error saving profile: " + error.message);
        } finally {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.innerText = "Save Changes";
            }
        }
    };
}