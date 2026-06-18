// ==========================================
// 1. ตั้งค่า Supabase
// ==========================================
const supabaseUrl = 'https://gvscgakbgbvesvzggrcj.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2c2NnYWtiZ2J2ZXN2emdncmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMzMxNzgsImV4cCI6MjA5NjkwOTE3OH0.HGFcfB775PibKpCtEkLT3ex9kEPiQrysdizpltcP1Mk';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null; 
let allLogs = [];

// ==========================================
// 2. ระบบออโต้ล็อกอิน
// ==========================================
// ==========================================
// 2. ระบบตรวจสอบสถานะล็อกอินจริง
// ==========================================
async function checkAuth() {
    // ตรวจสอบว่ามี Session ปัจจุบันหรือไม่
    const { data: { user }, error } = await supabaseClient.auth.getUser();

    if (error || !user) {
        // ถ้าไม่มีคนล็อกอิน ให้เด้งกลับไปหน้า auth
        window.location.href = 'auth.html';
        return;
    }

    currentUser = user;
    
    // ดึงชื่อจาก profiles มาแสดง (ถ้ามี)
    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

    const displayName = (profile && profile.full_name) ? profile.full_name : user.email;
    
    // เปลี่ยน ID ให้ตรงกับหน้า history.html ของคุณ (สมมติว่าเป็น user-display-name)
    const displayElement = document.getElementById('user-display-name');
    if (displayElement) {
        displayElement.innerText = `👤 ${displayName}`;
    }

    loadHistory(); 
}

// เรียกใช้ฟังก์ชันตรวจสอบทันที
checkAuth();

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'auth.html';
});
// ==========================================
// 3. ฟังก์ชันโหลดประวัติการทานยา
// ==========================================
async function loadHistory() {
    const tableBody = document.getElementById('historyTableBody');
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">กำลังโหลดข้อมูล...</td></tr>';

    // ดึงข้อมูลประวัติ พร้อมเชื่อมตาราง medicines เพื่อเอาชื่อยา
    const { data, error } = await supabaseClient
        .from('medication_logs')
        .select(`
            id,
            status,
            taken_at,
            med_id,
            medicines ( name, dosage, instruction )
        `)
        .order('taken_at', { ascending: false });

    if (error) {
        return tableBody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">โหลดข้อมูลล้มเหลว: ${error.message}</td></tr>`;
    }
    
    allLogs = data;
    renderHistoryTable(allLogs);
}

// ==========================================
// 4. ฟังก์ชันแสดงผลตารางและการจัดการเวลา
// ==========================================
function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function renderHistoryTable(dataArray) {
    const tableBody = document.getElementById('historyTableBody');
    tableBody.innerHTML = '';
    
    if (dataArray.length === 0) {
        return tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">ยังไม่มีประวัติการทานยา</td></tr>';
    }

    dataArray.forEach(log => {
        const tr = document.createElement('tr');
        
        // เช็คว่ายาถูกลบออกจากระบบไปหรือยัง
        const medName = log.medicines ? log.medicines.name : '<span style="color:red">ยาถูกลบออกจากระบบแล้ว</span>';
        const medDosage = log.medicines ? log.medicines.dosage : '-';
        const medInstruction = log.medicines ? log.medicines.instruction.replace(/\[.*?\]\s*/, '') : '-';

        tr.innerHTML = `
            <td>${formatDate(log.taken_at)}</td>
            <td><strong>${log.med_id}</strong></td>
            <td>${medName}</td>
            <td>${medDosage} (${medInstruction})</td>
            <td><span class="status-badge">✅ ${log.status}</span></td>
        `;
        tableBody.appendChild(tr);
    });
}

// ==========================================
// 5. ระบบกรองวันที่ (Date Filter)
// ==========================================
document.getElementById('applyFilterBtn').addEventListener('click', () => {
    const filterDate = document.getElementById('filterDate').value; // คืนค่าเป็น YYYY-MM-DD
    
    if (!filterDate) {
        alert("กรุณาเลือกวันที่ต้องการค้นหา");
        return;
    }

    // กรองเอาเฉพาะข้อมูลที่มี taken_at ตรงกับวันที่เลือก
    const filteredLogs = allLogs.filter(log => {
        const logDate = log.taken_at.split('T')[0]; // ตัดเอาเฉพาะส่วน YYYY-MM-DD
        return logDate === filterDate;
    });

    renderHistoryTable(filteredLogs);
});

document.getElementById('resetFilterBtn').addEventListener('click', () => {
    document.getElementById('filterDate').value = '';
    renderHistoryTable(allLogs);
});

// Sidebar มือถือ
document.getElementById('openSidebar').addEventListener('click', () => document.getElementById('sidebar').classList.add('open'));
document.getElementById('closeSidebar').addEventListener('click', () => document.getElementById('sidebar').classList.remove('open'));