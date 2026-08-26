import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    doc, getDoc, updateDoc, deleteDoc, collection, query, where, onSnapshot, orderBy, getDocs, addDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { convertDriveUrl, formatRelativeTime, parseSocialLink } from "./utils.js";

// Global Live States
let loggedInUserId = null;
let loggedInUserName = "Anonymous";
let targetUserId = null;
let activePostId = null;
let activePostData = null;

let commentUnsubscribe = null; 
let portfolioUnsubscribe = null;
let savedUnsubscribe = null;

let currentPage = 1;
const ITEMS_PER_PAGE = 6;
let cachedUserPosts = [];
let searchQuery = ""; 

// 🎯 ฟังก์ชันดึง UID จาก URL หรือ Auth
function getUserIdFromUrlOrAuth() {
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('id');
    
    if (idFromUrl) {
        return idFromUrl;
    }
    
    if (loggedInUserId) {
        const newUrl = `${window.location.pathname}?id=${loggedInUserId}`;
        window.history.replaceState({ path: newUrl }, '', newUrl);
        return loggedInUserId;
    }
    
    return null;
}

function parseLikesCount(data) {
    if (!data) return 0;
    if (typeof data.likes === "number" && !isNaN(data.likes)) return data.likes;
    if (data.likedBy && typeof data.likedBy === "object") {
        if (typeof data.likedBy.likesCount === "number" && !isNaN(data.likedBy.likesCount)) {
            return data.likedBy.likesCount;
        }
    }
    const parsed = parseInt(data.likes, 10);
    return isNaN(parsed) ? 0 : parsed;
}

// 🔔 ระบบ Pop-up Toast แจ้งเตือน
const toast = (msg, type = "success") => {
    if (typeof window.showCustomAlert === 'function') { 
        window.showCustomAlert(msg, type); 
        return;
    }

    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "fixed bottom-5 right-5 z-[10000] space-y-2 pointer-events-none";
        document.body.appendChild(container);
    }

    const toastEl = document.createElement("div");
    toastEl.className = `pointer-events-auto flex items-center p-4 rounded-2xl shadow-xl border border-white/60 transition-all duration-300 transform translate-y-2 opacity-0 max-w-sm ${
        type === "success" 
        ? "bg-emerald-500 text-white" 
        : type === "error" 
        ? "bg-rose-500 text-white" 
        : "bg-amber-500 text-white"
    }`;

    const icon = type === "success" ? "✨" : type === "error" ? "❌" : "⚠️";

    toastEl.innerHTML = `
        <span class="mr-2.5 text-sm">${icon}</span>
        <p class="text-xs font-bold tracking-wide">${msg}</p>
    `;

    container.appendChild(toastEl);

    setTimeout(() => { toastEl.classList.remove("translate-y-2", "opacity-0"); }, 10);
    setTimeout(() => {
        toastEl.classList.add("opacity-0", "translate-y-[-10px]");
        setTimeout(() => toastEl.remove(), 300);
    }, 3500);
};

const BAD_WORDS = ["ควย", "เย็ด", "เหี้ย", "สัส", "ชาติต้น", "มึง", "กู", "ดอ", "แรด", "ร่าน"];
function containsBadWords(...texts) {
    const combinedText = texts.join(" ").toLowerCase();
    return BAD_WORDS.some(word => combinedText.includes(word));
}

function normalizeCategory(category) {
    if (!category) return "2D Graphic Design";
    const c = category.trim();
    if (["Graphic Design", "Graphics & Design", "Graphics", "2D"].includes(c)) return "2D Graphic Design";
    if (["Motion Graphic / 3D", "3D", "Motion", "Motion Graphic", "3D & Motion Graphics"].includes(c)) return "3D & Motion Graphics";
    if (["photography", "Photo"].includes(c.toLowerCase())) return "Photography";
    if (["Video & Animation", "Video", "Video Editor"].includes(c)) return "Video Editor";
    return c;
}

function updateLikeBtnStyle(btnElement, isLiked) {
    if (!btnElement) return;
    if (isLiked) {
        btnElement.classList.add("text-rose-500", "scale-105");
        btnElement.classList.remove("text-slate-500", "text-orange-600");
    } else {
        btnElement.classList.remove("text-rose-500", "scale-105");
        btnElement.classList.add("text-orange-600");
    }
}

function updateSaveBtnStyle(btnElement, isSaved) {
    if (!btnElement) return;
    const icon = btnElement.querySelector("#save-icon");
    const text = btnElement.querySelector("#save-btn-text");

    if (isSaved) {
        btnElement.classList.add("bg-amber-500", "text-white", "border-amber-500");
        btnElement.classList.remove("text-slate-500", "border-slate-200", "hover:bg-slate-50");
        if (icon) icon.classList.add("fill-current");
        if (text) text.innerText = "บันทึกแล้ว";
    } else {
        btnElement.classList.remove("bg-amber-500", "text-white", "border-amber-500");
        btnElement.classList.add("text-slate-500", "border-slate-200", "hover:bg-slate-50");
        if (icon) icon.classList.remove("fill-current");
        if (text) text.innerText = "บันทึก";
    }
}

// 🖼️ Pop-up ขยายรูปโปรไฟล์
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

// 🌐 ฟังก์ชันแสดงผล Social & Line Links
function renderSocialLinks(socials = {}, lineId = "") {
    const container = document.getElementById('user-social-links');
    if (!container) return;

    const lineLinkBtn = document.getElementById("link-line");
    const lineLabel = document.getElementById("label-line");
    if (lineLinkBtn && lineLabel) {
        if (lineId && lineId.trim() !== "") {
            const cleanLine = lineId.trim().replace(/^@/, '');
            lineLinkBtn.href = `https://line.me/ti/p/~${cleanLine}`;
            lineLabel.innerText = `@${cleanLine}`;
            lineLinkBtn.classList.remove("hidden");
        } else {
            lineLinkBtn.classList.add("hidden");
        }
    }

    const getUsername = (url) => {
        try {
            const parsed = new URL(url);
            const pathname = parsed.pathname.replace(/\/$/, '');
            const parts = pathname.split('/').filter(Boolean);
            return parts.length > 0 ? `@${parts[parts.length - 1]}` : parsed.hostname;
        } catch {
            return url;
        }
    };

    const platforms = [
        {
            key: 'facebook',
            name: 'Facebook',
            url: socials.facebook,
            bgClass: 'bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] border-[#1877F2]/20',
            svg: `<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`
        },
        {
            key: 'instagram',
            name: 'Instagram',
            url: socials.instagram,
            bgClass: 'bg-rose-500/10 hover:bg-rose-500/20 text-[#E4405F] border-rose-500/20',
            svg: `<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`
        },
        {
            key: 'website',
            name: 'Website',
            url: socials.website,
            bgClass: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-[#10B981] border-emerald-500/20',
            svg: `<svg class="w-3.5 h-3.5 fill-none stroke-current" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>`
        }
    ];

    let html = lineLinkBtn ? lineLinkBtn.outerHTML : '';
    platforms.forEach(p => {
        if (p.url && p.url.trim() !== '') {
            const handle = getUsername(p.url);
            html += `
                <a href="${p.url}" target="_blank" rel="noopener noreferrer" 
                   class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 hover:scale-105 active:scale-95 ${p.bgClass}">
                    ${p.svg}
                    <span class="truncate max-w-[110px]">${handle}</span>
                </a>
            `;
        }
    });

    container.innerHTML = html;
}

// 👤 อัปเดต DOM ส่วนของ Profile
function updateProfileDOM(name, avatarUrl, email = "", bio = "", bannerUrl = "", socials = {}, purpose = "freelance", lineId = "") {
    const nameTargets = ["user-display-name", "left-name-display", "profile-name-display", "user-name-display"];
    nameTargets.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = name;
    });

    const emailEl = document.getElementById("user-email");
    if (emailEl) emailEl.innerText = email || "Thailand";

    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=f97316&color=fff`;
    const finalAvatar = avatarUrl || defaultAvatar;
    const finalAvatarSrc = convertDriveUrl(finalAvatar);

    const userAvatarEl = document.getElementById("user-avatar");
    if (userAvatarEl) {
        userAvatarEl.src = finalAvatarSrc;
        userAvatarEl.onerror = () => { userAvatarEl.src = defaultAvatar; };
        userAvatarEl.onclick = () => openAvatarPreviewPopup(avatarUrl || defaultAvatar);
    }

    const DEFAULT_SITE_BANNER = "/img/banner.jpg";
    const bannerEl = document.getElementById("profile-banner-img");
    if (bannerEl) {
        const finalBanner = bannerUrl ? convertDriveUrl(bannerUrl) : DEFAULT_SITE_BANNER;
        bannerEl.src = finalBanner;
        bannerEl.onerror = () => { bannerEl.src = DEFAULT_SITE_BANNER; };
    }

    const bioEl = document.getElementById("user-bio");
    if (bioEl) bioEl.innerText = bio || "ยังไม่มีคำอธิบายโปรไฟล์";

    const purposeBadge = document.getElementById("user-purpose-badge");
    if (purposeBadge) {
        if (purpose === "client") {
            purposeBadge.innerText = "EMPLOYER";
            purposeBadge.className = "px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-blue-100 text-blue-700 border border-blue-200";
        } else {
            purposeBadge.innerText = "FREELANCE";
            purposeBadge.className = "px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-orange-100 text-orange-700 border border-orange-200";
        }
    }

    renderSocialLinks(socials, lineId);

    if (document.getElementById("edit-bio")) document.getElementById("edit-bio").value = bio || "";
    if (document.getElementById("edit-line")) document.getElementById("edit-line").value = lineId || "";
    if (document.getElementById("edit-facebook")) document.getElementById("edit-facebook").value = socials.facebook || "";
    if (document.getElementById("edit-instagram")) document.getElementById("edit-instagram").value = socials.instagram || "";
    if (document.getElementById("edit-website")) document.getElementById("edit-website").value = socials.website || "";

    const purposeRadio = document.querySelector(`input[name="user_purpose"][value="${purpose}"]`);
    if (purposeRadio) purposeRadio.checked = true;
}

// 🌐 อัปเดต DOM ส่วน Navbar
async function updateNavbarDOM(user) {
    if (!user) return;

    let name = user.displayName || user.email.split('@')[0] || "User";
    let email = user.email || "";
    let avatarUrl = user.photoURL || "";

    try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            const userData = userDoc.data();
            name = userData.displayName || userData.fullName || userData.name || name;
            avatarUrl = userData.photoURL || userData.avatar || userData.avatarUrl || avatarUrl;
        }
    } catch (err) {
        console.error("Error fetching user data for Navbar:", err);
    }

    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=f97316&color=fff`;
    const finalAvatar = avatarUrl ? convertDriveUrl(avatarUrl) : defaultAvatar;

    const dropdownName = document.getElementById("dropdown-user-name");
    if (dropdownName) dropdownName.innerText = name;

    const dropdownEmail = document.getElementById("dropdown-user-email");
    if (dropdownEmail) dropdownEmail.innerText = email;

    ["header-avatar", "dropdown-avatar", "navbar-avatar", "user-avatar-nav"].forEach(id => {
        const imgEl = document.getElementById(id);
        if (imgEl) {
            imgEl.src = finalAvatar;
            imgEl.onerror = () => { imgEl.src = defaultAvatar; };
        }
    });
}

// 🔍 ฟังก์ชันแสดงผลและกรองโพสต์ด้วยระบบค้นหา (Fuzzy Match)
function renderPaginatedPosts() {
    const listContainer = document.getElementById("user-projects-grid");
    const paginationContainer = document.getElementById("pagination-controls");
    if (!listContainer) return;

    listContainer.innerHTML = "";

    const cleanQuery = (searchQuery || "").trim().toLowerCase();

    const filteredPosts = cachedUserPosts.filter(item => {
        if (!cleanQuery) return true;
        
        const pData = item.data || {};
        const title = (pData.title || (pData.likedBy ? pData.likedBy.title : '') || '').toLowerCase();
        const category = normalizeCategory(pData.category || (pData.likedBy ? pData.likedBy.category : '')).toLowerCase();
        const desc = (pData.description || pData.desc || '').toLowerCase();
        const ownerName = (pData.ownerName || '').toLowerCase();

        return title.includes(cleanQuery) || 
               category.includes(cleanQuery) || 
               desc.includes(cleanQuery) || 
               ownerName.includes(cleanQuery);
    });

    if (filteredPosts.length === 0) {
        listContainer.innerHTML = `
            <div class="col-span-full text-center text-slate-400 py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                <p class="text-xs">${searchQuery ? `ไม่พบผลงานที่ตรงกับคำค้นหา "${searchQuery}"` : "ยังไม่มีการเผยแพร่ผลงานใดๆ ในระบบ"}</p>
            </div>`;
        if (paginationContainer) paginationContainer.innerHTML = "";
        return;
    }

    const totalPages = Math.ceil(filteredPosts.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages) currentPage = totalPages || 1;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedPosts = filteredPosts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    paginatedPosts.forEach((item) => {
        const pData = item.data; 
        const pId = item.id;
        
        let likesCount = parseLikesCount(pData);
        const displayTitle = pData.title || (pData.likedBy ? pData.likedBy.title : 'Untitled');
        const displayImage = pData.imgLink || pData.image || pData.coverUrl || pData.imageUrl || pData.img || (pData.likedBy ? pData.likedBy.image : '');
        let displayCategory = normalizeCategory(pData.category || (pData.likedBy ? pData.likedBy.category : '2D Graphic Design'));

        const card = document.createElement("div");
        card.className = "bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md border border-slate-100 transition-all cursor-pointer group animate-fade-in flex flex-col justify-between";
        card.innerHTML = `
            <div>
                <div class="aspect-video w-full bg-slate-100 overflow-hidden relative">
                    <img src="${convertDriveUrl(displayImage)}" referrerpolicy="no-referrer" class="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" onerror="this.src='https://via.placeholder.com/400x225?text=No+Image'">
                    <span class="absolute top-3 right-3 text-[10px] bg-slate-900/70 text-white font-bold px-2 py-0.5 rounded-md backdrop-blur-sm uppercase">${displayCategory}</span>
                </div>
                <div class="p-4">
                    <h4 class="font-bold text-slate-800 text-sm truncate">${displayTitle}</h4>
                </div>
            </div>
            <div class="px-4 pb-4">
                <div class="flex items-center justify-between pt-2 border-t border-slate-50 text-[11px] text-slate-400">
                    <span>❤️ ${likesCount} ไลค์</span>
                    <span class="text-orange-500 font-medium">ดูรายละเอียด →</span>
                </div>
            </div>
        `;
        card.onclick = () => openPortfolioPopup(pId, pData);
        listContainer.appendChild(card);
    });

    if (paginationContainer) {
        paginationContainer.innerHTML = "";
        if (totalPages > 1) {
            for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement("button");
                btn.innerText = i;
                btn.type = "button";
                btn.className = (i === currentPage) 
                    ? "w-8 h-8 rounded-lg bg-orange-600 text-white text-xs font-bold shadow-md shadow-orange-600/20 transition-all"
                    : "w-8 h-8 rounded-lg bg-white/60 hover:bg-white text-slate-600 border border-slate-200 text-xs font-semibold transition-all";
                
                btn.onclick = () => {
                    currentPage = i;
                    renderPaginatedPosts();
                };
                paginationContainer.appendChild(btn);
            }
        }
    }
}

function setupSearchInputs() {
    const desktopInput = document.getElementById("search-input");
    const mobileInput = document.getElementById("mobile-search-input");

    const handleSearchInput = (e) => {
        searchQuery = e.target.value;
        currentPage = 1; 
        
        const workTabBtn = document.querySelector('.profile-tab[data-tab="tab-work"]');
        if (workTabBtn) workTabBtn.click();
        
        if (desktopInput && e.target !== desktopInput) desktopInput.value = e.target.value;
        if (mobileInput && e.target !== mobileInput) mobileInput.value = e.target.value;

        renderPaginatedPosts();
    };

    if (desktopInput) desktopInput.addEventListener("input", handleSearchInput);
    if (mobileInput) mobileInput.addEventListener("input", handleSearchInput);
}

// 🚀 ดึงข้อมูล Firestore ตาม Target UID
async function initProfilePage() {
    if (portfolioUnsubscribe) portfolioUnsubscribe();
    if (savedUnsubscribe) savedUnsubscribe();

    targetUserId = getUserIdFromUrlOrAuth();

    if (!targetUserId) return;

    const editBtn = document.getElementById("btn-open-edit-modal");
    if (editBtn) {
        if (loggedInUserId && loggedInUserId === targetUserId) {
            editBtn.classList.remove("hidden");
        } else {
            editBtn.classList.add("hidden");
        }
    }

    try {
        const userDocRef = doc(db, "users", targetUserId);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();

            const finalName = userData.displayName || userData.fullName || userData.name || "User Creator";
            const finalAvatar = userData.photoURL || userData.avatar || userData.avatarUrl || "";
            const finalEmail = userData.email || userData.otherContact || "";
            const finalBio = userData.headline || userData.bio || userData.about || "";
            const finalBanner = userData.banner || userData.bannerUrl || "";
            const socials = userData.socials || { facebook: userData.facebook || "", instagram: userData.instagram || "", website: userData.website || "" };
            const purpose = userData.purpose || "freelance";
            const lineId = userData.lineId || userData.line || "";

            updateProfileDOM(finalName, finalAvatar, finalEmail, finalBio, finalBanner, socials, purpose, lineId);
        } else {
            updateProfileDOM("User Not Found", "", "", "ไม่พบผู้ใช้งานนี้ในระบบ", "", {}, "freelance", "");
        }
    } catch (e) {
        if (e.code === "permission-denied") {
            toast("สิทธิ์การเข้าถึงถูกปฏิเสธ (Firestore Security Rules)", "error");
        }
    }

    const handlePortfolioSnapshot = (snapshot) => {
        cachedUserPosts = [];
        let totalLikesCount = 0;

        snapshot.forEach((postDoc) => { 
            const pData = postDoc.data();
            const targetUid = pData.ownerId || pData.ownerUid || pData.uid || pData.userId || pData.authorId || pData.createdBy;
            if (targetUid === targetUserId) {
                cachedUserPosts.push({ id: postDoc.id, data: pData }); 
            }
        });

        cachedUserPosts.sort((a, b) => new Date(b.data.createdAt || 0) - new Date(a.data.createdAt || 0));

        cachedUserPosts.forEach(item => {
            totalLikesCount += parseLikesCount(item.data);
        });

        if (document.getElementById("stat-projects")) document.getElementById("stat-projects").innerText = cachedUserPosts.length;
        if (document.getElementById("stats-total-posts")) document.getElementById("stats-total-posts").innerText = cachedUserPosts.length;
        if (document.getElementById("stat-likes")) document.getElementById("stat-likes").innerText = totalLikesCount;
        if (document.getElementById("stats-total-likes")) document.getElementById("stats-total-likes").innerText = totalLikesCount;

        renderPaginatedPosts();
    };

    try {
        const portfolioQuery = query(collection(db, "portfolios"));
        portfolioUnsubscribe = onSnapshot(portfolioQuery, (snapshot) => {
            handlePortfolioSnapshot(snapshot);
        });
    } catch (err) { }

    try {
        const savedQuery = query(collection(db, "portfolios"), where(`savedBy.${targetUserId}`, "==", true));
        savedUnsubscribe = onSnapshot(savedQuery, (snapshot) => {
            const savedContainer = document.getElementById("saved-projects-grid");
            if (!savedContainer) return;

            savedContainer.innerHTML = "";

            if (snapshot.empty) {
                savedContainer.innerHTML = `
                    <div class="col-span-full text-center text-slate-400 py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                        <p class="text-xs">ยังไม่มีรายการที่บันทึกไว้</p>
                    </div>`;
                return;
            }

            snapshot.forEach((postDoc) => {
                const pData = postDoc.data();
                const pId = postDoc.id;
                const likesCount = parseLikesCount(pData);
                const displayTitle = pData.title || (pData.likedBy ? pData.likedBy.title : 'Untitled');
                const displayImage = pData.imgLink || pData.image || pData.coverUrl || pData.imageUrl || pData.img || (pData.likedBy ? pData.likedBy.image : '');
                const displayCategory = normalizeCategory(pData.category || (pData.likedBy ? pData.likedBy.category : '2D Graphic Design'));

                const card = document.createElement("div");
                card.className = "bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md border border-slate-100 transition-all cursor-pointer group animate-fade-in flex flex-col justify-between";
                card.innerHTML = `
                    <div>
                        <div class="aspect-video w-full bg-slate-100 overflow-hidden relative">
                            <img src="${convertDriveUrl(displayImage)}" referrerpolicy="no-referrer" class="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" onerror="this.src='https://via.placeholder.com/400x225?text=No+Image'">
                            <span class="absolute top-3 right-3 text-[10px] bg-slate-900/70 text-white font-bold px-2 py-0.5 rounded-md backdrop-blur-sm uppercase">${displayCategory}</span>
                            <span class="absolute bottom-3 left-3 text-[10px] bg-amber-500 text-white font-bold px-2 py-0.5 rounded-md shadow-sm">🔖 บันทึกแล้ว</span>
                        </div>
                        <div class="p-4">
                            <h4 class="font-bold text-slate-800 text-sm truncate">${displayTitle}</h4>
                            <p class="text-[11px] text-slate-400 mt-1">โดย ${pData.ownerName || 'Anonymous'}</p>
                        </div>
                    </div>
                    <div class="px-4 pb-4">
                        <div class="flex items-center justify-between pt-2 border-t border-slate-50 text-[11px] text-slate-400">
                            <span class="text-rose-500 font-bold">❤️ ${likesCount} ไลค์</span>
                            <span class="text-orange-500 font-medium">ดูรายละเอียด →</span>
                        </div>
                    </div>
                `;
                card.onclick = () => openPortfolioPopup(pId, pData);
                savedContainer.appendChild(card);
            });
        });
    } catch(err) { }
}

// 🟢 Auth Listener
onAuthStateChanged(auth, async (user) => {
    if (user) {
        loggedInUserId = user.uid;
        loggedInUserName = user.displayName || user.email.split('@')[0] || "User Creator";
        await updateNavbarDOM(user);
    } else {
        loggedInUserId = null;
    }

    await initProfilePage();
});

// Modal Edit Profile Control
const profileModal = document.getElementById("modal-edit-profile");
if (profileModal) {
    const editBtn = document.getElementById("btn-open-edit-modal");
    if (editBtn) editBtn.onclick = () => profileModal.classList.remove("hidden");

    const closeBtn = document.getElementById("btn-close-edit-modal");
    if (closeBtn) closeBtn.onclick = () => profileModal.classList.add("hidden");
}

// Submit Form Edit Profile
const editForm = document.getElementById("form-edit-profile");
if (editForm) {
    editForm.onsubmit = async (e) => {
        e.preventDefault();
        if (!loggedInUserId || loggedInUserId !== targetUserId) return;
        try {
            const newBio = document.getElementById("edit-bio")?.value || "";
            const newLine = document.getElementById("edit-line")?.value || "";
            const selectedPurpose = document.querySelector('input[name="user_purpose"]:checked')?.value || "freelance";

            const newSocials = {
                facebook: document.getElementById("edit-facebook")?.value || "",
                instagram: document.getElementById("edit-instagram")?.value || "",
                website: document.getElementById("edit-website")?.value || ""
            };

            await updateDoc(doc(db, "users", loggedInUserId), { 
                headline: newBio,
                purpose: selectedPurpose,
                lineId: newLine,
                socials: newSocials
            });

            const userDoc = await getDoc(doc(db, "users", loggedInUserId));
            if (userDoc.exists()) {
                const uData = userDoc.data();
                updateProfileDOM(
                    uData.displayName || loggedInUserName,
                    uData.photoURL || "",
                    uData.email || "",
                    newBio,
                    uData.banner || "",
                    newSocials,
                    selectedPurpose,
                    newLine
                );
            }

            toast("✨ อัปเดตข้อมูลโปรไฟล์เรียบร้อยแล้ว!", "success");
            if (profileModal) profileModal.classList.add("hidden");
        } catch (err) {
            toast("ไม่สามารถอัปเดตโปรไฟล์ได้", "error");
        }
    };
}

// Popup View Portfolio
const pModal = document.getElementById("portfolio-modal");
const editPortModal = document.getElementById("modal-edit-portfolio");

// ❌ ฟังก์ชันสั่งปิด Portfolio Popup
function closePortfolioModal() {
    if (commentUnsubscribe) { 
        commentUnsubscribe(); 
        commentUnsubscribe = null; 
    }
    if (pModal) {
        pModal.classList.add("hidden");
        pModal.style.display = "none";
    }
    const modalIframe = document.getElementById("modal-iframe");
    if (modalIframe) modalIframe.src = "";
    
    const modalVideo = document.getElementById("modal-video");
    if (modalVideo && typeof modalVideo.pause === 'function') modalVideo.pause();
}

// 🎯 Event Listeners สำหรับการกดปิด Portfolio Modal ทุกช่องทาง
document.addEventListener("DOMContentLoaded", () => {
    // 1. ปุ่มปิดทุกปุ่ม
    const closeBtns = document.querySelectorAll("#modal-close-btn, .close-modal-btn, [data-close-modal]");
    closeBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            closePortfolioModal();
        };
    });

    // 2. คลิกพื้นที่ภายนอก (Backdrop)
    if (pModal) {
        pModal.onclick = (e) => {
            if (e.target === pModal) {
                closePortfolioModal();
            }
        };
    }

    // 3. ปุ่ม ESC บนคีย์บอร์ด
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && pModal && !pModal.classList.contains("hidden")) {
            closePortfolioModal();
        }
    });
});

function startCommentsRealtimeStream(postId) {
    if (commentUnsubscribe) { commentUnsubscribe(); commentUnsubscribe = null; }

    const commentsList = document.getElementById("modal-comments-container") || document.getElementById("modal-comments-list");
    const commentCountText = document.getElementById("modal-comment-count");
    if (!commentsList) return;

    commentsList.innerHTML = `<div class="flex justify-center py-4"><div class="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>`;

    const q = query(collection(db, "portfolios", postId, "comments"), orderBy("createdAt", "asc"));

    commentUnsubscribe = onSnapshot(q, (snapshot) => {
        commentsList.innerHTML = "";
        if (commentCountText) commentCountText.innerText = snapshot.size;

        if (snapshot.empty) {
            commentsList.innerHTML = `<div class="text-center py-4 text-slate-400 text-xs italic">ยังไม่มีความคิดเห็น</div>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const comment = docSnap.data();
            const commentUserId = comment.userId || comment.uid || comment.ownerId || "";
            const fallbackName = comment.userName || comment.ownerName || comment.displayName || "Anonymous";
            const fallbackAvatar = comment.avatarUrl || comment.avatar || "";
            const timeAgo = comment.createdAt ? formatRelativeTime(comment.createdAt) : "";

            const div = document.createElement("div");
            div.className = "p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1 mb-2";

            const avatarHtml = fallbackAvatar 
                ? `<img src="${convertDriveUrl(fallbackAvatar)}" class="w-full h-full object-cover rounded-full" referrerpolicy="no-referrer" onerror="this.onerror=null; this.parentNode.innerText='${fallbackName.charAt(0).toUpperCase()}';">`
                : fallbackName.charAt(0).toUpperCase();

            div.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2">
                        <div class="w-6 h-6 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center text-[10px] overflow-hidden shrink-0 placeholder-avatar-comment">
                            ${avatarHtml}
                        </div>
                        <span class="font-bold text-slate-800 text-[11px] name-comment-display">${fallbackName}</span>
                    </div>
                    <span class="text-[9px] text-slate-400">${timeAgo}</span>
                </div>
                <p class="text-slate-600 pl-8 text-[11px]">${comment.text || ""}</p>
            `;

            if (commentUserId) {
                getDoc(doc(db, "users", commentUserId)).then((userDoc) => {
                    if (userDoc.exists()) {
                        const uData = userDoc.data();
                        const liveName = uData.displayName || uData.name || fallbackName;
                        const liveAvatar = uData.photoURL || uData.avatarUrl || uData.avatar || "";

                        const nameEl = div.querySelector(".name-comment-display");
                        const avatarEl = div.querySelector(".placeholder-avatar-comment");

                        if (nameEl) nameEl.innerText = liveName;
                        if (avatarEl && liveAvatar) {
                            avatarEl.innerHTML = `<img src="${convertDriveUrl(liveAvatar)}" class="w-full h-full object-cover rounded-full" referrerpolicy="no-referrer" onerror="this.onerror=null; this.parentNode.innerText='${liveName.charAt(0).toUpperCase()}';">`;
                        }
                    }
                });
            }

            commentsList.appendChild(div);
        });
        commentsList.scrollTop = commentsList.scrollHeight;
    });
}

function openPortfolioPopup(postId, postData) {
    activePostId = postId; 
    activePostData = postData;
    
    const modalImg = document.getElementById("modal-img");
    const modalVideo = document.getElementById("modal-video");
    let modalIframe = document.getElementById("modal-iframe");

    // Reset Elements ทั้งหมดก่อนเปิด
    if (modalImg) { modalImg.src = ""; modalImg.classList.add("hidden"); }
    if (modalVideo) { modalVideo.src = ""; if (typeof modalVideo.pause === 'function') modalVideo.pause(); modalVideo.classList.add("hidden"); }
    if (modalIframe) { modalIframe.src = ""; modalIframe.classList.add("hidden"); }

    const rawMediaLink = postData.imgLink || postData.image || postData.coverUrl || postData.imageUrl || postData.img || (postData.likedBy ? postData.likedBy.image : '');
    const lowerLink = (rawMediaLink || '').toLowerCase();

    // 1. กรณีเป็น YouTube Video -> แสดง iframe
    if (lowerLink.includes("youtube.com") || lowerLink.includes("youtu.be")) {
        if (!modalIframe && modalImg) {
            modalIframe = document.createElement("iframe");
            modalIframe.id = "modal-iframe";
            modalImg.parentNode.insertBefore(modalIframe, modalImg);
        }
        if (modalIframe) {
            modalIframe.classList.remove("hidden");
            modalIframe.className = "w-full h-full object-contain bg-slate-950 border-0 block aspect-video";
            let videoId = rawMediaLink.includes("v=") ? new URL(rawMediaLink).searchParams.get("v") : rawMediaLink.split("/").pop();
            modalIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        }
    } 
    // 2. กรณีรูปภาพทั่วไป หรือ Google Drive Image -> แสดง <img>
    else {
        if (modalImg) {
            modalImg.classList.remove("hidden");
            modalImg.src = convertDriveUrl(rawMediaLink);
            modalImg.onerror = () => {
                modalImg.src = 'https://via.placeholder.com/800x450?text=Image+Load+Failed';
            };
        }
    }

    const displayTitle = postData.title || (postData.likedBy ? postData.likedBy.title : "Untitled");
    const displayOwnerId = postData.ownerId || postData.ownerUid || postData.uid || (postData.likedBy ? postData.likedBy.ownerId : null);
    let displayCategory = normalizeCategory(postData.category || (postData.likedBy ? postData.likedBy.category : '2D Graphic Design'));

    if (document.getElementById("modal-category")) document.getElementById("modal-category").innerText = displayCategory.toUpperCase();
    if (document.getElementById("modal-title")) document.getElementById("modal-title").innerText = displayTitle;
    if (document.getElementById("modal-desc")) document.getElementById("modal-desc").innerText = postData.description || postData.desc || "ไม่มีคำอธิบายเพิ่มเติม";
    
    let currentLikesCount = parseLikesCount(postData);
    if (document.getElementById("modal-like-count")) {
        document.getElementById("modal-like-count").innerText = currentLikesCount;
    }
    
    // 🔴 จัดการสถานะ Like
    const likeBtn = document.getElementById("modal-like-btn");
    if (likeBtn) {
        const likedMap = (postData.likedBy && typeof postData.likedBy === "object") ? postData.likedBy : {};
        const isLiked = loggedInUserId ? likedMap[loggedInUserId] === true : false;
        updateLikeBtnStyle(likeBtn, isLiked);

        likeBtn.onclick = async () => {
            if (!loggedInUserId) return toast("กรุณาเข้าสู่ระบบก่อนกดถูกใจ", "error");
            
            const postRef = doc(db, "portfolios", postId);
            const isCurrentlyLiked = activePostData.likedBy && activePostData.likedBy[loggedInUserId] === true;
            const newLikedState = !isCurrentlyLiked;

            let updatedLikes = parseLikesCount(activePostData);
            updatedLikes = newLikedState ? updatedLikes + 1 : Math.max(0, updatedLikes - 1);

            updateLikeBtnStyle(likeBtn, newLikedState);
            if (document.getElementById("modal-like-count")) {
                document.getElementById("modal-like-count").innerText = updatedLikes;
            }

            if (!activePostData.likedBy || typeof activePostData.likedBy !== 'object') {
                activePostData.likedBy = {};
            }
            activePostData.likedBy[loggedInUserId] = newLikedState;
            activePostData.likes = updatedLikes;

            try {
                await updateDoc(postRef, {
                    [`likedBy.${loggedInUserId}`]: newLikedState,
                    likes: updatedLikes
                });
            } catch (err) {
                toast("ไม่สามารถอัปเดตการกดถูกใจได้", "error");
            }
        };
    }

    // 🔖 จัดการสถานะ Save
    const saveBtn = document.getElementById("modal-save-btn");
    if (saveBtn) {
        const savedMap = (postData.savedBy && typeof postData.savedBy === "object") ? postData.savedBy : {};
        const isSaved = loggedInUserId ? savedMap[loggedInUserId] === true : false;
        updateSaveBtnStyle(saveBtn, isSaved);

        saveBtn.onclick = async () => {
            if (!loggedInUserId) return toast("กรุณาเข้าสู่ระบบก่อนบันทึกผลงาน", "error");

            const postRef = doc(db, "portfolios", postId);
            const isCurrentlySaved = activePostData.savedBy && activePostData.savedBy[loggedInUserId] === true;
            const newSavedState = !isCurrentlySaved;

            updateSaveBtnStyle(saveBtn, newSavedState);

            if (!activePostData.savedBy || typeof activePostData.savedBy !== 'object') {
                activePostData.savedBy = {};
            }
            activePostData.savedBy[loggedInUserId] = newSavedState;

            try {
                await updateDoc(postRef, {
                    [`savedBy.${loggedInUserId}`]: newSavedState
                });
                toast(newSavedState ? "🔖 บันทึกผลงานแล้ว" : "ยกเลิกการบันทึกผลงานแล้ว", "success");
            } catch (err) {
                toast("ไม่สามารถอัปเดตการบันทึกได้", "error");
            }
        };
    }

    const actionZone = document.getElementById("owner-action-zone");
    if (actionZone) {
        if (loggedInUserId && displayOwnerId === loggedInUserId) { 
            actionZone.classList.remove("hidden"); 
        } else { 
            actionZone.classList.add("hidden"); 
        }
    }

    startCommentsRealtimeStream(postId);

    if (pModal) {
        pModal.classList.remove("hidden");
        pModal.style.display = "flex";
    }
}

// 💬 ส่งความคิดเห็นใหม่
const commentForm = document.getElementById("form-add-comment") || document.getElementById("modal-comment-form");
if (commentForm) {
    commentForm.onsubmit = async (e) => {
        e.preventDefault();
        if (!activePostId) return;
        if (!loggedInUserId) return toast("กรุณาเข้าสู่ระบบก่อนแสดงความคิดเห็น", "error");

        const inputEl = commentForm.querySelector("input[type='text']") || commentForm.querySelector("textarea");
        if (!inputEl) return;

        const text = inputEl.value.trim();
        if (!text) return;

        if (containsBadWords(text)) {
            return toast("ข้อความของคุณมีคำไม่สุภาพ กรุณาแก้ไขก่อนส่ง", "error");
        }

        try {
            await addDoc(collection(db, "portfolios", activePostId, "comments"), {
                userId: loggedInUserId,
                ownerName: loggedInUserName,
                text: text,
                createdAt: new Date().toISOString()
            });
            inputEl.value = "";
        } catch (err) {
            toast("ไม่สามารถส่งความคิดเห็นได้", "error");
        }
    };
}

if (document.getElementById("btn-trigger-edit-post")) {
    document.getElementById("btn-trigger-edit-post").onclick = () => {
        if (!activePostData) return;
        const currentTitle = activePostData.title || (activePostData.likedBy ? activePostData.likedBy.title : "");
        const currentImage = activePostData.imgLink || activePostData.image || activePostData.coverUrl || activePostData.imageUrl || activePostData.img || (activePostData.likedBy ? activePostData.likedBy.image : "");
        const currentDesc = activePostData.description || activePostData.desc || "";

        if (document.getElementById("edit-port-title")) document.getElementById("edit-port-title").value = currentTitle;
        if (document.getElementById("edit-port-image")) document.getElementById("edit-port-image").value = currentImage; 
        if (document.getElementById("edit-port-desc")) document.getElementById("edit-port-desc").value = currentDesc;
        
        const categorySelect = document.getElementById("edit-port-category");
        if (categorySelect) {
            let oldCategory = activePostData.category || (activePostData.likedBy && activePostData.likedBy.category ? activePostData.likedBy.category : "2D Graphic Design"); 
            categorySelect.value = normalizeCategory(oldCategory);
        }
        closePortfolioModal();
        if (editPortModal) editPortModal.classList.remove("hidden");
    };
}

if (document.getElementById("btn-cancel-edit-port-modal")) {
    document.getElementById("btn-cancel-edit-port-modal").onclick = () => editPortModal.classList.add("hidden");
}

if (document.getElementById("form-update-portfolio")) {
    document.getElementById("form-update-portfolio").onsubmit = async (e) => {
        e.preventDefault();
        if (!activePostId) return;
        try {
            const updatedTitle = document.getElementById("edit-port-title").value;
            const updatedCategory = document.getElementById("edit-port-category").value;
            const updatedImage = document.getElementById("edit-port-image").value;
            const updatedDesc = document.getElementById("edit-port-desc").value;

            const originalOwnerId = activePostData.ownerId || activePostData.ownerUid || activePostData.uid || loggedInUserId;
            const originalOwnerName = activePostData.ownerName || loggedInUserName;

            const hasBadWord = containsBadWords(updatedTitle, updatedDesc);
            const finalStatus = hasBadWord ? "pending" : "approved";

            await updateDoc(doc(db, "portfolios", activePostId), {
                ownerId: originalOwnerId, ownerName: originalOwnerName, 
                title: updatedTitle, category: updatedCategory, 
                image: updatedImage, imgLink: updatedImage, description: updatedDesc, status: finalStatus
            });
            
            toast("✨ บันทึกการแก้ไขข้อมูลสำเร็จ!", "success");
            if (editPortModal) editPortModal.classList.add("hidden");
        } catch (err) { 
            toast("เกิดข้อผิดพลาดไม่สามารถบันทึกข้อมูลได้", "error"); 
        }
    };
}

if (document.getElementById("btn-trigger-delete-post")) {
    document.getElementById("btn-trigger-delete-post").onclick = async () => {
        if (!activePostId) return;
        if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบผลงานชิ้นนี้อย่างถาวร?")) {
            try {
                await deleteDoc(doc(db, "portfolios", activePostId));
                toast("🗑️ ลบผลงานเรียบร้อยแล้ว", "success");
                closePortfolioModal();
            } catch (err) { 
                toast("ไม่สามารถลบผลงานได้", "error"); 
            }
        }
    };
}

// Sign Out
document.querySelectorAll("#dropdown-logout").forEach(btn => {
    btn.onclick = async () => {
        if (confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
            try {
                await signOut(auth);
                window.location.href = "index.html";
            } catch (err) {
                toast("เกิดข้อผิดพลาด ไม่สามารถออกจากระบบได้", "error");
            }
        }
    };
});

function setupProfileDropdown() {
    const toggleBtn = document.getElementById("btn-toggle-dropdown");
    const dropdownMenu = document.getElementById("user-dropdown-menu");

    if (toggleBtn && dropdownMenu) {
        const parentContainer = toggleBtn.closest('.profile-dropdown-wrapper');
        let timeoutId = null;

        const showMenu = () => {
            clearTimeout(timeoutId);
            dropdownMenu.classList.remove("hidden");
        };

        const hideMenu = () => {
            timeoutId = setTimeout(() => {
                dropdownMenu.classList.add("hidden");
            }, 150);
        };

        if (parentContainer) {
            parentContainer.addEventListener("mouseenter", showMenu);
            parentContainer.addEventListener("mouseleave", hideMenu);
        }

        toggleBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle("hidden");
        });

        document.addEventListener("click", (e) => {
            if (parentContainer && !parentContainer.contains(e.target)) {
                dropdownMenu.classList.add("hidden");
            }
        });
    }
}

function setupProfileTabs() {
    const tabs = document.querySelectorAll(".profile-tab");
    const contents = document.querySelectorAll(".tab-content");

    if (tabs.length === 0) return;

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetTab = tab.getAttribute("data-tab");

            tabs.forEach(t => {
                t.classList.remove("text-black", "border-black", "font-bold");
                t.classList.add("text-zinc-500", "border-transparent");
            });

            contents.forEach(content => content.classList.add("hidden"));

            tab.classList.remove("text-zinc-500", "border-transparent");
            tab.classList.add("text-black", "border-black", "font-bold");

            const targetContent = document.getElementById(targetTab);
            if (targetContent) {
                targetContent.classList.remove("hidden");
            }
        });
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        setupProfileTabs();
        setupProfileDropdown();
        setupSearchInputs();
    });
} else {
    setupProfileTabs();
    setupProfileDropdown();
    setupSearchInputs();
}