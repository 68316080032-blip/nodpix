// app.js - ระบบการจัดการ UI, Authentication, Gallery, และ Realtime Comments (100% Full Version)
import { db, auth } from "./firebase-config.js";
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, addDoc, orderBy, setDoc, deleteDoc, increment, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { convertDriveUrl, convertDriveVideoUrl, formatRelativeTime, parseSocialLink } from "./utils.js";

// Global Live States
let activePostId = null;
let currentUserId = null;
let currentUserName = "Anonymous";
let currentUserAvatar = "";
let currentUserRole = "user"; 
let commentUnsubscribe = null;
let activeReplyToId = null;   

// Global State สำหรับกรองหมวดหมู่
let selectedCategory = "For You";
let rawPortfolioItems = [];

let expandState = {
    "Graphic Design": true, 
    "Video Editor": true,
    "Motion Graphic / 3D": true,
    "All": true
};

// 🔗 ฟังก์ชันสำหรับนำทางไปยังหน้า Profile ของผู้โพสต์
function navigateToProfile(userId) {
    if (!auth.currentUser) {
        showToast("กรุณาเข้าสู่ระบบก่อนเข้าชมโปรไฟล์", "warning");
        openAuthPopup();
        return;
    }

    if (!userId || userId === "undefined" || userId === "null") {
        showToast("ไม่พบข้อมูลผู้ใช้งานนี้", "error");
        return;
    }
    window.location.href = `profile.html?id=${userId}`;
}

// 🔄 ฟังก์ชันอัปเดต UI โปรไฟล์บน Navbar
function updateNavProfileUI() {
    const navUsername = document.getElementById("nav-username");
    const dropdownUsername = document.getElementById("dropdown-user-name");
    const avatarZone = document.getElementById("nav-avatar-zone");

    if (!currentUserId) {
        if (navUsername) navUsername.innerText = "Guest";
        if (dropdownUsername) dropdownUsername.innerText = "Guest";
        if (avatarZone) avatarZone.innerText = "G";
        return;
    }

    if (navUsername) navUsername.innerText = currentUserName;
    if (dropdownUsername) dropdownUsername.innerText = currentUserName;

    if (avatarZone) {
        if (currentUserAvatar && currentUserAvatar.trim() !== "") {
            const avatarUrl = convertDriveUrl(currentUserAvatar);
            const initialChar = currentUserName.charAt(0).toUpperCase();
            
            avatarZone.innerHTML = `
                <img src="${avatarUrl}" 
                     class="w-full h-full object-cover rounded-full select-none" 
                     referrerpolicy="no-referrer" 
                     onerror="this.onerror=null; this.parentNode.innerText='${initialChar}';" />
            `;
        } else {
            avatarZone.innerText = currentUserName.charAt(0).toUpperCase();
        }
    }
}

// 🔔 ระบบ Pop-up Toast แจ้งเตือนสไตล์มินิมอล
const showToast = (message, type = "success") => {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "fixed bottom-5 right-5 z-[10000] space-y-2 pointer-events-none";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `pointer-events-auto flex items-center p-4 rounded-2xl shadow-xl border border-white/60 transition-all duration-300 transform translate-y-2 opacity-0 max-w-sm ${
        type === "success" 
        ? "bg-emerald-500 text-white" 
        : type === "error" 
        ? "bg-rose-500 text-white" 
        : "bg-amber-500 text-white"
    }`;

    const icon = type === "success" ? "✨" : type === "error" ? "❌" : "⚠️";

    toast.innerHTML = `
        <span class="mr-2.5 text-sm">${icon}</span>
        <p class="text-xs font-bold tracking-wide">${message}</p>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove("translate-y-2", "opacity-0");
    }, 10);

    setTimeout(() => {
        toast.classList.add("opacity-0", "translate-y-[-10px]");
        setTimeout(() => toast.remove(), 300);
    }, 3500);
};

// 🗑️ ระบบ Pop-up ยืนยันการลบความคิดเห็น
const showConfirmModal = (title, message) => {
    return new Promise((resolve) => {
        let confirmModal = document.getElementById("custom-confirm-modal");
        
        if (!confirmModal) {
            confirmModal = document.createElement("div");
            confirmModal.id = "custom-confirm-modal";
            confirmModal.className = "fixed inset-0 z-[10000] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 transition-opacity duration-200 opacity-0 hidden";
            confirmModal.innerHTML = `
                <div id="custom-confirm-box" class="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 transform scale-95 transition-all duration-200 text-center space-y-4">
                    <div class="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto text-xl shadow-inner">
                        🗑️
                    </div>
                    <div class="space-y-1">
                        <h3 id="confirm-modal-title" class="text-base font-black text-slate-800">ยืนยันการทำรายการ</h3>
                        <p id="confirm-modal-msg" class="text-xs text-slate-500 font-normal leading-relaxed">คุณแน่ใจหรือไม่ว่าต้องการดำเนินการนี้?</p>
                    </div>
                    <div class="flex items-center gap-2 pt-2">
                        <button id="btn-confirm-cancel" class="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-95">
                            ยกเลิก
                        </button>
                        <button id="btn-confirm-ok" class="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 transition-colors shadow-md shadow-rose-500/20 active:scale-95">
                            ยืนยันลบ
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(confirmModal);
        }

        const titleEl = confirmModal.querySelector("#confirm-modal-title");
        const msgEl = confirmModal.querySelector("#confirm-modal-msg");
        const btnCancel = confirmModal.querySelector("#btn-confirm-cancel");
        const btnOk = confirmModal.querySelector("#btn-confirm-ok");
        const box = confirmModal.querySelector("#custom-confirm-box");

        if (titleEl) titleEl.innerText = title || "ยืนยันการทำรายการ";
        if (msgEl) msgEl.innerText = message || "คุณต้องการดำเนินการนี้ใช่หรือไม่?";

        confirmModal.classList.remove("hidden");
        confirmModal.style.display = "flex";
        setTimeout(() => {
            confirmModal.classList.remove("opacity-0");
            box.classList.remove("scale-95");
        }, 10);

        const closeFunc = (result) => {
            confirmModal.classList.add("opacity-0");
            box.classList.add("scale-95");
            setTimeout(() => {
                confirmModal.classList.add("hidden");
                confirmModal.style.display = "none";
                resolve(result);
            }, 200);
        };

        btnOk.onclick = () => closeFunc(true);
        btnCancel.onclick = () => closeFunc(false);
        confirmModal.onclick = (e) => {
            if (e.target === confirmModal) closeFunc(false);
        };
    });
};

// 🖼️ ฟังก์ชันเปิดป๊อบอัพขยายรูปโปรไฟล์
function openAvatarPreviewPopup(imgSrc) {
    if (!imgSrc) return;
    
    let previewModal = document.getElementById("avatar-preview-modal");
    if (!previewModal) {
        previewModal = document.createElement("div");
        previewModal.id = "avatar-preview-modal";
        previewModal.className = "fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 hidden transition-opacity duration-300 opacity-0";
        previewModal.innerHTML = `
            <div class="relative max-w-sm w-full bg-white rounded-3xl p-4 overflow-hidden shadow-2xl transform scale-95 transition-transform duration-300" id="avatar-preview-content">
                <button id="close-avatar-preview" class="absolute top-4 right-4 bg-slate-900/50 hover:bg-slate-900/80 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors z-50 shadow-xs">✕</button>
                <div class="aspect-square w-full rounded-full overflow-hidden bg-slate-100 flex items-center justify-center shadow-inner">
                    <img id="avatar-preview-img" src="" class="w-full h-full object-cover select-none pointer-events-none">
                </div>
            </div>
        `;
        document.body.appendChild(previewModal);
        
        const closeFunc = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            previewModal.classList.add("opacity-0");
            previewModal.querySelector("#avatar-preview-content").classList.add("scale-95");
            setTimeout(() => {
                previewModal.classList.add("hidden");
                previewModal.style.display = "none";
            }, 300);
        };
        
        previewModal.querySelector("#close-avatar-preview").onclick = closeFunc;
        previewModal.onclick = (e) => { if (e.target === previewModal) closeFunc(e); };
    }
    
    const previewImg = previewModal.querySelector("#avatar-preview-img");
    previewImg.src = convertDriveUrl(imgSrc);
    
    previewModal.classList.remove("hidden");
    previewModal.style.display = "flex";
    setTimeout(() => {
        previewModal.classList.remove("opacity-0");
        previewModal.querySelector("#avatar-preview-content").classList.remove("scale-95");
    }, 10);
}

// 🛡️ ตรวจสอบสถานะผู้ใช้งาน แบบ Realtime
onAuthStateChanged(auth, async (user) => {
    const adminLinkElement = document.getElementById("admin-link");
    const loginBtnElement = document.getElementById("login-btn");
    const userProfileMenu = document.getElementById("user-profile-menu");

    if (user) {
        currentUserId = user.uid;
        if (loginBtnElement) loginBtnElement.classList.add("hidden");
        if (userProfileMenu) userProfileMenu.classList.remove("hidden");

        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const uData = userDoc.data();
                currentUserName = uData.name || uData.displayName || user.displayName || user.email || "User";
                currentUserAvatar = uData.avatarUrl || uData.avatar || uData.photoURL || user.photoURL || "";
                currentUserRole = (uData.role || "user").toLowerCase().trim();

                updateNavProfileUI();

                if (adminLinkElement) {
                    if (currentUserRole === "admin" || currentUserRole === "dev") {
                        adminLinkElement.classList.remove("hidden");
                    } else {
                        adminLinkElement.classList.add("hidden");
                    }
                }
            } else {
                await setDoc(doc(db, "users", user.uid), {
                    uid: user.uid,
                    name: user.displayName || "Google User",
                    displayName: user.displayName || "Google User",
                    email: user.email,
                    phone: "-",
                    tel: "-",
                    line: "-",
                    lineId: "-",
                    role: "user",
                    avatarUrl: user.photoURL || "",
                    createdAt: new Date().toISOString()
                });
                
                currentUserName = user.displayName || "Google User";
                currentUserAvatar = user.photoURL || "";
                updateNavProfileUI();

                showToast("ยินดีต้อนรับ! ระบบลงทะเบียนบัญชี Google ของคุณสำเร็จแล้ว");
                setTimeout(() => window.location.reload(), 1000);
            }
        } catch (e) {
            console.error("Error setting user context & role check:", e);
            currentUserName = user.displayName || user.email || "User";
            currentUserAvatar = user.photoURL || "";
            updateNavProfileUI();
        }
    } else {
        currentUserId = null;
        currentUserName = "Anonymous";
        currentUserAvatar = "";
        currentUserRole = "user";

        updateNavProfileUI();

        if (loginBtnElement) loginBtnElement.classList.remove("hidden");
        if (adminLinkElement) adminLinkElement.classList.add("hidden");
        if (userProfileMenu) userProfileMenu.classList.add("hidden");
    }
});

// ================= 🔓 REALTIME AUTH POP-UP CONTROLLER =================
const authPopupModal = document.getElementById("auth-popup-modal");
const btnCloseAuthPop = document.getElementById("btn-close-auth-pop");
const authGuardModal = document.getElementById("auth-guard-modal");
const loginSection = document.getElementById("auth-pop-login-section");
const registerSection = document.getElementById("auth-pop-register-section");
const btnToRegister = document.getElementById("btn-switch-to-register");
const btnToLogin = document.getElementById("btn-switch-to-login");
const popLoginForm = document.getElementById("pop-login-form");
const popRegisterForm = document.getElementById("pop-register-form");
const btnGoogleAuth = document.getElementById("btn-pop-google");
const loginBtn = document.getElementById("login-btn");
const btnCloseAuthModal = document.getElementById("btn-close-auth-modal");
const btnTriggerLoginPop = document.getElementById("btn-trigger-login-pop");

const openAuthPopup = () => {
    const targetModal = authPopupModal || authGuardModal;
    if (targetModal) {
        targetModal.classList.remove("hidden");
        targetModal.style.display = "flex";
    }
    showLoginSection();
};

const closeAuthPopup = () => {
    if (authPopupModal) {
        authPopupModal.classList.add("hidden");
        authPopupModal.style.display = "none";
    }
    if (authGuardModal) {
        authGuardModal.classList.add("hidden");
        authGuardModal.style.display = "none";
    }
    if (popLoginForm) popLoginForm.reset();
    if (popRegisterForm) popRegisterForm.reset();
};

const showLoginSection = () => {
    if (loginSection) loginSection.classList.remove("hidden");
    if (registerSection) registerSection.classList.add("hidden");
};

const showRegisterSection = () => {
    if (loginSection) loginSection.classList.add("hidden");
    if (registerSection) registerSection.classList.remove("hidden");
};

if (loginBtn) loginBtn.onclick = openAuthPopup;
if (btnTriggerLoginPop) btnTriggerLoginPop.onclick = openAuthPopup;
if (btnCloseAuthPop) btnCloseAuthPop.onclick = closeAuthPopup;
if (btnToRegister) btnToRegister.onclick = showRegisterSection;
if (btnToLogin) btnToLogin.onclick = showLoginSection;
if (btnCloseAuthModal) btnCloseAuthModal.onclick = closeAuthPopup;

const btnDropdownToggle = document.getElementById("btn-dropdown-toggle");
const navDropdownBox = document.getElementById("nav-dropdown-box");
const dropdownArrow = document.getElementById("dropdown-arrow");
if (btnDropdownToggle && navDropdownBox) {
    btnDropdownToggle.onclick = (e) => {
        e.stopPropagation();
        navDropdownBox.classList.toggle("hidden");
        if (dropdownArrow) dropdownArrow.classList.toggle("rotate-180");
    };
    window.addEventListener("click", () => {
        navDropdownBox.classList.add("hidden");
        if (dropdownArrow) dropdownArrow.classList.remove("rotate-180");
    });
}

const btnNavLogout = document.getElementById("btn-nav-logout");
if (btnNavLogout) {
    btnNavLogout.onclick = async () => {
        try {
            await signOut(auth);
            showToast("ออกจากระบบเรียบร้อยแล้ว");
            setTimeout(() => window.location.reload(), 800);
        } catch (e) {
            showToast("เกิดข้อผิดพลาดในการออกจากระบบ", "error");
        }
    };
}

if (btnGoogleAuth) {
    btnGoogleAuth.onclick = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            showToast("เชื่อมต่อเข้าสู่ระบบผ่าน Google สำเร็จเรียบร้อยแล้ว!");
            closeAuthPopup();
        } catch (error) {
            console.error(error);
            showToast("การเชื่อมต่อบัญชีถูกยกเลิก หรือเกิดข้อผิดพลาด", "error");
        }
    };
}

if (popLoginForm) {
    popLoginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById("pop-login-email").value.trim();
        const password = document.getElementById("pop-login-password").value;
        try {
            await signInWithEmailAndPassword(auth, email, password);
            showToast("เข้าสู่ระบบเสร็จสมบูรณ์ ยินดีต้อนรับกลับครับ!");
            closeAuthPopup();
        } catch (err) {
            showToast("อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง", "error");
        }
    };
}

if (popRegisterForm) {
    popRegisterForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById("pop-reg-name").value.trim();
        const email = document.getElementById("pop-reg-email").value.trim();
        const phone = document.getElementById("pop-reg-phone").value.trim();
        const password = document.getElementById("pop-reg-password").value;
        const confirmPassword = document.getElementById("pop-reg-confirm-password").value;

        if (password !== confirmPassword) {
            showToast("รหัสผ่านทั้งสองช่องไม่ตรงกัน! กรุณาตรวจสอบอีกครั้ง", "error");
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                name: name,
                displayName: name,
                email: email,
                phone: phone,
                tel: phone,
                line: "-",
                lineId: "-",
                role: "user",
                avatarUrl: "",
                createdAt: new Date().toISOString()
            });

            showToast("สมัครสมาชิกและบันทึกข้อมูลเข้าสู่ระบบสำเร็จแล้ว!");
            closeAuthPopup();
        } catch (err) {
            if (err.code === "auth/email-already-in-use") {
                showToast("อีเมลนี้ถูกใช้งานในระบบแล้ว ไม่สามารถสมัครซ้ำได้", "error");
            } else {
                showToast(err.message, "error");
            }
        }
    };
}

// ================= 🎯 1. REALTIME GALLERY & CATEGORY FILTER ENGINE =================

function initCategoryFilter() {
    const validCategories = ["For You", "Graphic Design", "Photography", "Illustration", "3D Art", "UI/UX", "Motion", "Video Editor"];
    const allElements = document.querySelectorAll("button, a, div");

    allElements.forEach(el => {
        const text = el.innerText ? el.innerText.trim() : "";
        if (validCategories.includes(text) && el.children.length === 0) {
            el.style.cursor = "pointer";
            el.onclick = (e) => {
                e.preventDefault();
                selectedCategory = text;

                allElements.forEach(b => {
                    const bText = b.innerText ? b.innerText.trim() : "";
                    if (validCategories.includes(bText) && b.children.length === 0) {
                        if (bText === selectedCategory) {
                            b.classList.add("bg-orange-500", "text-white");
                            b.classList.remove("bg-slate-100", "text-slate-600");
                        } else {
                            b.classList.remove("bg-orange-500", "text-white");
                            b.classList.add("bg-slate-100", "text-slate-600");
                        }
                    }
                });

                applyCategoryFilter();
            };
        }
    });
}

function applyCategoryFilter() {
    const grids = {
        "Graphic Design": document.getElementById("grid-graphic"),
        "Video Editor": document.getElementById("grid-video"),
        "Motion Graphic / 3D": document.getElementById("grid-motion")
    };

    const hasCategoryGrids = grids["Graphic Design"] && grids["Video Editor"] && grids["Motion Graphic / 3D"];
    const fallbackGrid = document.getElementById("main-portfolio-grid") || document.getElementById("portfolio-grid") || document.querySelector("main .grid") || document.querySelector(".grid");

    let filteredItems = [...rawPortfolioItems];

    if (selectedCategory !== "For You") {
        filteredItems = filteredItems.filter(item => {
            const cat = (item.category || "").toLowerCase();
            const targetCat = selectedCategory.toLowerCase();
            return cat.includes(targetCat) || targetCat.includes(cat);
        });
    }

    if (hasCategoryGrids) {
        let lists = { "Graphic Design": [], "Video Editor": [], "Motion Graphic / 3D": [] };

        filteredItems.forEach((item) => {
            let rawCategory = (item.category || "").trim();
            let mappedCategory = "";

            if (rawCategory.includes("Graphic") && !rawCategory.includes("3D") && !rawCategory.includes("Motion")) {
                mappedCategory = "Graphic Design";
            } else if (rawCategory.includes("Video") || rawCategory.includes("Editor")) {
                mappedCategory = "Video Editor";
            } else if (rawCategory.includes("3D") || rawCategory.includes("Motion") || rawCategory.includes("3d") || rawCategory.includes("2D")) {
                mappedCategory = "Motion Graphic / 3D";
            }

            if (mappedCategory && lists[mappedCategory]) {
                lists[mappedCategory].push(item);
            } else {
                lists["Graphic Design"].push(item);
            }
        });

        const mapping = [
            { key: "Graphic Design", grid: grids["Graphic Design"], btn: "btn-more-graphic", count: "count-graphic" },
            { key: "Video Editor", grid: grids["Video Editor"], btn: "btn-more-video", count: "count-video" },
            { key: "Motion Graphic / 3D", grid: grids["Motion Graphic / 3D"], btn: "btn-more-motion", count: "count-motion" }
        ];

        mapping.forEach(({ key, grid, btn, count }) => {
            if (document.getElementById(count)) document.getElementById(count).innerText = lists[key].length;
            
            const btnMore = document.getElementById(btn);
            if (btnMore) {
                btnMore.onclick = () => {
                    expandState[key] = !expandState[key];
                    renderCategoryRow(lists[key], key, grid, btn);
                };
            }

            renderCategoryRow(lists[key], key, grid, btn);
        });
    } else if (fallbackGrid) {
        expandState["All"] = true;
        renderCategoryRow(filteredItems, "All", fallbackGrid, null);
    }
}

function initGalleryStream() {
    const q = query(collection(db, "portfolios"));

    onSnapshot(q, (snapshot) => {
        rawPortfolioItems = [];

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const status = (data.status || "").toLowerCase().trim();
            if (status !== "approved" && status !== "" && status !== "public") return;

            rawPortfolioItems.push({ id: docSnap.id, ...data });
        });

        rawPortfolioItems.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        applyCategoryFilter();
    }, (error) => {
        console.error("Gallery Snapshot Error:", error);
    });
}

function renderCategoryRow(itemsArray, categoryName, targetGridElement, moreButtonId) {
    if (!targetGridElement) return;
    targetGridElement.innerHTML = "";
    const btnMore = moreButtonId ? document.getElementById(moreButtonId) : null;

    if (itemsArray.length === 0) {
        targetGridElement.innerHTML = `<p class="text-xs text-slate-400 italic py-8 text-center w-full col-span-full">📭 ไม่พบผลงานในรายการนี้</p>`;
        if (btnMore) btnMore.classList.add("hidden");
        return;
    }

    if (btnMore) {
        if (itemsArray.length > 6) {
            btnMore.classList.remove("hidden");
            btnMore.innerText = expandState[categoryName] ? "แสดงน้อยลง ▴" : `ดูทั้งหมด (${itemsArray.length}) ➔`;
        } else {
            btnMore.classList.add("hidden");
        }
    }

    if (expandState[categoryName]) {
        targetGridElement.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-4 pt-1";
    } else {
        targetGridElement.className = "flex overflow-x-auto gap-6 pb-4 pt-1 snap-x no-scrollbar";
    }

    const displayItems = expandState[categoryName] ? itemsArray : itemsArray.slice(0, 6);

    displayItems.forEach((item) => {
        const currentImg = item.imgLink || item.image || item.coverUrl || item.imageUrl || item.img || item.photo || "";
        
        const targetUid = item.ownerUid || item.ownerId || item.uid || item.userId || item.authorId || item.createdBy;
        
        const cardId = `card-${item.id}`;
        const timeDisplay = formatRelativeTime(item.createdAt);

        const card = document.createElement("div");
        card.id = cardId;
        card.dataset.id = item.id;
        card.className = "premium-card rounded-2xl overflow-hidden cursor-pointer flex flex-col justify-between p-3 space-y-3 flex-shrink-0 w-full snap-start bg-white border border-slate-100 shadow-xs hover:shadow-md transition-all";
        card.innerHTML = `
            <div class="relative aspect-video bg-slate-900 rounded-xl overflow-hidden shrink-0 section-media">
                <img src="${convertDriveUrl(currentImg)}" referrerpolicy="no-referrer" class="w-full h-full object-cover transition-transform duration-500 hover:scale-105" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600';">
                <span class="absolute bottom-2 right-2 bg-slate-950/70 backdrop-blur-xs text-[9px] text-slate-200 px-2 py-0.5 rounded font-medium tracking-tight">${timeDisplay}</span>
            </div>
            <div class="space-y-2 flex-grow flex flex-col justify-between">
                <div class="section-content">
                    <h4 class="text-xs font-bold text-slate-800 line-clamp-1">${item.title || "Untitled Work"}</h4>
                    <p class="text-[10px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">${item.description || "คลิกเพื่อดูข้อมูลผลงาน..."}</p>
                </div>
                <div class="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                    <div class="flex items-center space-x-2 truncate max-w-[75%] creator-profile-btn group/profile p-1 rounded-lg hover:bg-orange-50 transition-all cursor-pointer">
                        <div class="w-5 h-5 rounded-full overflow-hidden bg-slate-200 shrink-0 border border-slate-100 placeholder-avatar flex items-center justify-center text-[9px] font-bold text-slate-500 shadow-2xs">${(item.ownerName || "C").charAt(0).toUpperCase()}</div>
                        <span class="text-slate-500 font-medium truncate">By <span class="text-slate-700 font-bold group-hover/profile:text-orange-600 name-display">${item.ownerName || "Creator"}</span></span>
                    </div>
                    <span class="text-rose-500 font-bold shrink-0">❤️ <span class="likes-text-count">${item.likedBy?.likesCount || item.likes || 0}</span></span>
                </div>
            </div>
        `;

        card.onclick = (e) => {
            const isCreatorBtn = e.target.closest(".creator-profile-btn");
            if (isCreatorBtn) {
                e.stopPropagation();
                navigateToProfile(targetUid);
            } else {
                openPortfolioDetailModal(item);
            }
        };

        if (targetUid) {
            getDoc(doc(db, "users", targetUid)).then((userDoc) => {
                if (userDoc.exists()) {
                    const uData = userDoc.data();
                    const liveName = uData.name || uData.displayName || item.ownerName || "Creator";
                    const liveAvatar = uData.avatarUrl || uData.avatar || uData.photoURL || "";
                    
                    const element = document.getElementById(cardId);
                    if (element) {
                        const nameEl = element.querySelector(".name-display");
                        const avatarEl = element.querySelector(".placeholder-avatar");

                        if (nameEl) nameEl.innerText = liveName;
                        if (avatarEl) {
                            if (liveAvatar) {
                                avatarEl.innerHTML = `<img src="${convertDriveUrl(liveAvatar)}" referrerpolicy="no-referrer" class="w-full h-full object-cover" onerror="this.onerror=null; this.parentNode.innerText='${liveName.charAt(0).toUpperCase()}';">`;
                            } else {
                                avatarEl.innerText = liveName.charAt(0).toUpperCase();
                            }
                        }
                    }
                }
            }).catch(e => console.error(e));
        }

        targetGridElement.appendChild(card);
    });
}

// ================= 👤 2. POP-UP MODAL แสดงช่องทางติดต่อ (AUTO-BUILD IF MISSING) =================
function ensureCreatorContactModalDOM() {
    let modal = document.getElementById("creator-contact-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "creator-contact-modal";
        modal.className = "fixed inset-0 z-[10000] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 hidden";
        modal.innerHTML = `
            <div class="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-center space-y-4 relative">
                <button id="contact-modal-close-btn" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
                <div id="contact-pop-avatar" class="w-20 h-20 mx-auto rounded-full bg-orange-500 text-white font-black text-xl flex items-center justify-center shadow-md overflow-hidden cursor-pointer">C</div>
                <div>
                    <h3 id="contact-pop-name" class="text-base font-black text-slate-800">กำลังโหลด...</h3>
                    <p class="text-xs text-slate-400 font-medium mt-0.5">ช่องทางการติดต่อตรง</p>
                </div>
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left space-y-2 text-xs">
                    <div class="flex items-center space-x-2">
                        <span>📞</span>
                        <span id="contact-pop-phone" class="font-semibold text-slate-700">กำลังโหลด...</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span>💬</span>
                        <span id="contact-pop-line" class="font-semibold text-slate-700">กำลังโหลด...</span>
                    </div>
                </div>
                <div id="contact-social-box" class="pt-2 flex flex-col gap-2 w-full"></div>
            </div>
        `;
        document.body.appendChild(modal);

        const closeBtn = modal.querySelector("#contact-modal-close-btn");
        closeBtn.onclick = () => {
            modal.classList.add("hidden");
            modal.style.display = "none";
        };
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.classList.add("hidden");
                modal.style.display = "none";
            }
        };
    }
    return modal;
}

async function openCreatorContactModal(uid, fallbackName) {
    const contactModal = ensureCreatorContactModalDOM();

    const popName = document.getElementById("contact-pop-name");
    const popPhone = document.getElementById("contact-pop-phone");
    const popLine = document.getElementById("contact-pop-line");
    const popAvatarZone = document.getElementById("contact-pop-avatar");
    let socialBox = document.getElementById("contact-social-box");

    if (popName) popName.innerText = fallbackName || "กำลังโหลด...";
    if (popPhone) popPhone.innerText = "กำลังโหลด...";
    if (popLine) popLine.innerText = "กำลังโหลด...";
    if (socialBox) socialBox.innerHTML = "";

    if (uid) {
        try {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
                const uData = userDoc.data();
                const finalName = uData.name || uData.displayName || fallbackName || "Creator";
                if (popName) popName.innerText = finalName;
                if (popPhone) popPhone.innerText = uData.phone || uData.tel || "ไม่มีข้อมูลติดต่อโทรศัพท์";
                if (popLine) popLine.innerText = uData.line || uData.lineId || "ไม่มีข้อมูลไอดี Line";
                
                const userAvatar = uData.avatarUrl || uData.avatar || uData.photoURL || "";
                if (popAvatarZone) {
                    popAvatarZone.className = "w-20 h-20 mx-auto rounded-full bg-orange-500 text-white font-black text-xl flex items-center justify-center shadow-md overflow-hidden cursor-pointer hover:opacity-90 active:scale-95 transition-all relative z-10";
                    if (userAvatar) {
                        popAvatarZone.innerHTML = `<img src="${convertDriveUrl(userAvatar)}" referrerpolicy="no-referrer" class="w-full h-full object-cover select-none pointer-events-none" onerror="this.onerror=null; this.parentNode.innerText='${finalName.charAt(0).toUpperCase()}';">`;
                        
                        popAvatarZone.onclick = (e) => { 
                            e.preventDefault();
                            e.stopPropagation(); 
                            openAvatarPreviewPopup(userAvatar); 
                        };
                    } else {
                        popAvatarZone.innerHTML = "";
                        popAvatarZone.innerText = finalName.charAt(0).toUpperCase();
                        popAvatarZone.onclick = null;
                    }
                }

                const finalFacebook = uData.facebook || uData.fb || "";
                const finalInstagram = uData.instagram || uData.ig || "";
                const finalTiktok = uData.tiktok || "";
                
                const linksToCheck = [];
                if (finalFacebook) linksToCheck.push(finalFacebook);
                if (finalInstagram) linksToCheck.push(finalInstagram);
                if (finalTiktok) linksToCheck.push(finalTiktok);

                linksToCheck.forEach(urlStr => {
                    const parsed = parseSocialLink(urlStr);
                    if (parsed && socialBox) {
                        const aElement = document.createElement("a");
                        aElement.href = parsed.originalUrl;
                        aElement.target = "_blank";
                        aElement.className = `flex items-center justify-center space-x-2 w-full py-2 px-3 rounded-xl font-bold text-xs transition-all transform hover:scale-[1.02] active:scale-[0.98] ${parsed.colorClass}`;
                        aElement.innerHTML = `<span>🔗 ${parsed.platform}: ${parsed.displayName}</span>`;
                        socialBox.appendChild(aElement);
                    }
                });

            } else {
                if (popPhone) popPhone.innerText = "ไม่พบโปรไฟล์ในฐานข้อมูล";
                if (popLine) popLine.innerText = "ไม่พบโปรไฟล์ในฐานข้อมูล";
            }
        } catch (err) {
            console.error(err);
        }
    }

    contactModal.classList.remove("hidden");
    contactModal.style.display = "flex";
}

// ================= 🖼️ 3. POP-UP MODAL แสดงรายละเอียดชิ้นงาน =================
async function openPortfolioDetailModal(item) {
    activePostId = item.id;
    activeReplyToId = null; 
    updateReplyIndicator(null);

    const modal = document.getElementById("portfolio-modal");
    const modalImg = document.getElementById("modal-img");
    const modalVideo = document.getElementById("modal-video");
    
    let modalIframe = document.getElementById("modal-iframe");
    if (!modal) return;

    // Reset Elements
    if (modalImg) { modalImg.src = ""; modalImg.classList.add("hidden"); }
    if (modalVideo) { modalVideo.src = ""; if (typeof modalVideo.pause === 'function') modalVideo.pause(); modalVideo.classList.add("hidden"); }
    if (modalIframe) { modalIframe.src = ""; modalIframe.classList.add("hidden"); }

    const mediaLink = item.imgLink || item.image || item.coverUrl || item.imageUrl || item.img || item.photo || "";
    const targetUid = item.ownerUid || item.ownerId || item.uid || item.userId || item.authorId || item.createdBy;
    
    const lowerLink = mediaLink.toLowerCase();
    const isGoogleDrive = lowerLink.includes("drive.google.com");
    const isYouTube = lowerLink.includes("youtube.com") || lowerLink.includes("youtu.be");
    const isVideoFile = lowerLink.includes(".mp4") || lowerLink.includes(".webm") || lowerLink.includes(".mov");

    if (isYouTube) {
        if (!modalIframe && modalVideo) {
            modalIframe = document.createElement("iframe");
            modalIframe.id = "modal-iframe";
            modalVideo.parentNode.insertBefore(modalIframe, modalVideo);
        }
        if (modalIframe) {
            modalIframe.classList.remove("hidden");
            modalIframe.className = "w-full h-full object-contain bg-slate-950 border-0 block aspect-video";
            
            let videoId = "";
            if (lowerLink.includes("shorts/")) {
                videoId = mediaLink.split("shorts/")[1].split("?")[0];
            } else if (lowerLink.includes("v=")) {
                videoId = new URL(mediaLink).searchParams.get("v");
            } else if (lowerLink.includes("youtu.be/")) {
                videoId = mediaLink.split("youtu.be/")[1].split("?")[0];
            }
            modalIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
            modalIframe.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
            modalIframe.setAttribute("allowfullscreen", "true");
        }
    } 
    else if (isGoogleDrive) {
        if (!modalIframe && modalVideo) {
            modalIframe = document.createElement("iframe");
            modalIframe.id = "modal-iframe";
            modalVideo.parentNode.insertBefore(modalIframe, modalVideo);
        }
        if (modalIframe) {
            modalIframe.classList.remove("hidden");
            modalIframe.className = "w-full h-full object-contain bg-slate-950 border-0 block aspect-video";
            
            let embedUrl = mediaLink;
            if (mediaLink.includes("/view")) {
                embedUrl = mediaLink.replace(/\/view.*/, "/preview");
            } else if (mediaLink.includes("id=")) {
                const urlObj = new URL(mediaLink);
                const fileId = urlObj.searchParams.get("id");
                embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
            } else if (!mediaLink.endsWith("/preview")) {
                embedUrl = `${mediaLink}/preview`;
            }
            modalIframe.src = embedUrl;
            modalIframe.setAttribute("allow", "autoplay");
        }
    } 
    else if (isVideoFile) {
        if (modalVideo) {
            modalVideo.classList.remove("hidden");
            modalVideo.className = "w-full h-full object-contain bg-slate-950 border-0 block";
            modalVideo.src = typeof convertDriveVideoUrl === 'function' ? convertDriveVideoUrl(mediaLink) : mediaLink;
            modalVideo.setAttribute("controls", "true");
            modalVideo.setAttribute("autoplay", "true");
        }
    } 
    else {
        if (modalImg) {
            modalImg.classList.remove("hidden");
            modalImg.className = "max-w-full max-h-full object-contain rounded-xl block";
            modalImg.src = mediaLink ? convertDriveUrl(mediaLink) : "https://via.placeholder.com/600x400?text=No+Image+Available";
        }
    }

    if (document.getElementById("modal-category")) document.getElementById("modal-category").innerText = item.category || "GENERAL";
    if (document.getElementById("modal-title")) document.getElementById("modal-title").innerText = item.title || "Untitled";
    if (document.getElementById("modal-desc")) document.getElementById("modal-desc").innerText = item.description || "No description provided.";
    
    const modalDescElement = document.getElementById("modal-desc");
    if (modalDescElement) {
        let internalProfileBlock = document.getElementById("modal-internal-creator-block");
        if (!internalProfileBlock) {
            internalProfileBlock = document.createElement("div");
            internalProfileBlock.id = "modal-internal-creator-block";
            modalDescElement.parentNode.insertBefore(internalProfileBlock, modalDescElement.nextSibling);
        }
        internalProfileBlock.className = "flex items-center space-x-3 p-3 mt-4 rounded-2xl bg-orange-50/60 border border-orange-100 hover:bg-orange-100/80 cursor-pointer transition-all group/deal w-full text-left";
        internalProfileBlock.innerHTML = `
            <div class="w-9 h-9 rounded-full overflow-hidden bg-slate-200 shrink-0 border border-white inner-avatar-box flex items-center justify-center text-xs font-bold text-slate-400 aspect-square hover:opacity-95 transition-opacity">
                ${(item.ownerName || "C").charAt(0).toUpperCase()}
            </div>
            <div class="flex-grow min-w-0 pointer-deal-text">
                <p class="text-[9px] text-orange-500 font-bold leading-none mb-1">💼 คลิกเพื่อดูหน้าโปรไฟล์และ Bio ผู้โพสต์</p>
                <span class="text-xs font-black text-slate-700 truncate block group-hover/deal:text-orange-600 inner-name-box">${item.ownerName || "Creator"}</span>
            </div>
        `;

        if (targetUid) {
            getDoc(doc(db, "users", targetUid)).then((userDoc) => {
                if (userDoc.exists()) {
                    const uData = userDoc.data();
                    const liveName = uData.name || uData.displayName || item.ownerName || "Creator";
                    const liveAvatar = uData.avatarUrl || uData.avatar || uData.photoURL || "";
                    
                    internalProfileBlock.querySelector(".inner-name-box").innerText = liveName;
                    if (liveAvatar) {
                        const innerAvt = internalProfileBlock.querySelector(".inner-avatar-box");
                        innerAvt.innerHTML = `<img src="${convertDriveUrl(liveAvatar)}" referrerpolicy="no-referrer" class="w-full h-full object-cover rounded-full">`;
                    }
                }
            }).catch(e => console.error(e));

            internalProfileBlock.onclick = (e) => {
                e.stopPropagation();
                navigateToProfile(targetUid);
            };
        } else {
            internalProfileBlock.onclick = (e) => {
                e.stopPropagation();
                showToast("ไม่พบ ID ผู้โพสต์ชิ้นงานนี้", "error");
            };
        }
    }

    const countDisplay = document.getElementById("modal-like-count");
    const likeBtn = document.getElementById("modal-like-btn");
    
    if (countDisplay) countDisplay.innerText = item.likedBy?.likesCount || item.likes || 0;

    const hasLiked = currentUserId && item.likedBy && item.likedBy[currentUserId] === true;
    if (likeBtn) {
        if (hasLiked) {
            likeBtn.className = "flex items-center space-x-1.5 bg-rose-500 hover:bg-rose-600 border border-rose-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition-transform active:scale-95 shadow-md shadow-rose-500/10";
        } else {
            likeBtn.className = "flex items-center space-x-1.5 bg-rose-50 hover:bg-rose-100/70 border border-rose-100 text-rose-500 font-bold text-xs px-3 py-1.5 rounded-xl transition-transform active:scale-95 shadow-2xs";
        }

        likeBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!currentUserId) {
                openAuthPopup();
                return;
            }

            const postRef = doc(db, "portfolios", item.id);
            try {
                const freshSnap = await getDoc(postRef);
                if (!freshSnap.exists()) return;
                
                const freshData = freshSnap.data();
                const currentLikesMap = freshData.likedBy || {};
                const isAlreadyLiked = currentLikesMap[currentUserId] === true;
                let nextLikesCount = (freshData.likes || 0);

                if (isAlreadyLiked) {
                    currentLikesMap[currentUserId] = false;
                    nextLikesCount = Math.max(0, nextLikesCount - 1);
                } else {
                    currentLikesMap[currentUserId] = true;
                    nextLikesCount += 1;
                }

                await updateDoc(postRef, { likes: nextLikesCount, likedBy: currentLikesMap });
                if (countDisplay) countDisplay.innerText = nextLikesCount;
                if (isAlreadyLiked) {
                    likeBtn.className = "flex items-center space-x-1.5 bg-rose-50 hover:bg-rose-100/70 border border-rose-100 text-rose-500 font-bold text-xs px-3 py-1.5 rounded-xl transition-transform active:scale-95 shadow-2xs";
                } else {
                    likeBtn.className = "flex items-center space-x-1.5 bg-rose-500 hover:bg-rose-600 border border-rose-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition-transform active:scale-95 shadow-md shadow-rose-500/10";
                }
            } catch (err) { console.error(err); }
        };
    }

    startCommentsRealtimeStream(item.id);
    modal.classList.remove("hidden");
    modal.style.display = "flex";
}

// ================= 💬 4. ระบบจัดการคอมเมนต์แบบ REALTIME =================
function startCommentsRealtimeStream(postId) {
    if (commentUnsubscribe) { commentUnsubscribe(); commentUnsubscribe = null; }

    const commentsList = document.getElementById("modal-comments-list") || document.getElementById("modal-comments-container") || document.getElementById("comments-list-container");
    const commentCountText = document.getElementById("modal-comment-count") || document.getElementById("modal-comments-count");
    if (!commentsList) return;

    commentsList.innerHTML = `<div class="flex justify-center py-4"><div class="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>`;

    window.onclick = (e) => {
        if (!e.target.matches('.btn-options-trigger')) {
            document.querySelectorAll('.comment-options-menu').forEach(m => m.classList.add('hidden'));
        }
    };

    const q = query(collection(db, "portfolios", postId, "comments"), orderBy("createdAt", "asc"));

    commentUnsubscribe = onSnapshot(q, (snapshot) => {
        commentsList.innerHTML = "";
        let totalCount = snapshot.size;
        if (commentCountText) commentCountText.innerText = totalCount;

        if (snapshot.empty) {
            commentsList.innerHTML = `
                <div class="text-center py-8 text-slate-400">
                    <p class="text-[12px]">ยังไม่มีความคิดเห็น</p>
                    <p class="text-[10px] mt-0.5">ร่วมแสดงความคิดเห็นเป็นคนแรก!</p>
                </div>
            `;
            return;
        }

        const commentsMap = new Map();
        const rootComments = [];
        const repliesMap = new Map();

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const commentObj = { id: docSnap.id, ...data };
            commentsMap.set(docSnap.id, commentObj);

            if (data.parentCommentId) {
                if (!repliesMap.has(data.parentCommentId)) {
                    repliesMap.set(data.parentCommentId, []);
                }
                repliesMap.get(data.parentCommentId).push(commentObj);
            } else {
                rootComments.push(commentObj);
            }
        });

        const createCommentItem = (comment, isReply = false) => {
            const comId = comment.id;
            const commentUserId = comment.userId || comment.uid || comment.ownerId || comment.authorId || comment.createdBy || "";
            const timeAgo = formatRelativeTime(comment.createdAt);
            
            const fallbackName = comment.userName || comment.displayName || comment.name || comment.authorName || "Anonymous";
            const fallbackAvatar = comment.avatarUrl || comment.avatar || comment.photoURL || comment.userAvatar || "";
            
            const isOwnerOrAdmin = (currentUserId && (commentUserId === currentUserId)) || currentUserRole === "admin" || currentUserRole === "dev";

            const div = document.createElement("div");
            const commentElementId = `comment-${comId}`;
            div.id = commentElementId;
            div.className = `p-3 rounded-2xl border transition-all relative group ${
                isReply 
                ? "bg-slate-100/70 border-slate-200/50 text-xs" 
                : "bg-slate-50 border-slate-100 text-xs shadow-2xs"
            }`;

            let replyTag = "";
            if (comment.parentCommentName && isReply) {
                replyTag = `<span class="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-md mr-1 font-bold">@${comment.parentCommentName}</span>`;
            }

            let optionsBtnHtml = "";
            if (isOwnerOrAdmin) {
                optionsBtnHtml = `
                    <div class="relative shrink-0">
                        <button class="w-6 h-6 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 font-black text-[12px] transition-colors btn-options-trigger leading-none" title="ตัวเลือก">•••</button>
                        <div class="hidden absolute right-0 top-7 bg-white shadow-xl rounded-xl border border-slate-100 py-1 w-28 z-50 comment-options-menu animate-fade-in">
                            <button class="w-full text-left px-3 py-1.5 text-[11px] text-rose-500 hover:bg-rose-50 font-bold flex items-center space-x-1.5 btn-delete-comment">
                                <span>🗑️</span> <span>ลบข้อความ</span>
                            </button>
                        </div>
                    </div>
                `;
            }

            const avatarHtml = fallbackAvatar 
                ? `<img src="${convertDriveUrl(fallbackAvatar)}" referrerpolicy="no-referrer" class="w-full h-full object-cover rounded-full" onerror="this.onerror=null; this.parentNode.innerText='${fallbackName.charAt(0).toUpperCase()}';">`
                : fallbackName.charAt(0).toUpperCase();

            div.innerHTML = `
                <div class="flex items-start justify-between">
                    <div class="flex items-center space-x-2.5 cursor-pointer group/author btn-comment-author">
                        <div class="w-8 h-8 rounded-full overflow-hidden bg-orange-500 text-white font-bold flex items-center justify-center text-xs placeholder-avatar-comment shrink-0 border border-slate-200 shadow-2xs">
                            ${avatarHtml}
                        </div>
                        <div class="flex flex-col">
                            <span class="font-bold text-slate-800 text-[11px] leading-tight name-comment-display group-hover/author:text-orange-600 group-hover/author:underline">${fallbackName}</span>
                            <span class="text-[9px] text-slate-400 font-light leading-none mt-0.5">${timeAgo}</span>
                        </div>
                    </div>
                    ${optionsBtnHtml}
                </div>
                <div class="pl-10 mt-1">
                    <p class="text-slate-700 leading-relaxed font-normal text-[11px]">${replyTag}${comment.text || comment.message || ""}</p>
                    <div class="mt-1 flex items-center space-x-3">
                        <button class="text-[10px] font-bold text-slate-400 hover:text-orange-500 transition-colors btn-reply-trigger" data-id="${comId}" data-name="${fallbackName}">ตอบกลับ</button>
                    </div>
                </div>
            `;

            const authorBtn = div.querySelector(".btn-comment-author");
            if (authorBtn) {
                authorBtn.onclick = (e) => {
                    e.stopPropagation();
                    navigateToProfile(commentUserId);
                };
            }

            if (commentUserId) {
                getDoc(doc(db, "users", commentUserId)).then((userDoc) => {
                    if (userDoc.exists()) {
                        const uData = userDoc.data();
                        const liveName = uData.name || uData.displayName || fallbackName;
                        const liveAvatar = uData.avatarUrl || uData.avatar || uData.photoURL || "";

                        const currentCommentEl = document.getElementById(commentElementId);
                        if (currentCommentEl) {
                            const nameDisplay = currentCommentEl.querySelector(".name-comment-display");
                            if (nameDisplay) nameDisplay.innerText = liveName;

                            const replyBtn = currentCommentEl.querySelector(".btn-reply-trigger");
                            if (replyBtn) replyBtn.setAttribute("data-name", liveName);

                            const avatarBox = currentCommentEl.querySelector(".placeholder-avatar-comment");
                            if (avatarBox && liveAvatar) {
                                avatarBox.innerHTML = `<img src="${convertDriveUrl(liveAvatar)}" referrerpolicy="no-referrer" class="w-full h-full object-cover rounded-full" onerror="this.onerror=null; this.parentNode.innerText='${liveName.charAt(0).toUpperCase()}';">`;
                            }
                        }
                    }
                }).catch(e => console.error("Error fetching comment user info:", e));
            }

            const optTrigger = div.querySelector(".btn-options-trigger");
            if (optTrigger) {
                optTrigger.onclick = (e) => {
                    e.stopPropagation();
                    const menu = div.querySelector(".comment-options-menu");
                    const isHidden = menu.classList.contains("hidden");
                    document.querySelectorAll('.comment-options-menu').forEach(m => m.classList.add('hidden'));
                    if (isHidden) menu.classList.remove("hidden");
                };
            }

            div.querySelector(".btn-reply-trigger").onclick = (e) => {
                e.preventDefault();
                if (!currentUserId) {
                    openAuthPopup();
                    return;
                }
                activeReplyToId = comId;
                const name = e.target.getAttribute("data-name");
                updateReplyIndicator(name);
                const input = document.getElementById("modal-comment-input");
                if (input) input.focus();
            };

            const deleteBtn = div.querySelector(".btn-delete-comment");
            if (deleteBtn) {
                deleteBtn.onclick = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const isConfirmed = await showConfirmModal("ลบความคิดเห็น?", "คุณแน่ใจหรือไม่ว่าต้องการลบความคิดเห็นนี้?");
                    if (isConfirmed) {
                        try {
                            await deleteDoc(doc(db, "portfolios", postId, "comments", comId));
                            showToast("ลบความคิดเห็นสำเร็จแล้ว");
                        } catch (err) {
                            console.error(err);
                            showToast("ไม่สามารถลบความคิดเห็นได้", "error");
                        }
                    }
                };
            }

            return div;
        };

        const renderRepliesRecursive = (parentId, containerEl) => {
            const replies = repliesMap.get(parentId);
            if (!replies || replies.length === 0) return;

            const repliesWrapper = document.createElement("div");
            repliesWrapper.className = "pl-6 mt-2 space-y-2 border-l-2 border-slate-100 ml-3";

            replies.forEach((reply) => {
                const replyEl = createCommentItem(reply, true);
                repliesWrapper.appendChild(replyEl);
                renderRepliesRecursive(reply.id, repliesWrapper);
            });

            containerEl.appendChild(repliesWrapper);
        };

        const fragment = document.createDocumentFragment();

        rootComments.forEach((rootComment) => {
            const rootItemWrapper = document.createElement("div");
            rootItemWrapper.className = "space-y-1 mb-3";

            const rootCommentEl = createCommentItem(rootComment, false);
            rootItemWrapper.appendChild(rootCommentEl);

            renderRepliesRecursive(rootComment.id, rootItemWrapper);

            fragment.appendChild(rootItemWrapper);
        });

        commentsList.appendChild(fragment);
        commentsList.scrollTop = commentsList.scrollHeight;
    }, (err) => {
        console.error("Comments sub error:", err);
        commentsList.innerHTML = '<div class="text-center py-4 text-rose-500 text-xs">เกิดข้อผิดพลาดในการโหลดความคิดเห็น</div>';
    });
}

function updateReplyIndicator(name) {
    const box = document.getElementById("comment-reply-indicator");
    if (!box) return;
    if (name) {
        box.className = "flex items-center justify-between bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-slate-200/60 mb-2 animate-fade-in";
        box.innerHTML = `
            <span>🔄 กำลังตอบกลับคุณ: @${name}</span>
            <button type="button" id="btn-cancel-reply" class="text-slate-400 hover:text-slate-800 ml-2">✕ ยกเลิก</button>
        `;
        document.getElementById("btn-cancel-reply").onclick = () => {
            activeReplyToId = null;
            updateReplyIndicator(null);
        };
    } else {
        box.innerHTML = "";
        box.className = "";
    }
}

// 📤 ระบบส่งความคิดเห็น
const commentForm = document.getElementById("modal-comment-form") || document.getElementById("comment-form");
const commentInput = document.getElementById("modal-comment-input");

if (commentInput) {
    commentInput.addEventListener("focus", () => {
        if (!currentUserId) {
            commentInput.blur();
            openAuthPopup();
        }
    });
}

if (commentForm) {
    commentForm.onsubmit = async (e) => {
        e.preventDefault();
        if (!activePostId) return;

        if (!currentUserId) {
            openAuthPopup();
            return;
        }

        const input = document.getElementById("modal-comment-input");
        const commentText = input.value.trim();
        if (!commentText) return;

        try {
            let parentName = null;
            if (activeReplyToId) {
                const parentDoc = await getDoc(doc(db, "portfolios", activePostId, "comments", activeReplyToId));
                if (parentDoc.exists()) {
                    const pData = parentDoc.data();
                    parentName = pData.userName || pData.displayName || pData.name || "Anonymous";
                }
            }

            await addDoc(collection(db, "portfolios", activePostId, "comments"), {
                userId: currentUserId,
                uid: currentUserId,
                ownerId: currentUserId,
                userName: currentUserName || auth.currentUser?.displayName || "Anonymous",
                displayName: currentUserName || auth.currentUser?.displayName || "Anonymous",
                avatarUrl: currentUserAvatar || auth.currentUser?.photoURL || "",
                photoURL: currentUserAvatar || auth.currentUser?.photoURL || "",
                text: commentText,
                message: commentText,
                parentCommentId: activeReplyToId || null,
                parentCommentName: parentName,
                createdAt: new Date().toISOString()
            });

            input.value = "";
            activeReplyToId = null;
            updateReplyIndicator(null);
            showToast("ส่งความคิดเห็นของคุณเรียบร้อยแล้ว");
        } catch (err) {
            console.error("Error sending comment:", err);
            showToast("ไม่สามารถส่งความคิดเห็นได้ในขณะนี้", "error");
        }
    };
}

// 🔏 จัดการ Event ปิดหน้าต่างโมดอลชิ้นงาน
const portfolioModal = document.getElementById("portfolio-modal");
const closeBtn = document.getElementById("modal-close-btn") || document.getElementById("portfolio-modal-close-btn");
if (closeBtn && portfolioModal) {
    const closeModalFunc = () => {
        portfolioModal.classList.add("hidden");
        portfolioModal.style.display = "none";
        const modalImg = document.getElementById("modal-img");
        const modalVideo = document.getElementById("modal-video");
        const modalIframe = document.getElementById("modal-iframe");
        
        if (modalImg) modalImg.src = "";
        if (modalVideo) { modalVideo.src = ""; if (typeof modalVideo.pause === 'function') modalVideo.pause(); }
        if (modalIframe) modalIframe.src = "";

        if (commentUnsubscribe) { commentUnsubscribe(); commentUnsubscribe = null; }
        activePostId = null;
        activeReplyToId = null;
        updateReplyIndicator(null);
    };

    closeBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); closeModalFunc(); };
    portfolioModal.onclick = (e) => { if (e.target === portfolioModal) closeModalFunc(); };
}

// 🚀 บูตระบบเมื่อโหลดหน้าเว็บสำเร็จ
window.addEventListener("DOMContentLoaded", () => {
    initGalleryStream();
    initCategoryFilter();
});