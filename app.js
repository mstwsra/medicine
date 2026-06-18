// ==========================================
// 1. ตั้งค่า Supabase
// ==========================================
const supabaseUrl = 'https://gvscgakbgbvesvzggrcj.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2c2NnYWtiZ2J2ZXN2emdncmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMzMxNzgsImV4cCI6MjA5NjkwOTE3OH0.HGFcfB775PibKpCtEkLT3ex9kEPiQrysdizpltcP1Mk';
// เปลี่ยนเป็น supabaseClient
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentMedicine = null;
let isWaitingForConfirm = false;

// ==========================================
// 2. โหลดรายการเสียงเตรียมไว้ตั้งแต่เปิดหน้าเว็บ
// ==========================================
let availableVoices = [];
function loadVoices() {
    availableVoices = window.speechSynthesis.getVoices();
}
// Chrome บางเครื่องต้องรอ event นี้เสียงถึงจะมา
window.speechSynthesis.onvoiceschanged = loadVoices;

document.addEventListener("DOMContentLoaded", () => {
    loadVoices(); // ลองโหลดทันทีที่เปิดเว็บ

    const urlParams = new URLSearchParams(window.location.search);
    const medId = urlParams.get('id'); 

    if (medId) {
        fetchMedicineData(medId);
    }
});

// ==========================================
// 3. ฟังก์ชันค้นหาข้อมูลยา และเช็คการกินซ้ำ
// ==========================================
async function fetchMedicineData(id) {
    updateUI("กำลังค้นหาข้อมูล...", "รอสักครู่ครับ");

    const { data, error } = await supabaseClient
        .from('medicines')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) {
        console.error("ค้นหาไม่พบ:", error);
        updateUI("❌ ไม่พบข้อมูลยา", `ไม่มีรหัส ${id} ในระบบ`);
        speak("ไม่พบข้อมูลยาในระบบครับ");
        return;
    }

    currentMedicine = data;

    const storedUserId = localStorage.getItem('med_user_id');
    if (storedUserId) {
        const checkTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { data: logData } = await supabaseClient
            .from('medication_logs')
            .select('taken_at')
            .eq('med_id', currentMedicine.id)
            .eq('user_id', storedUserId)
            .gte('taken_at', checkTime) 
            .order('taken_at', { ascending: false })
            .limit(1);

        if (logData && logData.length > 0) {
            updateUI(`ยา ${currentMedicine.name}`, `⚠️ คุณเพิ่งทานยานี้ไปแล้ว`);
            // การใส่เว้นวรรค (space) หรือลูกน้ำ (,) จะช่วยให้เสียงมีจังหวะหยุดพัก ไม่พูดรัว
            speak(`คุณเพิ่งทานยา, ${currentMedicine.name}, ไปแล้วเมื่อไม่นานมานี้ครับ, ไม่ต้องทานซ้ำนะครับ`);
            
            setTimeout(() => { 
                window.location.href = window.location.pathname; 
            }, 6000);
            return; 
        }
    }

    updateUI(`ยา ${data.name}`, `วิธีกิน: ${data.dosage} ${data.instruction}`);
    // ปรับรูปแบบประโยคให้มีจังหวะหายใจ
    speak(
        `ยาที่คุณต้องการกินคือ, ${data.name} . วิธีการกินคือ, ${data.dosage}, ${data.instruction}. หากทานแล้ว, กรุณาพูดว่า, กินยาแล้ว. หรือถ้าฟังไม่ทัน, ให้พูดว่า, อ่านซ้ำนะครับ`, 
        startListening
    );
}

// ==========================================
// 4. ฟังก์ชันจัดการหน้าจอ (UI)
// ==========================================
function updateUI(mainText, subText) {
    const mainEl = document.getElementById('mainText');
    const subEl = document.getElementById('subText');
    if(mainEl) mainEl.innerText = mainText;
    if(subEl) {
        subEl.innerText = subText;
        subEl.classList.remove('hidden');
    }
}

// ==========================================
// 5. ระบบพูดเสียง (ใช้เทคนิคดึงเสียง Google Translate ฟรี)
// ==========================================
function speak(text, onEndCallback) {
    // ใช้ API ลับของ Google Translate (ฟรี ไม่ต้องมี Key)
    // client=tw-ob คือรหัสที่ทำให้ดึงเสียงได้ยาวๆ
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=th-TH&client=tw-ob&q=${encodeURIComponent(text)}`;
    
    const audio = new Audio(url);
    const speakerAnim = document.getElementById('speakerAnimation');
    const waveAnim = document.getElementById('waveformAnimation');

    audio.onplay = function() {
        if(speakerAnim) speakerAnim.classList.add('playing');
        if(waveAnim) waveAnim.classList.add('playing-wave');
    };

    audio.onended = function() {
        if(speakerAnim) speakerAnim.classList.remove('playing');
        if(waveAnim) waveAnim.classList.remove('playing-wave');
        if(onEndCallback) onEndCallback(); // ถ้ามีคำสั่งเปิดไมค์ ให้เปิดหลังพูดจบ
    };

    // ป้องกันกรณีเน็ตหลุดหรือถูกเบราว์เซอร์บล็อก ให้มีเสียงระบบเดิมสำรองไว้
    audio.onerror = function() {
        console.warn("ดึงเสียงกูเกิลไม่สำเร็จ สลับไปใช้เสียงระบบ...");
        fallbackSpeak(text, onEndCallback);
    };

    audio.play().catch(e => {
        console.warn("เบราว์เซอร์บล็อกเสียง:", e);
        fallbackSpeak(text, onEndCallback);
    });
}

// ฟังก์ชันเสียงสำรอง (กรณีเน็ตมีปัญหา)
function fallbackSpeak(text, onEndCallback) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = 0.85;
    
    utterance.onend = function() {
        if(onEndCallback) onEndCallback();
    };
    window.speechSynthesis.speak(utterance);
}

// ==========================================
// 6. ระบบฟังเสียง (Speech-to-Text)
// ==========================================
function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        updateUI(currentMedicine.name, "เบราว์เซอร์ไม่รองรับระบบเสียง กรุณากดปุ่มเพื่อบันทึก");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'th-TH';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = function() {
        isWaitingForConfirm = true;
        updateUI(currentMedicine.name, "กำลังฟัง... 🎤 พูดว่า 'กินยาแล้ว' หรือ 'อ่านซ้ำ'");
    };

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript.trim();
        console.log("จับเสียงได้ว่า:", transcript);

        if (transcript.includes("กินยาแล้ว") || transcript.includes("กินแล้ว")) {
            confirmMedication();
        } 
        else if (transcript.includes("อ่านซ้ำ") || transcript.includes("ซ้ำ") || transcript.includes("อีกครั้ง")) {
            isWaitingForConfirm = false; 
            updateUI(currentMedicine.name, "กำลังอ่านข้อมูลซ้ำครับ...");
            // ส่งข้อความไปให้ Google อ่านซ้ำ
            speak(`ยา, ${currentMedicine.name}. วิธีกินคือ, ${currentMedicine.dosage}, ${currentMedicine.instruction}  หากทานแล้ว, พูดว่า, กินยาแล้ว ครับ`, startListening);
        } 
        else {
            updateUI(currentMedicine.name, `ได้ยินว่า "${transcript}" กรุณาพูดว่า "กินยาแล้ว"`);
            setTimeout(startListening, 2000); 
        }
    };

    recognition.onerror = function(event) {
        if(event.error !== 'no-speech') {
           updateUI(currentMedicine.name, "รับเสียงไม่ได้ กำลังลองใหม่...");
           setTimeout(startListening, 2000);
        }
    };

    recognition.onend = function() {
        if (isWaitingForConfirm) recognition.start();
    }

    try {
        recognition.start();
    } catch (e) {
        console.error("เริ่มการฟังเสียงล้มเหลว:", e);
    }
}

// ==========================================
// 7. บันทึกข้อมูล
// ==========================================
async function confirmMedication() {
    if (!currentMedicine) return;
    
    isWaitingForConfirm = false; 

    const storedUserId = localStorage.getItem('med_user_id');
    const finalUserId = storedUserId || currentMedicine.user_id;

    if (!finalUserId) {
        updateUI('❌ ไม่พบข้อมูลผู้ใช้', 'กรุณาตั้งค่าผู้ใช้ในหน้า setup');
        speak("ไม่พบข้อมูลผู้ใช้ครับ");
        return;
    }

    updateUI('กำลังบันทึกข้อมูล...', '💾');

    const { error } = await supabaseClient.from('medication_logs').insert([{
        med_id: currentMedicine.id,
        user_id: finalUserId, 
        status: 'กินแล้ว',
        taken_at: new Date().toISOString()
    }]);

    if (error) {
        console.error("Error details:", error);
        updateUI('❌ บันทึกไม่สำเร็จ', error.message || 'เกิดข้อผิดพลาด');
        speak("ขออภัยครับ, บันทึกข้อมูลไม่สำเร็จ");
    } else {
        updateUI('✅ บันทึกเรียบร้อย', 'ขอบคุณครับ');
        const subEl = document.getElementById('subText');
        if (subEl) subEl.classList.add('hidden');
        
        speak(`คุณกินยา, ${currentMedicine.name}, เรียบร้อยแล้วครับ. ขอให้สุขภาพแข็งแรงนะครับ`);
        
        setTimeout(() => { 
            window.location.href = window.location.pathname; 
        }, 6000);
    }
}