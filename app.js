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
let helperCategories = ['Pečení/Dorty', 'Výzdoba', 'Doprava', 'Koordinace'];

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
    }
});

// Opraveno: Explicitní načtení inputů
document.getElementById('loginBtn').onclick = () => signInWithEmailAndPassword(auth, document.getElementById('emailInput').value, document.getElementById('passwordInput').value).catch(e => alert(e.message));
document.getElementById('registerBtn').onclick = () => createUserWithEmailAndPassword(auth, document.getElementById('emailInput').value, document.getElementById('passwordInput').value).catch(e => alert(e.message));
document.getElementById('logoutBtn').onclick = () => signOut(auth);

function initApp(uid) {
    onSnapshot(doc(db, "nastaveni", uid), (ds) => {
        if (ds.exists()) {
            if(ds.data().weddingDate) {
                document.getElementById('weddingDateInput').value = ds.data().weddingDate;
                window.updateCountdown();
            }
            if(ds.data().helperCategories) helperCategories = ds.data().helperCategories;
        }
        window.renderHelperCategoriesUI();
    });
    onSnapshot(query(guestsColl, where("userId", "==", uid)), snap => {
        allGuestsData = []; snap.forEach(d => { let g = d.data(); g.id = d.id; allGuestsData.push(g); });
        window.updateDashboardStats(); window.renderGuestsView(); window.renderHelpersView(); window.renderAccView();
    });
    onSnapshot(query(budgetColl, where("userId", "==", uid)), snap => {
        allBudgetData = []; snap.forEach(d => { let b = d.data(); b.id = d.id; allBudgetData.push(b); });
        window.renderBudgetView();
    });
    onSnapshot(query(accColl, where("userId", "==", uid)), snap => {
        accPlacesData = []; snap.forEach(d => { let p = d.data(); p.id = d.id; accPlacesData.push(p); });
        window.renderAccView();
    });
}

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
        tbody.innerHTML += `<tr>
            <td>${cat}</td><td>${b.name}</td><td>${b.estimated} Kč</td>
            <td><input type="number" class="editable-input ${color}" style="width:90px" value="${b.actual || 0}" id="act_${b.id}">
            <button class="btn-small" onclick="updateDoc(doc(db, 'rozpocet', '${b.id}'), {actual: Number(document.getElementById('act_${b.id}').value)})">✔</button></td>
            <td><button class="btn-small btn-secondary" onclick="openBudgetModal('${b.id}')">✏️</button> <button class="btn-small" onclick="deleteDoc(doc(db, 'rozpocet', '${b.id}'))">❌</button></td></tr>`;
    });

    for (let [cat, sum] of Object.entries(catSums)) {
        summaryBody.innerHTML += `<tr><td>${cat}</td><td><strong>${sum.toLocaleString()} Kč</strong></td></tr>`;
    }
    document.getElementById('totalEstimated').innerText = estTotal.toLocaleString() + " Kč";
    document.getElementById('totalActual').innerText = actTotal.toLocaleString() + " Kč";
};

// --- POMOCNÍCI ---
window.renderHelpersView = () => {
    const hp = document.getElementById('helperPendingTableBody'); hp.innerHTML = '';
    const ha = document.getElementById('helperAssignedTableBody'); ha.innerHTML = '';
    
    allGuestsData.filter(g => g.isHelper).forEach(g => {
        if (g.helperStatus === 'pending') {
            hp.innerHTML += `<tr><td><strong>${g.name}</strong><br><small>Z formuláře: ${g.helperTask || 'Nic'}</small></td>
                <td><button class="btn-small btn-secondary" onclick="openHelperModal('${g.id}')">Vybrat role</button></td>
                <td><button class="btn-small" onclick="updateDoc(doc(db, 'hoste', '${g.id}'), {helperStatus:'assigned'})">Schválit</button></td></tr>`;
        } else {
            ha.innerHTML += `<tr><td><strong>${g.name}</strong></td><td>${g.helperTask || '-'}</td>
                <td><button class="btn-small btn-secondary" onclick="openHelperModal('${g.id}')">Upravit role</button></td></tr>`;
        }
    });
};

window.openHelperModal = (id) => {
    const g = allGuestsData.find(x => x.id === id);
    document.getElementById('modalHelperId').value = id;
    const cont = document.getElementById('modalHelperCheckboxes');
    cont.innerHTML = helperCategories.map(c => `
        <label style="padding:10px; background:#f9f9f9; border-radius:8px; border:1px solid #eee;">
            <input type="checkbox" value="${c}" ${(g.helperTask || '').includes(c) ? 'checked' : ''}> ${c}
        </label>
    `).join('');
    document.getElementById('helperEditModal').classList.remove('hidden');
};
window.saveHelperRoles = () => {
    const id = document.getElementById('modalHelperId').value;
    const roles = Array.from(document.querySelectorAll('#modalHelperCheckboxes input:checked')).map(cb => cb.value).join(', ');
    updateDoc(doc(db, 'hoste', id), { helperTask: roles });
    window.closeHelperModal();
};

// --- HOSTÉ ---
window.renderGuestsView = () => {
    const tbody = document.getElementById('guestTableBody'); tbody.innerHTML = '';
    let stats = { children: { 'Malé (0-3)':0, 'Střední (4-10)':0, 'Velké (11+)':0 } };

    allGuestsData.forEach(g => {
        let childInfo = g.numChildren > 0 ? `<br><small style="color:#d81b60;">👶 ${g.numChildren} dětí (${g.childrenAges?.join(', ') || ''})</small>` : '';
        if (g.childrenAges) g.childrenAges.forEach(age => { if(stats.children[age] !== undefined) stats.children[age]++; });

        tbody.innerHTML += `<tr class="${g.side === 'Nevěsta' ? 'side-nevesta' : (g.side === 'Ženich' ? 'side-zenich' : 'side-spolecny')}">
            <td><strong>${g.name}</strong>${childInfo}</td><td>${g.city || '-'}</td><td>${g.side}</td>
            <td style="cursor:pointer" onclick="toggleGuest('${g.id}','${g.status}')">${g.status === 'Potvrzeno' ? '✅ Potvrzeno' : (g.status === 'Nezúčastní se' ? '<span class="status-declined">❌ Odmítl/a</span>' : '📩 Pozváno')}</td>
            <td><button class="btn-small btn-secondary" onclick="openEditModal('${g.id}')">✏️</button> <button class="btn-small" onclick="deleteDoc(doc(db, 'hoste', '${g.id}'))">❌</button></td></tr>`;
    });
    
    // Zobrazení dětí v dashboardu a sekcích
    const dashChildElement = document.getElementById('dashTotalChildren');
    if(dashChildElement) dashChildElement.innerText = Object.values(stats.children).reduce((a,b)=>a+b, 0);
};

// Opraveno: Správné volání prvků pomocí getElementById
window.closeHelperModal = () => document.getElementById('helperEditModal').classList.add('hidden');

window.addHelperCategory = () => {
    const input = document.getElementById('newCategoryInput');
    const v = input.value.trim();
    if(v) { 
        helperCategories.push(v); 
        setDoc(doc(db, "nastaveni", myUid), {helperCategories}, {merge:true}); 
        input.value = '';
    }
};

window.renderHelperCategoriesUI = () => {
    let html = '';
    helperCategories.forEach(c => html += `<span class="city-badge">${c} <button class="btn-small btn-secondary" style="margin-left:5px; padding:0 4px;" onclick="removeHelperCategory('${c}')">x</button></span>`);
    document.getElementById('categoryTagsContainer').innerHTML = html;
};

window.removeHelperCategory = (cat) => {
    helperCategories = helperCategories.filter(c => c !== cat);
    setDoc(doc(db, "nastaveni", myUid), { helperCategories }, { merge: true });
};

window.saveWeddingDate = () => {
    const val = document.getElementById('weddingDateInput').value;
    setDoc(doc(db, "nastaveni", myUid), {weddingDate: val}, {merge:true});
};

window.updateCountdown = () => {
    const val = document.getElementById('weddingDateInput').value;
    if(!val) return;
    const d = new Date(val);
    const diff = Math.ceil((d - new Date()) / 86400000);
    document.getElementById('countdownDisplay').innerText = diff >= 0 ? diff + " dní! 🎉" : "Svatba byla! ❤️";
};

// Export funkcí pro HTML akce
window.deleteDoc = deleteDoc; 
window.updateDoc = updateDoc; 
window.doc = doc; 
window.db = db;

window.toggleGuest = (id, s) => { 
    let n = 'Pozváno'; 
    if (s === 'Pozváno') n = 'Potvrzeno'; 
    else if (s === 'Potvrzeno') n = 'Nezúčastní se'; 
    updateDoc(doc(db, 'hoste', id), { status: n }); 
};

window.openEditModal = (id) => {
    const guest = allGuestsData.find(g => g.id === id);
    if (!guest) return;
    document.getElementById('editGuestId').value = id;
    document.getElementById('editGuestName').value = guest.name;
    document.getElementById('editNumChildren').value = guest.numChildren || 0;
    document.getElementById('editModal').classList.remove('hidden');
};

window.closeModal = () => document.getElementById('editModal').classList.add('hidden');

window.saveGuestEdit = () => {
    const id = document.getElementById('editGuestId').value;
    updateDoc(doc(db, 'hoste', id), { 
        name: document.getElementById('editGuestName').value, 
        numChildren: Number(document.getElementById('editNumChildren').value) 
    });
    closeModal();
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

document.getElementById('addBudgetBtn').onclick = () => {
    const n = document.getElementById('budgetItemName').value;
    const c = document.getElementById('budgetCategory').value;
    const e = document.getElementById('budgetEstimated').value;
    if(n && e) {
        addDoc(budgetColl, { name: n, category: c, estimated: Number(e), actual: 0, userId: myUid });
        document.getElementById('budgetItemName').value = ''; 
        document.getElementById('budgetCategory').value = ''; 
        document.getElementById('budgetEstimated').value = '';
    }
};

window.copyShareUrl = () => {
    const copyText = document.getElementById("shareUrlInput");
    copyText.select(); 
    navigator.clipboard.writeText(copyText.value);
    alert("Odkaz zkopírován!");
};
