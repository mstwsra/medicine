// ==========================================
// 1. ตั้งค่า Supabase
// ==========================================
const supabaseUrl = 'https://gvscgakbgbvesvzggrcj.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2c2NnYWtiZ2J2ZXN2emdncmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMzMxNzgsImV4cCI6MjA5NjkwOTE3OH0.HGFcfB775PibKpCtEkLT3ex9kEPiQrysdizpltcP1Mk';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;

async function checkSession() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error || !user) return window.location.href = 'auth.html';
    currentUser = user;

    const { data: profile } = await supabaseClient.from('profiles').select('full_name').eq('id', user.id).single();
    document.getElementById('userEmailDisplay').innerText = profile?.full_name || user.email;

    loadDashboardData();
}

// ==========================================
// 2. ดึงข้อมูลและประมวลผล
// ==========================================
async function loadDashboardData() {
    // 1. ดึงข้อมูลยา (Medicines)
    const { data: medicines } = await supabaseClient
        .from('medicines')
        .select('*')
        .eq('user_id', currentUser.id);

    // 2. ดึงประวัติการทานยา (Logs) โดยเรียงตาม taken_at
    const { data: logs } = await supabaseClient
        .from('medication_logs')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('taken_at', { ascending: false });

    // --- คำนวณสรุปรายวัน ---
    const totalMedsCount = medicines ? medicines.length : 0;
    
    const todayStr = new Date().toDateString();
    
    // กรองประวัติที่เกิดขึ้นวันนี้และ status = taken
    const logsToday = logs ? logs.filter(log => new Date(log.taken_at).toDateString() === todayStr && log.status === 'taken') : [];
    
    document.getElementById('totalMedsCard').innerHTML = `${totalMedsCount} <span>ชนิด</span>`;
    document.getElementById('todayMedsCard').innerHTML = `${totalMedsCount} <span>รายการ</span>`;
    document.getElementById('takenTodayCard').innerHTML = `${logsToday.length} <span>รายการ</span>`;

    // --- สร้างกราฟ (ไม่มีตารางประวัติแล้ว) ---
    processChartsData(totalMedsCount, logs);
}

// ==========================================
// 3. วาดกราฟ (Chart.js)
// ==========================================
let barChartInst = null;
let doughnutChartInst = null;

function processChartsData(totalMeds, allLogs) {
    const labels = [];
    const takenData = [0, 0, 0, 0, 0, 0, 0];
    const dateCheckArr = [];

    // สร้าง Array วันที่ 7 วันล่าสุด
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
        dateCheckArr.push(d.toDateString());
    }

    let totalTaken7Days = 0;

    if (allLogs) {
        allLogs.forEach(log => {
            if (log.status === 'taken') {
                const logDateStr = new Date(log.taken_at).toDateString();
                const idx = dateCheckArr.indexOf(logDateStr);
                if (idx !== -1) {
                    takenData[idx]++;
                    totalTaken7Days++;
                }
            }
        });
    }

    // คำนวณ Adherence (วินัยการทานยา)
    const expected7Days = totalMeds * 7;
    let missed7Days = expected7Days - totalTaken7Days;
    if (missed7Days < 0 || totalMeds === 0) missed7Days = 0;

    // ------------------------------------
    // วาดกราฟแท่ง (Bar Chart)
    // ------------------------------------
    const ctxBar = document.getElementById('barChart').getContext('2d');
    if (barChartInst) barChartInst.destroy();
    barChartInst = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'จำนวนครั้งที่ทานสำเร็จ',
                data: takenData,
                backgroundColor: '#3498db',
                borderRadius: 5
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: 5, // บังคับเพดานให้แสดงอย่างน้อย 5
                    ticks: {
                        stepSize: 1, // ขยับทีละ 1
                        precision: 0 // ไม่แสดงทศนิยม
                    }
                }
            }
        }
    });

    // ------------------------------------
    // วาดกราฟโดนัท (Doughnut Chart)
    // ------------------------------------
    const ctxDoughnut = document.getElementById('doughnutChart').getContext('2d');
    if (doughnutChartInst) doughnutChartInst.destroy();
    doughnutChartInst = new Chart(ctxDoughnut, {
        type: 'doughnut',
        data: {
            labels: ['ทานแล้ว', 'ยังไม่ทาน'],
            datasets: [{
                data: [totalTaken7Days, missed7Days === 0 && totalTaken7Days === 0 ? 1 : missed7Days],
                backgroundColor: ['#2ecc71', '#e74c3c'],
                borderWidth: 2
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

// ==========================================
// 4. ควบคุม Sidebar & ล็อกเอาต์
// ==========================================
document.getElementById('openSidebar').addEventListener('click', () => document.getElementById('sidebar').classList.add('open'));
document.getElementById('closeSidebar').addEventListener('click', () => document.getElementById('sidebar').classList.remove('open'));

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'auth.html';
});

// เริ่มโหลดข้อมูล
checkSession();