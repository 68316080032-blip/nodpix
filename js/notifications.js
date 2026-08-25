import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Init Header & Messenger Events
export function initHeaderAndMessenger() {
    const btnToggleDropdown = document.getElementById('btn-toggle-dropdown');
    const userDropdownMenu = document.getElementById('user-dropdown-menu');
    const authGuest = document.getElementById('auth-guest');
    const authUser = document.getElementById('auth-user');
    const btnToggleMessages = document.getElementById('btn-toggle-messages');
    const messengerModal = document.getElementById('messenger-modal');
    const closeMessengerModal = document.getElementById('close-messenger-modal');
    const messengerListContainer = document.getElementById('messenger-list-container');
    const messengerBadge = document.getElementById('messenger-badge');

    // Toggle Messenger Modal
    btnToggleMessages?.addEventListener('click', (e) => {
        e.stopPropagation();
        messengerModal?.classList.toggle('hidden');
    });

    closeMessengerModal?.addEventListener('click', () => {
        messengerModal?.classList.add('hidden');
    });

    // Toggle User Dropdown Menu
    btnToggleDropdown?.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdownMenu?.classList.toggle('hidden');
    });

    // Close Modals when clicking outside
    document.addEventListener('click', (e) => {
        if (messengerModal && !messengerModal.contains(e.target) && !btnToggleMessages?.contains(e.target)) {
            messengerModal.classList.add('hidden');
        }
        if (userDropdownMenu && !userDropdownMenu.contains(e.target) && !btnToggleDropdown?.contains(e.target)) {
            userDropdownMenu.classList.add('hidden');
        }
    });

    // Logout Action
    document.getElementById('dropdown-logout')?.addEventListener('click', async () => {
        await signOut(auth);
        window.location.reload();
    });

    // Listen to Real-time Notifications
    function listenToNotifications(userId) {
        if (!messengerListContainer) return;

        const q = query(
            collection(db, "notifications"),
            where("receiverId", "==", userId)
        );

        onSnapshot(q, (snapshot) => {
            const totalMsg = snapshot.size;

            if (messengerBadge) {
                if (totalMsg > 0) {
                    messengerBadge.textContent = totalMsg;
                    messengerBadge.classList.remove('hidden');
                } else {
                    messengerBadge.classList.add('hidden');
                }
            }

            messengerListContainer.innerHTML = '';
            if (snapshot.empty) {
                messengerListContainer.innerHTML = `<p class="text-center text-xs text-slate-400 py-6">ไม่มีข้อความแจ้งเตือนใหม่</p>`;
                return;
            }

            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const docId = docSnap.id;
                const dateStr = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString('th-TH') : '';

                const card = document.createElement('div');
                card.className = "bg-[#f4f7fa] p-4 rounded-2xl relative space-y-2 border border-slate-100/50";
                card.innerHTML = `
                    <div class="flex items-start justify-between">
                        <h4 class="font-black text-orange-500 text-sm">${data.senderName || 'ผู้ใช้'}</h4>
                        <div class="flex items-center space-x-2">
                            <span class="text-[10px] text-slate-400 font-medium">${dateStr}</span>
                            <button data-id="${docId}" class="btn-delete-notif text-slate-300 hover:text-rose-500 transition-all p-0.5 cursor-pointer">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </div>
                    <p class="text-xs text-slate-600 font-medium leading-relaxed">
                        <span class="mr-1">📥</span> <strong>[${data.type || 'ใบเสนอราคาใหม่'}]</strong><br>
                        ${data.jobTitle ? `งาน: "${data.jobTitle}"<br>` : ''}
                        ${data.price ? `เสนอราคา: ฿${data.price} (${data.days || '-'} วัน)<br>` : ''}
                        ${data.message ? `ข้อความ: ${data.message}` : ''}
                    </p>
                    <div class="pt-2 flex justify-end">
                        <a href="${data.link || 'jobs.html'}" class="bg-orange-500 hover:bg-orange-600 text-white font-bold text-[11px] px-4 py-1.5 rounded-full transition-all inline-flex items-center gap-1 shadow-xs shadow-orange-500/20">
                            ไปที่หน้างานเพื่อตกลงจ้าง →
                        </a>
                    </div>
                `;

                messengerListContainer.appendChild(card);
            });

            // Bind Delete Event
            document.querySelectorAll('.btn-delete-notif').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const notifId = e.currentTarget.getAttribute('data-id');
                    if (notifId) {
                        await deleteDoc(doc(db, "notifications", notifId));
                    }
                });
            });
        });
    }

    // Auth State Listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            authGuest?.classList.add('hidden');
            authUser?.classList.remove('hidden');

            listenToNotifications(user.uid);

            const myProfileBtn = document.getElementById('nav-my-profile-link');
            if (myProfileBtn) myProfileBtn.href = `profile.html?id=${user.uid}`;

            try {
                const userDoc = await getDoc(doc(doc(db, "users", user.uid)));
                const userNameEl = document.getElementById('dropdown-user-name');
                const userEmailEl = document.getElementById('dropdown-user-email');
                const headerAvatar = document.getElementById('header-avatar');
                const dropdownAvatar = document.getElementById('dropdown-avatar');

                if (userDoc.exists()) {
                    const data = userDoc.data();
                    if (userNameEl) userNameEl.textContent = data.displayName || user.email;
                    if (userEmailEl) userEmailEl.textContent = user.email;
                    
                    const avatarSrc = data.avatarBase64 || data.photoURL || data.avatarUrl;
                    if (avatarSrc) {
                        if (headerAvatar) headerAvatar.src = avatarSrc;
                        if (dropdownAvatar) dropdownAvatar.src = avatarSrc;
                    }
                } else {
                    if (userNameEl) userNameEl.textContent = user.email;
                    if (userEmailEl) userEmailEl.textContent = user.email;
                }
            } catch (err) {
                console.error("Error fetching user data:", err);
            }
        } else {
            authGuest?.classList.remove('hidden');
            authUser?.classList.add('hidden');
        }
    });
}

// Auto Init on script load
initHeaderAndMessenger();