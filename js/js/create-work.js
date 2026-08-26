/**
 * NODPIX - Create Work Handler
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. ดึงข้อมูลรูปโปรไฟล์มาแสดงบน Header
    // ==========================================
    const headerAvatar = document.getElementById('header-avatar');
    
    // ดึงข้อมูลผู้ใช้จาก LocalStorage (เปลี่ยน Key ตามที่ใช้งานจริง เช่น 'userProfile' หรือ 'userData')
    const savedUser = JSON.parse(localStorage.getItem('currentUser') || localStorage.getItem('userProfile') || '{}');

    if (headerAvatar && savedUser.photoURL) {
        headerAvatar.src = savedUser.photoURL;
    }

    // ==========================================
    // 2. Element Selectors สำหรับฟอร์ม
    // ==========================================
    const imgInput = document.getElementById('port-img');
    const previewContainer = document.getElementById('preview-container');
    const previewImage = document.getElementById('preview-image');
    const formSubmit = document.getElementById('form-submit-portfolio');

    /**
     * แปลง URL ทั่วไปให้เป็น Direct Link สำหรับแสดงผลรูปภาพ
     */
    function transformToDirectImageUrl(url) {
        if (!url) return '';
        let cleanUrl = url.trim();

        // 1. แปลงลิงก์ Google Drive (drive.google.com/file/d/ID/view...)
        if (cleanUrl.includes('drive.google.com')) {
            const match = cleanUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || cleanUrl.match(/id=([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                return `https://lh3.googleusercontent.com/d/${match[1]}`;
            }
        }

        // 2. แปลงลิงก์ Imgur (imgur.com/xxxx)
        if (cleanUrl.includes('imgur.com') && !cleanUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            const imgurId = cleanUrl.split('/').pop().split('.')[0];
            if (imgurId) return `https://i.imgur.com/${imgurId}.png`;
        }

        // 3. แปลงลิงก์ Dropbox
        if (cleanUrl.includes('dropbox.com')) {
            return cleanUrl.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
        }

        return cleanUrl;
    }

    /**
     * จัดการ Event เมื่อมีการพิมพ์/วาง URL ในช่องใส่ภาพ
     */
    imgInput?.addEventListener('input', (e) => {
        const rawUrl = e.target.value.trim();

        if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
            const directUrl = transformToDirectImageUrl(rawUrl);
            
            // นำ Direct URL ไปใส่ที่ภาพ Preview
            previewImage.src = directUrl;
            previewContainer.classList.remove('hidden');
        } else {
            previewContainer.classList.add('hidden');
        }
    });

    /**
     * ดักจับกรณีที่รูปภาพโหลดไม่สำเร็จ (Broken Image / Permission Error)
     */
    previewImage?.addEventListener('error', () => {
        if (!imgInput.value.trim()) return;

        // ซ่อนกล่องพรีวิวเมื่อโหลดภาพไม่สำเร็จ
        previewContainer.classList.add('hidden');
        
        if (typeof window.showCustomAlert === 'function') {
            window.showCustomAlert('❌ ไม่สามารถโหลดรูปภาพได้\nโปรดตรวจสอบ URL หรือสิทธิ์การเข้าถึงภาพ (เช่น การตั้งค่า Public ใน Google Drive)', 'error');
        } else {
            alert('ไม่สามารถโหลดรูปภาพได้ โปรดตรวจสอบ URL หรือตั้งค่าสิทธิ์ให้เป็น สาธารณะ (Public)');
        }
    });

    /**
     * ดักจับ Event Submit ฟอร์มสร้างผลงาน
     */
    formSubmit?.addEventListener('submit', (e) => {
        e.preventDefault();

        const title = document.getElementById('port-title').value.trim();
        const category = document.getElementById('port-category').value;
        const rawImgUrl = imgInput.value.trim();
        const description = document.getElementById('port-desc').value.trim();
        const directImgUrl = transformToDirectImageUrl(rawImgUrl);

        if (!title || !rawImgUrl) {
            alert('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน');
            return;
        }

        const newWorkData = {
            title,
            category,
            imageUrl: directImgUrl,
            description,
            createdAt: new Date().toISOString()
        };

        console.log('Publishing new work:', newWorkData);
        
        if (typeof window.showCustomAlert === 'function') {
            window.showCustomAlert('✨ เผยแพร่ผลงานสำเร็จเรียบร้อย!', 'success');
            setTimeout(() => {
                window.location.href = 'profile.html';
            }, 1500);
        } else {
            alert('เผยแพร่ผลงานสำเร็จ!');
            window.location.href = 'profile.html';
        }
    });
});