import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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
let allGuestsData = []; // Zde držíme všechna data pro filtraci
let myUid = null;

// --- Navigace (SPA) ---
window.showPage = (pageId) => {
    document.querySelectorAll('.page-view').forEach(el => el.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
};

// --- AUTH ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        myUid = user.uid;
        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('appSection').classList.remove('hidden');
        showPage('dashboard');
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
    // Generování odkazu
    let currentPath = window.location.pathname;
    if (currentPath.endsWith('index.html')) currentPath = currentPath.replace('index.html', '');
    if (!currentPath.endsWith('/')) currentPath += '/';
    document.getElementById('shareUrlInput').value = window.location.origin + currentPath + 'formular.html?uid=' + uid;

    // Načtení data svatby (Odpočet)
    getDoc(doc(db, "nastaveni", uid)).then(docSnap => {
        if (docSnap.exists() && docSnap.data().weddingDate) {
            document.getElementById('weddingDateInput').value = docSnap.data().weddingDate;
            updateCountdown();
        }
    });

    // 1. ÚKOLY
    unsubs.push(onSnapshot(query(tasksColl, where("userId", "==", uid)), snap => {
        const list = document.getElementById('taskList'); list.innerHTML = '';
        snap.forEach(d => {
            const t = d.data(); const id = d.id;
            const li = document.createElement('li');
            if (t.completed) li.classList.add('completed');
            li.innerHTML = `<div class="task-main"><input type="checkbox" ${t.completed ? 'checked' : ''} onchange="updateDoc(doc(db, 'ukoly', '${id}'), {completed: this.checked})"><span class="task-text">${t.text}</span><div><button class="btn-small btn-secondary" onclick="editTaskName('${id}', '${t.text}')">✏️</button><button class="btn-small" onclick="deleteDoc(doc(db, 'ukoly', '${id}'))">❌</button></div></div><div class="task-note"><input type="text" placeholder="Přidat poznámku k úkolu..." value="${t.note || ''}" onchange="updateDoc(doc(db, 'ukoly', '${id}'), {note: this.value})"></div>`;
            list.appendChild(li);
        });
    }));

    // 2. HOSTÉ (Stáhne do paměti a zavolá renderovací funkce pro všechny sekce)
    unsubs.push(onSnapshot(query(guestsColl, where("userId", "==", uid)), snap => {
        allGuestsData = [];
        snap.forEach(d => { let g = d.data(); g.id = d.id; allGuestsData.push(g); });
        
        updateDashboardStats();
        renderGuestsView();
        renderHelpersView();
        renderAccView();
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

// --- LOGIKA DASHBOARDU ---
function updateDashboardStats() {
    let totals = { guests: 0, confirmed: 0, helpers: 0, pendingHelpers: 0, accGuests: 0, pendingAcc: 0 };
    allGuestsData.forEach(g => {
        totals.guests++;
        if (g.status === 'Potvrzeno') totals.confirmed++;
        if (g.isHelper) {
            totals.helpers++;
            if (g.helperStatus === 'pending') totals.pendingHelpers++;
        }
        if (g.needsAcc) {
            totals.accGuests++;
            if (g.accStatus === 'pending') totals.pendingAcc++;
        }
    });
    document.getElementById('dashTotalGuests').innerText = totals.guests;
    document.getElementById('dashConfirmedGuests').innerText = totals.confirmed;
    document.getElementById('dashTotalHelpers').innerText = totals.helpers;
    document.getElementById('dashPendingHelpers').innerText = totals.pendingHelpers;
    document.getElementById('dashTotalAcc').innerText = totals.accGuests;
    document.getElementById('dashPendingAcc').innerText = totals.pendingAcc;
}

window.saveWeddingDate = () => {
    const d = document.getElementById('weddingDateInput').value;
    if(myUid && d) { setDoc(doc(db, "nastaveni", myUid), { weddingDate: d }, { merge: true }); updateCountdown(); }
};

function updateCountdown() {
    const dStr = document.getElementById('weddingDateInput').value;
    if (!dStr) return;
    const diffTime = Math.abs(new Date(dStr) - new Date());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    document.getElementById('countdownDisplay').innerText = `Už jen ${diffDays} dní! 🎉`;
}

// --- VYKRESLOVÁNÍ HOSTŮ (s řazením a filtrem) ---
window.renderGuestsView = () => {
    let filtered = [...allGuestsData];
    
    // Čtení filtrů
    const nInput = document.getElementById('filterGuestName').value.toLowerCase().split(',').map(s=>s.trim()).filter(s=>s);
    const cInput = document.getElementById('filterGuestCity').value.toLowerCase().split(',').map(s=>s.trim()).filter(s=>s);
    const dateInput = document.getElementById('filterGuestDate').value;
    const sides = Array.from(document.querySelectorAll('.filter-side:checked')).map(cb=>cb.value);
    const statuses = Array.from(document.querySelectorAll('.filter-status:checked')).map(cb=>cb.value);
    const sortType = document.getElementById('sortGuestDate').value;

    // Filtrování
    filtered = filtered.filter(g => {
        let matchN = nInput.length === 0 || nInput.some(n => g.name.toLowerCase().includes(n));
        let matchC = cInput.length === 0 || cInput.some(c => (g.city||'').toLowerCase().includes(c));
        let matchSide = sides.length === 0 || sides.includes(g.side);
        let matchStatus = statuses.length === 0 || statuses.includes(g.status);
        let matchDate = !dateInput || (g.submittedDate && g.submittedDate.startsWith(dateInput));
        return matchN && matchC && matchSide && matchStatus && matchDate;
    });

    // Řazení
    filtered.sort((a, b) => {
        if (sortType === 'name') return a.name.localeCompare(b.name);
        let dateA = a.submittedDate ? new Date(a.submittedDate).getTime() : 0;
        let dateB = b.submittedDate ? new Date(b.submittedDate).getTime() : 0;
        return sortType === 'desc' ? dateB - dateA : dateA - dateB;
    });

    // Statistiky
    let stats = { total:0, confirmed:0, declined:0, nevesta:0, zenich:0, spolecny:0, cities:{} };
    const tbody = document.getElementById('guestTableBody'); tbody.innerHTML = '';
    
    filtered.forEach(g => {
        stats.total++;
        if(g.status === 'Potvrzeno') stats.confirmed++;
        if(g.status === 'Nezúčastní se') stats.declined++;
        if(g.side === 'Nevěsta') stats.nevesta++; else if(g.side === 'Ženich') stats.zenich++; else stats.spolecny++;
        
        let city = g.city ? g.city.trim() : 'Nezadáno';
        stats.cities[city] = (stats.cities[city] || 0) + 1;

        let displayDate = g.submittedDate ? new Date(g.submittedDate).toLocaleDateString('cs-CZ') : '';
        let statusHtml = g.status === 'Potvrzeno' ? '✅ Potvrzeno' : (g.status === 'Nezúčastní se' ? '<span class="status-declined">❌ Nezúčastní se</span>' : '📩 Pozváno');
        
        const tr = document.createElement('tr');
        tr.className = g.side === 'Nevěsta' ? 'side-nevesta' : (g.side === 'Ženich' ? 'side-zenich' : 'side-spolecny');
        tr.innerHTML = `<td><strong>${g.name}</strong><br><small style="color:#888">${displayDate}</small></td><td>${g.city || '-'}</td><td>${g.side}</td><td style="cursor:pointer" onclick="toggleGuest('${g.id}','${g.status}')">${statusHtml}</td><td><button class="btn-small btn-secondary" onclick="openEditModal('${g.id}')">✏️</button> <button class="btn-small" onclick="deleteDoc(doc(db, 'hoste', '${g.id}'))">❌</button></td>`;
        tbody.appendChild(tr);
    });

    // Vykreslení Měst (Grafické štítky)
    let cityHtml = '<strong>Hosté z měst:</strong><br>';
    for (let [city, count] of Object.entries(stats.cities)) {
        cityHtml += `<div class="city-badge">${city} <span>(${count}x)</span></div>`;
    }
    document.getElementById('cityBadgesContainer').innerHTML = cityHtml;

    document.getElementById('guestStatsBlock').innerHTML = `
        <div class="stat-box">Nevěsta: <strong>${stats.nevesta}</strong></div>
        <div class="stat-box">Ženich: <strong>${stats.zenich}</strong></div>
        <div class="stat-box">Společní: <strong>${stats.spolecny}</strong></div>
        <div class="stat-box">Zobrazeno: <strong>${stats.total}</strong></div>
        <div class="stat-box" style="background:#e8f5e9;">Potvrzeno: <strong style="color:#27ae60;">${stats.confirmed}</strong></div>
    `;
};

// --- VYKRESLOVÁNÍ POMOCNÍKŮ ---
window.renderHelpersView = () => {
    const nInput = document.getElementById('filterHelperName').value.toLowerCase();
    const tInput = document.getElementById('filterHelperTask').value.toLowerCase();
    
    const hPending = document.getElementById('helperPendingTableBody'); hPending.innerHTML = '';
    const hAssigned = document.getElementById('helperAssignedTableBody'); hAssigned.innerHTML = '';
    let tasksStats = {};

    allGuestsData.filter(g => g.isHelper).forEach(g => {
        let matchN = g.name.toLowerCase().includes(nInput);
        let matchT = (g.helperTask||'').toLowerCase().includes(tInput);

        if (g.helperStatus === 'pending') {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><strong>${g.name}</strong></td><td>${g.helperTask || 'Nezadáno'}</td><td><button class="btn-small" onclick="assignHelper('${g.id}', '${g.helperTask}')">Přiřadit</button></td>`;
            hPending.appendChild(tr);
        } else if (matchN && matchT) {
            let tName = g.helperTask ? g.helperTask.trim() : 'Nepřiřazeno';
            tasksStats[tName] = (tasksStats[tName] || 0) + 1;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><strong>${g.name}</strong></td><td><input type="text" class="editable-input" value="${g.helperTask || ''}" onchange="updateDoc(doc(db, 'hoste', '${g.id}'), {helperTask: this.value})"></td>`;
            hAssigned.appendChild(tr);
        }
    });

    let hHtml = '';
    for (let [task, count] of Object.entries(tasksStats)) hHtml += `<div class="stat-box" style="flex:1; min-width:120px;">${task}<br><strong>${count} lidí</strong></div>`;
    document.getElementById('helperStatsBlock').innerHTML = hHtml;
};

// --- VYKRESLOVÁNÍ UBYTOVÁNÍ (s filtrováním) ---
window.renderAccView = () => {
    const nInput = document.getElementById('filterAccName').value.toLowerCase();
    const pInput = document.getElementById('filterAccPlace').value.toLowerCase();
    const rInput = document.getElementById('filterAccRoom').value.toLowerCase();

    const aPending = document.getElementById('accPendingTableBody'); aPending.innerHTML = '';
    const aAssigned = document.getElementById('accAssignedTableBody'); aAssigned.innerHTML = '';
    let accStats = {};

    allGuestsData.filter(g => g.needsAcc).forEach(g => {
        let matchN = g.name.toLowerCase().includes(nInput);
        let matchP = (g.accPlace||'').toLowerCase().includes(pInput);
        let matchR = (g.accRoom||'').toLowerCase().includes(rInput);

        if (g.accStatus === 'pending') {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><strong>${g.name}</strong></td><td>${g.accRoom || 'Zatím bez požadavku'}</td><td><button class="btn-small" onclick="assignAcc('${g.id}')">Přiřadit</button></td>`;
            aPending.appendChild(tr);
        } else if (matchN && matchP && matchR) {
            let place = g.accPlace ? g.accPlace.trim() : 'Nepřiřazeno';
            if (!accStats[place]) accStats[place] = { guests: 0, rooms: new Set() };
            accStats[place].guests++;
            if (g.accRoom) accStats[place].rooms.add(g.accRoom.trim());

            const tr = document.createElement('tr');
            tr.innerHTML = `<td><strong>${g.name}</strong></td><td><input type="text" class="editable-input" value="${g.accPlace || ''}" onchange="updateDoc(doc(db, 'hoste', '${g.id}'), {accPlace: this.value})"></td><td><input type="text" class="editable-input" value="${g.accRoom || ''}" onchange="updateDoc(doc(db, 'hoste', '${g.id}'), {accRoom: this.value})"></td><td><button class="btn-small btn-secondary" onclick="updateDoc(doc(db, 'hoste', '${g.id}'), {accStatus: 'pending'})">Zpět do čekačky</button></td>`;
            aAssigned.appendChild(tr);
        }
    });

    let aHtml = '';
    for (let [place, info] of Object.entries(accStats)) {
        aHtml += `<div class="stat-box stat-acc">${place}<br><strong>${info.guests} lidí</strong><span style="font-size:0.85rem; color:#666;">(v ${info.rooms.size} pokojích)</span></div>`;
    }
    document.getElementById('accStatsBlock').innerHTML = aHtml;
};

// --- AKCE (Přidávání, Editace) ---
document.getElementById('addBtn').onclick = () => {
    const val = document.getElementById('taskInput').value;
    if(val) addDoc(tasksColl, { text: val, note: '', completed: false, userId: myUid });
    document.getElementById('taskInput').value = '';
};

document.getElementById('addGuestBtn').onclick = () => {
    const name = document.getElementById('guestName').value;
    if(name) {
        let isH = document.getElementById('isHelper').checked;
        let needsA = document.getElementById('needsAcc').checked;
        addDoc(guestsColl, { 
            name, city: document.getElementById('guestCity').value, side: document.getElementById('guestSide').value, 
            isHelper: isH, needsAcc: needsA, status: 'Pozváno', 
            helperTask: '', helperStatus: isH ? 'assigned' : '', 
            accPlace: '', accRoom: '', accStatus: needsA ? 'assigned' : '', 
            userId: myUid, submittedDate: new Date().toISOString()
        });
        document.getElementById('guestName').value = ''; document.getElementById('guestCity').value = '';
        document.getElementById('isHelper').checked = false; document.getElementById('needsAcc').checked = false;
    }
};

document.getElementById('addBudgetBtn').onclick = () => {
    const name = document.getElementById('budgetItemName').value;
    const estimated = document.getElementById('budgetEstimated').value;
    if(name && estimated) addDoc(budgetColl, { name, estimated: Number(estimated), actual: 0, userId: myUid });
    document.getElementById('budgetItemName').value = ''; document.getElementById('budgetEstimated').value = '';
};

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
    let place = prompt("Zadejte místo ubytování:");
    if (place !== null) {
        let room = prompt("Zadejte číslo pokoje:");
        if (room !== null) updateDoc(doc(db, 'hoste', id), { accPlace: place, accRoom: room, accStatus: 'assigned' });
    }
};

window.editTaskName = (id, oldText) => {
    let newText = prompt("Upravit úkol:", oldText);
    if (newText && newText.trim() !== "") updateDoc(doc(db, 'ukoly', id), { text: newText.trim() });
};

window.copyShareUrl = () => {
    const copyText = document.getElementById("shareUrlInput");
    copyText.select(); navigator.clipboard.writeText(copyText.value);
    alert("Odkaz byl zkopírován!");
};

window.openEditModal = (id) => {
    const guest = allGuestsData.find(g => g.id === id);
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
