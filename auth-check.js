// ตรวจสอบสถานะล็อกอินทันทีที่โหลดหน้าเว็บ
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (!session && window.location.pathname !== 'auth.html') {
        // ถ้าไม่มี session ให้เด้งกลับไปหน้า login
        // window.location.href = 'auth.html'; 
    } else if (session) {
        currentUser = session.user;
        // โหลดข้อมูลตามหน้า (ถ้าหน้านั้นมีฟังก์ชัน loadHistory หรืออื่นๆ)
        if (typeof loadHistory === 'function') loadHistory();
    }
});