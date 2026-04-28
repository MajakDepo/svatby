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
    // 0. VYTVOŘENÍ ODKAZU PRO HOSTY (Zelený box)
    const guestSection = document.getElementById('guests');
    // Správné složení URL pro GitHub Pages
    let currentPath = window.location.pathname.replace('index.html', '');
    if (!currentPath.endsWith('/')) currentPath += '/';
    const shareUrl = window.location.origin + currentPath + 'formular.html?uid=' + uid;
    
    if(!document.getElementById('shareBox')) {
        const shareBox = document.createElement('div');
        shareBox.id = 'shareBox';
        shareBox.className = 'input-form-extended'; // Použijeme existující CSS třídu
        shareBox.style.background = '#e8f5e9';
        shareBox.style.borderColor = '#c8e6c9';
        shareBox.innerHTML = `
            <p><strong>Odkaz pro vaše hosty:</strong> Pošlete jim tento odkaz pro vyplnění účasti:</p>
            <div style="display:flex; gap:10px; width:100%;">
                <input type="text" readonly value="${shareUrl}" style="background:white; flex:1;">
                <button onclick="navigator.clipboard.writeText('${shareUrl}'); alert('Odkaz zkopírován do schránky!')">Kopírovat</button>
            </div>
        `;
        // Vložíme ho hned pod nadpis sekce hostů
        guestSection.insertBefore(shareBox, guestSection.children[1]);
    }

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

    // 2. HOSTÉ
    unsubs.push(onSnapshot(query(guestsColl, where("userId", "==", uid)), snap => {
        const gBody = document.getElementById('guestTableBody');
        const hBody = document.getElementById('helperTableBody');
        const aBody = document.getElementById('accTableBody');
        gBody.innerHTML = ''; hBody.innerHTML = ''; aBody.innerHTML = '';
        
        currentGuests = [];
        let stats = { total:0, confirmed:0, nevesta:0, zenich:0, spolecny:0, cities:{}, tasks:{} };

        snap.forEach(d => {
            const g = d.data(); g.id = d.id;
            currentGuests.push(g);

            stats.total++;
            if(g.status === 'Potvrzeno') stats.confirmed++;
            if(g.side === 'Nevěsta') stats.nevesta++;
            else if(g.side === 'Ženich') stats.zenich++;
            else stats.spolecny++;
            
            let city = g.city ? g.city.trim() : 'Nezadáno';
            stats.cities[city] = (stats.cities[city] || 0) + 1;

            const tr = document.createElement('tr');
            let colorClass = g.side === 'Nevěsta' ? 'side-nevesta' : (g.side === 'Ženich' ? 'side-zenich' : 'side-spolecny');
            tr.className = colorClass;
            tr.innerHTML = `
                <td><strong>${g.name}</strong><br><small style="color:#888">${g.submittedDate ? 'Z formuláře: '+g.submittedDate : ''}</small></td>
                <td>${g.city || '-'}</td>
                <td>${g.side}</td>
                <td style="cursor:pointer" onclick="toggleGuest('${g.id}','${g.status}')">${g.status === 'Potvrzeno' ? '✅ Potvrzeno' : '📩 Pozváno'}</td>
                <td>
                    <button class="btn-small btn-secondary" onclick="openEditModal('${g.id}')">✏️</button>
                    <button class="btn-small" onclick="deleteDoc(doc(db, 'hoste', '${g.id}'))">❌</button>
                </td>
            `;
            gBody.appendChild(tr);

            if (g.isHelper) {
                let taskName = g.helperTask ? g.helperTask.trim() : 'Zatím nepřiřazeno';
                stats.tasks[taskName] = (stats.tasks[taskName] || 0) + 1;
                const trH = document.createElement('tr');
                trH.innerHTML = `<td><strong>${g.name}</strong></td><td><input type="text" class="editable-input" value="${g.helperTask || ''}" onchange="updateDoc(doc(db, 'hoste', '${g.id}'), {helperTask: this.value})"></td>`;
                hBody.appendChild(trH);
            }

            if (g.needsAcc) {
                const trA = document.createElement('tr');
                trA.innerHTML = `
                    <td><strong>${g.name}</strong></td>
                    <td><input type="text" class="editable-input" value="${g.accPlace || ''}" onchange="updateDoc(doc(db, 'hoste', '${g.id}'), {accPlace: this.value})"></td>
                    <td><input type="text" class="editable-input" value="${g.accRoom || ''}" onchange="updateDoc(doc(db, 'hoste', '${g.id}'), {accRoom: this.value})"></td>
                `;
                aBody.appendChild(trA);
            }
        });
        renderGuestStats(stats);
    }));

    // 3. ROZPOČET
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
        <div class="stat-box">Pozváno: <strong>${s.total}</strong></div>
        <div class="stat-box">Potvrzeno: <strong>${s.confirmed}</strong></div>
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

// --- FILTRACE (DOM) ---
window.filterGuests = () => {
    const n = document.getElementById('filterGuestName').value.toLowerCase();
    const c = document.getElementById('filterGuestCity').value.toLowerCase();
    const si = document.getElementById('filterGuestSide').value.toLowerCase();
    const st = document.getElementById('filterGuestStatus').value.toLowerCase();
    
    const rows = document.getElementById('guestTableBody').getElementsByTagName('tr');
    for (let row of rows) {
        let textN = row.cells[0].innerText.toLowerCase();
        let textC = row.cells[1].innerText.toLowerCase();
        let textSi = row.cells[2].innerText.toLowerCase();
        let textSt = row.cells[3].innerText.toLowerCase();
        if (textN.includes(n) && textC.includes(c) && textSi.includes(si) && textSt.includes(st)) row.style.display = "";
        else row.style.display = "none";
    }
};

window.filterHelpers = () => {
    const n = document.getElementById('filterHelperName').value.toLowerCase();
    const t = document.getElementById('filterHelperTask').value.toLowerCase();
    const rows = document.getElementById('helperTableBody').getElementsByTagName('tr');
    for (let row of rows) {
        let textN = row.cells[0].innerText.toLowerCase();
        let textT = row.cells[1].getElementsByTagName('input')[0].value.toLowerCase();
        if (textN.includes(n) && textT.includes(t)) row.style.display = "";
        else row.style.display = "none";
    }
};

// --- AKCE TLAČÍTEK ---
document.getElementById('addBtn').onclick = () => {
    const val = document.getElementById('taskInput').value;
    if(val) addDoc(tasksColl, { text: val, note: '', completed: false, userId: auth.currentUser.uid });
    document.getElementById('taskInput').value = '';
};

document.getElementById('addGuestBtn').onclick = () => {
    const name = document.getElementById('guestName').value;
    if(name) {
        addDoc(guestsColl, { 
            name, city: document.getElementById('guestCity').value, side: document.getElementById('guestSide').value, 
            isHelper: document.getElementById('isHelper').checked, needsAcc: document.getElementById('needsAcc').checked, 
            status: 'Pozváno', helperTask: '', accPlace: '', accRoom: '', userId: auth.currentUser.uid 
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
window.toggleGuest = (id, s) => updateDoc(doc(db, 'hoste', id), { status: s === 'Pozváno' ? 'Potvrzeno' : 'Pozváno' });
window.editTaskName = (id, oldText) => {
    let newText = prompt("Upravit úkol:", oldText);
    if (newText && newText.trim() !== "") updateDoc(doc(db, 'ukoly', id), { text: newText.trim() });
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
