// ==========================================
// 1. ตั้งค่า Supabase
// ==========================================
const supabaseUrl = 'https://gvscgakbgbvesvzggrcj.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2c2NnYWtiZ2J2ZXN2emdncmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMzMxNzgsImV4cCI6MjA5NjkwOTE3OH0.HGFcfB775PibKpCtEkLT3ex9kEPiQrysdizpltcP1Mk';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let isEditing = false;
let currentEditId = null;
let allMedicines = [];
let currentUser = null; 

// ==========================================
// 2. ระบบตรวจสอบการเข้าสู่ระบบและดึงข้อมูลชื่อ
// ==========================================
async function checkSession() {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
        window.location.href = 'auth.html';
        return;
    }

    currentUser = user;

    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

    const displayName = (profile && profile.full_name) ? profile.full_name : user.email;
    document.getElementById('user-display-name').innerText = displayName;

    loadMedicines(); 
}

checkSession();

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'auth.html';
});

// ==========================================
// 3. ฟังก์ชันโหลดข้อมูลและแสดงตาราง
// ==========================================
async function loadMedicines() {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">กำลังโหลดข้อมูล...</td></tr>';

    const { data, error } = await supabaseClient
        .from('medicines')
        .select('*')
        .eq('user_id', currentUser.id) 
        .order('created_at', { ascending: false });

    if (error) return tableBody.innerHTML = `<tr><td colspan="4" style="color:red; text-align:center;">โหลดข้อมูลล้มเหลว: ${error.message}</td></tr>`;
    
    allMedicines = data;
    renderTable(allMedicines);
}

function getTagHTML(instructionStr) {
    if (!instructionStr) return '';
    let tagClass = 'tag-other'; let tagText = 'อื่นๆ';
    if (instructionStr.includes('[เช้า]')) { tagClass = 'tag-morning'; tagText = 'เช้า'; }
    else if (instructionStr.includes('[กลางวัน]')) { tagClass = 'tag-noon'; tagText = 'กลางวัน'; }
    else if (instructionStr.includes('[เย็น]')) { tagClass = 'tag-evening'; tagText = 'เย็น'; }
    else if (instructionStr.includes('[ก่อนนอน]')) { tagClass = 'tag-bedtime'; tagText = 'ก่อนนอน'; }
    else return ''; 
    const cleanInstruction = instructionStr.replace(/\[.*?\]\s*/, '');
    return `<div style="margin-bottom: 5px;"><span class="tag ${tagClass}">${tagText}</span></div>${cleanInstruction}`;
}

function renderTable(dataArray) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';
    if (dataArray.length === 0) return tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">ยังไม่มีข้อมูลยา</td></tr>';

    dataArray.forEach(med => {
        const tr = document.createElement('tr');
        // เพิ่มการแสดงเวลาในตาราง
        const timeDisplay = med.scheduled_time ? med.scheduled_time.substring(0,5) + ' น.' : 'ไม่ได้ตั้งเวลา';

        tr.innerHTML = `
            <td><strong>${med.id}</strong></td>
            <td>${med.name}<br><small style="color:#7f8c8d">${med.dosage}</small></td>
            <td>
                ${getTagHTML(med.instruction)}
                <small style="color:#e67e22; display:block; margin-top:4px;">⏱️ ${timeDisplay}</small>
            </td>
            <td>
                <div style="margin-bottom: 5px;">
                    <button class="action-btn info-btn" onclick="showDetails('${med.id}')">🔍 รายละเอียด</button>
                    <button class="action-btn link-btn" onclick="copyDirectLink('${med.id}')">🔗 คัดลอกลิงก์</button>
                </div>
                <div>
                    <button class="action-btn edit-btn" onclick="editMedicine('${med.id}')">✏️ แก้ไข</button>
                    <button class="action-btn delete-btn" onclick="deleteMedicine('${med.id}', '${med.name}')">🗑️ ลบ</button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

document.getElementById('searchInput').addEventListener('input', function(e) {
    const keyword = e.target.value.toLowerCase();
    const filteredData = allMedicines.filter(med => 
        (med.name && med.name.toLowerCase().includes(keyword)) ||
        (med.id && med.id.toLowerCase().includes(keyword))
    );
    renderTable(filteredData);
});

// ==========================================
// 4. จัดการฟอร์ม เพิ่ม/แก้ไข ข้อมูล
// ==========================================
document.getElementById('medForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerText = "กำลังบันทึก..."; submitBtn.disabled = true;

    const timeTag = document.getElementById('timeTag').value;
    const additionalInst = document.getElementById('medInstruction').value;
    const combinedInstruction = timeTag ? `[${timeTag}] ${additionalInst}` : additionalInst;

    // ดึงค่าเวลา
    const medTimeInput = document.getElementById('medTime');
    const medTimeValue = medTimeInput ? medTimeInput.value : null;

    const medData = {
        id: document.getElementById('medId').value,
        name: document.getElementById('medName').value,
        dosage: document.getElementById('medDosage').value,
        instruction: combinedInstruction,
        warning: document.getElementById('medWarning').value || "ไม่มี",
        user_id: currentUser.id,
        scheduled_time: medTimeValue || null
    };

    if (isEditing) {
        await supabaseClient.from('medicines').update(medData).eq('id', currentEditId);
        alert('อัปเดตสำเร็จ!'); resetForm();
    } else {
        medData.is_taken = false; 
        const { error } = await supabaseClient.from('medicines').insert([medData]);
        if (error) alert('รหัสยาซ้ำ หรือผิดพลาด: ' + error.message);
        else { generateLink(medData.id); resetForm(false); }
    }

    submitBtn.disabled = false; loadMedicines(); 
});

// ==========================================
// 5. ปุ่มแอคชันในตาราง (รายละเอียด, ก๊อปลิงก์, ลบ, แก้ไข)
// ==========================================
function showDetails(id) {
    const med = allMedicines.find(m => m.id === id);
    if (!med) return;
    
    const timeDisplay = med.scheduled_time ? med.scheduled_time.substring(0,5) + ' น.' : 'ไม่ได้ตั้งเวลา';

    document.getElementById('modalTitle').innerText = `รายละเอียดยา`;
    document.getElementById('modalBody').innerHTML = `
        <p><strong>รหัสยา (NFC):</strong> <span style="color:#3498db; font-weight:bold;">${med.id}</span></p>
        <p><strong>ชื่อยา:</strong> ${med.name}</p>
        <p><strong>ขนาดรับประทาน:</strong> ${med.dosage}</p>
        <p><strong>วิธีทาน:</strong> ${med.instruction}</p>
        <p><strong>เวลาที่ต้องทาน:</strong> <span style="color:#e67e22; font-weight:bold;">${timeDisplay}</span></p>
        <p><strong>คำเตือน:</strong> <span style="color:#e74c3c;">${med.warning}</span></p>
    `;
    document.getElementById('detailsModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('detailsModal').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('detailsModal');
    if (event.target == modal) { modal.style.display = "none"; }
}

function copyDirectLink(id) {
    let baseUrl = window.location.href.replace('admin.html', 'index.html'); 
    if (!baseUrl.includes('index.html')) baseUrl = window.location.origin + '/index.html';
    const link = `${baseUrl}?id=${id}`;
    navigator.clipboard.writeText(link).then(() => alert(`คัดลอกลิงก์สำหรับยา ${id} เรียบร้อยแล้ว!\n\nลิงก์: ${link}`));
}

async function deleteMedicine(id, name) {
    if (confirm(`ยืนยันการลบ "${name}" ?`)) {
        await supabaseClient.from('medicines').delete().eq('id', id);
        loadMedicines();
    }
}

async function editMedicine(id) {
    const med = allMedicines.find(m => m.id === id);
    if (!med) return;
    document.getElementById('medId').value = med.id; document.getElementById('medId').readOnly = true;
    document.getElementById('medName').value = med.name;
    document.getElementById('medDosage').value = med.dosage; document.getElementById('medWarning').value = med.warning;

    // ดึงเวลาไปโชว์ในช่อง input
    const medTimeInput = document.getElementById('medTime');
    if(medTimeInput) {
        medTimeInput.value = med.scheduled_time || '';
    }

    let instStr = med.instruction || ''; const match = instStr.match(/\[(.*?)\]\s*(.*)/);
    if (match) { document.getElementById('timeTag').value = match[1]; document.getElementById('medInstruction').value = match[2]; } 
    else { document.getElementById('timeTag').value = ''; document.getElementById('medInstruction').value = instStr; }

    isEditing = true; currentEditId = med.id;
    document.getElementById('formTitle').innerText = `แก้ไขข้อมูล: ${med.id}`;
    document.getElementById('submitBtn').innerText = "อัปเดตข้อมูล"; document.getElementById('submitBtn').style.backgroundColor = "#f39c12";
    document.getElementById('cancelBtn').classList.remove('hidden'); document.getElementById('result').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function generateLink(id) {
    // ใช้คำสั่งนี้จะดีที่สุด เพราะมันจะดึง Path ของโฟลเดอร์ที่หน้า admin อยู่มาใช้เลย
    let path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
    let baseUrl = window.location.origin + path + '/index.html';
    
    document.getElementById('nfcLink').value = `${baseUrl}?id=${id}`;
    document.getElementById('result').classList.remove('hidden');
}

document.getElementById('copyBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('nfcLink').value).then(() => alert('คัดลอกลิงก์เรียบร้อย!'));
});

function resetForm(clearAll = true) {
    if(clearAll) document.getElementById('medForm').reset();
    isEditing = false; currentEditId = null; document.getElementById('medId').readOnly = false;
    document.getElementById('formTitle').innerText = "เพิ่มข้อมูลยาใหม่";
    document.getElementById('submitBtn').innerText = "บันทึกข้อมูล"; document.getElementById('submitBtn').style.backgroundColor = "#2ecc71";
    document.getElementById('cancelBtn').classList.add('hidden');
}

document.getElementById('cancelBtn').addEventListener('click', () => { resetForm(); document.getElementById('result').classList.add('hidden'); });

document.getElementById('openSidebar').addEventListener('click', () => document.getElementById('sidebar').classList.add('open'));
document.getElementById('closeSidebar').addEventListener('click', () => document.getElementById('sidebar').classList.remove('open'));

// ==========================================
// 6. ฟังก์ชันบันทึกลง medication_logs
// ==========================================
async function logMedicationTaken(medId) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    if (!user) {
        alert("กรุณาล็อกอินก่อนครับ");
        return;
    }

    const { error } = await supabaseClient
        .from('medication_logs')
        .insert([
            { 
                user_id: user.id, 
                med_id: medId, 
                status: 'taken' 
            }
        ]);

    if (error) {
        console.error("บันทึกข้อมูลไม่ได้:", error);
        alert("เกิดข้อผิดพลาดในการบันทึก");
    } else {
        alert("บันทึกว่าทานยาแล้วเรียบร้อย!");
    }
}