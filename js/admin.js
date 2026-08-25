// admin.js - ฉบับจัดเรียงสิทธิ์สูงขึ้นก่อน เรียงตามตัวอักษร และระบบแบ่งหน้าสมาชิกสมบูรณ์
import { db, auth } from "./firebase-config.js";
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { convertDriveUrl } from "./utils.js"; 

let allUsersCache = [];       
let filteredUsersCache = [];  
let currentPage = 1;          
const itemsPerPage = 5; 
let currentAdminRole = "user"; 
let currentEditingUid = ""; 

// 🛠️ ฟังก์ชันตรวจสอบคำหยาบสำหรับระบบกรองข้อความหลังบ้าน
function containsProfanity(text) {
    if (!text) return false;
    const badWords = ["ควย", "เย็ด", "มึง", "กู", "สัส", "เหี้ย", "ระยำ", "fuck", "bitch", "dick"]; 
    const lowerText = text.toLowerCase();
    return badWords.some(word => lowerText.includes(word));
}

export function setGlobalAdminRole(role) {
    currentAdminRole = (role || "").toLowerCase().trim();
}

// 🌟 ผูก Event ระบบต่าง ๆ ทันทีที่โหลดโครงสร้างหน้าเว็บเสร็จ
document.addEventListener("DOMContentLoaded", () => {
    initUserModalEvents();
    initPortfolioModalEvents(); 
    initPaginationButtons(); // ◀ ผูกการทำงานปุ่ม เปลี่ยนหน้า ก่อนหน้า/ถัดไป มุมบนขวา
});

// ================= 🔐 SECURITY GATE =================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const uData = userDoc.data();
                const userRole = (uData.role || "").toLowerCase().trim();
                
                if (userRole === "admin" || userRole === "dev") {
                    setGlobalAdminRole(userRole);
                    
                    initUserManagement();
                    fetchAdminPendingWorks();
                    initOnlineStaffMonitor(user.uid);
                } else {
                    alert("🔒 ปฏิเสธการเข้าถึง: คุณไม่มีสิทธิ์เข้าใช้งานระบบหลังบ้าน");
                    window.location.href = "index.html";
                }
            } else {
                alert("🔒 ไม่พบข้อมูลโปรไฟล์ของคุณในระบบหลัก");
                window.location.href = "index.html";
            }
        } catch (e) {
            console.error("Security gate error:", e);
            window.location.href = "index.html";
        }
    } else {
        alert("🔒 กรุณาเข้าสู่ระบบก่อนเข้าใช้งานหน้านี้ครับ");
        window.location.href = "index.html";
    }
});

// ================= 👤 1. USER MANAGEMENT ENGINE (ระบบสมาชิก) =================
export function initUserManagement() {
    const searchInput = document.getElementById("search-user"); 
    const tableBody = document.getElementById("user-table-body"); 

    if (!tableBody) return;

    // ดึงข้อมูลสมาชิกแบบ Realtime
    onSnapshot(collection(db, "users"), (snapshot) => {
        allUsersCache = [];
        snapshot.forEach(docSnap => {
            const userData = { id: docSnap.id, ...docSnap.data() };
            allUsersCache.push(userData);
        });

        const statUsersCount = document.getElementById("count-users"); 
        if (statUsersCount) {
            statUsersCount.innerText = snapshot.size;
        }

        applyUserFilterAndRender(searchInput ? searchInput.value : "");
    }, (error) => {
        console.error("Firestore users snapshot error:", error);
    });

    if (searchInput) {
        searchInput.oninput = (e) => {
            currentPage = 1; 
            applyUserFilterAndRender(e.target.value);
        };
    }
}

// 🌟 ฟังก์ชันกรองข้อมูล ค้นหา และ จัดเรียงลำดับ Role ลำดับตัวอักษร
function applyUserFilterAndRender(keyword) {
    const cleanKey = keyword.toLowerCase().trim();
    
    // 1. กรองคำค้นหาตามชื่อหรืออีเมล
    let filtered = allUsersCache.filter(user => {
        const name = (user.name || user.displayName || user.username || "").toLowerCase();
        const email = (user.email || "").toLowerCase();
        return name.includes(cleanKey) || email.includes(cleanKey);
    });

    // 2. จัดเรียงลำดับสิทธิ์ และตัวอักษร (Sorting)
    filtered.sort((a, b) => {
        const roleA = (a.role || "").toLowerCase().trim();
        const roleB = (b.role || "").toLowerCase().trim();

        // กำหนดคะแนนน้ำหนักให้แก่สิทธิ์เพื่อเรียงจากสูงลงต่ำ
        const getRoleWeight = (role) => {
            if (role === "dev") return 3;
            if (role === "admin") return 2;
            return 1; // สมาชิกทั่วไป / Creator
        };

        const weightA = getRoleWeight(roleA);
        const weightB = getRoleWeight(roleB);

        // ถ้าน้ำหนัก Role ไม่เท่ากัน ดันสิทธิ์สูงขึ้นก่อน
        if (weightA !== weightB) {
            return weightB - weightA;
        }

        // ถ้า Role เหมือนกัน ให้เรียงลำดับชื่อตามตัวอักษร ก-ฮ และ A-Z
        const nameA = (a.name || a.displayName || "").toLowerCase();
        const nameB = (b.name || b.displayName || "").toLowerCase();
        return nameA.localeCompare(nameB, 'th', { sensitivity: 'base' });
    });

    filteredUsersCache = filtered;
    renderUserTableByPage();
}

// ฟังก์ชันตัดแบ่งข้อมูลแสดงผลรายหน้าบนตาราง (Pagination Render)
function renderUserTableByPage() {
    const tableBody = document.getElementById("user-table-body");
    const pageInfo = document.getElementById("page-info");
    const btnPrev = document.getElementById("btn-prev-page");
    const btnNext = document.getElementById("btn-next-page");

    if (!tableBody) return;
    tableBody.innerHTML = ""; 

    const total = filteredUsersCache.length;
    const maxPage = Math.max(1, Math.ceil(total / itemsPerPage));
    
    if (currentPage > maxPage) currentPage = maxPage;

    // อัปเดต UI ข้อความบอกหน้า และการเปิด/ปิด ปุ่มกดเปลี่ยนหน้า
    if (pageInfo) pageInfo.innerText = `หน้า ${currentPage} / ${maxPage}`;
    if (btnPrev) btnPrev.disabled = (currentPage === 1);
    if (btnNext) btnNext.disabled = (currentPage === maxPage);

    // ดึงเฉพาะข้อมูลของหน้านั้น ๆ ออกมาแสดงผล (ทีละ 5 แถว)
    const start = (currentPage - 1) * itemsPerPage;
    const pageItems = filteredUsersCache.slice(start, start + itemsPerPage);

    if (pageItems.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-slate-400 italic">ไม่พบข้อมูลรายชื่อสมาชิก...</td></tr>`;
        return;
    }

    pageItems.forEach(user => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50/50 transition-colors";

        const currentAvatar = user.avatarUrl || user.avatar || user.photoURL || "";
        const avatarImg = currentAvatar 
            ? `<img src="${convertDriveUrl(currentAvatar)}" class="w-9 h-9 rounded-full object-cover border border-slate-200" referrerpolicy="no-referrer" onerror="this.onerror=null; this.parentNode.innerHTML='👤';">`
            : `<div class="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm border border-slate-200 text-slate-400">👤</div>`;

        const checkRole = (user.role || "").toLowerCase().trim();
        let badge = `<span class="px-2.5 py-0.5 text-[9px] font-bold tracking-wider rounded-md bg-slate-100 text-slate-500 border border-slate-200 uppercase">Creator</span>`;
        if (checkRole === "admin") badge = `<span class="px-2.5 py-0.5 text-[9px] font-bold tracking-wider rounded-md bg-orange-50 text-orange-600 border border-orange-200/50 uppercase">Admin</span>`;
        if (checkRole === "dev") badge = `<span class="px-2.5 py-0.5 text-[9px] font-bold tracking-wider rounded-md bg-rose-50 text-rose-600 border border-rose-200/50 uppercase">👑 DEV</span>`;

        let actions = "";
        if (currentAdminRole === "dev" || checkRole !== "dev") {
            actions = `
                <button class="btn-edit-user px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-all">⚙️ จัดการ</button>
                <button class="btn-delete-user px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg font-bold transition-all">ลบ</button>
            `;
        } else {
            actions = `<span class="text-[10px] text-slate-400 italic font-medium">🔒 PROTECTED</span>`;
        }

        tr.innerHTML = `
            <td class="py-4 px-4 flex items-center space-x-3">
                ${avatarImg}
                <div>
                    <p class="font-bold text-slate-800">${user.name || user.displayName || "Anonymous"}</p>
                    <p class="text-[10px] text-slate-400">${user.email || "-"}</p>
                </div>
            </td>
            <td class="py-4 px-4">
                <p class="text-slate-600 font-medium">📞 ${user.phone || user.tel || "-"}</p>
                <p class="text-slate-400">💬 ${user.line || user.lineId || "-"}</p>
            </td>
            <td class="py-4 px-4">${badge}</td>
            <td class="py-4 px-4 text-right space-x-1">${actions}</td>
        `;

        // ปุ่มเปิดกล่องโมดอลแก้ไขข้อมูลสมาชิก
        const btnEdit = tr.querySelector(".btn-edit-user");
        if (btnEdit) {
            btnEdit.onclick = () => {
                currentEditingUid = user.id; 
                if(document.getElementById("edit-user-name")) document.getElementById("edit-user-name").value = user.name || user.displayName || "";
                if(document.getElementById("edit-user-role")) document.getElementById("edit-user-role").value = checkRole || "user";
                if(document.getElementById("edit-user-phone")) document.getElementById("edit-user-phone").value = user.phone || user.tel || "";
                if(document.getElementById("edit-user-line")) document.getElementById("edit-user-line").value = user.line || user.lineId || "";

                const userModal = document.getElementById("modal-edit-user");
                if (userModal) userModal.classList.remove("hidden");
            };
        }

        // ปุ่มลบสมาชิกออกจากระบบข้อมูลฐานข้อมูล
        const btnDel = tr.querySelector(".btn-delete-user");
        if (btnDel) {
            btnDel.onclick = async () => {
                if (currentAdminRole !== "dev" && checkRole === "dev") { alert("⚠️ สิทธิ์ไม่เพียงพอในการลบไอดีผู้พัฒนาระบบ"); return; }
                if (confirm(`คุณต้องการลบรายชื่อสมาชิก [ ${user.name || user.displayName || 'สมาชิก'} ] ออกจากระบบถาวรใช่หรือไม่?`)) {
                    try { await deleteDoc(doc(db, "users", user.id)); alert("🗑️ ลบข้อมูลเรียบร้อย"); } catch (err) { alert(err.message); }
                }
            };
        }

        tableBody.appendChild(tr);
    });
}

// 🌟 ฟังชันก์ลงทะเบียนรับคำสั่ง Event คลิกเปลี่ยนหน้า (Pagination Click Logic)
function initPaginationButtons() {
    const btnPrev = document.getElementById("btn-prev-page");
    const btnNext = document.getElementById("btn-next-page");

    if (btnPrev) {
        btnPrev.onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                renderUserTableByPage();
            }
        };
    }

    if (btnNext) {
        btnNext.onclick = () => {
            const total = filteredUsersCache.length;
            const maxPage = Math.ceil(total / itemsPerPage);
            if (currentPage < maxPage) {
                currentPage++;
                renderUserTableByPage();
            }
        };
    }
}

// ฟังชันก์ควบคุมปุ่มตกลง/ยกเลิกใน Modal แก้ไขข้อมูลผู้ใช้งาน
export function initUserModalEvents() {
    const userModal = document.getElementById("modal-edit-user");
    const btnCancel = document.getElementById("btn-cancel-user-modal");
    const editForm = document.getElementById("form-update-user");

    const closeModal = () => { if(userModal) userModal.classList.add("hidden"); };

    if(btnCancel) btnCancel.onclick = closeModal;

    if(editForm) {
        editForm.onsubmit = async (e) => {
            e.preventDefault();
            if(!currentEditingUid) return;

            const uName = document.getElementById("edit-user-name").value.trim();
            const uRole = document.getElementById("edit-user-role").value;
            const uPhone = document.getElementById("edit-user-phone").value.trim();
            const uLine = document.getElementById("edit-user-line").value.trim();

            if(uRole === "dev" && currentAdminRole !== "dev") {
                alert("⚠️ สิทธิ์ไม่เพียงพอ: บัญชีระดับแอดมินธรรมดา ไม่สามารถแต่งตั้งผู้อื่นเป็น DEV ได้");
                return;
            }

            try {
                await updateDoc(doc(db, "users", currentEditingUid), {
                    name: uName,
                    displayName: uName,
                    role: uRole,
                    phone: uPhone,
                    line: uLine
                });

                alert("✨ อัปเดตข้อมูลและสิทธิ์ของสมาชิกสำเร็จเรียบร้อย!");
                closeModal(); 
            } catch(error) {
                console.error("Error updating user info: ", error);
                alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + error.message);
            }
        };
    }
}

// ================= 📂 2. PORTFOLIO APPROVAL ENGINE (ระบบตรวจงานคำหยาบ) =================
export function fetchAdminPendingWorks() {
    onSnapshot(collection(db, "portfolios"), (snap) => {
        let p = 0; let a = 0;
        snap.forEach(d => {
            const data = d.data();
            const s = (data.status || "").toLowerCase().trim();
            
            if (s === "pending") {
                const hasProfanity = containsProfanity(data.title) || containsProfanity(data.description);
                if (hasProfanity) p++;
            }
            if (s === "approved") a++;
        });
        if(document.getElementById("count-pending")) document.getElementById("count-pending").innerText = p;
        if(document.getElementById("count-approved")) document.getElementById("count-approved").innerText = a;
    });

    const q = query(collection(db, "portfolios"), where("status", "==", "pending"));
    onSnapshot(q, (snap) => {
        const container = document.getElementById("pending-container");
        if (!container) return;
        
        const profanityWorks = [];
        
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            const hasProfanityInTitle = containsProfanity(data.title);
            const hasProfanityInDesc = containsProfanity(data.description);
            
            if (hasProfanityInTitle || hasProfanityInDesc) {
                profanityWorks.push({ id: docSnap.id, ...data });
            }
        });

        if (profanityWorks.length === 0) {
            container.innerHTML = `
                <div class="sm:col-span-2 text-center text-slate-400 py-10 font-bold text-xs uppercase tracking-wider">
                    ✨ All caught up! No unsafe works found.
                </div>
            `;
            return;
        }
        
        container.innerHTML = "";

        profanityWorks.forEach((data) => {
            const id = data.id;
            
            let rawImg = data.image || data.imgLink || data.coverUrl || data.imageUrl || "";
            if (!rawImg && data.likedBy) {
                rawImg = data.likedBy.image || "";
            }
            
            const img = convertDriveUrl(rawImg) || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500";
            
            let displayCategory = data.category || "General";
            if (displayCategory.includes("Graphic")) displayCategory = "Graphic Design";
            if (displayCategory.includes("Video") || displayCategory.includes("Editor")) displayCategory = "Video Editor";
            if (displayCategory.includes("3D") || displayCategory.includes("Motion")) displayCategory = "Motion Graphic / 3D";

            const div = document.createElement("div");
            div.className = "bg-white border border-rose-200 bg-rose-50/5 rounded-2xl p-4 space-y-3 shadow-xs flex flex-col justify-between";
            
            div.innerHTML = `
                <button type="button" class="btn-view-details block text-left w-full space-y-3 group focus:outline-none">
                    <div class="aspect-video bg-slate-900 rounded-xl overflow-hidden relative border border-slate-200/40 group-hover:opacity-90 transition-opacity">
                        <img src="${img}" referrerpolicy="no-referrer" class="w-full h-full object-cover">
                        <span class="absolute top-2 left-2 text-[9px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-md uppercase tracking-wider">${displayCategory}</span>
                        <div class="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span class="bg-white/90 text-slate-800 text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-xs">⚠️ ตรวจสอบคำหยาบ</span>
                        </div>
                    </div>
                    <div>
                        <h4 class="font-bold text-slate-800 text-xs truncate group-hover:text-orange-500 transition-colors">${data.title || "Untitled Work"}</h4>
                        <p class="text-[10px] text-slate-400 truncate mt-0.5">โดยครีเอเตอร์: <span class="text-slate-600 font-semibold">${data.ownerName || "Unknown"}</span></p>
                    </div>
                </button>
                <div class="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                    <button type="button" class="btn-adm-approve py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl transition-all shadow-xs">✓ ปล่อยผ่าน</button>
                    <button type="button" class="btn-adm-reject py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-bold rounded-xl border border-rose-200/40 transition-all">✕ ปฏิเสธ</button>
                </div>
            `;

            div.querySelector(".btn-view-details").onclick = (e) => {
                e.preventDefault();
                if(document.getElementById("view-port-image")) document.getElementById("view-port-image").src = img;
                if(document.getElementById("view-port-category")) document.getElementById("view-port-category").innerText = displayCategory;
                if(document.getElementById("view-port-owner")) document.getElementById("view-port-owner").innerText = data.ownerName || "ไม่ระบุชื่อ";
                if(document.getElementById("view-port-title")) document.getElementById("view-port-title").innerText = data.title || "Untitled Work";
                if(document.getElementById("view-port-desc")) document.getElementById("view-port-desc").innerText = data.description || "ครีเอเตอร์ไม่ได้ระบุรายละเอียดเพิ่มเติมเอาไว้...";

                const portModal = document.getElementById("modal-view-portfolio");
                if (portModal) portModal.classList.remove("hidden");
            };

            div.querySelector(".btn-adm-approve").onclick = (e) => { 
                e.preventDefault(); 
                updateStatus(id, "approved"); 
            };
            
            div.querySelector(".btn-adm-reject").onclick = (e) => { 
                e.preventDefault(); 
                updateStatus(id, "rejected"); 
            };

            container.appendChild(div);
        });
    }, (error) => {
        console.error("Firestore portfolios snapshot error:", error);
    });
}

async function updateStatus(id, s) {
    if(!confirm(`ต้องการเปลี่ยนสถานะงานนี้เป็น: [ ${s.toUpperCase()} ] ใช่ไหม?`)) return;
    try {
        if (s === "approved") {
            await updateDoc(doc(db, "portfolios", id), { 
                status: "approved",
                "likedBy.status": "approved"
            });
            alert("ดำเนินการอนุมัติและปล่อยผ่านผลงานชิ้นนี้สำเร็จแล้วครับ");
        } else if (s === "rejected") {
            await updateDoc(doc(db, "portfolios", id), { 
                status: "rejected",
                "likedBy.status": "rejected"
            });
            alert("ปฏิเสธการอนุมัติเรียบร้อย (ระบบส่งแจ้งเตือนกลับไปยังหน้าจัดการของครีเอเตอร์แล้วครับ)");
        }
    } catch (err) { 
        console.error("Update Status Error: ", err);
        alert("เกิดข้อผิดพลาด: " + err.message); 
    }
}

function initPortfolioModalEvents() {
    const portModal = document.getElementById("modal-view-portfolio");
    const btnClose = document.getElementById("btn-close-port-modal");
    const btnCancel = document.getElementById("btn-cancel-port-modal");

    if(!portModal) return;

    const closePortModal = () => { portModal.classList.add("hidden"); };

    if(btnClose) btnClose.onclick = closePortModal;
    if(btnCancel) btnCancel.onclick = closePortModal;
}

// ================= 🟢 3. ONLINE STAFF MONITOR (ระบบติดตามสตาฟออนไลน์) =================
export function initOnlineStaffMonitor(currentUid) {
    const listArea = document.getElementById("staff-monitor-list");
    if (!listArea) return;

    const updateMyStatus = async () => {
        try {
            await updateDoc(doc(db, "users", currentUid), {
                lastActive: new Date().getTime()
            });
        } catch (e) { console.error("Active Update Failed:", e); }
    };

    updateMyStatus();
    setInterval(updateMyStatus, 30000); 

    onSnapshot(collection(db, "users"), (snapshot) => {
        listArea.innerHTML = "";
        const now = new Date().getTime();
        let onlineCount = 0;

        snapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const checkRole = (user.role || "").toLowerCase().trim();
            
            if ((checkRole === "admin" || checkRole === "dev") && user.lastActive && (now - user.lastActive < 120000)) {
                onlineCount++;
                
                const item = document.createElement("div");
                item.className = "flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded-xl";
                
                let roleTag = (checkRole === "dev")
                    ? `<span class="text-[8px] bg-rose-50 text-rose-600 border border-rose-200/50 px-1.5 py-0.5 rounded font-black">👑 DEV</span>`
                    : `<span class="text-[8px] bg-orange-50 text-orange-600 border border-orange-200/50 px-1.5 py-0.5 rounded font-bold">ADMIN</span>`;

                const currentAvatar = user.avatarUrl || user.avatar || user.photoURL || "";
                const avatarImg = currentAvatar 
                    ? `<img src="${convertDriveUrl(currentAvatar)}" class="w-6 h-6 rounded-full object-cover border border-slate-200" referrerpolicy="no-referrer" onerror="this.onerror=null; this.parentNode.innerHTML='👤';">`
                    : `<div class="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 font-bold">👤</div>`;

                item.innerHTML = `
                    <div class="flex items-center space-x-2 min-w-0">
                        ${avatarImg}
                        <p class="font-bold text-slate-700 truncate text-[11px]">${user.name || user.displayName || "Staff Node"}</p>
                    </div>
                    ${roleTag}
                `;
                listArea.appendChild(item);
            }
        });

        const staffCountBadge = document.getElementById("count-staffs");
        if (staffCountBadge) staffCountBadge.innerText = onlineCount;

        if (onlineCount === 0) {
            listArea.innerHTML = `<div class="text-center py-4 text-slate-400 text-[11px] italic">No other staff online.</div>`;
        }
    });
}