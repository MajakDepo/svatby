import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

const tasksColl = collection(db, "ukoly"), guestsColl = collection(db, "hoste"), budgetColl = collection(db, "rozpocet"), accColl = collection(db, "ubytovani_kapacity");
let unsubs = [];
let allGuestsData = []; 
let helperCategories = ['Pečení/Dorty', 'Výzdoba', 'Doprava', 'Koordinace', 'Hudba/Program'];
let accPlacesData = [];
let myUid = null;

// SPA Navigace
window.showPage = (pageId) => {
    document.querySelectorAll('.page-view').forEach(el => el.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
};

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
    let cp = window.location.pathname;
    if (cp.endsWith('index.html')) cp = cp.replace('index.html', '');
    if (!cp.endsWith('/')) cp += '/';
    document.getElementById('shareUrlInput').value = window.location.origin + cp + 'formular.html?uid=' + uid;

    // Nastavení (Kategorie pomocníků & Datum svatby)
    unsubs.push(onSnapshot(doc(db, "nastaveni", uid), (docSnap) => {
        if (docSnap.exists()) {
            if(docSnap.data().weddingDate) {
                document.getElementById('weddingDateInput').value = docSnap.data().weddingDate;
                updateCountdown();
            }
            if(docSnap.data().helperCategories) {
                helperCategories = docSnap.data().helperCategories;
            }
        }
        renderHelperCategoriesUI();
        if(allGuestsData.length > 0) renderHelpersView(); 
    }));

    // Kapacity ubytování
    unsubs.push(onSnapshot(query(accColl, where("userId", "==", uid)), snap => {
        accPlacesData = [];
        snap.forEach(d => { let p = d.data(); p.id = d.id; accPlacesData.push(p); });
        if(allGuestsData.length > 0) renderAccView();
    }));

    // Úkoly
    unsubs.push(onSnapshot(query(tasksColl, where("userId", "==", uid)), snap => {
        const list = document.getElementById('taskList'); list.innerHTML = '';
        snap.forEach(d => {
            const t = d.data();
            const li = document.createElement('li');
            if (t.completed) li.classList.add('completed');
            li.innerHTML = `<div class="task-main"><input type="checkbox" ${t.completed ? 'checked' : ''} onchange="updateDoc(doc(db, 'ukoly', '${d.id}'), {completed: this.checked})"><span class="task-text">${t.text}</span><div><button class="btn-small btn-secondary" onclick="editTaskName('${d.id}', '${t.text}')">✏️</button><button class="btn-small" onclick="deleteDoc(doc(db, 'ukoly', '${d.id}'))">❌</button></div></div><div class="task-note"><input type="text" placeholder="Přidat poznámku k úkolu..." value="${t.note || ''}" onchange="updateDoc(doc(db, 'ukoly', '${d.id}'), {note: this.value})"></div>`;
            list.appendChild(li);
        });
    }));

    // Hosté
    unsubs.push(onSnapshot(query(guestsColl, where("userId", "==", uid)), snap => {
        allGuestsData = [];
        snap.forEach(d => { let g = d.data(); g.id = d.id; allGuestsData.push(g); });
        
        updateDashboardStats();
        renderGuestsView();
        renderHelpersView();
        renderAccView();
    }));

    // Rozpočet
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

// --- DASHBOARD ---
function updateDashboardStats() {
    let totals = { guests: 0, confirmed: 0, helpers: 0, pendingHelpers: 0, accGuests: 0, pendingAcc: 0 };
    allGuestsData.forEach(g => {
        totals.guests++;
        if (g.status === 'Potvrzeno') totals.confirmed++;
        if (g.isHelper) { totals.helpers++; if (g.helperStatus === 'pending') totals.pendingHelpers++; }
        if (g.needsAcc) { totals.accGuests++; if (g.accStatus === 'pending') totals.pendingAcc++; }
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
    if(myUid && d) { setDoc(doc(db, "nastaveni", myUid), { weddingDate: d }, { merge: true }); }
};

function updateCountdown() {
    const dStr = document.getElementById('weddingDateInput').value;
    if (!dStr) return;
    const diffTime = Math.ceil((new Date(dStr) - new Date()) / (1000 * 60 * 60 * 24)); 
    document.getElementById('countdownDisplay').innerText = diffTime >= 0 ? `Už jen ${diffTime} dní! 🎉` : `Svatba už proběhla! ❤️`;
}

// --- HOSTÉ ---
window.renderGuestsView = () => {
    let filtered = [...allGuestsData];
    const nInput = document.getElementById('filterGuestName').value.toLowerCase().split(',').map(s=>s.trim()).filter(s=>s);
    const cInput = document.getElementById('filterGuestCity').value.toLowerCase().split(',').map(s=>s.trim()).filter(s=>s);
    const dateInput = document.getElementById('filterGuestDate').value;
    const sides = Array.from(document.querySelectorAll('.filter-side:checked')).map(cb=>cb.value);
    const statuses = Array.from(document.querySelectorAll('.filter-status:checked')).map(cb=>cb.value);
    const sortType = document.getElementById('sortGuestDate').value;

    filtered = filtered.filter(g => {
        let matchN = nInput.length === 0 || nInput.some(n => g.name.toLowerCase().includes(n));
        let matchC = cInput.length === 0 || cInput.some(c => (g.city||'').toLowerCase().includes(c));
        let matchSide = sides.length === 0 || sides.includes(g.side);
        let matchStatus = statuses.length === 0 || statuses.includes(g.status);
        let matchDate = !dateInput || (g.submittedDate && g.submittedDate.startsWith(dateInput));
        return matchN && matchC && matchSide && matchStatus && matchDate;
    });

    filtered.sort((a, b) => {
        if (sortType === 'name') return a.name.localeCompare(b.name);
        let dateA = a.submittedDate ? new Date(a.submittedDate).getTime() : 0;
        let dateB = b.submittedDate ? new Date(b.submittedDate).getTime() : 0;
        return sortType === 'desc' ? dateB - dateA : dateA - dateB;
    });

    let stats = { total:0, confirmed:0, nevesta:0, zenich:0, spolecny:0, cities:{} };
    const tbody = document.getElementById('guestTableBody'); tbody.innerHTML = '';
    
    filtered.forEach(g => {
        stats.total++;
        if(g.status === 'Potvrzeno') stats.confirmed++;
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

    let cityHtml = '<strong>Hosté z měst:</strong><br>';
    for (let [city, count] of Object.entries(stats.cities)) cityHtml += `<div class="city-badge">${city} <span>(${count}x)</span></div>`;
    document.getElementById('cityBadgesContainer').innerHTML = cityHtml;

    document.getElementById('guestStatsBlock').innerHTML = `
        <div class="stat-box">Nevěsta: <strong>${stats.nevesta}</strong></div>
        <div class="stat-box">Ženich: <strong>${stats.zenich}</strong></div>
        <div class="stat-box">Společní: <strong>${stats.spolecny}</strong></div>
        <div class="stat-box">Zobrazeno: <strong>${stats.total}</strong></div>
        <div class="stat-box" style="background:#e8f5e9;">Potvrzeno: <strong style="color:#27ae60;">${stats.confirmed}</strong></div>
    `;
};

// --- POMOCNÍCI ---
function renderHelperCategoriesUI() {
    let html = '';
    helperCategories.forEach(c => html += `<span class="city-badge">${c} <button class="btn-small btn-secondary" style="margin-left:5px; padding:0 4px;" onclick="removeHelperCategory('${c}')">x</button></span>`);
    document.getElementById('categoryTagsContainer').innerHTML = html;
}

window.addHelperCategory = () => {
    const val = document.getElementById('newCategoryInput').value.trim();
    if(val && !helperCategories.includes(val)) {
        helperCategories.push(val);
        setDoc(doc(db, "nastaveni", myUid), { helperCategories }, { merge: true });
        document.getElementById('newCategoryInput').value = '';
    }
};
window.removeHelperCategory = (cat) => {
    helperCategories = helperCategories.filter(c => c !== cat);
    setDoc(doc(db, "nastaveni", myUid), { helperCategories }, { merge: true });
};

window.renderHelpersView = () => {
    const hPending = document.getElementById('helperPendingTableBody'); hPending.innerHTML = '';
    const hAssigned = document.getElementById('helperAssignedTableBody'); hAssigned.innerHTML = '';
    let tasksStats = {};

    // Předgenerování Select boxu pro úpravu před schválením
    let selectHtmlOptions = `<option value="">-- Vyberte nebo napište --</option>`;
    helperCategories.forEach(c => selectHtmlOptions += `<option value="${c}">${c}</option>`);

    allGuestsData.filter(g => g.isHelper).forEach(g => {
        if (g.helperStatus === 'pending') {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${g.name}</strong><br><small style="color:#888;">Z formuláře: ${g.helperTask || 'Nic nezaškrtnuto'}</small></td>
                <td>
                    <select id="pendingHelperCat_${g.id}" style="width:100%; margin-bottom:5px;">${selectHtmlOptions}</select>
                    <input type="text" id="pendingHelperTxt_${g.id}" class="editable-input" placeholder="Nebo napište vlastní..." value="${g.helperTask || ''}">
                </td>
                <td><button class="btn-small" onclick="approveHelper('${g.id}')">Uložit & Schválit</button></td>
            `;
            hPending.appendChild(tr);
        } else {
            // Rozdělení rolí oddělených čárkou do nezávislých počítadel
            let tArray = (g.helperTask ? g.helperTask : 'Nepřiřazeno').split(',').map(s => s.trim()).filter(s => s);
            if(tArray.length === 0) tArray = ['Nepřiřazeno'];
            tArray.forEach(t => { tasksStats[t] = (tasksStats[t] || 0) + 1; });

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${g.name}</strong></td>
                <td style="display:flex; gap:5px;">
                    <select class="editable-input" onchange="updateDoc(doc(db, 'hoste', '${g.id}'), {helperTask: this.value})">
                        <option value="${g.helperTask}">${g.helperTask}</option>
                        ${helperCategories.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </td>
                <td><button class="btn-small btn-secondary" onclick="updateDoc(doc(db, 'hoste', '${g.id}'), {helperStatus: 'pending'})">Zpět k rozřazení</button></td>
            `;
            hAssigned.appendChild(tr);
        }
    });

    let hHtml = '';
    for (let [task, count] of Object.entries(tasksStats)) hHtml += `<div class="helper-stat-box">${task} <strong>${count}x</strong></div>`;
    document.getElementById('helperStatsBlock').innerHTML = hHtml;
};

window.approveHelper = (id) => {
    let sel = document.getElementById(`pendingHelperCat_${id}`).value;
    let txt = document.getElementById(`pendingHelperTxt_${id}`).value;
    let finalTask = sel ? (txt ? sel + ", " + txt : sel) : txt;
    updateDoc(doc(db, 'hoste', id), { helperTask: finalTask, helperStatus: 'assigned' });
};

// --- UBYTOVÁNÍ (Kapacity a přiřazování) ---
window.addAccPlace = () => {
    const name = document.getElementById('newPlaceName').value.trim();
    const roomsInput = document.getElementById('newPlaceRooms').value.trim(); // "5x Dvoulůžkový, 2x Jednolůžkový"
    if(!name) return;

    let generatedRooms = [];
    if(roomsInput) {
        // Parser (Rozpozná číslo x Název)
        const parts = roomsInput.split(',');
        parts.forEach(part => {
            const match = part.trim().match(/^(\d+)[xX]\s+(.+)$/);
            if(match) {
                let count = parseInt(match[1]);
                let type = match[2];
                for(let i=1; i<=count; i++) generatedRooms.push(`${type} ${i}`);
            } else if(part.trim() !== '') {
                generatedRooms.push(part.trim());
            }
        });
    }

    addDoc(accColl, { name: name, rooms: generatedRooms, userId: myUid });
    document.getElementById('newPlaceName').value = '';
    document.getElementById('newPlaceRooms').value = '';
};

window.renderAccView = () => {
    // 1. Zobrazení nastavení místností
    const placesCont = document.getElementById('accPlacesContainer'); placesCont.innerHTML = '';
    let selectPlacesHtml = `<option value="">-- Vyberte místo --</option>`;
    
    // Zjistíme, kdo kde bydlí (abychom ukázali obsazenost)
    let occupancy = {};
    allGuestsData.forEach(g => {
        if(g.needsAcc && g.accStatus === 'assigned' && g.accPlace) {
            if(!occupancy[g.accPlace]) occupancy[g.accPlace] = {};
            if(g.accRoom) {
                if(!occupancy[g.accPlace][g.accRoom]) occupancy[g.accPlace][g.accRoom] = [];
                occupancy[g.accPlace][g.accRoom].push(g.name);
            }
        }
    });

    accPlacesData.forEach(p => {
        selectPlacesHtml += `<option value="${p.id}">${p.name}</option>`;
        let rHtml = '';
        p.rooms.forEach(r => {
            let occ = (occupancy[p.name] && occupancy[p.name][r]) ? occupancy[p.name][r] : [];
            let classes = occ.length > 0 ? 'room-tag full' : 'room-tag';
            let title = occ.length > 0 ? `Obsazeno: ${occ.join(', ')}` : 'Volné';
            rHtml += `<span class="${classes}" title="${title}">${r}</span>`;
        });
        placesCont.innerHTML += `
            <div class="acc-place-card">
                <h4>${p.name} <button class="btn-small btn-secondary" onclick="deleteDoc(doc(db, 'ubytovani_kapacity', '${p.id}'))">Smazat místo</button></h4>
                <div>${rHtml || '<i>Žádné pokoje nezadány</i>'}</div>
            </div>`;
    });

    // 2. Čekající hosté - S chytrou roletkou
    const aPending = document.getElementById('accPendingTableBody'); aPending.innerHTML = '';
    allGuestsData.filter(g => g.needsAcc && g.accStatus === 'pending').forEach(g => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${g.name}</strong></td>
            <td>${g.accRoom || 'Zatím bez požadavku'}</td>
            <td>
                <select id="selPlace_${g.id}" style="width:100%; margin-bottom:5px;" onchange="loadRoomsForSelect('${g.id}', this.value)">
                    ${selectPlacesHtml}
                </select>
                <select id="selRoom_${g.id}" style="width:100%; display:none;">
                    <option value="">-- Nejdřív vyberte místo --</option>
                </select>
            </td>
            <td><button class="btn-small" onclick="approveAcc('${g.id}')">Schválit ubytování</button></td>
        `;
        aPending.appendChild(tr);
    });

    // 3. Schválení hosté
    const aAssigned = document.getElementById('accAssignedTableBody'); aAssigned.innerHTML = '';
    allGuestsData.filter(g => g.needsAcc && g.accStatus === 'assigned').forEach(g => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${g.name}</strong></td><td>${g.accPlace}</td><td>${g.accRoom}</td>
                        <td><button class="btn-small btn-secondary" onclick="updateDoc(doc(db, 'hoste', '${g.id}'), {accStatus: 'pending', accPlace:'', accRoom:''})">Zrušit přiřazení</button></td>`;
        aAssigned.appendChild(tr);
    });
};

// Funkce, která dynamicky naplní druhý select box pokoji z vybraného místa
window.loadRoomsForSelect = (guestId, placeId) => {
    const roomSelect = document.getElementById(`selRoom_${guestId}`);
    if(!placeId) { roomSelect.style.display = 'none'; return; }
    
    const place = accPlacesData.find(p => p.id === placeId);
    if(place) {
        let html = `<option value="">-- Vyberte pokoj --</option>`;
        place.rooms.forEach(r => html += `<option value="${r}">${r}</option>`);
        roomSelect.innerHTML = html;
        roomSelect.style.display = 'block';
    }
};

window.approveAcc = (guestId) => {
    const placeId = document.getElementById(`selPlace_${guestId}`).value;
    const room = document.getElementById(`selRoom_${guestId}`).value;
    
    if(!placeId) { alert("Musíte vybrat ubytovací místo!"); return; }
    const placeName = accPlacesData.find(p => p.id === placeId).name;
    
    updateDoc(doc(db, 'hoste', guestId), { accPlace: placeName, accRoom: room || '', accStatus: 'assigned' });
};

// --- AKCE OSTATNÍ (Hosté přidání atd.) ---
document.getElementById('addBtn').onclick = () => {
    const val = document.getElementById('taskInput').value;
    if(val) addDoc(tasksColl, { text: val, note: '', completed: false, userId: myUid });
    document.getElementById('taskInput').value = '';
};
document.getElementById('addGuestBtn').onclick = () => {
    const name = document.getElementById('guestName').value;
    if(name) {
        let isH = document.getElementById('isHelper').checked; let needsA = document.getElementById('needsAcc').checked;
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

window.db = db; window.doc = doc; window.deleteDoc = deleteDoc; window.updateDoc = updateDoc;
window.toggleGuest = (id, s) => {
    let next = 'Pozváno'; if (s === 'Pozváno') next = 'Potvrzeno'; else if (s === 'Potvrzeno') next = 'Nezúčastní se';
    updateDoc(doc(db, 'hoste', id), { status: next });
};
window.editTaskName = (id, oldText) => {
    let newText = prompt("Upravit úkol:", oldText);
    if (newText && newText.trim() !== "") updateDoc(doc(db, 'ukoly', id), { text: newText.trim() });
};
window.copyShareUrl = () => {
    const copyText = document.getElementById("shareUrlInput");
    copyText.select(); navigator.clipboard.writeText(copyText.value);
    alert("Odkaz zkopírován!");
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
        name: document.getElementById('editGuestName').value, city: document.getElementById('editGuestCity').value,
        side: document.getElementById('editGuestSide').value, isHelper: document.getElementById('editIsHelper').checked,
        needsAcc: document.getElementById('editNeedsAcc').checked
    });
    closeModal();
};
