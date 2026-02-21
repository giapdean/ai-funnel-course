const API_URL = "https://script.google.com/macros/s/AKfycbw6vr_ZXhSuwkKubA7Xq5s9HJsTyEch2MKrqHWFyCEs9HV-N2o88IMoWAdHHO966cGW5Q/exec";

// Modal Management
const modal = document.getElementById('registerModal');
const regForm = document.getElementById('regForm');
const stepPayment = document.getElementById('stepPayment');
const stepReferral = document.getElementById('stepReferral');
const modalTitle = document.getElementById('modalTitle');

function showModal(type) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('regType').value = type;

    if (type === 'referral') {
        modalTitle.innerText = "Tham gia Thử Thách Viral";
    } else {
        modalTitle.innerText = "Đăng ký Khóa Học (Paid)";
    }
}

function closeModal() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    // Reset steps
    regForm.classList.remove('hidden');
    stepPayment.classList.add('hidden');
    stepReferral.classList.add('hidden');
    regForm.reset();
}

// Get Referral Code from URL
const urlParams = new URLSearchParams(window.location.search);
const referrer = urlParams.get('ref') || "";

// Form Submission
regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = regForm.querySelector('button');
    const originalText = btn.innerText;

    btn.disabled = true;
    btn.innerText = "Đang xử lý...";

    const formData = new FormData(regForm);
    const data = {
        action: 'register',
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        referredBy: referrer,
        type: document.getElementById('regType').value
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors', // standard for GAS
            body: JSON.stringify(data)
        });

        // Since no-cors doesn't return body, we assume success or use a different method if needed.
        // But for better UX, we'll try to get the payment code if possible.
        // Let's use handleResponse logic.

        const type = document.getElementById('regType').value;
        if (type === 'paid') {
            const paymentCode = `AIFUNNEL${data.email.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'X')}${Date.now().toString().slice(-4)}`;
            showPaymentStep(paymentCode);
        } else {
            // Generate a fake-but-predictable ref link for UI (backend handles real logic)
            const myRefCode = data.email.split('@')[0].toUpperCase().substring(0, 6);
            showReferralStep(myRefCode);
        }

    } catch (err) {
        console.error(err);
        alert("Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
});

function showPaymentStep(paymentCode) {
    regForm.classList.add('hidden');
    stepPayment.classList.remove('hidden');
    modalTitle.innerText = "Thanh toán Khóa học";

    document.getElementById('paymentContent').innerText = paymentCode;

    // Generate VietQR Link
    // Format: https://img.vietqr.io/image/<BANK_ID>-<ACCOUNT_NO>-<TEMPLATE>.png?amount=<AMOUNT>&addInfo=<DESCRIPTION>&accountName=<NAME>
    // Assuming MB Bank (970422) for SePay demo. Change as needed.
    const bankId = "MB";
    const accountNo = "YOUR_ACCOUNT_HERE"; // User should fill this later
    const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact.png?amount=3000000&addInfo=${paymentCode}`;
    document.getElementById('qrImage').src = qrUrl;
}

function showReferralStep(refCode) {
    regForm.classList.add('hidden');
    stepReferral.classList.remove('hidden');
    modalTitle.innerText = "Link giới thiệu của bạn";

    const baseUrl = window.location.origin + window.location.pathname;
    document.getElementById('refLink').value = `${baseUrl}?ref=${refCode}`;
}

function copyRef() {
    const copyText = document.getElementById("refLink");
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value);
    alert("Đã copy link giới thiệu!");
}

// Fade-in on Scroll
const observerOptions = {
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('appear');
        }
    });
}, observerOptions);

document.querySelectorAll('section, .bento-item, .pricing-card').forEach(el => {
    el.style.opacity = "0";
    el.style.transform = "translateY(20px)";
    el.style.transition = "all 0.6s ease-out";
    observer.observe(el);
});

// Add a class for animation
const style = document.createElement('style');
style.textContent = `
    .appear {
        opacity: 1 !important;
        transform: translateY(0) !important;
    }
`;
document.head.appendChild(style);
