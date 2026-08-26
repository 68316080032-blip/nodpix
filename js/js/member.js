// member.js
import { db } from "./firebase-config.js";
import { collection, query, where, onSnapshot, addDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { convertDriveUrl } from "./utils.js";

export function initMemberDashboard(currentUid, currentName) {
    const formSubmit = document.getElementById("form-submit-portfolio");
    const container = document.getElementById("my-portfolio-list");

    if (!container) return;

    // ================= 📂 1. REALTIME MY PORTFOLIO STREAM =================
    // ดึงข้อมูลผลงาน คัดกรองเอาเฉพาะอันที่ ownerUid ตรงกับคนที่กำลังล็อกอินอยู่เท่านั้น
    const q = query(collection(db, "portfolios"), where("ownerUid", "==", currentUid));
    
    onSnapshot(q, (snapshot) => {
        container.innerHTML = "";
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="sm:col-span-2 p-12 text-center bg-white/[0.01] rounded-3xl border border-white/5 border-dashed">
                    <p class="text-xs text-slate-500 font-bold uppercase tracking-widest">🎨 You haven't uploaded any works yet.</p>
                </div>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            const img = convertDriveUrl(data.imgLink || data.coverUrl || data.imageUrl || "");
            const status = (data.status || "pending").toLowerCase();

            // ออกแบบป้ายสถานะ (Badge Status)
            let statusBadge = "";
            if (status === "approved") {
                statusBadge = `<span class="px-2 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-[8px] font-black tracking-widest uppercase">Approved</span>`;
            } else if (status === "rejected") {
                statusBadge = `<span class="px-2 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-[8px] font-black tracking-widest uppercase">Rejected</span>`;
            } else {
                statusBadge = `<span class="px-2 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-[8px] font-black tracking-widest uppercase animate-pulse">Pending</span>`;
            }

            const card = document.createElement("div");
            card.className = "glass-card overflow-hidden flex flex-col border-white/5 group hover:border-orange-500/20 transition-all duration-300";
            
            card.innerHTML = `
                <div class="aspect-video w-full bg-black relative overflow-hidden">
                    <img src="${img}" referrerpolicy="no-referrer" class="w-full h-full object-cover group-hover:scale-105 transition-all duration-500 opacity-90">
                    <div class="absolute top-3 right-3">
                         ${statusBadge}
                    </div>
                </div>
                <div class="p-5 flex-grow flex flex-col justify-between text-left">
                    <div>
                        <p class="text-[9px] font-bold text-orange-500 uppercase tracking-widest mb-1.5">${data.category || "General"}</p>
                        <h4 class="font-bold text-white text-sm truncate">${data.title || "Untitled Work"}</h4>
                        <p class="text-[11px] text-slate-500 line-clamp-2 mt-1.5 leading-relaxed">${data.description || "No description."}</p>
                    </div>
                    
                    <div class="mt-4 pt-3 border-t border-white/5 flex items-center justify-end">
                        <button class="btn-delete-my-port text-[9px] font-bold px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                            🗑️ REMOVE
                        </button>
                    </div>
                </div>
            `;

            // ระบบให้เจ้าของผลงานสามารถกดยกเลิกหรือลบผลงานของตัวเองทิ้งได้
            card.querySelector(".btn-delete-my-port").onclick = async () => {
                if (confirm(`Do you want to delete "${data.title}"?`)) {
                    try {
                        await deleteDoc(doc(db, "portfolios", id));
                        alert("Deleted successfully.");
                    } catch (e) { alert("Error: " + e.message); }
                }
            };

            container.appendChild(card);
        });
    });

    // ================= 📤 2. PORTFOLIO SUBMISSION ENGINE =================
    if (formSubmit) {
        formSubmit.onsubmit = async (e) => {
            e.preventDefault();

            const title = document.getElementById("port-title").value.trim();
            const category = document.getElementById("port-category").value;
            const imgLink = document.getElementById("port-img").value.trim();
            const description = document.getElementById("port-desc").value.trim();

            try {
                // บันทึกข้อมูลขึ้นคอลเลกชัน portfolios ด้วยสิทธิ์ Pending
                await addDoc(collection(db, "portfolios"), {
                    title: title,
                    category: category,
                    imgLink: imgLink,
                    description: description,
                    ownerUid: currentUid,
                    ownerName: currentName,
                    status: "pending", // ตั้งเป็นรอดำเนินการเสมอเพื่อความปลอดภัย
                    createdAt: new Date().getTime()
                });

                alert("🚀 ส่งผลงานเข้าคิวตรวจสอบสำเร็จแล้ว! รอแอดมินอนุมัตินะครับ");
                formSubmit.reset(); // ล้างข้อมูลในฟอร์มออกทั้งหมด
            } catch (error) {
                alert("❌ เกิดข้อผิดพลาดในการส่งผลงาน: " + error.message);
            }
        };
    }
}