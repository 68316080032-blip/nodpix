import { db, auth } from "./firebase-config.js";

import { 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { 
    collection, 
    addDoc, 
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    onSnapshot, 
    query, 
    where,
    serverTimestamp,
    writeBatch 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// -------------------------------------------------------------
// 🔔 Custom Toast Notification System
// -------------------------------------------------------------
function showToast(message, type = 'success', duration = 3500) {
    let container = document.getElementById('toast-container');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4';
        document.body.appendChild(container);
    }

    const themes = {
        success: {
            bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
            icon: 'fa-circle-check text-emerald-500',
        },
        error: {
            bg: 'bg-rose-50 border-rose-200 text-rose-900',
            icon: 'fa-circle-xmark text-rose-500',
        },
        info: {
            bg: 'bg-blue-50 border-blue-200 text-blue-900',
            icon: 'fa-circle-info text-blue-500',
        },
        warning: {
            bg: 'bg-amber-50 border-amber-200 text-amber-900',
            icon: 'fa-triangle-exclamation text-amber-500',
        }
    };

    const theme = themes[type] || themes.success;

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto relative flex items-center justify-between gap-3 p-4 rounded-2xl border shadow-lg ${theme.bg} transition-all duration-300 transform translate-y-2 opacity-0 overflow-hidden`;

    toast.innerHTML = `
        <div class="flex items-center gap-3">
            <i class="fa-solid ${theme.icon} text-base shrink-0"></i>
            <span class="text-xs font-bold leading-snug">${escapeHtml(message)}</span>
        </div>
        <button type="button" class="btn-close-toast text-slate-400 hover:text-slate-600 text-xs font-bold pl-2 cursor-pointer shrink-0">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    });

    const removeToast = () => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector('.btn-close-toast').addEventListener('click', removeToast);
    setTimeout(removeToast, duration);
}

// -------------------------------------------------------------
// ❓ Custom Confirm Modal System
// -------------------------------------------------------------
function showConfirm({ title = 'ยืนยันการทำรายการ', message = 'คุณต้องการดำเนินการต่อหรือไม่?', confirmText = 'ยืนยัน', cancelText = 'ยกเลิก', type = 'warning' }) {
    return new Promise((resolve) => {
        const typeStyles = {
            danger: {
                iconBg: 'bg-rose-100 text-rose-600',
                icon: 'fa-triangle-exclamation',
                btnBg: 'bg-rose-600 hover:bg-rose-700 text-white'
            },
            warning: {
                iconBg: 'bg-amber-100 text-amber-600',
                icon: 'fa-circle-exclamation',
                btnBg: 'bg-orange-500 hover:bg-orange-600 text-white'
            },
            info: {
                iconBg: 'bg-blue-100 text-blue-600',
                icon: 'fa-circle-info',
                btnBg: 'bg-blue-600 hover:bg-blue-700 text-white'
            }
        };

        const currentStyle = typeStyles[type] || typeStyles.warning;

        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 transition-opacity duration-200 opacity-0';

        overlay.innerHTML = `
            <div class="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 transform scale-95 transition-all duration-200 space-y-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-2xl ${currentStyle.iconBg} flex items-center justify-center shrink-0">
                        <i class="fa-solid ${currentStyle.icon} text-lg"></i>
                    </div>
                    <div>
                        <h4 class="font-black text-slate-900 text-sm">${escapeHtml(title)}</h4>
                        <p class="text-xs font-semibold text-slate-500 mt-0.5">${escapeHtml(message)}</p>
                    </div>
                </div>

                <div class="flex items-center justify-end gap-2 pt-2">
                    <button type="button" class="btn-cancel px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer">
                        ${escapeHtml(cancelText)}
                    </button>
                    <button type="button" class="btn-confirm px-4 py-2 rounded-xl ${currentStyle.btnBg} text-xs font-bold transition-all shadow-sm cursor-pointer">
                        ${escapeHtml(confirmText)}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const card = overlay.querySelector('div');

        requestAnimationFrame(() => {
            overlay.classList.remove('opacity-0');
            card.classList.remove('scale-95');
        });

        const closeConfirm = (result) => {
            overlay.classList.add('opacity-0');
            card.classList.add('scale-95');
            setTimeout(() => {
                overlay.remove();
                resolve(result);
            }, 200);
        };

        overlay.querySelector('.btn-confirm').addEventListener('click', () => closeConfirm(true));
        overlay.querySelector('.btn-cancel').addEventListener('click', () => closeConfirm(false));
    });
}

// 🛠️ Convert Google Drive Image URL
function convertDriveUrl(url) {
    if (!url || typeof url !== 'string') return '';
    if (url.includes('drive.google.com')) {
        let fileId = '';
        if (url.includes('/d/')) {
            fileId = url.split('/d/')[1].split('/')[0].split('?')[0];
        } else if (url.includes('id=')) {
            fileId = url.split('id=')[1].split('&')[0];
        }
        if (fileId) {
            return `https://lh3.googleusercontent.com/d/${fileId}`;
        }
    }
    return url;
}

// DOM Elements
const jobsListContainer = document.getElementById('jobs-list');
const jobCountText = document.getElementById('job-count');

// Modal Elements
const modalPostJob = document.getElementById('modalPostJob');
const btnPostJob = document.getElementById('btnPostJob');
const btnCloseModal = document.getElementById('btnCloseModal');
const formPostJob = document.getElementById('formPostJob');

const modalApplyJob = document.getElementById('modalApplyJob');
const btnApplyJob = document.getElementById('btnApplyJob');
const btnCloseApplyModal = document.getElementById('btnCloseApplyModal');
const formApplyJob = document.getElementById('formApplyJob');
const applyModalJobTitle = document.getElementById('applyModalJobTitle');

// Cropper Elements
const modalCropImage = document.getElementById('modalCropImage');
const cropperTargetImage = document.getElementById('cropperTargetImage');
const btnCancelCrop = document.getElementById('btnCancelCrop');
const btnSaveCrop = document.getElementById('btnSaveCrop');
const jobFileInput = document.getElementById('jobFileInput');
let cropper = null;

// Messenger Elements
const btnOpenMessenger = document.getElementById('btnOpenMessenger');
const messengerDrawer = document.getElementById('messengerDrawer');
const btnCloseMessenger = document.getElementById('btnCloseMessenger');
const messagesList = document.getElementById('messagesList');
const unreadBadge = document.getElementById('unreadBadge');

// Filter Elements
const btnFilterAll = document.getElementById('btnFilterAll');
const btnFilterFreelance = document.getElementById('btnFilterFreelance');
const btnFilterFulltime = document.getElementById('btnFilterFulltime');
const btnFilterSaved = document.getElementById('btnFilterSaved');

// Auth Elements
const btnLogout = document.getElementById('btnLogout');
const authGuest = document.getElementById('auth-guest');
const authUser = document.getElementById('auth-user');
const userDisplayName = document.getElementById('user-display-name');

// Job Detail Elements
const defaultPrompt = document.getElementById('default-prompt');
const activeJobView = document.getElementById('active-job-view');
const viewJobTitle = document.getElementById('view-job-title');
const viewJobCompany = document.getElementById('view-job-company');
const viewJobBudget = document.getElementById('view-job-budget');
const viewJobLocation = document.getElementById('view-job-location');
const viewJobDesc = document.getElementById('view-job-desc');
const viewJobBadge = document.getElementById('view-job-badge');
const viewHiringAvatar = document.getElementById('view-hiring-avatar');

// Sidebar Elements
const sidebarJobType = document.getElementById('sidebar-job-type');
const sidebarJobLocation = document.getElementById('sidebar-job-location');
const sidebarHiringAvatar = document.getElementById('sidebar-hiring-avatar');
const sidebarHiringName = document.getElementById('sidebar-hiring-name');
const viewJobDate = document.getElementById('view-job-date');
const sidebarCreativeFields = document.getElementById('sidebar-creative-fields');

const proposalsContainer = document.getElementById('proposals-container');
const myProposalsList = document.getElementById('my-proposals-list');

// State Variables
let currentUser = null;
let jobsData = []; 
let currentFilter = 'all'; 
let currentSelectedJob = null;
let editingJobId = null;
let messengerUnsubscribe = null;
let proposalsUnsubscribe = null;
let myProposalsUnsubscribe = null;
let jobsUnsubscribe = null;

// ⭐ Save Jobs State
let savedJobIds = JSON.parse(localStorage.getItem('savedJobIds')) || [];

// -------------------------------------------------------------
// ✂️ Image Cropper System
// -------------------------------------------------------------
if (jobFileInput) {
    jobFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            if (cropperTargetImage) {
                cropperTargetImage.src = event.target.result;
                modalCropImage?.classList.remove('hidden');

                if (cropper) cropper.destroy();

                cropper = new Cropper(cropperTargetImage, {
                    aspectRatio: 1,
                    viewMode: 1,
                    background: false,
                    autoCropArea: 0.8
                });
            }
        };
        reader.readAsDataURL(file);
    });
}

btnCancelCrop?.addEventListener('click', () => {
    if (cropper) cropper.destroy();
    modalCropImage?.classList.add('hidden');
    if (jobFileInput) jobFileInput.value = '';
});

btnSaveCrop?.addEventListener('click', () => {
    if (!cropper) return;

    const canvas = cropper.getCroppedCanvas({
        width: 400,
        height: 400
    });

    const croppedBase64 = canvas.toDataURL('image/jpeg', 0.85);

    const jobImageUrlInput = document.getElementById('jobImageUrl');
    if (jobImageUrlInput) {
        jobImageUrlInput.value = croppedBase64;
    }

    const imagePreview = document.getElementById('imagePreview');
    if (imagePreview) {
        imagePreview.src = croppedBase64;
        imagePreview.classList.remove('hidden');
    }

    cropper.destroy();
    modalCropImage?.classList.add('hidden');
});

// -------------------------------------------------------------
// 🔐 Auth Listener & Access Control (ต้องล็อกอินเท่านั้น)
// -------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
    currentUser = user;

    // ล้าง Realtime Subscriptions เดิมก่อนทำรายการ
    if (messengerUnsubscribe) messengerUnsubscribe();
    if (proposalsUnsubscribe) proposalsUnsubscribe();
    if (myProposalsUnsubscribe) myProposalsUnsubscribe();
    if (jobsUnsubscribe) jobsUnsubscribe();

    if (user) {
        authGuest?.classList.add('hidden');
        authUser?.classList.remove('hidden');
        authUser?.classList.add('flex');

        const headerAvatar = document.getElementById('header-avatar');
        const dropdownAvatar = document.getElementById('dropdown-avatar');
        const dropdownEmail = document.getElementById('dropdown-user-email');

        if (dropdownEmail) {
            dropdownEmail.textContent = user.email || 'ไม่ระบุอีเมล';
        }

        let name = user.displayName || user.email?.split('@')[0] || 'ผู้ใช้งาน';
        let avatarUrl = user.photoURL || '';

        try {
            // ✅ แก้ไขจาก doc(doc, ...) เป็น doc(db, ...)
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                name = userData.name || userData.displayName || userData.username || name;
                avatarUrl = userData.photoURL || userData.avatar || userData.avatarUrl || userData.profileImage || userData.profileImg || userData.picture || userData.imageUrl || avatarUrl;
            }
        } catch (e) {
            console.error("Error loading user profile:", e);
        }

        if (userDisplayName) {
            userDisplayName.textContent = name;
        }

        const fallbackAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;
        const finalAvatar = avatarUrl ? convertDriveUrl(avatarUrl) : fallbackAvatar;

        applyImageSrc(headerAvatar, finalAvatar, fallbackAvatar);
        applyImageSrc(dropdownAvatar, finalAvatar, fallbackAvatar);

        listenToMessenger(user.uid);
        listenToMyProposals(user.uid);
        
        // 🔒 เริ่มดึงข้อมูลประกาศงานเฉพาะผู้ใช้ที่ล็อกอินแล้วเท่านั้น
        listenToJobs();
    } else {
        // กรณีไม่ได้ล็อกอิน
        authGuest?.classList.remove('hidden');
        authUser?.classList.add('hidden');

        jobsData = [];
        clearJobView();
        
        if (jobCountText) jobCountText.textContent = `0 jobs`;
        if (jobsListContainer) {
            jobsListContainer.innerHTML = `
                <div class="p-8 text-center bg-amber-50/50 border border-amber-200/60 rounded-2xl">
                    <i class="fa-solid fa-lock text-amber-500 text-2xl mb-2"></i>
                    <p class="text-xs font-bold text-amber-900">กรุณาเข้าสู่ระบบเพื่อดูรายการงานทั้งหมด</p>
                </div>
            `;
        }
    }
});

btnLogout?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.reload());
});

btnOpenMessenger?.addEventListener('click', () => messengerDrawer?.classList.toggle('hidden'));
btnCloseMessenger?.addEventListener('click', () => messengerDrawer?.classList.add('hidden'));

function applyImageSrc(targetEl, srcUrl, fallback) {
    if (!targetEl) return;
    
    let imgTag = targetEl.tagName === 'IMG' ? targetEl : targetEl.querySelector('img');
    
    if (imgTag) {
        imgTag.src = srcUrl;
        imgTag.onerror = () => { imgTag.src = fallback; };
    } else {
        targetEl.style.backgroundImage = `url('${srcUrl}')`;
        targetEl.style.backgroundSize = 'cover';
        targetEl.style.backgroundPosition = 'center';
    }
}

// -------------------------------------------------------------
// 💬 Messenger System
// -------------------------------------------------------------
function listenToMessenger(userId) {
    if (!messagesList) return;

    const q = query(collection(db, "messages"), where("receiverId", "==", userId));

    messengerUnsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            if (unreadBadge) unreadBadge.classList.add('hidden');
            messagesList.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs font-semibold">ไม่มีข้อความแจ้งเตือนในขณะนี้</div>`;
            return;
        }

        let msgArray = [];
        snapshot.forEach((docSnap) => msgArray.push({ id: docSnap.id, ...docSnap.data() }));

        msgArray.sort((a, b) => (b.createdAt?.toMillis() || Date.now()) - (a.createdAt?.toMillis() || Date.now()));

        if (unreadBadge) {
            unreadBadge.textContent = msgArray.length;
            unreadBadge.classList.remove('hidden');
        }

        let htmlContent = "";
        msgArray.forEach((msg) => {
            const dateStr = msg.createdAt ? new Date(msg.createdAt.toMillis()).toLocaleString('th-TH') : 'เพิ่งส่ง';

            htmlContent += `
                <div class="p-3.5 bg-slate-50 hover:bg-slate-100 transition-all space-y-2 rounded-2xl mb-2 border border-slate-100 relative group">
                    <div class="flex items-center justify-between gap-2 pr-6">
                        <span class="font-extrabold text-xs text-orange-500 truncate">${escapeHtml(msg.senderName || 'ผู้ใช้งาน')}</span>
                        <span class="text-[10px] text-slate-400 font-medium shrink-0">${dateStr}</span>
                    </div>

                    <button onclick="deleteMessage('${msg.id}')" title="ลบข้อความ" class="absolute top-3 right-3 text-slate-300 hover:text-rose-500 transition-colors p-1 cursor-pointer">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>

                    <p class="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-medium">${escapeHtml(msg.text)}</p>
                    
                    ${msg.jobId ? `
                        <div class="pt-1 flex justify-end">
                            <button onclick="showJobDetail('${msg.jobId}'); document.getElementById('messengerDrawer')?.classList.add('hidden');" class="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-[11px] font-bold transition-all shadow-xs cursor-pointer">
                                ไปที่หน้างานเพื่อตกลงจ้าง →
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        messagesList.innerHTML = htmlContent;
    });
}

window.deleteMessage = async function(messageId) {
    const isConfirmed = await showConfirm({
        title: "ยืนยันการลบข้อความ",
        message: "คุณต้องการลบข้อความแจ้งเตือนนี้ใช่หรือไม่?",
        confirmText: "ลบข้อความ",
        type: "danger"
    });

    if (!isConfirmed) return;

    try {
        await deleteDoc(doc(db, "messages", messageId));
        showToast("ลบข้อความแจ้งเตือนเรียบร้อยแล้ว", "success");
    } catch (error) {
        showToast("เกิดข้อผิดพลาดในการลบข้อความ: " + error.message, "error");
    }
};

async function sendMessage({ senderId, senderName, receiverId, jobId, jobTitle, text }) {
    try {
        await addDoc(collection(db, "messages"), {
            senderId, senderName, receiverId, jobId, jobTitle, text, isRead: false, createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error sending chat message:", error);
    }
}

// Dropdown Action Menu
window.toggleActionMenu = function(e, jobId) {
    e.stopPropagation();
    const targetMenu = document.getElementById(`action-menu-${jobId}`);
    
    document.querySelectorAll('.job-action-menu').forEach(menu => {
        if (menu !== targetMenu) menu.classList.add('hidden');
    });

    if (targetMenu) {
        targetMenu.classList.toggle('hidden');
    }
};

document.addEventListener('click', () => {
    document.querySelectorAll('.job-action-menu').forEach(menu => menu.classList.add('hidden'));
});

// Delete Job
window.deleteJob = async function(jobId) {
    const isConfirmed = await showConfirm({
        title: "ยืนยันการลบงาน",
        message: "คุณต้องการลบประกาศงานนี้ใช่หรือไม่? ข้อมูลใบเสนอราคาที่เกี่ยวข้องทั้งหมดจะถูกลบออก",
        confirmText: "ลบงาน",
        type: "danger"
    });

    if (!isConfirmed) return;

    try {
        const batch = writeBatch(db);
        
        batch.delete(doc(db, "jobs", jobId));

        const proposalsQuery = query(collection(db, "proposals"), where("jobId", "==", jobId));
        const proposalsSnap = await getDocs(proposalsQuery);
        proposalsSnap.forEach(pDoc => batch.delete(pDoc.ref));

        await batch.commit();

        showToast("ลบประกาศงานสำเร็จเรียบร้อยแล้ว!", "success");
        clearJobView();
    } catch (error) {
        showToast("เกิดข้อผิดพลาดในการลบงาน: " + error.message, "error");
    }
};

window.openEditJobModal = function(jobId) {
    const job = jobsData.find(j => j.id === jobId);
    if (!job) return;

    editingJobId = jobId;

    document.getElementById('jobTitle').value = job.title || '';
    document.getElementById('jobBudget').value = job.budget || '';
    document.getElementById('jobType').value = job.jobType || 'Freelance';
    document.getElementById('jobLocation').value = job.location || '';
    document.getElementById('jobCategory').value = job.category || 'Graphic Design';
    document.getElementById('jobImageUrl').value = job.imageUrl || '';
    document.getElementById('jobDesc').value = job.description || '';
    
    const modalHeaderTitle = document.querySelector('#modalPostJob h3');
    if (modalHeaderTitle) modalHeaderTitle.textContent = 'แก้ไขประกาศงาน';

    modalPostJob?.classList.remove('hidden');
};

// Post / Edit Job
formPostJob?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return showToast("กรุณาเข้าสู่ระบบก่อนทำรายการ", "warning");

    const title = document.getElementById('jobTitle')?.value.trim();
    const budget = Number(document.getElementById('jobBudget')?.value) || 0;
    const jobType = document.getElementById('jobType')?.value;
    const location = document.getElementById('jobLocation')?.value.trim();
    const category = document.getElementById('jobCategory')?.value;
    const rawImageUrl = document.getElementById('jobImageUrl')?.value.trim();
    const description = document.getElementById('jobDesc')?.value.trim();

    const imageUrl = convertDriveUrl(rawImageUrl);

    try {
        if (editingJobId) {
            await updateDoc(doc(db, "jobs", editingJobId), {
                title, budget, jobType, location, category, imageUrl, description, updatedAt: serverTimestamp()
            });
            showToast("แก้ไขประกาศงานเรียบร้อยแล้ว!", "success");
            showJobDetail(editingJobId);
        } else {
            await addDoc(collection(db, "jobs"), {
                title,
                budget,
                jobType,
                location,
                category,
                imageUrl,
                description,
                userId: currentUser.uid,
                status: "open",
                createdAt: serverTimestamp()
            });
            showToast("โพสต์งานสำเร็จเรียบร้อยแล้ว!", "success");
        }

        formPostJob.reset();
        editingJobId = null;
        modalPostJob?.classList.add('hidden');
    } catch (error) {
        showToast("เกิดข้อผิดพลาด: " + error.message, "error");
    }
});

// Submit Proposal
formApplyJob?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return showToast("กรุณาเข้าสู่ระบบก่อนส่งใบเสนอราคา", "warning");
    if (!currentSelectedJob) return showToast("ไม่พบข้อมูลงานที่ต้องการสมัคร", "error");
    if (currentSelectedJob.userId === currentUser.uid) return showToast("คุณไม่สามารถยื่นเสนอราคาให้กับงานของตนเองได้", "warning");

    const price = Number(document.getElementById('proposalPrice')?.value) || 0;
    const days = Number(document.getElementById('proposalDays')?.value) || 0;
    const coverLetter = document.getElementById('proposalCoverLetter')?.value.trim();

    try {
        const checkQuery = query(collection(db, "proposals"), where("jobId", "==", currentSelectedJob.id), where("applicantId", "==", currentUser.uid));
        const existingProposals = await getDocs(checkQuery);

        if (!existingProposals.empty) {
            showToast("คุณได้ยื่นใบเสนอราคาสำหรับงานนี้ไปแล้ว ไม่สามารถยื่นซ้ำได้ครับ", "info");
            modalApplyJob?.classList.add('hidden');
            return;
        }

        let applicantName = currentUser.displayName || currentUser.email.split('@')[0];
        try {
            const appUserDoc = await getDoc(doc(db, "users", currentUser.uid));
            if (appUserDoc.exists()) {
                const uData = appUserDoc.data();
                applicantName = uData.name || uData.displayName || applicantName;
            }
        } catch(e) {}

        await addDoc(collection(db, "proposals"), {
            jobId: currentSelectedJob.id,
            jobTitle: currentSelectedJob.title,
            jobOwnerId: currentSelectedJob.userId || null,
            applicantId: currentUser.uid,
            applicantName,
            applicantEmail: currentUser.email,
            proposedPrice: price,
            deliveryDays: days,
            coverLetter,
            status: "pending",
            createdAt: serverTimestamp()
        });

        if (currentSelectedJob.userId) {
            await sendMessage({
                senderId: currentUser.uid,
                senderName: applicantName,
                receiverId: currentSelectedJob.userId,
                jobId: currentSelectedJob.id,
                jobTitle: currentSelectedJob.title,
                text: `📩 [ใบเสนอราคาใหม่]\nงาน: "${currentSelectedJob.title}"\nเสนอราคา: ฿${price.toLocaleString()} (${days} วัน)\nข้อความ: ${coverLetter}`
            });
        }

        formApplyJob.reset();
        modalApplyJob?.classList.add('hidden');
        showToast("ส่งใบเสนอราคาเรียบร้อยแล้ว!", "success");
    } catch (error) {
        showToast("เกิดข้อผิดพลาดในการส่งใบเสนอราคา: " + error.message, "error");
    }
});

// Accept Proposal
window.acceptProposal = async function(proposalId, applicantId, jobTitle, proposedPrice) {
    const isConfirmed = await showConfirm({
        title: "ยืนยันการตอบรับข้อเสนอ",
        message: `คุณต้องการตกลงว่าจ้างผู้เสนอราคารายนี้ ในราคา ฿${Number(proposedPrice).toLocaleString()} ใช่หรือไม่?`,
        confirmText: "ตกลงว่าจ้าง",
        type: "warning"
    });

    if (!isConfirmed) return;

    try {
        const selectedJobId = currentSelectedJob?.id;
        const batch = writeBatch(db);

        batch.update(doc(db, "proposals", proposalId), { status: "accepted", updatedAt: serverTimestamp() });

        if (selectedJobId) {
            const otherProposalsQuery = query(collection(db, "proposals"), where("jobId", "==", selectedJobId));
            const otherSnap = await getDocs(otherProposalsQuery);
            
            otherSnap.forEach((dDoc) => {
                if (dDoc.id !== proposalId) {
                    batch.update(doc(db, "proposals", dDoc.id), { status: "rejected", updatedAt: serverTimestamp() });
                }
            });

            batch.update(doc(db, "jobs", selectedJobId), { status: "closed", hiredApplicantId: applicantId, updatedAt: serverTimestamp() });
        }

        await batch.commit();

        let senderName = currentUser.displayName || "ผู้ว่าจ้าง";
        try {
            const senderSnap = await getDoc(doc(db, "users", currentUser.uid));
            if (senderSnap.exists()) {
                senderName = senderSnap.data().name || senderSnap.data().displayName || senderName;
            }
        } catch(e) {}

        await sendMessage({
            senderId: currentUser.uid,
            senderName,
            receiverId: applicantId,
            jobId: selectedJobId || "",
            jobTitle: jobTitle,
            text: `🎉 [ตอบรับข้อเสนอแล้ว]\nงาน: "${jobTitle}"\nผู้ว่าจ้างได้ตกลงรับข้อเสนอราคา ฿${Number(proposedPrice).toLocaleString()} เรียบร้อยแล้วครับ!`
        });

        showToast("ตกลงว่าจ้างเรียบร้อยแล้ว!", "success");
        clearJobView();
    } catch (error) {
        showToast("เกิดข้อผิดพลาดในการตอบรับข้อเสนอ: " + error.message, "error");
    }
};

// Reject Proposal
window.rejectProposal = async function(proposalId, applicantId, jobTitle) {
    const isConfirmed = await showConfirm({
        title: "ยืนยันการปฏิเสธข้อเสนอ",
        message: "คุณต้องการปฏิเสธข้อเสนอราคานี้ใช่หรือไม่?",
        confirmText: "ปฏิเสธข้อเสนอ",
        type: "danger"
    });

    if (!isConfirmed) return;

    try {
        await updateDoc(doc(db, "proposals", proposalId), { 
            status: "rejected", 
            updatedAt: serverTimestamp() 
        });

        let senderName = currentUser.displayName || "ผู้ว่าจ้าง";
        try {
            const senderSnap = await getDoc(doc(db, "users", currentUser.uid));
            if (senderSnap.exists()) {
                senderName = senderSnap.data().name || senderSnap.data().displayName || senderName;
            }
        } catch(e) {}

        await sendMessage({
            senderId: currentUser.uid,
            senderName,
            receiverId: applicantId,
            jobId: currentSelectedJob?.id || "",
            jobTitle: jobTitle,
            text: `❌ [ข้อเสนอถูกปฏิเสธ]\nงาน: "${jobTitle}"\nผู้ว่าจ้างได้ปฏิเสธข้อเสนอราคาของคุณเรียบร้อยแล้ว`
        });

        showToast("ปฏิเสธข้อเสนอราคาเรียบร้อยแล้ว!", "info");
    } catch (error) {
        showToast("เกิดข้อผิดพลาดในการปฏิเสธข้อเสนอ: " + error.message, "error");
    }
};

function clearJobView() {
    currentSelectedJob = null;
    activeJobView?.classList.add('hidden');
    defaultPrompt?.classList.remove('hidden');
    if (proposalsContainer) proposalsContainer.innerHTML = '';
    if (proposalsUnsubscribe) proposalsUnsubscribe();
}

// Listen My Proposals
function listenToMyProposals(userId) {
    if (!myProposalsList) return;

    const q = query(collection(db, "proposals"), where("applicantId", "==", userId));

    myProposalsUnsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            myProposalsList.innerHTML = `<p class="text-xs text-slate-400 font-medium">คุณยังไม่ได้ยื่นเสนอราคาในงานใดๆ</p>`;
            return;
        }

        let html = "";
        snapshot.forEach((docSnap) => {
            const item = { id: docSnap.id, ...docSnap.data() };
            let statusBadge = item.status === 'accepted' ? `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-700 font-bold text-xs rounded-full">🎉 อนุมัติแล้ว</span>` : (item.status === 'rejected' ? `<span class="px-2.5 py-1 bg-rose-100 text-rose-700 font-bold text-xs rounded-full">✕ ไม่ได้รับคัดเลือก</span>` : `<span class="px-2.5 py-1 bg-amber-100 text-amber-700 font-bold text-xs rounded-full">⏳ รอพิจารณา</span>`);

            html += `
                <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl mb-2 flex justify-between items-center">
                    <div>
                        <h4 class="font-extrabold text-xs text-slate-900">${escapeHtml(item.jobTitle)}</h4>
                        <p class="text-[11px] text-slate-500 mt-0.5 font-medium">ราคาเสนอ: <span class="text-orange-500 font-bold">฿${Number(item.proposedPrice || 0).toLocaleString()}</span> (${item.deliveryDays} วัน)</p>
                    </div>
                    <div class="flex items-center gap-2">
                        ${statusBadge}
                        <button onclick="deleteMyProposal('${item.id}')" title="ลบออก" class="p-1.5 text-slate-300 hover:text-rose-500 transition-colors cursor-pointer">
                            <i class="fa-solid fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        myProposalsList.innerHTML = html;
    });
}

window.deleteMyProposal = async function(proposalId) {
    const isConfirmed = await showConfirm({
        title: "ยืนยันการลบข้อเสนอ",
        message: "คุณต้องการลบข้อเสนอนี้ออกจากรายการใช่หรือไม่?",
        confirmText: "ลบรายการ",
        type: "danger"
    });

    if (!isConfirmed) return;

    try {
        await deleteDoc(doc(db, "proposals", proposalId));
        showToast("ลบข้อเสนอเรียบร้อยแล้ว", "success");
    } catch (error) {
        showToast("เกิดข้อผิดพลาดในการลบข้อเสนอ: " + error.message, "error");
    }
};

// Listen Jobs & Render System ( Realtime ดึงข้อมูลงานเมื่อล็อกอินแล้ว )
function listenToJobs() {
    if (!jobsListContainer) return;

    const q = query(collection(db, "jobs"));
    jobsUnsubscribe = onSnapshot(q, (snapshot) => {
        jobsData = [];
        snapshot.forEach((docSnap) => {
            const job = { id: docSnap.id, ...docSnap.data() };
            if (job.status !== "closed") jobsData.push(job);
        });
        renderJobs();
    });
}

function renderJobs() {
    if (!jobsListContainer) return;

    // หากผู้ใช้ไม่ได้ล็อกอิน ให้ไม่แสดงรายการงาน
    if (!currentUser) {
        if (jobCountText) jobCountText.textContent = `0 jobs`;
        jobsListContainer.innerHTML = `
            <div class="p-8 text-center bg-amber-50/50 border border-amber-200/60 rounded-2xl">
                <i class="fa-solid fa-lock text-amber-500 text-2xl mb-2"></i>
                <p class="text-xs font-bold text-amber-900">กรุณาเข้าสู่ระบบเพื่อดูรายการงานทั้งหมด</p>
            </div>
        `;
        return;
    }

    let filteredJobs = jobsData;
    if (currentFilter === 'saved') {
        filteredJobs = jobsData.filter(j => savedJobIds.includes(String(j.id)));
    } else if (currentFilter !== 'all') {
        filteredJobs = jobsData.filter(j => j.jobType === currentFilter);
    }

    if (jobCountText) jobCountText.textContent = `${filteredJobs.length} jobs`;

    if (filteredJobs.length === 0) {
        jobsListContainer.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs font-semibold">ยังไม่มีประกาศงานในขณะนี้</div>`;
        return;
    }

    let htmlContent = "";
    filteredJobs.forEach((job) => {
        const isSelected = currentSelectedJob && currentSelectedJob.id === job.id;
        
        const activeCardStyle = isSelected 
            ? "border-l-4 border-l-orange-500 bg-orange-50/50 shadow-md ring-1 ring-orange-500/20" 
            : "border-l-4 border-l-transparent hover:border-slate-300 hover:bg-slate-50/80 shadow-xs";

        const activeTitleStyle = isSelected ? "text-orange-600" : "text-slate-900 group-hover:text-orange-500";
        const isOwner = currentUser && currentUser.uid === job.userId;

        htmlContent += `
            <article class="bg-white rounded-2xl p-4 transition-all duration-200 border border-slate-200 ${activeCardStyle} cursor-pointer job-item relative group" data-id="${job.id}">
                
                <div class="flex items-start justify-between gap-3">
                    <div class="flex items-start gap-3 flex-1 min-w-0">
                        <div class="w-8 h-8 rounded-lg ${isSelected ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-500'} flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                            <i class="fa-regular fa-clipboard text-sm"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <h3 class="font-extrabold text-sm ${activeTitleStyle} transition-colors leading-snug truncate">
                                ${escapeHtml(job.title)}
                            </h3>
                            <p class="text-xs font-semibold text-slate-400 mt-1">
                                ${escapeHtml(job.location || 'Remote')}
                            </p>
                        </div>
                    </div>
                    
                    <div class="relative">
                        <button type="button" onclick="toggleActionMenu(event, '${job.id}')" class="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0" title="ตัวเลือก">
                            <i class="fa-solid fa-ellipsis text-slate-400 text-sm"></i>
                        </button>

                        <div id="action-menu-${job.id}" class="job-action-menu hidden absolute right-0 mt-1 w-36 bg-white rounded-2xl shadow-xl border border-slate-100 z-30 py-1 overflow-hidden">
                            ${isOwner ? `
                                <button onclick="event.stopPropagation(); openEditJobModal('${job.id}');" class="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-orange-50 hover:text-orange-600 flex items-center gap-2">
                                    <i class="fa-solid fa-pen-to-square text-slate-400 text-[11px]"></i> แก้ไขประกาศ
                                </button>
                                <button onclick="event.stopPropagation(); deleteJob('${job.id}');" class="w-full px-3.5 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                                    <i class="fa-regular fa-trash-can text-rose-500 text-[11px]"></i> ลบงาน
                                </button>
                            ` : `
                                <div class="px-3 py-2 text-[11px] text-slate-400 font-medium text-center">ไม่มีสิทธิ์จัดการ</div>
                            `}
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-2.5 pt-3.5 mt-2 border-t border-slate-100/80">
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-fuchsia-50 text-fuchsia-600 rounded-xl text-[11px] font-bold border border-fuchsia-100/80">
                        <i class="fa-solid fa-list-check text-[10px]"></i>
                        ${escapeHtml(job.jobType || 'Freelance')}
                    </span>
                    <span class="text-xs font-extrabold text-orange-500 tracking-tight">
                        ฿${Number(job.budget || 0).toLocaleString()}
                    </span>
                </div>

            </article>
        `;
    });

    jobsListContainer.innerHTML = htmlContent;
    document.querySelectorAll('.job-item').forEach(item => {
        item.addEventListener('click', () => showJobDetail(item.getAttribute('data-id')));
    });
}

function setFilter(type, activeBtn) {
    currentFilter = type;

    [btnFilterAll, btnFilterFreelance, btnFilterFulltime, btnFilterSaved].forEach(btn => {
        if (btn) btn.className = "px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap";
    });

    if (activeBtn) activeBtn.className = "px-4 py-1.5 bg-slate-900 text-white rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap";

    renderJobs();
}

btnFilterAll?.addEventListener('click', (e) => setFilter('all', e.currentTarget));
btnFilterFreelance?.addEventListener('click', (e) => setFilter('Freelance', e.currentTarget));
btnFilterFulltime?.addEventListener('click', (e) => setFilter('Full-Time', e.currentTarget));
btnFilterSaved?.addEventListener('click', (e) => setFilter('saved', e.currentTarget));

// -------------------------------------------------------------
// ⭐ Save Job Functions
// -------------------------------------------------------------
window.toggleSaveJob = function(jobId) {
    const index = savedJobIds.indexOf(String(jobId));
    if (index > -1) {
        savedJobIds.splice(index, 1);
        showToast("ยกเลิกการบันทึกงานเรียบร้อยแล้ว", "info");
    } else {
        savedJobIds.push(String(jobId));
        showToast("บันทึกงานเรียบร้อยแล้ว!", "success");
    }
    localStorage.setItem('savedJobIds', JSON.stringify(savedJobIds));
    
    updateSaveJobButtonUI(jobId);

    if (currentFilter === 'saved') {
        renderJobs();
    }
};

function updateSaveJobButtonUI(jobId) {
    const btnDetailSaveJob = document.querySelector('#active-job-view button:has(.fa-star)');
    if (!btnDetailSaveJob) return;

    const isSaved = savedJobIds.includes(String(jobId));
    const icon = btnDetailSaveJob.querySelector('i');
    const textSpan = btnDetailSaveJob.querySelector('span');

    if (isSaved) {
        btnDetailSaveJob.className = 'bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-600 text-xs font-bold px-4 py-2.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer';
        if (icon) icon.className = 'fa-solid fa-star text-amber-500';
        if (textSpan) textSpan.textContent = 'Saved';
    } else {
        btnDetailSaveJob.className = 'border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer';
        if (icon) icon.className = 'fa-regular fa-star text-slate-400';
        if (textSpan) textSpan.textContent = 'Save Job';
    }
}

window.showJobDetail = async function(jobId) {
    const job = jobsData.find(j => j.id === jobId);
    if (!job) return;

    currentSelectedJob = job;
    renderJobs();

    defaultPrompt?.classList.add('hidden');
    activeJobView?.classList.remove('hidden');

    if (viewJobTitle) viewJobTitle.textContent = job.title;
    if (viewJobBudget) viewJobBudget.textContent = `฿${Number(job.budget || 0).toLocaleString()}`;
    if (viewJobLocation) viewJobLocation.textContent = job.location || 'Remote';
    if (viewJobBadge) viewJobBadge.textContent = job.jobType || 'Freelance';

    if (sidebarJobType) sidebarJobType.textContent = job.jobType || 'Freelance';
    if (sidebarJobLocation) sidebarJobLocation.textContent = job.location || 'Remote';

    if (sidebarCreativeFields) {
        sidebarCreativeFields.innerHTML = `<span class="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold">${escapeHtml(job.category || 'Graphic Design')}</span>`;
    }

    if (viewJobDate) {
        const postedDate = job.createdAt ? new Date(job.createdAt.toMillis()).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : 'ไม่นานมานี้';
        viewJobDate.textContent = postedDate;
    }

    let employerName = job.companyName || 'ไม่ระบุชื่อผู้ว่าจ้าง';
    let rawAvatar = '';

    if (job.userId) {
        try {
            const userDocSnap = await getDoc(doc(db, "users", job.userId));
            if (userDocSnap.exists()) {
                const uData = userDocSnap.data();

                employerName = uData.name || uData.displayName || uData.username || uData.fullName || employerName;

                rawAvatar = uData.photoURL || 
                            uData.avatar || 
                            uData.avatarUrl || 
                            uData.profileImage || 
                            uData.profileImg || 
                            uData.picture || 
                            uData.imageUrl || 
                            uData.userImg || 
                            '';
            }
        } catch (err) {
            console.error("Error fetching employer profile details:", err);
        }
    }

    const fallbackAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(employerName)}`;
    const finalAvatarSrc = rawAvatar ? convertDriveUrl(rawAvatar) : fallbackAvatar;

    if (viewJobCompany) viewJobCompany.textContent = employerName;
    if (sidebarHiringName) sidebarHiringName.textContent = employerName;

    applyImageSrc(viewHiringAvatar, finalAvatarSrc, fallbackAvatar);
    applyImageSrc(sidebarHiringAvatar, finalAvatarSrc, fallbackAvatar);

    if (viewJobDesc) {
        let imageHtml = '';
        if (job.imageUrl) {
            imageHtml = `
                <div class="my-4 rounded-2xl overflow-hidden border border-slate-200 shadow-xs max-h-96 bg-slate-50 flex items-center justify-center">
                    <img src="${escapeHtml(job.imageUrl)}" alt="Job Attachment" class="w-full h-full object-cover" onerror="this.parentElement.style.display='none'">
                </div>
            `;
        }
        viewJobDesc.innerHTML = `${imageHtml}<p class="whitespace-pre-line text-slate-600 font-normal mb-4">${escapeHtml(job.description || 'ไม่มีรายละเอียดเพิ่มเติม')}</p>`;
    }

    const btnDetailSaveJob = document.querySelector('#active-job-view button:has(.fa-star)');
    if (btnDetailSaveJob) btnDetailSaveJob.onclick = () => toggleSaveJob(job.id);
    updateSaveJobButtonUI(job.id);

    listenToJobProposals(job.id);
};

function listenToJobProposals(jobId) {
    if (!proposalsContainer) return;
    if (proposalsUnsubscribe) proposalsUnsubscribe();

    const q = query(collection(db, "proposals"), where("jobId", "==", jobId));

    proposalsUnsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            proposalsContainer.innerHTML = `<p class="text-xs text-slate-400 font-medium">ยังไม่มีผู้เสนอราคาในงานนี้</p>`;
            return;
        }

        let html = `<h4 class="font-bold text-xs text-slate-700 mb-2">รายการข้อเสนอราคา (${snapshot.size}):</h4>`;
        
        snapshot.forEach((docSnap) => {
            const p = { id: docSnap.id, ...docSnap.data() };
            const isOwner = currentUser && currentSelectedJob && currentSelectedJob.userId === currentUser.uid;

            let statusBadge = `<span class="px-2 py-0.5 bg-amber-100 text-amber-700 font-bold text-[10px] rounded-md">รอพิจารณา</span>`;
            if (p.status === 'accepted') {
                statusBadge = `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold text-[10px] rounded-md">✓ ตกลงจ้างแล้ว</span>`;
            } else if (p.status === 'rejected') {
                statusBadge = `<span class="px-2 py-0.5 bg-rose-100 text-rose-700 font-bold text-[10px] rounded-md">✕ ปฏิเสธแล้ว</span>`;
            }

            html += `
                <div class="p-3 bg-white border border-slate-200 rounded-xl mb-2 space-y-2 ${p.status === 'rejected' ? 'opacity-60' : ''}">
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-xs text-slate-900">${escapeHtml(p.applicantName)}</span>
                        <span class="text-xs font-black text-emerald-600">฿${Number(p.proposedPrice || 0).toLocaleString()} (${p.deliveryDays} วัน)</span>
                    </div>
                    <p class="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">${escapeHtml(p.coverLetter || '-')}</p>
                    
                    <div class="flex justify-between items-center pt-1">
                        <div>${statusBadge}</div>
                        
                        ${(isOwner && p.status === 'pending' && currentSelectedJob?.status !== 'closed') ? `
                            <div class="flex items-center gap-1.5">
                                <button data-proposal-id="${p.id}" data-applicant-id="${p.applicantId}" data-job-title="${escapeHtml(p.jobTitle)}"
                                    class="btn-reject-proposal px-3 py-1 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 font-bold text-xs rounded-lg transition-all cursor-pointer">
                                    ปฏิเสธ
                                </button>
                                <button data-proposal-id="${p.id}" data-applicant-id="${p.applicantId}" data-job-title="${escapeHtml(p.jobTitle)}" data-proposed-price="${p.proposedPrice}"
                                    class="btn-accept-proposal px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer">
                                    ตกลงจ้าง
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        proposalsContainer.innerHTML = html;

        document.querySelectorAll('.btn-accept-proposal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                acceptProposal(
                    target.getAttribute('data-proposal-id'),
                    target.getAttribute('data-applicant-id'),
                    target.getAttribute('data-job-title'),
                    Number(target.getAttribute('data-proposed-price'))
                );
            });
        });

        document.querySelectorAll('.btn-reject-proposal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                rejectProposal(
                    target.getAttribute('data-proposal-id'),
                    target.getAttribute('data-applicant-id'),
                    target.getAttribute('data-job-title')
                );
            });
        });
    });
}

btnPostJob?.addEventListener('click', () => {
    if (!currentUser) return showToast("กรุณาเข้าสู่ระบบก่อนโพสต์งาน", "warning");
    editingJobId = null; 
    formPostJob?.reset();
    const modalHeaderTitle = document.querySelector('#modalPostJob h3');
    if (modalHeaderTitle) modalHeaderTitle.textContent = 'Post a Job';
    modalPostJob?.classList.remove('hidden');
});

btnCloseModal?.addEventListener('click', () => {
    editingJobId = null;
    modalPostJob?.classList.add('hidden');
});

btnApplyJob?.addEventListener('click', () => {
    if (!currentUser) return showToast("กรุณาเข้าสู่ระบบก่อนยื่นเสนอราคา", "warning");
    if (currentSelectedJob?.status === 'closed') return showToast("งานนี้ปิดรับสมัครเรียบร้อยแล้ว", "warning");
    
    if (applyModalJobTitle && currentSelectedJob) {
        applyModalJobTitle.textContent = `งาน: ${currentSelectedJob.title}`;
    }
    modalApplyJob?.classList.remove('hidden');
});

btnCloseApplyModal?.addEventListener('click', () => modalApplyJob?.classList.add('hidden'));

function escapeHtml(text) {
    return String(text || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
}