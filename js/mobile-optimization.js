/**
 * Mobile UX & Interaction Control
 * สำหรับเพิ่มความลื่นไหลและระบบ Touch Event บนมือถือ
 */

// 1. แก้ปัญหา Dynamic Viewport Height (vh) ในมือถือ ป้องกันแอดเดรสบาร์ทำย้วย
const setAppHeight = () => {
    document.documentElement.style.setProperty('--doc-height', `${window.innerHeight}px`);
};

window.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', setAppHeight);
setAppHeight();

// 2. ระบบ Touch Swipe Gesture (ปัดซ้าย-ขวา เพื่อปิด/เปิด Modal หรือ Menu)
export class MobileSwipeDetector {
    constructor(element, callbacks = {}) {
        this.element = typeof element === 'string' ? document.querySelector(element) : element;
        this.callbacks = callbacks;
        this.startX = 0;
        this.startY = 0;
        this.threshold = 50;

        if (this.element) this.init();
    }

    init() {
        this.element.addEventListener('touchstart', (e) => {
            this.startX = e.touches[0].clientX;
            this.startY = e.touches[0].clientY;
        }, { passive: true });

        this.element.addEventListener('touchend', (e) => {
            const diffX = e.changedTouches[0].clientX - this.startX;
            const diffY = e.changedTouches[0].clientY - this.startY;

            if (Math.abs(diffX) > Math.abs(diffY)) {
                if (Math.abs(diffX) > this.threshold) {
                    diffX > 0 ? this.callbacks.onSwipeRight?.() : this.callbacks.onSwipeLeft?.();
                }
            } else {
                if (Math.abs(diffY) > this.threshold) {
                    diffY > 0 ? this.callbacks.onSwipeDown?.() : this.callbacks.onSwipeUp?.();
                }
            }
        }, { passive: true });
    }
}

// 3. ปรับ Feedback ปุ่มกดขณะแตะบนมือถือ
document.addEventListener('DOMContentLoaded', () => {
    const attachTouchFeedback = () => {
        const interactiveElements = document.querySelectorAll('button, a, .clickable');
        interactiveElements.forEach(el => {
            el.addEventListener('touchstart', () => el.classList.add('active-touch'), { passive: true });
            el.addEventListener('touchend', () => el.classList.remove('active-touch'), { passive: true });
            el.addEventListener('touchcancel', () => el.classList.remove('active-touch'), { passive: true });
        });
    };

    attachTouchFeedback();

    // 4. ผูก Swipe gesture กับ Modal (ตัวอย่าง: ปัดลงหรือซ้ายเพื่อปิด Modal ผลงาน)
    const portfolioModal = document.getElementById('portfolio-modal');
    if (portfolioModal) {
        new MobileSwipeDetector(portfolioModal, {
            onSwipeDown: () => {
                const closeBtn = document.getElementById('modal-close-btn');
                if (closeBtn) closeBtn.click();
            }
        });
    }
});