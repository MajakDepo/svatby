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

function initApp(uid) {
    onSnapshot(doc(db, "nastaveni", uid), (ds) => {
        if (ds.exists()) {
            if(ds.data().weddingDate) document.getElementById('weddingDateInput').value = ds.data().weddingDate;
            if(ds.data().helperCategories) helperCategories = ds.data().helperCategories;
        }
        renderHelperCategoriesUI();
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
            <td><input type="number" class="${color}" value="${b.actual || 0}" onchange="updateDoc(doc(db, 'rozpocet', '${b.id}'), {actual: Number(this.value)})"></td>
            <td><button onclick="deleteDoc(doc(db, 'rozpocet', '${b.id}'))">❌</button></td></tr>`;
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
            hp.innerHTML += `<tr><td>${g.name}<br><small>${g.helperTask}</small></td>
                <td><button onclick="openHelperModal('${g.id}')">Vybrat role</button></td>
                <td><button onclick="updateDoc(doc(db, 'hoste', '${g.id}'), {helperStatus:'assigned'})">Schválit</button></td></tr>`;
        } else {
            ha.innerHTML += `<tr><td>${g.name}</td><td>${g.helperTask || '-'}</td>
                <td><button onclick="openHelperModal('${g.id}')">Upravit</button></td></tr>`;
        }
    });
};

window.openHelperModal = (id) => {
    const g = allGuestsData.find(x => x.id === id);
    document.getElementById('modalHelperId').value = id;
    const cont = document.getElementById('modalHelperCheckboxes');
    cont.innerHTML = helperCategories.map(c => `
        <label><input type="checkbox" value="${c}" ${(g.helperTask || '').includes(c) ? 'checked' : ''}> ${c}</label>
    `).join('');
    document.getElementById('helperEditModal').classList.remove('hidden');
};
window.saveHelperRoles = () => {
    const id = document.getElementById('modalHelperId').value;
    const roles = Array.from(document.querySelectorAll('#modalHelperCheckboxes input:checked')).map(cb => cb.value).join(', ');
    updateDoc(doc(db, 'hoste', id), { helperTask: roles });
    closeHelperModal();
};

// --- HOSTÉ ---
window.renderGuestsView = () => {
    const tbody = document.getElementById('guestTableBody'); tbody.innerHTML = '';
    let stats = { children: { 'Malé (0-3)':0, 'Střední (4-10)':0, 'Velké (11+)':0 } };

    allGuestsData.forEach(g => {
        let childInfo = g.numChildren > 0 ? `<br><small>👶 ${g.numChildren} dětí (${g.childrenAges?.join(', ') || ''})</small>` : '';
        if (g.childrenAges) g.childrenAges.forEach(age => stats.children[age]++);

        tbody.innerHTML += `<tr class="${g.side === 'Nevěsta' ? 'side-nevesta' : 'side-zenich'}">
            <td><strong>${g.name}</strong>${childInfo}</td><td>${g.city || '-'}</td><td>${g.side}</td>
            <td onclick="toggleGuest('${g.id}','${g.status}')">${g.status === 'Potvrzeno' ? '✅' : '📩'}</td>
            <td><button onclick="deleteDoc(doc(db, 'hoste', '${g.id}'))">❌</button></td></tr>`;
    });
    // Zobrazení dětí v dashboardu
    document.getElementById('dashTotalChildren').innerText = Object.values(stats.children).reduce((a,b)=>a+b, 0);
};

// Pomocné
window.closeHelperModal = () => document.getElementById('helperEditModal').classList.add('hidden');
window.addHelperCategory = () => {
    const v = newCategoryInput.value;
    if(v) { helperCategories.push(v); setDoc(doc(db, "nastaveni", myUid), {helperCategories}, {merge:true}); }
};
window.saveWeddingDate = () => setDoc(doc(db, "nastaveni", myUid), {weddingDate: weddingDateInput.value}, {merge:true});
window.updateCountdown = () => {
    const d = new Date(weddingDateInput.value);
    const diff = Math.ceil((d - new Date()) / 86400000);
    document.getElementById('countdownDisplay').innerText = diff >= 0 ? diff + " dní" : "Svatba byla!";
};
// Export funkcí pro HTML
window.deleteDoc = deleteDoc; window.updateDoc = updateDoc; window.doc = doc; window.db = db;
