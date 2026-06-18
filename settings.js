const supabaseUrl = 'https://gvscgakbgbvesvzggrcj.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2c2NnYWtiZ2J2ZXN2emdncmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMzMxNzgsImV4cCI6MjA5NjkwOTE3OH0.HGFcfB775PibKpCtEkLT3ex9kEPiQrysdizpltcP1Mk';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);


// 1. ดึงชื่อผู้ใช้และข้อมูล Line ID เมื่อโหลดหน้าเว็บ
document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile(); // ดึงชื่อมาโชว์ที่ Header
    loadSettings();    // ดึง Line ID มาโชว์ในช่องกรอก
    
    // ตั้งค่าปุ่ม Sidebar
    document.getElementById('openSidebar').addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('open');
    });
    document.getElementById('closeSidebar').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
    });
});

// ฟังก์ชันดึงชื่อผู้ใช้จากตาราง profiles
async function loadUserProfile() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) { window.location.href = 'auth.html'; return; }

    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

    // แสดงชื่อใน span id="user-display-name"
    const nameDisplay = document.getElementById('user-display-name');
    if (nameDisplay) {
        nameDisplay.innerText = profile?.full_name || user.email;
    }
}

// ฟังก์ชันดึง Line User ID
async function loadSettings() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data } = await supabaseClient
        .from('profiles')
        .select('line_user_id')
        .eq('id', user.id)
        .single();

    if (data && data.line_user_id) {
        document.getElementById('lineUserId').value = data.line_user_id;
    }
}

// ฟังก์ชันบันทึก Line ID
async function saveLineId() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const newLineId = document.getElementById('lineUserId').value;

    const { error } = await supabaseClient
        .from('profiles')
        .update({ line_user_id: newLineId })
        .eq('id', user.id);

    if (error) alert("บันทึกไม่สำเร็จ: " + error.message);
    else alert("บันทึก Line User ID เรียบร้อยแล้ว!");
}

// บันทึกข้อมูลทั้งของตัวเองและญาติ
async function saveLineId() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const newLineId = document.getElementById('lineUserId').value;
    const newRelativeId = document.getElementById('relativeLineId').value;

    const { error } = await supabaseClient
        .from('profiles')
        .update({ 
            line_user_id: newLineId,
            relative_line_id: newRelativeId 
        })
        .eq('id', user.id);

    if (error) {
        alert("เกิดข้อผิดพลาด: " + error.message);
    } else {
        // สร้าง Popup แจ้งเตือนพร้อมปุ่มแก้ไข
        const doEdit = confirm("บันทึกข้อมูลเรียบร้อยแล้ว!\nคุณต้องการแก้ไขข้อมูลต่อหรือไม่?");
        if (!doEdit) {
            // ถ้าไม่แก้ไข ให้ทำอะไรบางอย่าง เช่น โหลดหน้าใหม่
            loadSettings(); 
        }
        // ถ้ากด OK (แก้ไขต่อ) ก็ปล่อยให้ค้างไว้ที่หน้าเดิม
    }
}

// เพิ่มฟังก์ชันโหลดข้อมูลญาติด้วย
async function loadSettings() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data } = await supabaseClient
        .from('profiles')
        .select('line_user_id, relative_line_id')
        .eq('id', user.id)
        .single();

    if (data) {
        if (data.line_user_id) document.getElementById('lineUserId').value = data.line_user_id;
        if (data.relative_line_id) document.getElementById('relativeLineId').value = data.relative_line_id;
    }
}

async function testLineNotification() {
    const webAppUrl = "https://script.google.com/macros/s/AKfycbzplm-HGMAOyZ3ZgjFF_cIWv230kAb0jrhn1C6IXo0-F-9fAZG97YJnb7i6dBNoPFK4/exec";
    const relativeId = document.getElementById('relativeLineId').value; // ดึง ID ญาติ
    
    await fetch(webAppUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            targetId: relativeId,
            medName: "ยาแก้คัน"
        })
    });
    alert("ส่งแจ้งเตือนทดสอบเรียบร้อยแล้ว!");
}

// ฟังก์ชันดึงข้อมูลมาแสดงเมื่อโหลดหน้า Settings
async function loadUserData() {
    // 1. ลองดึงจาก localStorage ก่อน
    const savedId = localStorage.getItem('med_user_id');
    const inputField = document.getElementById('setupUserId');
    
    if (savedId) {
        inputField.value = savedId;
    } else {
        // 2. ถ้าไม่มีใน localStorage ให้ดึงจาก Auth User ของ Supabase
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
            inputField.value = user.id; // ใช้ UUID ของระบบล็อกอินอัตโนมัติ
        }
    }
}

// ฟังก์ชันบันทึกข้อมูล
function saveUserToStorage() {
    const id = document.getElementById('setupUserId').value.trim();
    if(id.length > 5) {
        localStorage.setItem('med_user_id', id);
        alert('บันทึกรหัสผู้ใช้งานเรียบร้อยแล้วค่ะ!');
    } else {
        alert('กรุณากรอกรหัสให้ถูกต้องค่ะ');
    }
}

// เรียกใช้เมื่อโหลดหน้าเว็บ
document.addEventListener('DOMContentLoaded', () => {
    loadUserData();
});