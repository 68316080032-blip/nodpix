// portfolio-modal.js
import { db } from "./firebase-config.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { convertDriveUrl } from "./utils.js";

export async function openPortfolioDetailModal(item, currentUserId, showToast, startCommentsRealtimeStream, updateReplyIndicator, openCreatorContactModal) {
    updateReplyIndicator(null);

    const modal = document.getElementById("portfolio-modal");
    const modalImg = document.getElementById("modal-img");
    const modalVideo = document.getElementById("modal-video");
    let modalIframe = document.getElementById("modal-iframe");
    
    if (!modal) return item.id;

    // ล้างสถานะมีเดียเก่า
    if (modalImg) { modalImg.src = ""; modalImg.classList.add("hidden"); }
    if (modalVideo) { modalVideo.src = ""; modalVideo.classList.add("hidden"); }
    if (modalIframe) { modalIframe.src = ""; modalIframe.classList.add("hidden"); }

    const mediaLink = item.imgLink || item.image || item.coverUrl || item.imageUrl || "";
    const targetUid = item.ownerUid || item.ownerId || item.uid || item.userId;
    
    const isGoogleDrive = mediaLink.includes("drive.google.com");
    const isYouTube = mediaLink.includes("youtube.com") || mediaLink.includes("youtu.be");
    const isMp4 = mediaLink.toLowerCase().includes(".mp4");

    // 🎥 แก้บั๊ก VDO: ใช้ Iframe /Preview สำหรับ Google Drive เสมอเพื่อให้กดเล่นได้
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
            if (mediaLink.includes("v=")) {
                videoId = new URL(mediaLink).searchParams.get("v");
            } else if (mediaLink.includes("youtu.be/")) {
                videoId = mediaLink.split("youtu.be/")[1].split("?")[0];
            }
            modalIframe.src = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
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
                embedUrl = mediaLink.replace("/view", "/preview");
            } else if (mediaLink.includes("id=")) {
                const urlObj = new URL(mediaLink);
                const fileId = urlObj.searchParams.get("id");
                embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
            }
            modalIframe.src = embedUrl;
        }
    } 
    else if (isMp4) {
        if (modalVideo) {
            modalVideo.classList.remove("hidden");
            modalVideo.className = "w-full h-full object-contain bg-slate-950 border-0 block";
            modalVideo.src = mediaLink;
            modalVideo.setAttribute("controls", "true");
        }
    } 
    else {
        if (modalImg) {
            modalImg.classList.remove("hidden");
            modalImg.className = "w-full h-full object-contain bg-slate-950 block";
            modalImg.src = convertDriveUrl(mediaLink);
        }
    }

    // ข้อมูลเนื้อหา
    if (document.getElementById("modal-category")) document.getElementById("modal-category").innerText = item.category || "GENERAL";
    if (document.getElementById("modal-title")) document.getElementById("modal-title").innerText = item.title || "Untitled";
    if (document.getElementById("modal-desc")) document.getElementById("modal-desc").innerText = item.description || "No description provided.";
    
    // บล็อกข้อมูล Creator ด้านใน
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
            <div class="w-9 h-9 rounded-full overflow-hidden bg-slate-200 shrink-0 border border-white inner-avatar-box flex items-center justify-center text-xs font-bold text-slate-400 aspect-square">
                ${(item.ownerName || "C").charAt(0).toUpperCase()}
            </div>
            <div class="flex-grow min-w-0">
                <p class="text-[9px] text-orange-500 font-bold leading-none mb-1">💼 คลิกโปรไฟล์นี้เพื่อติดต่อดีลงาน</p>
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
                        internalProfileBlock.querySelector(".inner-avatar-box").innerHTML = `<img src="${convertDriveUrl(liveAvatar)}" class="w-full h-full object-cover rounded-full">`;
                    }
                }
            }).catch(e => console.error(e));

            internalProfileBlock.onclick = (e) => {
                e.stopPropagation();
                openCreatorContactModal(targetUid, item.ownerName);
            };
        }
    }

    // ❤️ ระบบควบคุมปุ่มถูกใจ (Like) - แก้ไขบัคไลค์คนอื่นหาย
    const countDisplay = document.getElementById("modal-like-count");
    const likeBtn = document.getElementById("modal-like-btn");
    
    // ดึงจำนวนไลค์ปัจจุบัน
    let currentLikesCount = 0;
    if (typeof item.likes === "number") {
        currentLikesCount = item.likes;
    } else if (item.likedBy && typeof item.likedBy === "object") {
        currentLikesCount = item.likedBy.likesCount || 0;
    }

    if (countDisplay) countDisplay.innerText = currentLikesCount;

    // ฟังก์ชันอัปเดตสไตล์ปุ่ม Like
    const updateLikeBtnStyle = (isLiked) => {
        if (!likeBtn) return;
        likeBtn.className = isLiked 
            ? "flex items-center space-x-1.5 bg-rose-500 hover:bg-rose-600 border border-rose-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition-transform active:scale-95 shadow-md shadow-rose-500/10"
            : "flex items-center space-x-1.5 bg-rose-50 hover:bg-rose-100/70 border border-rose-100 text-rose-500 font-bold text-xs px-3 py-1.5 rounded-xl transition-transform active:scale-95 shadow-2xs";
    };

    // เช็คสถานะ Like เริ่มต้น
    const initialLikedMap = (item.likedBy && typeof item.likedBy === "object") ? item.likedBy : {};
    const hasLiked = initialLikedMap[currentUserId] === true;
    updateLikeBtnStyle(hasLiked);

    if (likeBtn) {
        likeBtn.onclick = async (e) => {
            e.preventDefault(); e.stopPropagation();
            if (!currentUserId) {
                const authModal = document.getElementById("auth-guard-modal");
                if (authModal) authModal.classList.remove("hidden");
                return;
            }

            // ล็อคปุ่มป้องกันการคลิกรัว
            likeBtn.style.pointerEvents = "none";
            const postRef = doc(db, "portfolios", item.id);

            try {
                // 📡 1. ดึงข้อมูลล่าสุดจาก Firestore เพื่อความถูกต้องของ Object likedBy
                const freshSnap = await getDoc(postRef);
                if (!freshSnap.exists()) return;
                
                const freshData = freshSnap.data();
                let currentLikesMap = (freshData.likedBy && typeof freshData.likedBy === "object") ? freshData.likedBy : {};
                const isAlreadyLiked = currentLikesMap[currentUserId] === true;
                
                let nextLikesCount = typeof freshData.likes === "number" ? freshData.likes : 0;

                // ⚡ 2. ปรับค่าตัวเลขและแจ้งเตือน Toast
                if (isAlreadyLiked) {
                    currentLikesMap[currentUserId] = false;
                    nextLikesCount = Math.max(0, nextLikesCount - 1);
                    if (typeof showToast === 'function') showToast("ถอนการถูกใจชิ้นงานแล้ว");
                } else {
                    currentLikesMap[currentUserId] = true;
                    nextLikesCount += 1;
                    if (typeof showToast === 'function') showToast("บันทึกการถูกใจผลงานเรียบร้อย!");
                }

                // ⚡ 3. อัปเดต UI ทันที
                if (countDisplay) countDisplay.innerText = nextLikesCount;
                updateLikeBtnStyle(!isAlreadyLiked);

                // 💾 4. บันทึกลง Firestore โดยใช้ Dot Notation เพื่ออัปเดตเฉพาะ UID ตัวเอง (ไม่กระทบผู้อื่น)
                await updateDoc(postRef, { 
                    likes: nextLikesCount, 
                    [`likedBy.${currentUserId}`]: !isAlreadyLiked 
                });

                // อัปเดต Memory ในหน้านั้นๆ
                item.likes = nextLikesCount;
                if (!item.likedBy || typeof item.likedBy !== "object") item.likedBy = {};
                item.likedBy[currentUserId] = !isAlreadyLiked;

            } catch (err) {
                console.error("Like Error:", err);
                if (typeof showToast === 'function') showToast("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
            } finally {
                likeBtn.style.pointerEvents = "auto";
            }
        };
    }

    startCommentsRealtimeStream(item.id);
    modal.classList.remove("hidden");
    return item.id;
}

export function closeModalFunc(commentUnsubscribe, updateReplyIndicator) {
    const portfolioModal = document.getElementById("portfolio-modal");
    if (!portfolioModal) return;

    portfolioModal.classList.add("hidden");
    const modalImg = document.getElementById("modal-img");
    const modalVideo = document.getElementById("modal-video");
    const modalIframe = document.getElementById("modal-iframe");
    
    if (modalImg) modalImg.src = "";
    if (modalVideo) modalVideo.src = "";
    if (modalIframe) modalIframe.src = "";

    if (commentUnsubscribe) commentUnsubscribe();
    updateReplyIndicator(null);
}