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
let unsubs = [], allGuestsData = [], allBudgetData = [], accPlacesData = [], myUid = null;
let helperCategories = ['Pečení/Dorty', 'Výzdoba', 'Doprava', 'Koordinace', 'Hudba/Program'];

// --- NAVIGACE A AUTH ---
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
                window.updateCountdown();
            }
            if(docSnap.data().helperCategories) helperCategories = docSnap.data().helperCategories;
        }
        window.renderHelperCategoriesUI();
        if(allGuestsData.length > 0) window.renderHelpersView(); 
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

    unsubs.push(onSnapshot(query(accColl, where("userId", "==", uid)), snap => {
        accPlacesData = []; snap.forEach(d => { let p = d.data(); p.id = d.id; accPlacesData.push(p); });
        if(allGuestsData.length > 0) window.renderAccView();
    }));

    unsubs.push(onSnapshot(query(guestsColl, where("userId", "==", uid)), snap => {
        allGuestsData = []; snap.forEach(d => { let g = d.data(); g.id = d.id; allGuestsData.push(g); });
        window.updateDashboardStats(); window.renderGuestsView(); window.renderHelpersView(); window.renderAccView();
    }));

    unsubs.push(onSnapshot(query(budgetColl, where("userId", "==", uid)), snap => {
        allBudgetData = []; snap.forEach(d => { let b = d.data(); b.id = d.id; allBudgetData.push(b); });
        window.renderBudgetView();
    }));
}

// --- DASHBOARD ---
window.updateDashboardStats = () => {
    let totals = { guests: 0, confirmed: 0, helpers: 0, pendingHelpers: 0, accGuests: 0, pendingAcc: 0, children: 0 };
    allGuestsData.forEach(g => {
        totals.guests++;
        totals.children += Number(g.numChildren || 0);
        if (g.status === 'Potvrzeno') totals.confirmed++;
        if (g.isHelper) { totals.helpers++; if (g.helperStatus === 'pending') totals.pendingHelpers++; }
        if (g.needsAcc) { totals.accGuests++; if (g.accStatus === 'pending') totals.pendingAcc++; }
    });
    document.getElementById('dashTotalGuests').innerText = totals.guests;
    document.getElementById('dashTotalChildren').innerText = totals.children;
    document.getElementById('dashConfirmedGuests').innerText = totals.confirmed;
    document.getElementById('dashTotalHelpers').innerText = totals.helpers;
    document.getElementById('dashPendingHelpers').innerText = totals.pendingHelpers;
    document.getElementById('dashTotalAcc').innerText = totals.accGuests;
    document.getElementById('dashPendingAcc').innerText = totals.pendingAcc;
};

window.saveWeddingDate = () => setDoc(doc(db, "nastaveni", myUid), { weddingDate: document.getElementById('weddingDateInput').value }, { merge: true });
window.updateCountdown = () => {
    const dStr = document.getElementById('weddingDateInput').value;
    if (!dStr) return;
    const diff = Math.ceil((new Date(dStr) - new Date()) / 86400000);
    document.getElementById('countdownDisplay').innerText = diff >= 0 ? `Už jen ${diff} dní! 🎉` : `Svatba už proběhla! ❤️`;
};

// --- HOSTÉ A DĚTI ---
window.renderGuestsView = () => {
    const tbody = document.getElementById('guestTableBody'); tbody.innerHTML = '';
    let stats = { total:0, confirmed:0, nevesta:0, zenich:0, spolecny:0, cities:{}, children: { 'Malé (0-3)':0, 'Střední (4-10)':0, 'Velké (11+)':0 } };

    allGuestsData.forEach(g => {
        stats.total++;
        if(g.status === 'Potvrzeno') stats.confirmed++;
        if(g.side === 'Nevěsta') stats.nevesta++; else if(g.side === 'Ženich') stats.zenich++; else stats.spolecny++;
        let city = g.city ? g.city.trim() : 'Nezadáno';
        stats.cities[city] = (stats.cities[city] || 0) + 1;

        if (g.childrenAges) g.childrenAges.forEach(age => { if(stats.children[age] !== undefined) stats.children[age]++; });
        let childInfo = g.numChildren > 0 ? `<br><small style="color:#d81b60;">👶 ${g.numChildren} dětí (${g.childrenAges?.join(', ') || ''})</small>` : '';

        tbody.innerHTML += `<tr class="${g.side === 'Nevěsta' ? 'side-nevesta' : (g.side === 'Ženich' ? 'side-zenich' : 'side-spolecny')}">
            <td><strong>${g.name}</strong>${childInfo}</td><td>${g.city || '-'}</td><td>${g.side}</td>
            <td style="cursor:pointer" onclick="toggleGuest('${g.id}','${g.status}')">${g.status === 'Potvrzeno' ? '✅ Potvrzeno' : (g.status === 'Nezúčastní se' ? '<span class="status-declined">❌ Odmítl/a</span>' : '📩 Pozváno')}</td>
            <td><button class="btn-small btn-secondary" onclick="openEditModal('${g.id}')">✏️</button> <button class="btn-small" onclick="deleteDoc(doc(db, 'hoste', '${g.id}'))">❌</button></td></tr>`;
    });

    let cityHtml = '<strong>Hosté z měst:</strong><br>';
    for (let [city, count] of Object.entries(stats.cities)) cityHtml += `<div class="city-badge">${city} <span>(${count}x)</span></div>`;
    document.getElementById('cityBadgesContainer').innerHTML = cityHtml;

    document.getElementById('guestStatsBlock').innerHTML = `
        <div class="stat-box">Nevěsta: <strong>${stats.nevesta}</strong></div>
        <div class="stat-box">Ženich: <strong>${stats.zenich}</strong></div>
        <div class="stat-box">Společní: <strong>${stats.spolecny}</strong></div>
        <div class="stat-box" style="background:#fff0f5;">Malé děti (0-3): <strong>${stats.children['Malé (0-3)']}</strong></div>
        <div class="stat-box" style="background:#fff0f5;">Střední děti (4-10): <strong>${stats.children['Střední (4-10)']}</strong></div>
        <div class="stat-box" style="background:#fff0f5;">Velké děti (11+): <strong>${stats.children['Velké (11+)']}</strong></div>
    `;
};

document.getElementById('addGuestBtn').onclick = () => {
    const name = document.getElementById('guestName').value;
    const numChild = Number(document.getElementById('guestChildren').value) || 0;
    if(name) {
        addDoc(guestsColl, { 
            name, city: document.getElementById('guestCity').value, side: document.getElementById('guestSide').value, 
            isHelper: document.getElementById('isHelper').checked, needsAcc: document.getElementById('needsAcc').checked, 
            status: 'Pozváno', helperTask: '', helperStatus: '', accPlace: '', accRoom: '', accStatus: '', 
            userId: myUid, submittedDate: new Date().toISOString(), numChildren: numChild, childrenAges: []
        });
        document.getElementById('guestName').value = ''; document.getElementById('guestCity').value = ''; document.getElementById('guestChildren').value = '';
    }
};

// --- POMOCNÍCI ---
window.renderHelperCategoriesUI = () => {
    let html = '';
    helperCategories.forEach(c => html += `<span class="city-badge">${c} <button class="btn-small btn-secondary" style="margin-left:5px; padding:0 4px;" onclick="removeHelperCategory('${c}')">x</button></span>`);
    document.getElementById('categoryTagsContainer').innerHTML = html;
};

window.addHelperCategory = () => {
    const val = document.getElementById('newCategoryInput').value.trim();
    if(val && !helperCategories.includes(val)) {
        helperCategories.push(val); setDoc(doc(db, "nastaveni", myUid), { helperCategories }, { merge: true });
        document.getElementById('newCategoryInput').value = '';
    }
};
window.removeHelperCategory = (cat) => {
    helperCategories = helperCategories.filter(c => c !== cat); setDoc(doc(db, "nastaveni", myUid), { helperCategories }, { merge: true });
};

window.renderHelpersView = () => {
    const hp = document.getElementById('helperPendingTableBody'); hp.innerHTML = '';
    const ha = document.getElementById('helperAssignedTableBody'); ha.innerHTML = '';
    let tasksStats = {};

    allGuestsData.filter(g => g.isHelper).forEach(g => {
        if (g.helperStatus === 'pending') {
            hp.innerHTML += `<tr><td><strong>${g.name}</strong><br><small style="color:#888;">Napsal: ${g.helperTask || 'Nic'}</small></td>
                <td><button class="btn-small btn-secondary" onclick="openHelperModal('${g.id}')">Vybrat z rozbalovacího seznamu</button></td>
                <td><button class="btn-small" onclick="updateDoc(doc(db, 'hoste', '${g.id}'), {helperStatus:'assigned'})">Schválit role</button></td></tr>`;
        } else {
            let tArray = (g.helperTask ? g.helperTask : 'Nepřiřazeno').split(',').map(s => s.trim()).filter(s => s);
            if(tArray.length === 0) tArray = ['Nepřiřazeno'];
            tArray.forEach(t => { tasksStats[t] = (tasksStats[t] || 0) + 1; });
            ha.innerHTML += `<tr><td><strong>${g.name}</strong></td><td>${g.helperTask || '-'}</td>
                <td><button class="btn-small btn-secondary" onclick="openHelperModal('${g.id}')">Upravit role</button></td></tr>`;
        }
    });

    let hHtml = '';
    for (let [task, count] of Object.entries(tasksStats)) hHtml += `<div class="stat-box" style="flex:auto;">${task}<br><strong>${count}x</strong></div>`;
    document.getElementById('helperStatsBlock').innerHTML = hHtml;
};

window.openHelperModal = (id) => {
    const g = allGuestsData.find(x => x.id === id);
    document.getElementById('modalHelperId').value = id;
    document.getElementById('modalHelperCheckboxes').innerHTML = helperCategories.map(c => `<label style="padding:10px; background:#f9f9f9; border-radius:8px; border:1px solid #eee;"><input type="checkbox" value="${c}" ${(g.helperTask || '').includes(c) ? 'checked' : ''}> ${c}</label>`).join('');
    document.getElementById('helperEditModal').classList.remove('hidden');
};
window.saveHelperRoles = () => {
    const id = document.getElementById('modalHelperId').value;
    const roles = Array.from(document.querySelectorAll('#modalHelperCheckboxes input:checked')).map(cb => cb.value).join(', ');
    updateDoc(doc(db, 'hoste', id), { helperTask: roles });
    window.closeHelperModal();
};
window.closeHelperModal = () => document.getElementById('helperEditModal').classList.add('hidden');

// --- UBYTOVÁNÍ ---
function getRoomCapacity(name) {
    let n = name.toLowerCase();
    if(n.includes('jedno')) return 1; if(n.includes('dvou')) return 2; if(n.includes('tří') || n.includes('tri')) return 3;
    if(n.includes('čtyř') || n.includes('ctyr')) return 4; if(n.includes('pěti') || n.includes('peti')) return 5;
    let m = n.match(/(\d+)/); if(m) return parseInt(m[1]); return 2;
}

window.addAccPlace = () => {
    const name = document.getElementById('newPlaceName').value.trim();
    const roomsInput = document.getElementById('newPlaceRooms').value.trim();
    if(!name) return;
    let generatedRooms = [];
    if(roomsInput) {
        roomsInput.split(',').forEach(part => {
            const match = part.trim().match(/^(\d+)[xX]\s+(.+)$/);
            if(match) { for(let i=1; i<=parseInt(match[1]); i++) generatedRooms.push(`${match[2]} ${i}`); } 
            else if(part.trim() !== '') generatedRooms.push(part.trim());
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
            let classes = 'room-tag'; let title = `Kapacita: ${cap}. Volno.`;
            if (occ.length > 0 && occ.length < cap) { classes = 'room-tag partial'; title = `Obsazeno ${occ.length}/${cap}: ${occ.join(', ')}`; } 
            else if (occ.length >= cap) { classes = 'room-tag full'; title = `PLNĚ OBSAZENO: ${occ.join(', ')}`; }
            rHtml += `<span class="${classes}" title="${title}">${r}</span>`;
        });
        placesCont.innerHTML += `<div class="acc-place-card"><h4>${p.name} <button class="btn-small btn-secondary" onclick="deleteDoc(doc(db, 'ubytovani_kapacity', '${p.id}'))">Smazat</button></h4><div>${rHtml || '<i>Žádné pokoje</i>'}</div></div>`;
    });

    const aPending = document.getElementById('accPendingTableBody'); aPending.innerHTML = '';
    allGuestsData.filter(g => g.needsAcc && g.accStatus === 'pending').forEach(g => {
        aPending.innerHTML += `<tr><td><strong>${g.name}</strong></td><td>${g.accRoom || '-'}</td><td><select id="selPlace_${g.id}" style="width:100%; margin-bottom:5px;" onchange="loadRoomsForSelect('${g.id}', this.value)">${selectPlacesHtml}</select><select id="selRoom_${g.id}" style="width:100%; display:none;"><option value="">-- Nejdřív vyberte místo --</option></select></td><td><button class="btn-small" onclick="approveAcc('${g.id}')">Schválit</button></td></tr>`;
    });

    const aAssigned = document.getElementById('accAssignedTableBody'); aAssigned.innerHTML = '';
    allGuestsData.filter(g => g.needsAcc && g.accStatus === 'assigned').forEach(g => {
        aAssigned.innerHTML += `<tr><td><strong>${g.name}</strong></td><td><input type="text" class="editable-input" value="${g.accPlace || ''}" onchange="updateDoc(doc(db, 'hoste', '${g.id}'), {accPlace: this.value})"></td><td><input type="text" class="editable-input" value="${g.accRoom || ''}" onchange="updateDoc(doc(db, 'hoste', '${g.id}'), {accRoom: this.value})"></td><td><button class="btn-small btn-secondary" onclick="updateDoc(doc(db, 'hoste', '${g.id}'), {accStatus: 'pending'})">Zpět k rozřazení</button></td></tr>`;
    });
};

window.loadRoomsForSelect = (guestId, placeId) => {
    const roomSelect = document.getElementById(`selRoom_${guestId}`);
    if(!placeId) { roomSelect.style.display = 'none'; return; }
    const place = accPlacesData.find(p => p.id === placeId);
    if(place) {
        roomSelect.innerHTML = `<option value="">-- Vyberte pokoj --</option>` + place.rooms.map(r => `<option value="${r}">${r}</option>`).join('');
        roomSelect.style.display = 'block';
    }
};

window.approveAcc = (guestId) => {
    const placeId = document.getElementById(`selPlace_${guestId}`).value;
    const room = document.getElementById(`selRoom_${guestId}`).value;
    if(!placeId) { alert("Musíte vybrat místo!"); return; }
    updateDoc(doc(db, 'hoste', guestId), { accPlace: accPlacesData.find(p => p.id === placeId).name, accRoom: room || '', accStatus: 'assigned' });
};

// --- ROZPOČET ---
window.renderBudgetView = () => {
    const tbody = document.getElementById('budgetTableBody'); tbody.innerHTML = '';
    const summaryBody = document.getElementById('budgetCategorySummaryBody'); summaryBody.innerHTML = '';
    let estTotal = 0, actTotal = 0, catSums = {};

    allBudgetData.forEach(b => {
        estTotal += Number(b.estimated); actTotal += Number(b.actual || 0);
        let cat = b.category || 'Nezařazeno';
        catSums[cat] = (catSums[cat] || 0) + Number(b.actual || 0);

        let color = b.actual > b.estimated ? 'budget-negative' : (b.actual > 0 ? 'budget-positive' : '');
        tbody.innerHTML += `<tr><td>${cat}</td><td><strong>${b.name}</strong></td><td>${b.estimated} Kč</td>
            <td style="display:flex; gap:5px;"><input type="number" class="editable-input ${color}" style="width:90px" value="${b.actual || 0}" id="act_${b.id}">
            <button class="btn-small" onclick="updateDoc(doc(db, 'rozpocet', '${b.id}'), {actual: Number(document.getElementById('act_${b.id}').value)})">✔</button></td>
            <td><button class="btn-small btn-secondary" onclick="openBudgetModal('${b.id}')">✏️</button> <button class="btn-small" onclick="deleteDoc(doc(db, 'rozpocet', '${b.id}'))">❌</button></td></tr>`;
    });

    for (let [cat, sum] of Object.entries(catSums)) summaryBody.innerHTML += `<tr><td>${cat}</td><td><strong>${sum.toLocaleString()} Kč</strong></td></tr>`;
    document.getElementById('totalEstimated').innerText = estTotal.toLocaleString() + " Kč";
    document.getElementById('totalActual').innerText = actTotal.toLocaleString() + " Kč";
};

document.getElementById('addBudgetBtn').onclick = () => {
    if(budgetItemName.value && budgetEstimated.value) {
        addDoc(budgetColl, { name: budgetItemName.value, category: budgetCategory.value, estimated: Number(budgetEstimated.value), actual: 0, userId: myUid });
        budgetItemName.value = ''; budgetCategory.value = ''; budgetEstimated.value = '';
    }
};

window.openBudgetModal = (id) => {
    const b = allBudgetData.find(x => x.id === id);
    document.getElementById('editBudgetId').value = id; document.getElementById('editBudgetName').value = b.name;
    document.getElementById('editBudgetCat').value = b.category || ''; document.getElementById('editBudgetEst').value = b.estimated;
    document.getElementById('editBudgetModal').classList.remove('hidden');
};
window.closeBudgetModal = () => document.getElementById('editBudgetModal').classList.add('hidden');
window.saveBudgetEdit = () => {
    updateDoc(doc(db, 'rozpocet', document.getElementById('editBudgetId').value), { name: document.getElementById('editBudgetName').value, category: document.getElementById('editBudgetCat').value, estimated: Number(document.getElementById('editBudgetEst').value) });
    closeBudgetModal();
};

// --- ÚKOLY A GLOBÁLNÍ FUNKCE ---
document.getElementById('addBtn').onclick = () => {
    if(taskInput.value) { addDoc(tasksColl, { text: taskInput.value, note: '', completed: false, userId: myUid }); taskInput.value = ''; }
};

window.db = db; window.doc = doc; window.deleteDoc = deleteDoc; window.updateDoc = updateDoc;
window.toggleGuest = (id, s) => { let n = 'Pozváno'; if (s === 'Pozváno') n = 'Potvrzeno'; else if (s === 'Potvrzeno') n = 'Nezúčastní se'; updateDoc(doc(db, 'hoste', id), { status: n }); };
window.editTaskName = (id, oldText) => { let nText = prompt("Upravit úkol:", oldText); if (nText && nText.trim() !== "") updateDoc(doc(db, 'ukoly', id), { text: nText.trim() }); };
window.copyShareUrl = () => { document.getElementById("shareUrlInput").select(); navigator.clipboard.writeText(document.getElementById("shareUrlInput").value); alert("Odkaz zkopírován!"); };

window.openEditModal = (id) => {
    const guest = allGuestsData.find(g => g.id === id);
    document.getElementById('editGuestId').value = id; document.getElementById('editGuestName').value = guest.name; document.getElementById('editGuestCity').value = guest.city || '';
    document.getElementById('editGuestSide').value = guest.side; document.getElementById('editNumChildren').value = guest.numChildren || 0;
    document.getElementById('editModal').classList.remove('hidden');
};
window.closeModal = () => document.getElementById('editModal').classList.add('hidden');
window.saveGuestEdit = () => {
    updateDoc(doc(db, 'hoste', document.getElementById('editGuestId').value), { name: document.getElementById('editGuestName').value, city: document.getElementById('editGuestCity').value, side: document.getElementById('editGuestSide').value, numChildren: Number(document.getElementById('editNumChildren').value) });
    closeModal();
};
