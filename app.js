import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDA4wHyLuyz8LN4RVxKoclF3CAXxKPg7xc",
    authDomain: "svatebniplanovac-f8ede.firebaseapp.com",
    projectId: "svatebniplanovac-f8ede",
    storageBucket: "svatebniplanovac-f8ede.firebasestorage.app",
    messagingSenderId: "1016595614269",
    appId: "1:1016595614269:web:f1c1dddbf8bd2228e43854",
    measurementId: "G-3LK6J78T6K"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const tasksColl = collection(db, "ukoly"), guestsColl = collection(db, "hoste"), budgetColl = collection(db, "rozpocet");
let unsubs = [];
let currentGuests = [];

// --- AUTH ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('appSection').classList.remove('hidden');
        initApp(user.uid);
    } else {
        document.getElementById('authSection').classList.remove('hidden');
        document.getElementById('appSection').classList.add('hidden');
        unsubs.forEach(u => u());
    }
});

document.getElementById('loginBtn').onclick = () => signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value).catch(e => alert(e.message));
document.getElementById('registerBtn').onclick = () => createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value).catch(e => alert(e.message));
document.getElementById('logoutBtn').onclick = () => signOut(auth);

function initApp(uid) {
    // 0. GENERATOR ODKAZU PRO HOSTY
    let currentPath = window.location.pathname;
    if (currentPath.endsWith('index.html')) currentPath = currentPath.replace('index.html', '');
    if (!currentPath.endsWith('/')) currentPath += '/';
    const shareUrl = window.location.origin + currentPath + 'formular.html?uid=' + uid;
    const urlInput = document.getElementById('shareUrlInput');
    if (urlInput) urlInput.value = shareUrl;

    // 1. ÚKOLY
    unsubs.push(onSnapshot(query(tasksColl, where("userId", "==", uid)), snap => {
        const list = document.getElementById('taskList'); list.innerHTML = '';
        snap.forEach(d => {
            const t = d.data(); const id = d.id;
            const li = document.createElement('li');
            if (t.completed) li.classList.add('completed');
            li.innerHTML = `
                <div class="task-main">
                    <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="updateDoc(doc(db, 'ukoly', '${id}'), {completed: this.checked})">
                    <span class="task-text">${t.text}</span>
                    <div>
                        <button class="btn-small btn-secondary" onclick="editTaskName('${id}', '${t.text}')">✏️</button>
                        <button class="btn-small" onclick="deleteDoc(doc(db, 'ukoly', '${id}'))">❌</button>
                    </div>
                </div>
                <div class="task-note">
                    <input type="text" placeholder="Přidat poznámku k úkolu..." value="${t.note || ''}" onchange="updateDoc(doc(db, 'ukoly', '${id}'), {note: this.value})">
                </div>
            `;
            list.appendChild(li);
        });
    }));

    // 2. HOSTÉ, POMOCNÍCI A UBYTOVÁNÍ
    unsubs.push(onSnapshot(query(guestsColl, where("userId", "==", uid)), snap => {
        const gBody = document.getElementById('guestTableBody');
        const hPending = document.getElementById('helperPendingTableBody');
        const hAssigned = document.getElementById('helperAssignedTableBody');
        const aPending = document.getElementById('accPendingTableBody');
        const aAssigned = document.getElementById('accAssignedTableBody');
        
        gBody.innerHTML = ''; hPending.innerHTML = ''; hAssigned.innerHTML = ''; aPending.innerHTML = ''; aAssigned.innerHTML = '';
        
        currentGuests = [];
        let stats = { total:0, confirmed:0, declined:0, nevesta:0, zenich:0, spolecny:0, cities:{}, tasks:{} };
        let accStats = {}; // Pro číselník ubytování

        snap.forEach(d => {
            const g = d.data(); g.id = d.id;
            currentGuests.push(g);

            // Statistiky
            stats.total++;
            if(g.status === 'Potvrzeno') stats.confirmed++;
            if(g.status === 'Nezúčastní se') stats.declined++;
            
            if(g.side === 'Nevěsta') stats.nevesta++;
            else if(g.side === 'Ženich') stats.zenich++;
            else stats.spolecny++;
            
            let city = g.city ? g.city.trim() : 'Nezadáno';
            stats.cities[city] = (stats.cities[city] || 0) + 1;

            // Formátování data pro zobrazení
            let displayDate = '';
            if (g.submittedDate) {
                let d = new Date(g.submittedDate);
                displayDate = `${d.getDate()}.${d.getMonth()+1}.${d.getFullYear()}`;
            }

            // A) HLAVNÍ TABULKA HOSTŮ
            const tr = document.createElement('tr');
            tr.className = g.side === 'Nevěsta' ? 'side-nevesta' : (g.side === 'Ženich' ? 'side-zenich' : 'side-spolecny');
            // Propojení data pro filtraci
            tr.dataset.date = g.submittedDate || '';
            
            let statusHtml = '';
            if (g.status === 'Potvrzeno') statusHtml = '✅ Potvrzeno';
            else if (g.status === 'Nezúčastní se') statusHtml = '<span class="status-declined">❌ Nezúčastní se</span>';
            else statusHtml = '📩 Pozváno';

            tr.innerHTML = `
                <td><strong>${g.name}</strong><br><small style="color:#888">${displayDate ? 'Z formuláře: '+displayDate : ''}</small></td>
                <td>${g.city || '-'}</td>
                <td>${g.side}</td>
                <td style="cursor:pointer" onclick="toggleGuest('${g.id}','${g.status}')">${statusHtml}</td>
                <td>
                    <button class="btn-small btn-secondary" onclick="openEditModal('${g.id}')">✏️</button>
                    <button class="btn-small" onclick="deleteDoc(doc(db, 'hoste', '${g.id}'))">❌</button>
                </td>
            `;
            gBody.appendChild(tr);

            // B) POMOCNÍCI
            if (g.isHelper) {
                if (g.helperStatus === 'pending') {
                    const trHP = document.createElement('tr');
                    trHP.innerHTML = `<td><strong>${g.name}</strong></td><td>${g.helperTask || 'Nezadáno'}</td>
                                      <td><button class="btn-small" onclick="assignHelper('${g.id}', '${g.helperTask}')">Přiřadit</button></td>`;
                    hPending.appendChild(trHP);
                } else {
                    let taskName = g.helperTask ? g.helperTask.trim() : 'Zatím nepřiřazeno';
                    stats.tasks[taskName] = (stats.tasks[taskName] || 0) + 1;
                    const trHA = document.createElement('tr');
                    trHA.innerHTML = `<td><strong>${g.name}</strong></td><td><input type="text" class="editable-input" value="${g.helperTask || ''}" onchange="updateDoc(doc(db, 'hoste', '${g.id}'), {helperTask: this.value})"></td>`;
                    hAssigned.appendChild(trHA);
                }
            }

            // C) UBYTOVÁNÍ
            if (g.needsAcc) {
                if (g.accStatus === 'pending') {
                    const trAP = document.createElement('tr');
                    trAP.innerHTML = `<td><strong>${g.name}</strong></td><td>${g.accRoom || 'Zatím bez požadavku'}</td>
                                      <td><button class="btn-small" onclick="assignAcc('${g.id}')">Přiřadit pokoj</button></td>`;
                    aPending.appendChild(trAP);
                } else {
                    // Logika pro číselník
                    let place = g.accPlace ? g.accPlace.trim() : 'Nepřiřazené místo';
                    if (!accStats[place]) accStats[place] = { guests: 0, rooms: new Set() };
                    accStats[place].guests++;
                    if (g.accRoom) accStats[place].rooms.add(g.accRoom.trim());

                    const trAA = document.createElement('tr');
                    trAA.innerHTML = `
                        <td><strong>${g.name}</strong></td>
                        <td><input type="text" class="editable-input" value="${g.accPlace || ''}" onchange="updateDoc(doc(db, 'hoste', '${g.id}'), {accPlace: this.value})"></td>
                        <td><input type="text" class="editable-input" value="${g.accRoom || ''}" onchange="updateDoc(doc(db, 'hoste', '${g.id}'), {accRoom: this.value})"></td>
                        <td><button class="btn-small btn-secondary" onclick="updateDoc(doc(db, 'hoste', '${g.id}'), {accStatus: 'pending'})">Zpět</button></td>
                    `;
                    aAssigned.appendChild(trAA);
                }
            }
        });
        renderGuestStats(stats);
        renderAccStats(accStats);
    }));

    // 3. ROZPOČET (Zůstává nezměněn)
    unsubs.push(onSnapshot(query(budgetColl, where("userId", "==", uid)), snap => {
        const tbody = document.getElementById('budgetTableBody'); tbody.innerHTML = '';
        let estTotal = 0, actTotal = 0;
        snap.forEach(d => {
            const b = d.data(); estTotal += Number(b.estimated); actTotal += Number(b.actual || 0);
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${b.name}</td><td>${b.estimated} Kč</td><td><input type="number" class="editable-input" style="width:80px" value="${b.actual || 0}" onchange="updateDoc(doc(db, 'rozpocet', '${d.id}'), {actual: Number(this.value)})"> Kč</td><td><button class="btn-small" onclick="deleteDoc(doc(db, 'rozpocet', '${d.id}'))">❌</button></td>`;
            tbody.appendChild(tr);
        });
        document.getElementById('totalEstimated').innerText = estTotal.toLocaleString() + " Kč";
        document.getElementById('totalActual').innerText = actTotal.toLocaleString() + " Kč";
    }));
}

// --- VYKRESLENÍ STATISTIK ---
function renderGuestStats(s) {
    let html = `
        <div class="stat-box">Nevěsta: <strong>${s.nevesta}</strong></div>
        <div class="stat-box">Ženich: <strong>${s.zenich}</strong></div>
        <div class="stat-box">Společní: <strong>${s.spolecny}</strong></div>
        <div class="stat-box">Pozváno (Celkem): <strong>${s.total}</strong></div>
        <div class="stat-box" style="background:#e8f5e9;">Potvrzeno: <strong style="color:#27ae60;">${s.confirmed}</strong></div>
        <div class="stat-box" style="background:#fce4e4;">Nezúčastní se: <strong style="color:#e74c3c;">${s.declined}</strong></div>
    `;
    html += `<div class="stat-box" style="grid-column: 1 / -1; text-align:left;"><strong>Hosté dle měst:</strong> `;
    let cityStrings = [];
    for (let [city, count] of Object.entries(s.cities)) { cityStrings.push(`${city} (${count}x)`); }
    html += cityStrings.join(', ') + `</div>`;
    document.getElementById('guestStatsBlock').innerHTML = html;

    let helperHtml = '';
    for (let [task, count] of Object.entries(s.tasks)) {
        helperHtml += `<div class="stat-box" style="flex:1; min-width:120px;">${task}<br><strong>${count} lidí</strong></div>`;
    }
    document.getElementById('helperStatsBlock').innerHTML = helperHtml;
}

function renderAccStats(accData) {
    let html = '';
    for (let [place, info] of Object.entries(accData)) {
        html += `
        <div class="stat-box stat-acc">
            ${place}<br>
            <strong>${info.guests} lidí</strong>
            <span style="font-size:0.85rem; color:#666;">(v ${info.rooms.size} pokojích)</span>
        </div>`;
    }
    document.getElementById('accStatsBlock').innerHTML = html;
}

// --- FILTRACE (Pokročilá pro hosty) ---
window.filterGuests = () => {
    // 1. Texty (rozdělení podle čárky)
    const nInput = document.getElementById('filterGuestName').value.toLowerCase().split(',').map(s=>s.trim()).filter(s=>s);
    const cInput = document.getElementById('filterGuestCity').value.toLowerCase().split(',').map(s=>s.trim()).filter(s=>s);
    // 2. Datum
    const dateInput = document.getElementById('filterGuestDate').value;
    // 3. Zaškrtávátka
    const sides = Array.from(document.querySelectorAll('.filter-side:checked')).map(cb=>cb.value);
    const statuses = Array.from(document.querySelectorAll('.filter-status:checked')).map(cb=>cb.value);
    
    const rows = document.getElementById('guestTableBody').getElementsByTagName('tr');
    for (let row of rows) {
        let nText = row.cells[0].innerText.toLowerCase();
        let cText = row.cells[1].innerText.toLowerCase();
        let sideText = row.cells[2].innerText;
        let statusText = row.cells[3].innerText; 
        
        let matchN = nInput.length === 0 || nInput.some(n => nText.includes(n));
        let matchC = cInput.length === 0 || cInput.some(c => cText.includes(c));
        let matchSide = sides.length === 0 || sides.some(s => sideText.includes(s));
        let matchStatus = statuses.length === 0 || statuses.some(s => statusText.includes(s));
        let matchDate = !dateInput || (row.dataset.date === dateInput);
        
        if (matchN && matchC && matchSide && matchStatus && matchDate) row.style.display = "";
        else row.style.display = "none";
    }
};

window.filterHelpers = () => {
    const n = document.getElementById('filterHelperName').value.toLowerCase();
    const t = document.getElementById('filterHelperTask').value.toLowerCase();
    const rows = document.getElementById('helperAssignedTableBody').getElementsByTagName('tr');
    for (let row of rows) {
        let textN = row.cells[0].innerText.toLowerCase();
        let textT = row.cells[1].getElementsByTagName('input')[0].value.toLowerCase();
        if (textN.includes(n) && textT.includes(t)) row.style.display = "";
        else row.style.display = "none";
    }
};

// --- AKCE TLAČÍTEK A SPRÁVA ---
document.getElementById('addBtn').onclick = () => {
    const val = document.getElementById('taskInput').value;
    if(val) addDoc(tasksColl, { text: val, note: '', completed: false, userId: auth.currentUser.uid });
    document.getElementById('taskInput').value = '';
};

document.getElementById('addGuestBtn').onclick = () => {
    const name = document.getElementById('guestName').value;
    if(name) {
        let isHelper = document.getElementById('isHelper').checked;
        let needsAcc = document.getElementById('needsAcc').checked;
        addDoc(guestsColl, { 
            name, city: document.getElementById('guestCity').value, side: document.getElementById('guestSide').value, 
            isHelper: isHelper, needsAcc: needsAcc, 
            status: 'Pozváno', 
            helperTask: '', helperStatus: isHelper ? 'assigned' : '', 
            accPlace: '', accRoom: '', accStatus: needsAcc ? 'assigned' : '', 
            userId: auth.currentUser.uid 
        });
        document.getElementById('guestName').value = ''; document.getElementById('guestCity').value = '';
        document.getElementById('isHelper').checked = false; document.getElementById('needsAcc').checked = false;
    }
};

document.getElementById('addBudgetBtn').onclick = () => {
    const name = document.getElementById('budgetItemName').value;
    const estimated = document.getElementById('budgetEstimated').value;
    if(name && estimated) addDoc(budgetColl, { name, estimated: Number(estimated), actual: 0, userId: auth.currentUser.uid });
    document.getElementById('budgetItemName').value = ''; document.getElementById('budgetEstimated').value = '';
};

// Globální funkce pro onchange/onclick
window.db = db; window.doc = doc; window.deleteDoc = deleteDoc; window.updateDoc = updateDoc;

window.toggleGuest = (id, s) => {
    let next = 'Pozváno';
    if (s === 'Pozváno') next = 'Potvrzeno';
    else if (s === 'Potvrzeno') next = 'Nezúčastní se';
    updateDoc(doc(db, 'hoste', id), { status: next });
};

window.assignHelper = (id, oldTask) => {
    let newTask = prompt("Potvrďte nebo upravte roli pomocníka:", oldTask);
    if (newTask !== null) updateDoc(doc(db, 'hoste', id), { helperTask: newTask, helperStatus: 'assigned' });
};

window.assignAcc = (id) => {
    let place = prompt("Zadejte místo ubytování (např. Penzion U Vody):");
    if (place !== null) {
        let room = prompt("Zadejte číslo pokoje (např. Pokoj 3):");
        if (room !== null) updateDoc(doc(db, 'hoste', id), { accPlace: place, accRoom: room, accStatus: 'assigned' });
    }
};

window.editTaskName = (id, oldText) => {
    let newText = prompt("Upravit úkol:", oldText);
    if (newText && newText.trim() !== "") updateDoc(doc(db, 'ukoly', id), { text: newText.trim() });
};

window.copyShareUrl = () => {
    const copyText = document.getElementById("shareUrlInput");
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value);
    alert("Odkaz byl zkopírován: " + copyText.value);
};

window.openEditModal = (id) => {
    const guest = currentGuests.find(g => g.id === id);
    if (!guest) return;
    document.getElementById('editGuestId').value = id;
    document.getElementById('editGuestName').value = guest.name;
    document.getElementById('editGuestCity').value = guest.city || '';
    document.getElementById('editGuestSide').value = guest.side;
    document.getElementById('editIsHelper').checked = guest.isHelper;
    document.getElementById('editNeedsAcc').checked = guest.needsAcc;
    document.getElementById('editModal').classList.remove('hidden');
};
window.closeModal = () => document.getElementById('editModal').classList.add('hidden');
window.saveGuestEdit = () => {
    const id = document.getElementById('editGuestId').value;
    updateDoc(doc(db, 'hoste', id), {
        name: document.getElementById('editGuestName').value,
        city: document.getElementById('editGuestCity').value,
        side: document.getElementById('editGuestSide').value,
        isHelper: document.getElementById('editIsHelper').checked,
        needsAcc: document.getElementById('editNeedsAcc').checked
    });
    closeModal();
};
