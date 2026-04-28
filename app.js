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
let allBudgetData = [];
let helperCategories = ['Pečení/Dorty', 'Výzdoba', 'Doprava', 'Koordinace', 'Hudba/Program'];
let activeHelperFilters = []; // Aktivní bubliny filtru
let accPlacesData = [];
let myUid = null;

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

    unsubs.push(onSnapshot(doc(db, "nastaveni", uid), (docSnap) => {
        if (docSnap.exists()) {
            if(docSnap.data().weddingDate) {
                document.getElementById('weddingDateInput').value = docSnap.data().weddingDate;
                updateCountdown();
            }
            if(docSnap.data().helperCategories) helperCategories = docSnap.data().helperCategories;
        }
        renderHelperCategoriesUI();
        if(allGuestsData.length > 0) renderHelpersView(); 
    }));

    unsubs.push(onSnapshot(query(accColl, where("userId", "==", uid)), snap => {
        accPlacesData = [];
        snap.forEach(d => { let p = d.data(); p.id = d.id; accPlacesData.push(p); });
        if(allGuestsData.length > 0) renderAccView();
    }));

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

    unsubs.push(onSnapshot(query(guestsColl, where("userId", "==", uid)), snap => {
        allGuestsData = [];
        snap.forEach(d => { let g = d.data(); g.id = d.id; allGuestsData.push(g); });
        updateDashboardStats(); renderGuestsView(); renderHelpersView(); renderAccView();
    }));

    unsubs.push(onSnapshot(query(budgetColl, where("userId", "==", uid)), snap => {
        allBudgetData = [];
        snap.forEach(d => { let b = d.data(); b.id = d.id; allBudgetData.push(b); });
        renderBudgetView();
    }));
}

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

window.toggleHelperFilter = (cat) => {
    if(activeHelperFilters.includes(cat)) activeHelperFilters = activeHelperFilters.filter(c => c !== cat);
    else activeHelperFilters.push(cat);
    renderHelpersView();
};

window.updateHelperTasksFromCb = (guestId) => {
    let cbs = document.querySelectorAll(`.cb-help-${guestId}:checked`);
    let vals = Array.from(cbs).map(cb => cb.value).join(', ');
    updateDoc(doc(db, 'hoste', guestId), { helperTask: vals });
};

window.renderHelpersView = () => {
    const hPending = document.getElementById('helperPendingTableBody'); hPending.innerHTML = '';
    const hAssigned = document.getElementById('helperAssignedTableBody'); hAssigned.innerHTML = '';
    let tasksStats = {};

    allGuestsData.filter(g => g.isHelper).forEach(g => {
        // Generování zaškrtávátek pro tohoto hosta
        let checkboxesHtml = helperCategories.map(c => {
            let checked = (g.helperTask || '').includes(c) ? 'checked' : '';
            return `<label style="display:inline-block; margin-right:8px; font-size:0.85rem;"><input type="checkbox" value="${c}" ${checked} class="cb-help-${g.id}" onchange="updateHelperTasksFromCb('${g.id}')"> ${c}</label>`;
        }).join('');

        if (g.helperStatus === 'pending') {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${g.name}</strong><br><small style="color:#888;">Napsal z formuláře: ${g.helperTask || 'Nic nezaškrtnuto'}</small></td>
                <td><div style="background:#f9f9f9; padding:10px; border-radius:8px;">${checkboxesHtml}</div></td>
                <td><button class="btn-small" onclick="updateDoc(doc(db, 'hoste', '${g.id}'), {helperStatus: 'assigned'})">Schválit role</button></td>
            `;
            hPending.appendChild(tr);
        } else {
            let tArray = (g.helperTask ? g.helperTask : 'Nepřiřazeno').split(',').map(s => s.trim()).filter(s => s);
            if(tArray.length === 0) tArray = ['Nepřiřazeno'];
            tArray.forEach(t => { tasksStats[t] = (tasksStats[t] || 0) + 1; });

            // Aplikace filtru přes klikací bubliny
            let showRow = activeHelperFilters.length === 0 || activeHelperFilters.some(f => tArray.includes(f));
            
            if (showRow) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${g.name}</strong></td>
                    <td>${checkboxesHtml}</td>
                    <td><button class="btn-small btn-secondary" onclick="updateDoc(doc(db, 'hoste', '${g.id}'), {helperStatus: 'pending'})">Zpět k rozřazení</button></td>
                `;
                hAssigned.appendChild(tr);
            }
        }
    });

    let hHtml = '';
    for (let [task, count] of Object.entries(tasksStats)) {
        let activeClass = activeHelperFilters.includes(task) ? 'active' : '';
        hHtml += `<div class="helper-stat-box ${activeClass}" onclick="toggleHelperFilter('${task}')">${task} <strong>${count}x</strong></div>`;
    }
    document.getElementById('helperStatsBlock').innerHTML = hHtml;
};

// --- UBYTOVÁNÍ (Chytré kapacity) ---
// Funkce na zjištění kapacity pokoje z jeho názvu
function getRoomCapacity(name) {
    let n = name.toLowerCase();
    if(n.includes('jedno')) return 1; if(n.includes('dvou')) return 2;
    if(n.includes('tří') || n.includes('tri')) return 3;
    if(n.includes('čtyř') || n.includes('ctyr')) return 4;
    if(n.includes('pěti') || n.includes('peti')) return 5;
    if(n.includes('šesti') || n.includes('sesti')) return 6;
    let m = n.match(/(\d+)/);
    if(m) return parseInt(m[1]);
    return 2; // Výchozí
}

window.addAccPlace = () => {
    const name = document.getElementById('newPlaceName').value.trim();
    const roomsInput = document.getElementById('newPlaceRooms').value.trim();
    if(!name) return;

    let generatedRooms = [];
    if(roomsInput) {
        const parts = roomsInput.split(',');
        parts.forEach(part => {
            const match = part.trim().match(/^(\d+)[xX]\s+(.+)$/);
            if(match) {
                let count = parseInt(match[1]); let type = match[2];
                for(let i=1; i<=count; i++) generatedRooms.push(`${type} ${i}`);
            } else if(part.trim() !== '') generatedRooms.push(part.trim());
        });
    }
    addDoc(accColl, { name: name, rooms: generatedRooms, userId: myUid });
    document.getElementById('newPlaceName').value = ''; document.getElementById('newPlaceRooms').value = '';
};

window.renderAccView = () => {
    const placesCont = document.getElementById('accPlacesContainer'); placesCont.innerHTML = '';
    let selectPlacesHtml = `<option value="">-- Vyberte místo --</option>`;
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
            let cap = getRoomCapacity(r);
            let classes = 'room-tag';
            let title = `Kapacita: ${cap}. Volno.`;

            if (occ.length > 0 && occ.length < cap) {
                classes = 'room-tag partial'; title = `Obsazeno ${occ.length}/${cap}: ${occ.join(', ')}`;
            } else if (occ.length >= cap) {
                classes = 'room-tag full'; title = `PLNĚ OBSAZENO: ${occ.join(', ')}`;
            }
            rHtml += `<span class="${classes}" title="${title}">${r}</span>`;
        });
        placesCont.innerHTML += `<div class="acc-place-card"><h4>${p.name} <button class="btn-small btn-secondary" onclick="deleteDoc(doc(db, 'ubytovani_kapacity', '${p.id}'))">Smazat místo</button></h4><div>${rHtml || '<i>Žádné pokoje nezadány</i>'}</div></div>`;
    });

    const aPending = document.getElementById('accPendingTableBody'); aPending.innerHTML = '';
    allGuestsData.filter(g => g.needsAcc && g.accStatus === 'pending').forEach(g => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${g.name}</strong></td><td>${g.accRoom || 'Zatím bez požadavku'}</td><td><select id="selPlace_${g.id}" style="width:100%; margin-bottom:5px;" onchange="loadRoomsForSelect('${g.id}', this.value)">${selectPlacesHtml}</select><select id="selRoom_${g.id}" style="width:100%; display:none;"><option value="">-- Nejdřív vyberte místo --</option></select></td><td><button class="btn-small" onclick="approveAcc('${g.id}')">Schválit</button></td>`;
        aPending.appendChild(tr);
    });

    const nInput = document.getElementById('filterAccName').value.toLowerCase();
    const pInput = document.getElementById('filterAccPlace').value.toLowerCase();
    const rInput = document.getElementById('filterAccRoom').value.toLowerCase();
    const aAssigned = document.getElementById('accAssignedTableBody'); aAssigned.innerHTML = '';
    
    allGuestsData.filter(g => g.needsAcc && g.accStatus === 'assigned').forEach(g => {
        let matchN = g.name.toLowerCase().includes(nInput);
        let matchP = (g.accPlace||'').toLowerCase().includes(pInput);
        let matchR = (g.accRoom||'').toLowerCase().includes(rInput);
        if (matchN && matchP && matchR) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><strong>${g.name}</strong></td><td><input type="text" list="placesList" class="editable-input" value="${g.accPlace || ''}" onchange="updateDoc(doc(db, 'hoste', '${g.id}'), {accPlace: this.value})"></td><td><input type="text" class="editable-input" value="${g.accRoom || ''}" onchange="updateDoc(doc(db, 'hoste', '${g.id}'), {accRoom: this.value})"></td><td><button class="btn-small btn-secondary" onclick="updateDoc(doc(db, 'hoste', '${g.id}'), {accStatus: 'pending'})">Zpět do čekačky</button></td>`;
            aAssigned.appendChild(tr);
        }
    });

    const datalist = document.getElementById('placesList');
    if(datalist) {
        datalist.innerHTML = '';
        accPlacesData.forEach(p => { datalist.innerHTML += `<option value="${p.name}">`; });
    }
};

window.loadRoomsForSelect = (guestId, placeId) => {
    const roomSelect = document.getElementById(`selRoom_${guestId}`);
    if(!placeId) { roomSelect.style.display = 'none'; return; }
    
    const place = accPlacesData.find(p => p.id === placeId);
    if(place) {
        let html = `<option value="">-- Vyberte pokoj --</option>`;
        place.rooms.forEach(r => html += `<option value="${r}">${r}</option>`);
        roomSelect.innerHTML = html; roomSelect.style.display = 'block';
    }
};

window.approveAcc = (guestId) => {
    const placeId = document.getElementById(`selPlace_${guestId}`).value;
    const room = document.getElementById(`selRoom_${guestId}`).value;
    if(!placeId) { alert("Musíte vybrat ubytovací místo!"); return; }
    const placeName = accPlacesData.find(p => p.id === placeId).name;
    updateDoc(doc(db, 'hoste', guestId), { accPlace: placeName, accRoom: room || '', accStatus: 'assigned' });
};

// --- ROZPOČET (Filtry a Barvy) ---
window.renderBudgetView = () => {
    const txtFilter = document.getElementById('filterBudgetText').value.toLowerCase();
    const catFilter = document.getElementById('filterBudgetCat').value.toLowerCase();

    let estTotal = 0, actTotal = 0;
    const tbody = document.getElementById('budgetTableBody'); tbody.innerHTML = '';

    allBudgetData.forEach(b => {
        let matchTxt = (b.name||'').toLowerCase().includes(txtFilter);
        let matchCat = (b.category||'').toLowerCase().includes(catFilter);

        if(matchTxt && matchCat) {
            estTotal += Number(b.estimated); actTotal += Number(b.actual || 0);
            
            // Logika barev (Zelená <= Odhad, Červená > Odhad)
            let colorClass = '';
            if (b.actual > 0) {
                colorClass = (b.actual <= b.estimated) ? 'budget-positive' : 'budget-negative';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${b.category || '-'}</td>
                <td><strong>${b.name}</strong></td>
                <td>${b.estimated} Kč</td>
                <td style="display:flex; gap:5px; align-items:center;">
                    <input type="number" id="actual_${b.id}" class="editable-input ${colorClass}" style="width:90px" value="${b.actual || 0}">
                    <button class="btn-small" onclick="saveActualBudget('${b.id}')" title="Uložit skutečnou částku">✔</button>
                </td>
                <td>
                    <button class="btn-small btn-secondary" onclick="openBudgetModal('${b.id}')">✏️</button>
                    <button class="btn-small" onclick="deleteDoc(doc(db, 'rozpocet', '${b.id}'))">❌</button>
                </td>
            `;
            tbody.appendChild(tr);
        }
    });

    document.getElementById('totalEstimated').innerText = estTotal.toLocaleString() + " Kč";
    document.getElementById('totalActual').innerText = actTotal.toLocaleString() + " Kč";
};

document.getElementById('addBudgetBtn').onclick = () => {
    const name = document.getElementById('budgetItemName').value;
    const cat = document.getElementById('budgetCategory').value;
    const estimated = document.getElementById('budgetEstimated').value;
    if(name && estimated) addDoc(budgetColl, { name, category: cat, estimated: Number(estimated), actual: 0, userId: myUid });
    document.getElementById('budgetItemName').value = ''; document.getElementById('budgetCategory').value = ''; document.getElementById('budgetEstimated').value = '';
};

window.saveActualBudget = (id) => {
    let val = parseFloat(document.getElementById(`actual_${id}`).value) || 0;
    updateDoc(doc(db, 'rozpocet', id), {actual: val});
};

window.openBudgetModal = (id) => {
    const b = allBudgetData.find(x => x.id === id);
    if (!b) return;
    document.getElementById('editBudgetId').value = id;
    document.getElementById('editBudgetName').value = b.name;
    document.getElementById('editBudgetCat').value = b.category || '';
    document.getElementById('editBudgetEst').value = b.estimated;
    document.getElementById('editBudgetModal').classList.remove('hidden');
};
window.closeBudgetModal = () => document.getElementById('editBudgetModal').classList.add('hidden');
window.saveBudgetEdit = () => {
    const id = document.getElementById('editBudgetId').value;
    updateDoc(doc(db, 'rozpocet', id), {
        name: document.getElementById('editBudgetName').value,
        category: document.getElementById('editBudgetCat').value,
        estimated: Number(document.getElementById('editBudgetEst').value)
    });
    closeBudgetModal();
};

// Globální
window.db = db; window.doc = doc; window.deleteDoc = deleteDoc; window.updateDoc = updateDoc;
window.toggleGuest = (id, s) => { let n = 'Pozváno'; if (s === 'Pozváno') n = 'Potvrzeno'; else if (s === 'Potvrzeno') n = 'Nezúčastní se'; updateDoc(doc(db, 'hoste', id), { status: n }); };
window.editTaskName = (id, oldText) => { let nText = prompt("Upravit úkol:", oldText); if (nText && nText.trim() !== "") updateDoc(doc(db, 'ukoly', id), { text: nText.trim() }); };
window.copyShareUrl = () => { const copyText = document.getElementById("shareUrlInput"); copyText.select(); navigator.clipboard.writeText(copyText.value); alert("Odkaz zkopírován!"); };

window.openEditModal = (id) => {
    const guest = allGuestsData.find(g => g.id === id);
    if (!guest) return;
    document.getElementById('editGuestId').value = id; document.getElementById('editGuestName').value = guest.name;
    document.getElementById('editGuestCity').value = guest.city || ''; document.getElementById('editGuestSide').value = guest.side;
    document.getElementById('editIsHelper').checked = guest.isHelper; document.getElementById('editNeedsAcc').checked = guest.needsAcc;
    document.getElementById('editModal').classList.remove('hidden');
};
window.closeModal = () => document.getElementById('editModal').classList.add('hidden');
window.saveGuestEdit = () => {
    const id = document.getElementById('editGuestId').value;
    updateDoc(doc(db, 'hoste', id), { name: document.getElementById('editGuestName').value, city: document.getElementById('editGuestCity').value, side: document.getElementById('editGuestSide').value, isHelper: document.getElementById('editIsHelper').checked, needsAcc: document.getElementById('editNeedsAcc').checked });
    closeModal();
};
