// utils.js

// แปลงลิงก์รูปภาพ หรือดึง Thumbnail จาก Google Drive ให้แสดงผล 100%
export function convertDriveUrl(url) {
    if (!url) return "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop";
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes("drive.google.com")) {
        let fileId = "";
        if (lowerUrl.includes("/file/d/")) {
            fileId = url.split("/file/d/")[1].split("/")[0];
        } else if (lowerUrl.includes("id=")) {
            fileId = url.split("id=")[1].split("&")[0];
        }
        if (fileId) {
            // 🛠️ แก้ไข: เปลี่ยนมาใช้ endpoint thumbnail และปรับขนาดให้ภาพชัดเจนขึ้น (sz=w1000) ป้องกันการโดนบล็อก
            return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
        }
    }
    return url;
}

// แปลงลิงก์วิดีโอ Google Drive ให้กลายเป็นหน้า Preview สำหรับสตรีมมิ่งบน iframe
export function convertDriveVideoUrl(url) {
    if (!url) return "";
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("drive.google.com")) {
        try {
            let fileId = "";
            if (lowerUrl.includes("/file/d/")) {
                fileId = url.split("/file/d/")[1].split("/")[0];
            } else if (lowerUrl.includes("id=")) {
                fileId = url.split("id=")[1].split("&")[0];
            }
            if (fileId) {
                return `https://drive.google.com/file/d/${fileId}/preview`;
            }
        } catch (err) { console.error(err); }
    }
    return url;
}

// ฟังก์ชันสลับหน้าจอ (Navigation)
export function navigateTo(viewName) {
    const views = ["gallery", "auth", "dashboard"];
    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) {
            if (v === viewName) {
                el.classList.remove("hidden");
            } else {
                el.classList.add("hidden");
            }
        }
    });
    // เลื่อนหน้าจอกลับไปด้านบนสุดทุกครั้งที่เปลี่ยนหน้า
    window.scrollTo({ top: 0, behavior: "smooth" });
}
// ฟังก์ชันเปลี่ยนวันเวลาธรรมดา ให้กลายเป็นเวลาแบบ Relative (เช่น 5 นาทีที่แล้ว, 2 วันที่แล้ว)
export function formatRelativeTime(dateString) {
    if (!dateString) return "ไม่ระบุเวลา";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "ไม่ระบุเวลา";

    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return "เมื่อครู่นี้";
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `เมื่อ ${diffInMinutes} นาทีที่แล้ว`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `เมื่อ ${diffInHours} ชั่วโมงที่แล้ว`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `เมื่อ ${diffInDays} วันที่แล้ว`;

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `เมื่อ ${diffInWeeks} สัปดาห์ที่แล้ว`;

    // ถ้าเก่าเกิน 1 เดือนไปแล้ว ให้โชว์วันที่เต็มปกติเพื่อความสวยงาม
    return date.toLocaleDateString("th-TH", { day: 'numeric', month: 'short', year: '2-digit' });
}

// ฟังก์ชันแกะชื่อ User จาก URL และส่งค่า CSS Class สีสันตามประเภทของแอป
export function parseSocialLink(url) {
    if (!url) return null;
    const cleanUrl = url.trim().toLowerCase();
    
    let platform = "";
    let colorClass = "";
    let displayName = "Link";

    if (cleanUrl.includes("facebook.com")) {
        platform = "Facebook";
        colorClass = "bg-[#1877F2] text-white hover:bg-[#166FE5]";
        displayName = url.split("facebook.com/")[1]?.split("/")[0]?.split("?")[0] || "Facebook Profile";
    } else if (cleanUrl.includes("instagram.com")) {
        platform = "Instagram";
        colorClass = "bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#FCB045] text-white shadow-xs";
        displayName = "@" + (url.split("instagram.com/")[1]?.split("/")[0]?.split("?")[0] || "Username");
    } else if (cleanUrl.includes("tiktok.com")) {
        platform = "TikTok";
        colorClass = "bg-[#010101] text-white hover:bg-black/80 border border-slate-800";
        displayName = url.split("tiktok.com/")[1]?.split("/")[0]?.split("?")[0] || "TikTok Video";
        if (!displayName.startsWith("@") && displayName.includes("@")) {
            displayName = "@" + displayName.split("@")[1];
        }
    } else {
        return null; // ถ้าไม่ใช่ 3 แอปนี้ จะไม่นำมาแสดงผลในช่องทางเสริม
    }

    return { platform, colorClass, displayName, originalUrl: url };
}