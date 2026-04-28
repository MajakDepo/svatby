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
let helperCategories = ['🎂 Pečení/Dorty', '🎀 Výzdoba', '🚗 Doprava', '📋 Koordinace', '🎵 Hudba/Program'];

// --- POMOCNÉ FUNKCE (HOISTING) ---
function getRoomCapacity(name) {
    let n = name.toLowerCase();
    if(n.includes('jedno')) return 1; if(n.includes('dvou')) return 2; if(n.includes('tří') || n.includes('tri')) return 3;
    if(n.includes('čtyř') || n.includes('ctyr')) return 4; if(n.includes('pěti') || n.includes('peti')) return 5;
    let m = n.match(/(\d+)/); return m ? parseInt(m[1]) : 2;
}

// --- NAVIGACE ---
window.showPage = (pageId) => {
    document.querySelectorAll('.page-view').forEach(el => el.classList.add('hidden'));
    const page = document.getElementById(pageId); if(page) page.classList.remove('hidden');
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
    }
});

function initApp(uid) {
    onSnapshot(doc(db, "nastaveni", uid), (ds) => {
        if (ds.exists()) {
            if(ds.data().weddingDate) { document.getElementById('weddingDateInput').value = ds.data().weddingDate; updateCountdown(); }
            if(ds.data().helperCategories) helperCategories = ds.data().helperCategories;
        }
        renderHelperCategoriesUI();
    });
    onSnapshot(query(tasksColl, where("userId", "==", uid)), snap => {
        const list = document.getElementById('taskList'); if(!list) return; list.innerHTML = '';
        snap.forEach(d => {
            const t = d.data();
            list.innerHTML += `<tr>
                <td><select onchange="updateDoc(doc(db, 'ukoly', '${d.id}'), {status: this.value})">
                    <option value="Není" ${t.status==='Není'?'selected':''}>❌ Není</option>
                    <option value="V průběhu" ${t.status==='V průběhu'?'selected':''}>⏳ V průběhu</option>
                    <option value="Hotovo" ${t.status==='Hotovo'?'selected':''}>✅ Hotovo</option>
                </select></td>
                <td class="priority-${t.priority}">${t.priority}</td>
                <td><strong>${t.text}</strong></td>
                <td><small>${t.note || '-'}</small></td>
                <td><button class="btn-small" onclick="deleteDoc(doc(db, 'ukoly', '${d.id}'))">❌</button></td></tr>`;
        });
    });
    onSnapshot(query(guestsColl, where("userId", "==", uid)), snap => {
        allGuestsData = []; snap.forEach(d => { let g = d.data(); g.id = d.id; allGuestsData.push(g); });
        updateDashboardStats(); renderGuestsView(); renderHelpersView(); renderAccView();
    });
    onSnapshot(query(budgetColl, where("userId", "==", uid)), snap => {
        allBudgetData = []; snap.forEach(d => { let b = d.data(); b.id = d.id; allBudgetData.push(b); });
        renderBudgetView();
    });
    onSnapshot(query(accColl, where("userId", "==", uid)), snap => {
        accPlacesData = []; snap.forEach(d => { let p = d.data(); p.id = d.id; accPlacesData.push(p); });
        renderAccView();
    });
}

// --- DASHBOARD ---
function updateDashboardStats() {
    let totals = { guests: 0, confirmed: 0, helpers: 0, pendingHelpers: 0, accGuests: 0, children: 0 };
    allGuestsData.forEach(g => {
        totals.guests++; totals.children += Number(g.numChildren || 0);
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
}

// --- ROZPOČET (VYLEPŠENÝ) ---
function renderBudgetView() {
    const tbody = document.getElementById('budgetTableBody');
    const summaryBody = document.getElementById('budgetCategorySummaryBody');
    if(!tbody || !summaryBody) return;
    tbody.innerHTML = ''; summaryBody.innerHTML = '';
    let estTotal = 0, actTotal = 0, catSums = {};

    allBudgetData.forEach(b => {
        estTotal += Number(b.estimated); actTotal += Number(b.actual || 0);
        let cat = b.category || 'Nezařazeno';
        if(!catSums[cat]) catSums[cat] = { est:0, act:0 };
        catSums[cat].est += Number(b.estimated); catSums[cat].act += Number(b.actual || 0);

        let color = b.actual > b.estimated ? 'budget-negative' : (b.actual > 0 ? 'budget-positive' : '');
        tbody.innerHTML += `<tr><td>${cat}</td><td><strong>${b.name}</strong></td><td>${b.estimated} Kč</td>
            <td style="display:flex; gap:5px;"><input type="number" class="editable-input ${color}" style="width:90px" value="${b.actual || 0}" id="act_${b.id}">
            <button class="btn-small" onclick="updateDoc(doc(db, 'rozpocet', '${b.id}'), {actual: Number(document.getElementById('act_${b.id}').value)})">✔</button></td>
            <td><button class="btn-small btn-secondary" onclick="openBudgetModal('${b.id}')">✏️</button> <button class="btn-small" onclick="deleteDoc(doc(db, 'rozpocet', '${b.id}'))">❌</button></td></tr>`;
    });

    for (let [cat, sum] of Object.entries(catSums)) {
        let colorClass = sum.act > sum.est ? 'budget-negative' : (sum.act > 0 ? 'budget-positive' : '');
        summaryBody.innerHTML += `<tr><td>${cat}</td><td>${sum.est.toLocaleString()} Kč</td><td class="${colorClass}"><strong>${sum.act.toLocaleString()} Kč</strong></td></tr>`;
    }
    
    document.getElementById('totalEstimated').innerText = estTotal.toLocaleString() + " Kč";
    document.getElementById('totalActual').innerText = actTotal.toLocaleString() + " Kč";
    
    // Zbarvení souhrnného boxu "Utraceno"
    const actBox = document.getElementById('totalActualBox');
    if(actTotal > estTotal) actBox.className = 'stat-box stat-negative';
    else if(actTotal > 0) actBox.className = 'stat-box stat-positive';
    else actBox.className = 'stat-box';
}

// --- POMOCNÍCI ---
function renderHelperCategoriesUI() {
    const cont = document.getElementById('categoryTagsContainer'); if(!cont) return;
    cont.innerHTML = helperCategories.map(c => `<span class="city-badge">${c} <button class="btn-small btn-secondary" onclick="removeHelperCategory('${c}')">x</button></span>`).join('');
}

function renderHelpersView() {
    const hp = document.getElementById('helperPendingTableBody'); 
    const ha = document.getElementById('helperAssignedTableBody');
    if(!hp || !ha) return; hp.innerHTML = ''; ha.innerHTML = '';
    
    allGuestsData.filter(g => g.isHelper).forEach(g => {
        if (g.helperStatus === 'pending') {
            hp.innerHTML += `<tr><td><strong>${g.name}</strong><br><small>Napsal: ${g.helperTask}</small></td>
                <td><button class="btn-small btn-secondary" onclick="openHelperModal('${g.id}')">📋 Vybrat role</button></td>
                <td><button class="btn-small" onclick="updateDoc(doc(db, 'hoste', '${g.id}'), {helperStatus:'assigned'})">✅ Schválit</button></td></tr>`;
        } else {
            ha.innerHTML += `<tr><td><strong>${g.name}</strong></td><td>${g.helperTask || '-'}</td>
                <td><button class="btn-small btn-secondary" onclick="openHelperModal('${g.id}')">✏️ Upravit</button></td></tr>`;
        }
    });
}

// --- UBYTOVÁNÍ (ZBARVOVÁNÍ A EDITACE) ---
function renderAccView() {
    const cont = document.getElementById('accPlacesContainer'); 
    const ap = document.getElementById('accPendingTableBody'); 
    const aa = document.getElementById('accAssignedTableBody');
    if(!cont || !ap || !aa) return; cont.innerHTML = ''; ap.innerHTML = ''; aa.innerHTML = '';
    
    let occupancy = {};
    allGuestsData.forEach(g => {
        if(g.needsAcc && g.accStatus === 'assigned' && g.accPlace) {
            if(!occupancy[g.accPlace]) occupancy[g.accPlace] = {};
            if(g.accRoom) { if(!occupancy[g.accPlace][g.accRoom]) occupancy[g.accPlace][g.accRoom] = []; occupancy[g.accPlace][g.accRoom].push(g.name); }
        }
    });

    accPlacesData.forEach(p => {
        let roomsHtml = p.rooms.map(r => {
            let occ = (occupancy[p.name] && occupancy[p.name][r]) ? occupancy[p.name][r] : [];
            let cap = getRoomCapacity(r);
            let cls = 'room-tag'; if(occ.length >= cap) cls += ' full'; else if(occ.length > 0) cls += ' partial';
            return `<span class="${cls}" title="Obsazeno: ${occ.join(', ') || 'Nikdo'}">${r}</span>`;
        }).join('');
        cont.innerHTML += `<div class=\"acc-place-card\"><h4>${p.name}</h4><div>${roomsHtml}</div></div>`;
    });

    allGuestsData.filter(g => g.needsAcc).forEach(g => {
        let options = `<option value="">-- Vybrat pokoj --</option>` + accPlacesData.map(p => p.rooms.map(r => `<option value="${p.name}|${r}" ${g.accPlace===p.name && g.accRoom===r ? 'selected':''}>${p.name}: ${r}</option>`).join('')).join('');
        let selectHtml = `<select onchange="let v=this.value.split('|'); updateDoc(doc(db, 'hoste', '${g.id}'), {accPlace: v[0], accRoom: v[1], accStatus: 'assigned'})">${options}</select>`;
        
        if (g.accStatus === 'pending') {
            ap.innerHTML += `<tr><td><strong>${g.name}</strong><br><small>${g.accRoom}</small></td><td>${selectHtml}</td><td><button class=\"btn-small\" onclick=\"updateDoc(doc(db, 'hoste', '${g.id}'), {accStatus:'assigned'})\">✅ Schválit</button></td></tr>`;
        } else {
            aa.innerHTML += `<tr><td><strong>${g.name}</strong></td><td>${g.accPlace}</td><td>${g.accRoom}</td><td>${selectHtml}</td></tr>`;
        }
    });
}

// --- GLOBÁLNÍ AKCE ---
window.addHelperCategory = () => {
    let v = document.getElementById('newCategoryInput').value.trim();
    if(v) { helperCategories.push(v); setDoc(doc(db, "nastaveni", myUid), {helperCategories}, {merge:true}); }
};

window.removeHelperCategory = (cat) => {
    helperCategories = helperCategories.filter(c => c !== cat);
    setDoc(doc(db, "nastaveni", myUid), { helperCategories }, { merge: true });
};

window.saveWeddingDate = () => setDoc(doc(db, "nastaveni", myUid), { weddingDate: document.getElementById('weddingDateInput').value }, { merge: true });

function updateCountdown() {
    let d = new Date(document.getElementById('weddingDateInput').value);
    let diff = Math.ceil((d - new Date()) / 86400000);
    document.getElementById('countdownDisplay').innerText = diff >= 0 ? diff + " dní! 🎉" : "Svatba byla! ❤️";
}

document.getElementById('addBtn').onclick = () => {
    let i = document.getElementById('taskInput'), n = document.getElementById('taskNoteInput'), p = document.getElementById('taskPriority');
    if(i.value) { addDoc(tasksColl, { text: i.value, note: n.value, priority: p.value, status: 'Není', userId: myUid }); i.value=''; n.value=''; }
};

window.openHelperModal = (id) => {
    const g = allGuestsData.find(x => x.id === id);
    document.getElementById('modalHelperId').value = id;
    document.getElementById('modalHelperCheckboxes').innerHTML = helperCategories.map(c => `<label><input type="checkbox" value="${c}" ${(g.helperTask || '').includes(c) ? 'checked' : ''}> ${c}</label>`).join('');
    document.getElementById('helperEditModal').classList.remove('hidden');
};

window.saveHelperRoles = () => {
    const roles = Array.from(document.querySelectorAll('#modalHelperCheckboxes input:checked')).map(cb => cb.value).join(', ');
    updateDoc(doc(db, 'hoste', document.getElementById('modalHelperId').value), { helperTask: roles, helperStatus: 'assigned' });
    document.getElementById('helperEditModal').classList.add('hidden');
};

// Export dalších funkcí
window.closeHelperModal = () => document.getElementById('helperEditModal').classList.add('hidden');
window.deleteDoc = deleteDoc; window.updateDoc = updateDoc; window.doc = doc; window.db = db;
window.editTaskName = (id, old) => { let n = prompt("Upravit:", old); if(n) updateDoc(doc(db, 'ukoly', id), { text: n }); };
window.openBudgetModal = (id) => {
    const b = allBudgetData.find(x => x.id === id);
    document.getElementById('editBudgetId').value = id; document.getElementById('editBudgetName').value = b.name;
    document.getElementById('editBudgetCat').value = b.category || ''; document.getElementById('editBudgetEst').value = b.estimated;
    document.getElementById('editBudgetModal').classList.remove('hidden');
};
window.saveBudgetEdit = () => {
    updateDoc(doc(db, 'rozpocet', document.getElementById('editBudgetId').value), { name: document.getElementById('editBudgetName').value, category: document.getElementById('editBudgetCat').value, estimated: Number(document.getElementById('editBudgetEst').value) });
    document.getElementById('editBudgetModal').classList.add('hidden');
};
window.closeBudgetModal = () => document.getElementById('editBudgetModal').classList.add('hidden');
