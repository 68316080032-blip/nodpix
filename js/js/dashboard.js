// dashboard.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, updateDoc, deleteDoc, collection, query, onSnapshot, addDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { convertDriveUrl } from "./utils.js";

// เปลี่ยนตัวรับงานมาใช้ฟังก์ชันแสดง Pop-up กระจกฝ้าตรงกลางจอแทน
const toast = (msg, type) => {
    if (window.showCustomAlert) { window.showCustomAlert(msg, type); } else { alert(msg); }
};

// 🛡️ ระบบ Filter คำต้องห้ามเบื้องต้น
const BAD_WORDS = ["ควย", "เย็ด", "เหี้ย", "สัส", "ชาติต้น", "มึง", "กู", "ดอ", "แรด", "ร่าน"];
function containsBadWords(...texts) {
    const combinedText = texts.join(" ").toLowerCase();
    return BAD_WORDS.some(word => combinedText.includes(word));
}

// 📦 ฟังก์ชันแปลงชื่อหมวดหมู่ที่ซ้ำซ้อนหรือเป็นเวอร์ชันเก่า ให้เข้ากลุ่มเวอร์ชันใหม่
function normalizeCategory(category) {
    if (!category) return "2D Graphic Design";
    const c = category.trim();
    
    if (c === "Graphic Design" || c === "Graphics & Design" || c === "Graphics" || c === "2D") {
        return "2D Graphic Design";
    }
    if (c === "Motion Graphic / 3D" || c === "3D" || c === "Motion" || c === "Motion Graphic" || c === "3D & Motion Graphics") {
        return "3D & Motion Graphics";
    }
    if (c.toLowerCase() === "photography" || c === "Photo") {
        return "Photography";
    }
    if (c === "Video & Animation" || c === "Video" || c === "Video Editor") {
        return "Video Editor";
    }
    return c;
}

let currentUserId = null;
let currentUserName = "Anonymous";
let currentUserRole = "user";
let activePostId = null;
let activePostData = null;
let commentUnsubscribe = null; 

// 🔢 ระบบตัวแปรสำหรับแบ่งหน้า (Pagination)
let currentPage = 1;
const ITEMS_PER_PAGE = 6;

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    
    currentUserId = user.uid;
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            currentUserName = userData.name || user.displayName || user.email;
            currentUserRole = userData.role || "user";
            
            if(document.getElementById("left-name-display")) document.getElementById("left-name-display").innerText = currentUserName;
            if(document.getElementById("left-role-display")) document.getElementById("left-role-display").innerText = currentUserRole.toUpperCase();
            
            if(document.getElementById("profile-name")) document.getElementById("profile-name").value = currentUserName;
            if(document.getElementById("profile-avatar")) document.getElementById("profile-avatar").value = userData.avatar || user.photoURL || "";

            const leftAvatarZone = document.getElementById("left-avatar-zone");
            if (leftAvatarZone) {
                const avatarSrc = userData.avatar || user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserName)}&background=f97316&color=fff`;
                leftAvatarZone.innerHTML = `<img src="${convertDriveUrl(avatarSrc)}" class="w-full h-full object-cover">`;
            }

            const profileModal = document.getElementById("modal-edit-profile");
            if(profileModal) {
                if(document.getElementById("btn-open-profile-modal")) document.getElementById("btn-open-profile-modal").onclick = () => profileModal.classList.remove("hidden");
                if(document.getElementById("lnk-edit-profile")) document.getElementById("lnk-edit-profile").onclick = () => profileModal.classList.remove("hidden");
                if(document.getElementById("btn-close-profile-modal")) document.getElementById("btn-close-profile-modal").onclick = () => profileModal.classList.add("hidden");
                if(document.getElementById("btn-cancel-profile-modal")) document.getElementById("btn-cancel-profile-modal").onclick = () => profileModal.classList.add("hidden");
            }

            if(document.getElementById("form-update-profile")) {
                document.getElementById("form-update-profile").onsubmit = async (e) => {
                    e.preventDefault();
                    await updateDoc(doc(db, "users", user.uid), {
                        name: document.getElementById("profile-name").value,
                        avatar: document.getElementById("profile-avatar").value
                    });
                    toast("อัปเดตข้อมูลโปรไฟล์เรียบร้อยแล้วครับ ✨", "success");
                    setTimeout(() => window.location.reload(), 1500);
                };
            }

            // =========================================================
            // 🛡️ STRICT PERSONAL FILTER + PAGINATION SYSTEM (FIXED)
            // =========================================================
            const portfolioQuery = query(collection(db, "portfolios"));

            onSnapshot(portfolioQuery, (snapshot) => {
                const listContainer = document.getElementById("my-portfolio-list");
                const paginationContainer = document.getElementById("pagination-controls");
                if(!listContainer) return;
                
                listContainer.innerHTML = "";
                let totalLikesCount = 0;
                const postsArray = [];

                snapshot.forEach((postDoc) => { 
                    const data = postDoc.data();
                    const docId = postDoc.id;

                    // 🔍 ตรวจสอบ UID จากทุกชื่อฟิลด์ที่เป็นไปได้
                    const actualOwnerId = data.ownerId || data.ownerUid || data.uid || (data.likedBy ? (data.likedBy.ownerId || data.likedBy.ownerUid || data.likedBy.uid) : null);
                    
                    // กรองเอาเฉพาะผลงานที่เป็นของผู้ใช้นี้เท่านั้น
                    if (actualOwnerId !== currentUserId) return;

                    postsArray.push({ id: docId, data: data }); 
                });
                
                if(postsArray.length === 0) {
                    listContainer.innerHTML = `
                        <div class="sm:col-span-2 text-center text-slate-400 py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                            <p class="text-xs">คุณยังไม่ได้อัปโหลดผลงานใดๆ ในระบบ</p>
                            <a href="#form-submit-portfolio" class="text-orange-500 font-bold hover:underline mt-2 inline-block text-xs">+ คลิกเพื่อสร้างผลงานใหม่</a>
                        </div>`;
                    if(paginationContainer) paginationContainer.innerHTML = "";
                    if(document.getElementById("stats-total-posts")) document.getElementById("stats-total-posts").innerText = "0";
                    if(document.getElementById("stats-total-likes")) document.getElementById("stats-total-likes").innerText = "0";
                    return;
                }

                // เรียงลำดับงานจากใหม่ไปเก่า
                postsArray.sort((a, b) => new Date(b.data.createdAt || 0) - new Date(a.data.createdAt || 0));

                // คำนวณยอดไลค์รวมทั้งหมด
                postsArray.forEach(item => {
                    const pData = item.data;
                    if (pData.likedBy && typeof pData.likedBy === 'object' && pData.likedBy.likesCount !== undefined) {
                        totalLikesCount += Number(pData.likedBy.likesCount) || 0;
                    } else if (Array.isArray(pData.likes)) {
                        totalLikesCount += pData.likes.length;
                    } else if (pData.likesCount !== undefined) {
                        totalLikesCount += Number(pData.likesCount) || 0;
                    }
                });

                if(document.getElementById("stats-total-posts")) document.getElementById("stats-total-posts").innerText = postsArray.length;
                if(document.getElementById("stats-total-likes")) document.getElementById("stats-total-likes").innerText = totalLikesCount;

                // 🧮 Logic การทำ Pagination (แสดงผลหน้าละ 6 รายการ)
                const totalPages = Math.ceil(postsArray.length / ITEMS_PER_PAGE);
                if (currentPage > totalPages) currentPage = totalPages || 1;

                const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                const endIndex = startIndex + ITEMS_PER_PAGE;
                const paginatedPosts = postsArray.slice(startIndex, endIndex);

                // แสดงการ์ดผลงานของหน้านั้นๆ
                paginatedPosts.forEach((item) => {
                    const pData = item.data; 
                    const pId = item.id;
                    
                    let likesCount = pData.likedBy && typeof pData.likedBy === 'object' && pData.likedBy.likesCount !== undefined 
                        ? pData.likedBy.likesCount 
                        : (Array.isArray(pData.likes) ? pData.likes.length : (pData.likesCount || 0));
                        
                    const displayTitle = pData.title || (pData.likedBy ? pData.likedBy.title : 'Untitled');
                    const displayImage = pData.image || pData.img || (pData.likedBy ? pData.likedBy.image : '');
                    let displayCategory = normalizeCategory(pData.category || (pData.likedBy ? pData.likedBy.category : '2D Graphic Design'));

                    const card = document.createElement("div");
                    card.className = "bg-white/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md border border-slate-100 transition-all cursor-pointer group animate-fade-in";
                    card.innerHTML = `
                        <div class="aspect-video w-full bg-slate-100 overflow-hidden relative">
                            <img src="${convertDriveUrl(displayImage)}" referrerpolicy="no-referrer" class="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" onerror="this.src='https://via.placeholder.com/400x225?text=No+Image'">
                            <span class="absolute top-3 right-3 text-[10px] bg-slate-900/70 text-white font-bold px-2 py-0.5 rounded-md backdrop-blur-sm uppercase">${displayCategory}</span>
                        </div>
                        <div class="p-4">
                            <h4 class="font-bold text-slate-800 text-sm truncate">${displayTitle}</h4>
                            <div class="flex items-center justify-between mt-3 pt-2 border-t border-slate-50 text-[11px] text-slate-400">
                                <span>❤️ ${likesCount} ไลค์</span>
                                <span class="text-orange-500 font-medium">ดูรายละเอียด/จัดการ →</span>
                            </div>
                        </div>
                    `;
                    card.onclick = () => openPortfolioPopup(pId, pData);
                    listContainer.appendChild(card);
                });

                // 🛠️ Render ปุ่มเลือกหน้าย่อย (Pagination Control Buttons)
                if(paginationContainer) {
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
                                modalCloseAndRefreshList();
                            };
                            paginationContainer.appendChild(btn);
                        }
                    }
                }

                function modalCloseAndRefreshList() {
                    listContainer.innerHTML = "";
                    const newStart = (currentPage - 1) * ITEMS_PER_PAGE;
                    const newPaginated = postsArray.slice(newStart, newStart + ITEMS_PER_PAGE);
                    
                    newPaginated.forEach((item) => {
                        const pData = item.data; const pId = item.id;
                        let likesCount = pData.likedBy && typeof pData.likedBy === 'object' && pData.likedBy.likesCount !== undefined ? pData.likedBy.likesCount : (pData.likesCount || 0);
                        const card = document.createElement("div");
                        card.className = "bg-white/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md border border-slate-100 transition-all cursor-pointer group";
                        card.innerHTML = `
                            <div class="aspect-video w-full bg-slate-100 overflow-hidden relative">
                                <img src="${convertDriveUrl(pData.image || pData.img || '')}" referrerpolicy="no-referrer" class="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" onerror="this.src='https://via.placeholder.com/400x225?text=No+Image'">
                                <span class="absolute top-3 right-3 text-[10px] bg-slate-900/70 text-white font-bold px-2 py-0.5 rounded-md backdrop-blur-sm uppercase">${normalizeCategory(pData.category)}</span>
                            </div>
                            <div class="p-4">
                                <h4 class="font-bold text-slate-800 text-sm truncate">${pData.title || 'Untitled'}</h4>
                                <div class="flex items-center justify-between mt-3 pt-2 border-t border-slate-50 text-[11px] text-slate-400">
                                    <span>❤️ ${likesCount} ไลค์</span>
                                    <span class="text-orange-500 font-medium">ดูรายละเอียด/จัดการ →</span>
                                </div>
                            </div>
                        `;
                        card.onclick = () => openPortfolioPopup(pId, pData);
                        listContainer.appendChild(card);
                    });
                    
                    const allPageBtns = paginationContainer.querySelectorAll("button");
                    allPageBtns.forEach((b, idx) => {
                        b.className = ((idx + 1) === currentPage)
                            ? "w-8 h-8 rounded-lg bg-orange-600 text-white text-xs font-bold shadow-md shadow-orange-600/20 transition-all"
                            : "w-8 h-8 rounded-lg bg-white/60 hover:bg-white text-slate-600 border border-slate-200 text-xs font-semibold transition-all";
                    });
                }

            }, (error) => { console.error("Firestore Strict Query Error:", error); });

            // =========================================================
            // 📩 ฟังก์ชันส่งผลงานใหม่
            // =========================================================
            if(document.getElementById("form-submit-portfolio")) {
                document.getElementById("form-submit-portfolio").onsubmit = async (e) => {
                    e.preventDefault();
                    try {
                        const tVal = document.getElementById("port-title").value;
                        const cVal = document.getElementById("port-category").value;
                        const iVal = document.getElementById("port-img").value;
                        const dVal = document.getElementById("port-desc").value;

                        const hasBadWord = containsBadWords(tVal, dVal);
                        const finalStatus = hasBadWord ? "pending" : "approved";

                        await addDoc(collection(db, "portfolios"), {
                            ownerId: user.uid, ownerName: currentUserName, title: tVal, category: cVal, image: iVal, description: dVal, status: finalStatus, createdAt: new Date().toISOString(),
                            likedBy: { likesCount: 0, link: "", title: tVal, image: iVal, category: cVal, ownerId: user.uid, ownerName: currentUserName, status: finalStatus }
                        });

                        if (finalStatus === "approved") {
                            toast("🚀 อัปโหลดผลงานสำเร็จ!<br><span class='text-[11px] text-slate-500 font-normal'>งานของคุณถูกเผยแพร่หน้าเว็บเรียบร้อยแล้ว</span>", "success");
                        } else {
                            toast("⚠️ ตรวจพบข้อความต้องสงสัย!<br><span class='text-[11px] text-slate-500 font-normal'>ระบบส่งให้ทีมแอดมินพิจารณาเพื่อเปิดใช้งานหลังบ้านนะครับ</span>", "warning");
                        }
                        document.getElementById("form-submit-portfolio").reset();
                    } catch (err) { console.error("Upload Error:", err); toast("เกิดข้อผิดพลาดในการอัปโหลดข้อมูล", "error"); }
                };
            }
        }
    } catch (error) { console.error(error); }
});

// POPUP CONTROL
const pModal = document.getElementById("portfolio-modal");
const editPortModal = document.getElementById("modal-edit-portfolio");

if(document.getElementById("modal-close-btn")) {
    document.getElementById("modal-close-btn").onclick = () => {
        if(commentUnsubscribe) { commentUnsubscribe(); commentUnsubscribe = null; }
        pModal.classList.add("hidden");
    };
}

function openPortfolioPopup(postId, postData) {
    activePostId = postId; activePostData = postData;
    if(commentUnsubscribe) { commentUnsubscribe(); commentUnsubscribe = null; }
    
    const displayTitle = postData.title || (postData.likedBy ? postData.likedBy.title : "Untitled");
    const displayOwnerId = postData.ownerId || postData.ownerUid || postData.uid || (postData.likedBy ? postData.likedBy.ownerId : null);
    const displayImage = postData.image || postData.img || (postData.likedBy ? postData.likedBy.image : '');
    let displayCategory = normalizeCategory(postData.category || (postData.likedBy ? postData.likedBy.category : '2D Graphic Design'));

    if(document.getElementById("modal-img")) document.getElementById("modal-img").src = convertDriveUrl(displayImage);
    if(document.getElementById("modal-category")) document.getElementById("modal-category").innerText = displayCategory.toUpperCase();
    if(document.getElementById("modal-title")) document.getElementById("modal-title").innerText = displayTitle;
    if(document.getElementById("modal-desc")) document.getElementById("modal-desc").innerText = postData.description || postData.desc || "ไม่มีคำอธิบายเพิ่มเติม";
    
    let initialLikes = postData.likedBy && typeof postData.likedBy === 'object' ? (postData.likedBy.likesCount || 0) : (Array.isArray(postData.likes) ? postData.likes.length : (postData.likesCount || 0));
    if(document.getElementById("modal-like-count")) document.getElementById("modal-like-count").innerText = initialLikes;
    
    const actionZone = document.getElementById("owner-action-zone");
    if(actionZone) {
        if(displayOwnerId === currentUserId) { actionZone.classList.remove("hidden"); } else { actionZone.classList.add("hidden"); }
    }

    try {
        const commentQuery = query(collection(db, "portfolios", postId, "comments"), orderBy("createdAt", "asc"));
        commentUnsubscribe = onSnapshot(commentQuery, (cmtSnap) => {
            const container = document.getElementById("modal-comments-container");
            if(!container) return;
            if(document.getElementById("modal-comment-count")) document.getElementById("modal-comment-count").innerText = cmtSnap.size; 
            container.innerHTML = "";
            if(cmtSnap.empty) { container.innerHTML = `<p class="text-slate-400 text-center py-2 italic text-[11px]">ยังไม่มีคอมเมนต์</p>`; }
            cmtSnap.forEach((cDoc) => {
                const cData = cDoc.data();
                const cDiv = document.createElement("div");
                cDiv.className = "bg-white p-2 rounded-xl border border-slate-100 mb-1";
                cDiv.innerHTML = `<p class="font-bold text-slate-700 text-[10px]">${cData.ownerName || 'Anonymous'}</p><p class="text-slate-600 mt-0.5">${cData.text}</p>`;
                container.appendChild(cDiv);
            });
            container.scrollTop = container.scrollHeight;
        }, (err) => {
            if(document.getElementById("modal-comments-container")) {
                document.getElementById("modal-comments-container").innerHTML = `<p class="text-slate-400 text-center py-2 italic text-[10px]">สิทธิ์ถูกจำกัดการเข้าถึง</p>`;
            }
        });
    } catch(e) { console.error(e); }

    if(pModal) pModal.classList.remove("hidden");
}

if(document.getElementById("btn-trigger-edit-post")) {
    document.getElementById("btn-trigger-edit-post").onclick = () => {
        if(!activePostData) return;
        const currentTitle = activePostData.title || (activePostData.likedBy ? activePostData.likedBy.title : "");
        const currentImage = activePostData.image || activePostData.img || (activePostData.likedBy ? activePostData.likedBy.image : "");
        const currentDesc = activePostData.description || activePostData.desc || "";

        if(document.getElementById("edit-port-title")) document.getElementById("edit-port-title").value = currentTitle;
        if(document.getElementById("edit-port-image")) document.getElementById("edit-port-image").value = currentImage; 
        if(document.getElementById("edit-port-desc")) document.getElementById("edit-port-desc").value = currentDesc;
        
        const categorySelect = document.getElementById("edit-port-category");
        if (categorySelect) {
            let oldCategory = activePostData.category || (activePostData.likedBy && activePostData.likedBy.category ? activePostData.likedBy.category : "2D Graphic Design"); 
            categorySelect.value = normalizeCategory(oldCategory);
        }
        if(pModal) pModal.classList.add("hidden");
        if(editPortModal) editPortModal.classList.remove("hidden");
    };
}

if(document.getElementById("btn-close-edit-port-modal")) document.getElementById("btn-close-edit-port-modal").onclick = () => editPortModal.classList.add("hidden");
if(document.getElementById("btn-cancel-edit-port-modal")) document.getElementById("btn-cancel-edit-port-modal").onclick = () => editPortModal.classList.add("hidden");

if(document.getElementById("form-update-portfolio")) {
    document.getElementById("form-update-portfolio").onsubmit = async (e) => {
        e.preventDefault();
        if(!activePostId) return;
        try {
            const updatedTitle = document.getElementById("edit-port-title").value;
            const updatedCategory = document.getElementById("edit-port-category").value;
            const updatedImage = document.getElementById("edit-port-image").value;
            const updatedDesc = document.getElementById("edit-port-desc").value;

            const originalLikes = activePostData.likedBy && activePostData.likedBy.likesCount !== undefined ? activePostData.likedBy.likesCount : (activePostData.likesCount || 0);
            const originalOwnerId = activePostData.ownerId || activePostData.ownerUid || activePostData.uid || (activePostData.likedBy ? activePostData.likedBy.ownerId : currentUserId);
            const originalOwnerName = activePostData.ownerName || (activePostData.likedBy ? activePostData.likedBy.ownerName : currentUserName);

            const hasBadWord = containsBadWords(updatedTitle, updatedDesc);
            const finalStatus = hasBadWord ? "pending" : "approved";

            await updateDoc(doc(db, "portfolios", activePostId), {
                ownerId: originalOwnerId, ownerName: originalOwnerName, title: updatedTitle, category: updatedCategory, image: updatedImage, description: updatedDesc, status: finalStatus, 
                "likedBy.likesCount": originalLikes, "likedBy.title": updatedTitle, "likedBy.image": updatedImage, "likedBy.category": updatedCategory, "likedBy.ownerId": originalOwnerId, "likedBy.ownerName": originalOwnerName, "likedBy.status": finalStatus
            });
            
            if (finalStatus === "approved") {
                toast("✨ บันทึกการแก้ไขข้อมูลสำเร็จ!<br><span class='text-[11px] text-slate-500 font-normal'>ระบบอัปเดตเวอร์ชันใหม่ของคุณให้ทันทีครับ</span>", "success");
            } else {
                toast("⚠️ ข้อความใหม่มีคำต้องสงสัย!<br><span class='text-[11px] text-slate-500 font-normal'>ส่งเรื่องเข้าคิวให้ทีมแอดมินอนุมัติความถูกต้องอีกครั้งครับ</span>", "warning");
            }
            if(editPortModal) editPortModal.classList.add("hidden");
        } catch (err) { console.error("Update failed:", err); toast("เกิดข้อผิดพลาดไม่สามารถบันทึกข้อมูลได้", "error"); }
    };
}

if(document.getElementById("btn-trigger-delete-post")) {
    document.getElementById("btn-trigger-delete-post").onclick = async () => {
        if(!activePostId) return;
        if(confirm("คุณแน่ใจหรือไม่ว่าต้องการลบผลงานชิ้นนี้อย่างถาวร?")) {
            try {
                await deleteDoc(doc(db, "portfolios", activePostId));
                toast("🗑️ ลบผลงานออกจากฐานข้อมูลเสร็จสิ้น", "success");
                if(pModal) pModal.classList.add("hidden");
            } catch (err) { toast("ไม่สามารถลบผลงานได้", "error"); }
        }
    };
}

if(document.getElementById("modal-like-btn")) {
    document.getElementById("modal-like-btn").onclick = async () => {
        const freshDoc = await getDoc(doc(db, "portfolios", activePostId));
        if(freshDoc.exists()){
            const currentData = freshDoc.data();
            let currentCount = currentData.likedBy && typeof currentData.likedBy === 'object' ? (currentData.likedBy.likesCount || 0) : (Array.isArray(currentData.likes) ? currentData.likes.length : (currentData.likesCount || 0));
            let nextCount = currentCount + 1; 
            await updateDoc(doc(db, "portfolios", activePostId), { "likedBy.likesCount": nextCount, "likesCount": nextCount });
            if(document.getElementById("modal-like-count")) document.getElementById("modal-like-count").innerText = nextCount;
        }
    };
}

if(document.getElementById("modal-comment-form")) {
    document.getElementById("modal-comment-form").onsubmit = async (e) => {
        e.preventDefault();
        const inputField = document.getElementById("modal-comment-input");
        if(!activePostId || !inputField.value.trim()) return;
        try {
            await addDoc(collection(db, "portfolios", activePostId, "comments"), {
                ownerId: currentUserId, ownerName: currentUserName, text: inputField.value, createdAt: new Date().toISOString()
            });
            inputField.value = "";
        } catch(err) { console.log("ไม่สามารถคอมเมนต์ได้เนื่องจากสิทธิ์ถูกจำกัด"); }
    };
}

// =========================================================
// 🚪 ระบบกดออกจากระบบ (Sign Out System)
// =========================================================
const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
    btnLogout.onclick = async () => {
        const { signOut } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
        if (confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
            try {
                await signOut(auth);
                toast("ออกจากระบบสำเร็จแล้ว 🚪<br><span class='text-[11px] text-slate-500 font-normal'>กำลังพากลับไปยังหน้าแรก...</span>", "success");
                setTimeout(() => { window.location.href = "index.html"; }, 1500);
            } catch (err) {
                console.error("Logout Error:", err);
                toast("เกิดข้อผิดพลาด ไม่สามารถออกจากระบบได้", "error");
            }
        }
    };
}