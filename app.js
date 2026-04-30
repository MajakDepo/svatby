import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where, setDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

const tasksColl = collection(db, "ukoly");
const shoppingColl = collection(db, "nakupni_seznam");
const guestsColl = collection(db, "hoste");
const accColl = collection(db, "ubytovani_kapacity");
const budgetPlanColl = collection(db, "rozpocet_plan");
const expensesColl = collection(db, "rozpocet_naklady");

let unsubs = [], allGuestsData = [], accPlacesData = [], allTasksData = [], allShoppingData = [], myUid = null;
let allBudgetPlans = [], allExpenses = [];
let helperCategories = ['🎂 Pečení/Dorty', '🎀 Výzdoba', '🚗 Doprava', '📋 Koordinace', '🎵 Hudba/Program'];
let activeHelperFilters = [];
let currentEditAccPlace = null; 

// --- NAVIGACE A AUTH ---
window.showPage = (pageId) => {
    document.querySelectorAll('.page-view').forEach(el => el.classList.add('hidden'));
    const page = document.getElementById(pageId);
    if(page) page.classList.remove('hidden');
};

function handleAuthError(e) {
    const errDiv = document.getElementById('authError');
    if(!errDiv) return;
    if(e.code === 'auth/email-already-in-use') errDiv.innerText = "❌ Tento e-mail je již zaregistrovaný. Použijte tlačítko 'Přihlásit se'.";
    else if(e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found') errDiv.innerText = "❌ Špatný e-mail nebo heslo.";
    else if(e.code === 'auth/weak-password') errDiv.innerText = "❌ Heslo musí mít alespoň 6 znaků.";
    else errDiv.innerText = "❌ Chyba: " + e.message;
}

const loginBtn = document.getElementById('loginBtn');
if(loginBtn) loginBtn.onclick = () => signInWithEmailAndPassword(auth, document.getElementById('emailInput').value, document.getElementById('passwordInput').value).catch(handleAuthError);

const regBtn = document.getElementById('registerBtn');
if(regBtn) regBtn.onclick = () => createUserWithEmailAndPassword(auth, document.getElementById('emailInput').value, document.getElementById('passwordInput').value).catch(handleAuthError);

const logOutBtn = document.getElementById('logoutBtn');
if(logOutBtn) logOutBtn.onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    if (user) {
        myUid = user.uid;
        const authSec = document.getElementById('authSection'); if(authSec) authSec.classList.add('hidden');
        const appSec = document.getElementById('appSection'); if(appSec) appSec.classList.remove('hidden');
        showPage('dashboard');
        initApp(user.uid);
    } else {
        const authSec = document.getElementById('authSection'); if(authSec) authSec.classList.remove('hidden');
        const appSec = document.getElementById('appSection'); if(appSec) appSec.classList.add('hidden');
    }
});

// --- INICIALIZACE APLIKACE ---
function initApp(uid) {
    let cp = window.location.pathname;
    if (cp.endsWith('index.html')) cp = cp.replace('index.html', '');
    if (!cp.endsWith('/')) cp += '/';
    const shareInput = document.getElementById('shareUrlInput');
    if(shareInput) shareInput.value = window.location.origin + cp + 'formular.html?uid=' + uid;

    unsubs.push(onSnapshot(doc(db, "nastaveni", uid), (ds) => {
        if (ds.exists()) {
            const data = ds.data();
            if(data.weddingDate) {
                const wedInput = document.getElementById('weddingDateInput');
                if(wedInput) wedInput.value = data.weddingDate;
            }
            if(data.helperCategories && data.helperCategories.length > 0) {
                helperCategories = data.helperCategories;
            }
        }
        window.updateCountdown();
        window.renderModalCategoryList(); 
        window.renderHelpersView();
    }));

    unsubs.push(onSnapshot(query(tasksColl, where("userId", "==", uid)), snap => {
        allTasksData = []; snap.forEach(d => { let t = d.data(); t.id = d.id; allTasksData.push(t); });
        window.renderTasksView();
    }));

    unsubs.push(onSnapshot(query(shoppingColl, where("userId", "==", uid)), snap => {
        allShoppingData = []; snap.forEach(d => { let s = d.data(); s.id = d.id; allShoppingData.push(s); });
        window.renderShoppingView();
    }));

    unsubs.push(onSnapshot(query(accColl, where("userId", "==", uid)), snap => {
        accPlacesData = []; snap.forEach(d => { let p = d.data(); p.id = d.id; accPlacesData.push(p); });
        window.renderAccView();
    }));

    unsubs.push(onSnapshot(query(guestsColl, where("userId", "==", uid)), snap => {
        allGuestsData = []; snap.forEach(d => { let g = d.data(); g.id = d.id; allGuestsData.push(g); });
        window.updateDashboardStats(); window.renderGuestsView(); window.renderHelpersView(); window.renderAccView();
    }));

    unsubs.push(onSnapshot(query(budgetPlanColl, where("userId", "==", uid)), snap => {
        allBudgetPlans = []; snap.forEach(d => { let b = d.data(); b.id = d.id; allBudgetPlans.push(b); });
        window.renderBudgetView();
    }));

    unsubs.push(onSnapshot(query(expensesColl, where("userId", "==", uid)), snap => {
        allExpenses = []; snap.forEach(d => { let e = d.data(); e.id = d.id; allExpenses.push(e); });
        window.renderBudgetView();
    }));
}

// --- DASHBOARD ---
window.updateDashboardStats = () => {
    let totals = { guests: 0, confirmed: 0, declined: 0, helpers: 0, pendingHelpers: 0, accGuests: 0, pendingAcc: 0, child1: 0, child2: 0, child3: 0 };
    allGuestsData.forEach(g => {
        totals.guests++;
        if (g.status === 'Potvrzeno') totals.confirmed++;
        if (g.status === 'Nezúčastní se') totals.declined++;
        if (g.isHelper) { totals.helpers++; if (g.helperStatus === 'pending') totals.pendingHelpers++; }
        if (g.needsAcc) { totals.accGuests++; if (g.accStatus === 'pending') totals.pendingAcc++; }
        
        // Započítat děti POUZE pokud host NEodmítl účast
        if (g.status !== 'Nezúčastní se') {
            if (g.childrenAges && g.childrenAges.length > 0) {
                g.childrenAges.forEach(age => {
                    if(age.includes('0-3')) totals.child1++;
                    else if(age.includes('4-10')) totals.child2++;
                    else if(age.includes('11+')) totals.child3++;
                });
            }
        }
    });
    
    if(document.getElementById('dashTotalGuests')) document.getElementById('dashTotalGuests').innerText = totals.guests;
    if(document.getElementById('dashConfirmedGuests')) document.getElementById('dashConfirmedGuests').innerText = totals.confirmed;
    if(document.getElementById('dashDeclinedGuests')) document.getElementById('dashDeclinedGuests').innerText = totals.declined;
    if(document.getElementById('dashChild1')) document.getElementById('dashChild1').innerText = totals.child1;
    if(document.getElementById('dashChild2')) document.getElementById('dashChild2').innerText = totals.child2;
    if(document.getElementById('dashChild3')) document.getElementById('dashChild3').innerText = totals.child3;
    if(document.getElementById('dashTotalChildren')) document.getElementById('dashTotalChildren').innerText = (totals.child1 + totals.child2 + totals.child3);
    if(document.getElementById('dashTotalHelpers')) document.getElementById('dashTotalHelpers').innerText = totals.helpers;
    if(document.getElementById('dashPendingHelpers')) document.getElementById('dashPendingHelpers').innerText = totals.pendingHelpers;
    if(document.getElementById('dashTotalAcc')) document.getElementById('dashTotalAcc').innerText = totals.accGuests;
    if(document.getElementById('dashPendingAcc')) document.getElementById('dashPendingAcc').innerText = totals.pendingAcc;
};

window.saveWeddingDate = () => {
    const d = document.getElementById('weddingDateInput');
    if(d && myUid) {
        setDoc(doc(db, "nastaveni", myUid), { weddingDate: d.value }, { merge: true }).then(() => window.updateCountdown());
    }
};

window.updateCountdown = () => {
    const wedInput = document.getElementById('weddingDateInput');
    const disp = document.getElementById('countdownDisplay');
    if (!wedInput || !disp) return;
    if (!wedInput.value) { disp.innerText = "Nastavte datum svatby"; return; }
    
    const targetDate = new Date(wedInput.value); targetDate.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((targetDate - today) / 86400000);
    disp.innerText = diff > 0 ? `Už jen ${diff} dní! 🎉` : (diff === 0 ? `Dnes je ten den! 🎉` : `Svatba už proběhla! ❤️`);
};

// --- ÚKOLY (TO-DO) ---
const addBtn = document.getElementById('addBtn');
if(addBtn) {
    addBtn.onclick = () => {
        const i = document.getElementById('taskInput'), n = document.getElementById('taskNoteInput'), p = document.getElementById('taskPriority');
        if(i && i.value) { addDoc(tasksColl, { text: i.value, note: n.value, priority: p.value, status: 'Není', userId: myUid }); i.value=''; n.value=''; }
    };
}

window.renderTasksView = () => {
    const list = document.getElementById('taskList');
    if(!list) return;
    list.innerHTML = '';
    const filterPri = document.getElementById('filterTaskPriority')?.value || '';
    const filterStat = document.getElementById('filterTaskStatus')?.value || '';
    
    let filtered = allTasksData.filter(t => (!filterPri || t.priority === filterPri) && (!filterStat || t.status === filterStat));
    filtered.sort((a, b) => {
        if(a.status === 'Hotovo' && b.status !== 'Hotovo') return 1;
        if(a.status !== 'Hotovo' && b.status === 'Hotovo') return -1;
        return 0;
    });
    
    filtered.forEach(t => {
        const textStyle = t.status === 'Hotovo' ? 'text-decoration: line-through; color: #aaa;' : '';
        list.innerHTML += `<tr>
            <td><select onchange="updateDoc(doc(db, 'ukoly', '${t.id}'), {status: this.value})">
                <option value="Není" ${t.status==='Není'?'selected':''}>❌ Není</option>
                <option value="V průběhu" ${t.status==='V průběhu'?'selected':''}>⏳ V průběhu</option>
                <option value="Hotovo" ${t.status==='Hotovo'?'selected':''}>✅ Hotovo</option>
            </select></td>
            <td class="priority-${t.priority}">${t.priority}</td>
            <td><strong style="${textStyle}">${t.text}</strong></td>
            <td><small>${t.note || '-'}</small></td>
            <td><button class="btn-small" onclick="deleteDoc(doc(db, 'ukoly', '${t.id}'))">❌</button></td></tr>`;
    });
};

// --- NÁKUPNÍ SEZNAM ---
const addShoppingBtn = document.getElementById('addShoppingBtn');
if(addShoppingBtn) {
    addShoppingBtn.onclick = () => {
        const i = document.getElementById('shoppingInput'), n = document.getElementById('shoppingNoteInput');
        if(i && i.value) { 
            addDoc(shoppingColl, { name: i.value, note: n.value, completed: false, userId: myUid }); 
            i.value=''; n.value=''; 
        }
    };
}

window.renderShoppingView = () => {
    const list = document.getElementById('shoppingListBody');
    if(!list) return;
    list.innerHTML = '';
    
    let sorted = [...allShoppingData];
    sorted.sort((a, b) => {
        if(a.completed === true && b.completed !== true) return 1;
        if(a.completed !== true && b.completed === true) return -1;
        return 0;
    });
    
    sorted.forEach(s => {
        const textStyle = s.completed ? 'text-decoration: line-through; color: #aaa;' : '';
        list.innerHTML += `<tr>
            <td style="width: 50px; text-align: center;">
                <input type="checkbox" ${s.completed ? 'checked' : ''} onchange="updateDoc(doc(db, 'nakupni_seznam', '${s.id}'), {completed: this.checked})" style="width:20px; height:20px; cursor:pointer;">
            </td>
            <td><strong style="${textStyle}">${s.name}</strong></td>
            <td><small style="${textStyle}">${s.note || '-'}</small></td>
            <td>
                <button class="btn-small btn-secondary" onclick="openShoppingModal('${s.id}')">✏️</button>
                <button class="btn-small" onclick="deleteDoc(doc(db, 'nakupni_seznam', '${s.id}'))">❌</button>
            </td>
        </tr>`;
    });
};

window.openShoppingModal = (id) => {
    const s = allShoppingData.find(x => x.id === id);
    if(!s) return;
    document.getElementById('editShoppingId').value = id;
    document.getElementById('editShoppingName').value = s.name;
    document.getElementById('editShoppingNote').value = s.note || '';
    document.getElementById('editShoppingModal').classList.remove('hidden');
};
window.closeShoppingModal = () => document.getElementById('editShoppingModal').classList.add('hidden');
window.saveShoppingEdit = () => {
    const id = document.getElementById('editShoppingId').value;
    updateDoc(doc(db, 'nakupni_seznam', id), {
        name: document.getElementById('editShoppingName').value,
        note: document.getElementById('editShoppingNote').value
    });
    window.closeShoppingModal();
};

// --- ROZPOČET ---
window.renderBudgetView = () => {
    const summaryBody = document.getElementById('budgetCategorySummaryBody'); 
    const expBody = document.getElementById('budgetExpensesBody');
    const catSelect = document.getElementById('expenseCategorySelect');
    if(!summaryBody || !expBody || !catSelect) return;

    let estTotal = 0, actTotal = 0, catSums = {};

    allBudgetPlans.forEach(p => {
        estTotal += Number(p.estimated);
        catSums[p.category] = { est: Number(p.estimated), act: 0, id: p.id };
    });

    let selHtml = '<option value="">-- Vyberte kategorii z plánu --</option>';
    allBudgetPlans.forEach(p => { selHtml += `<option value="${p.category}">${p.category}</option>`; });
    catSelect.innerHTML = selHtml;

    const txtFilter = (document.getElementById('filterBudgetText')?.value || '').toLowerCase();
    const catFilter = (document.getElementById('filterBudgetCat')?.value || '').toLowerCase();

    allExpenses.forEach(e => {
        let cat = e.category || 'Nezařazeno';
        let amt = Number(e.amount || 0);
        actTotal += amt;
        if(!catSums[cat]) catSums[cat] = { est: 0, act: 0, id: null };
        catSums[cat].act += amt;
    });

    summaryBody.innerHTML = '';
    for (let [cat, data] of Object.entries(catSums)) {
        let colorClass = data.act > data.est ? 'budget-negative' : (data.act > 0 ? 'budget-positive' : '');
        let actionHtml = data.id ? `<button class="btn-small btn-secondary" onclick="openPlanModal('${data.id}')">✏️</button> <button class="btn-small" onclick="deleteDoc(doc(db, 'rozpocet_plan', '${data.id}'))">❌</button>` : '';
        summaryBody.innerHTML += `<tr><td><strong>${cat}</strong></td><td>${data.est.toLocaleString()} Kč</td><td class="${colorClass}"><strong>${data.act.toLocaleString()} Kč</strong></td><td>${actionHtml}</td></tr>`;
    }
    
    expBody.innerHTML = '';
    allExpenses.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(e => {
        if (txtFilter && !(e.name||'').toLowerCase().includes(txtFilter)) return;
        if (catFilter && !(e.category||'').toLowerCase().includes(catFilter)) return;
        let dStr = e.date ? new Date(e.date).toLocaleDateString('cs-CZ') : '-';
        expBody.innerHTML += `<tr><td>${dStr}</td><td>${e.category}</td><td>${e.name}</td><td><strong>${Number(e.amount).toLocaleString()} Kč</strong></td>
            <td><button class="btn-small btn-secondary" onclick="openExpenseModal('${e.id}')">✏️</button> <button class="btn-small" onclick="deleteDoc(doc(db, 'rozpocet_naklady', '${e.id}'))">❌</button></td></tr>`;
    });

    if(document.getElementById('totalEstimated')) document.getElementById('totalEstimated').innerText = estTotal.toLocaleString() + " Kč";
    if(document.getElementById('totalActual')) document.getElementById('totalActual').innerText = actTotal.toLocaleString() + " Kč";
    const actBox = document.getElementById('totalActualBox');
    if(actBox) { actBox.className = actTotal > estTotal ? 'stat-box stat-negative' : (actTotal > 0 ? 'stat-box stat-positive' : 'stat-box'); }
};

const addPlanBtn = document.getElementById('addPlanBtn');
if(addPlanBtn) {
    addPlanBtn.onclick = () => {
        const cat = document.getElementById('planCategoryName').value; const est = document.getElementById('planEstimatedAmount').value;
        if(cat && est) {
            addDoc(budgetPlanColl, { category: cat, estimated: Number(est), userId: myUid });
            document.getElementById('planCategoryName').value = ''; document.getElementById('planEstimatedAmount').value = '';
        }
    };
}

const addExpenseBtn = document.getElementById('addExpenseBtn');
if(addExpenseBtn) {
    addExpenseBtn.onclick = () => {
        const d = document.getElementById('expenseDate').value, n = document.getElementById('expenseName').value;
        const c = document.getElementById('expenseCategorySelect').value, a = document.getElementById('expenseActualAmount').value;
        if(n && a) {
            addDoc(expensesColl, { date: d, name: n, category: c, amount: Number(a), userId: myUid });
            document.getElementById('expenseDate').value = ''; document.getElementById('expenseName').value = '';
            document.getElementById('expenseCategorySelect').value = ''; document.getElementById('expenseActualAmount').value = '';
        }
    };
}

window.openPlanModal = (id) => {
    const p = allBudgetPlans.find(x => x.id === id);
    if (!p) return;
    document.getElementById('editPlanId').value = id;
    document.getElementById('editPlanCatName').value = p.category;
    document.getElementById('editPlanAmount').value = p.estimated;
    document.getElementById('editPlanModal').classList.remove('hidden');
};
window.closePlanModal = () => document.getElementById('editPlanModal').classList.add('hidden');
window.savePlanEdit = () => {
    updateDoc(doc(db, 'rozpocet_plan', document.getElementById('editPlanId').value), { category: document.getElementById('editPlanCatName').value, estimated: Number(document.getElementById('editPlanAmount').value) });
    window.closePlanModal();
};

window.openExpenseModal = (id) => {
    const e = allExpenses.find(x => x.id === id);
    if (!e) return;
    document.getElementById('editExpId').value = id;
    document.getElementById('editExpDate').value = e.date || '';
    document.getElementById('editExpName').value = e.name;
    const sel = document.getElementById('editExpCatSelect');
    sel.innerHTML = '<option value="">-- Vyberte kategorii z plánu --</option>' + allBudgetPlans.map(p => `<option value="${p.category}">${p.category}</option>`).join('');
    sel.value = e.category || '';
    document.getElementById('editExpAmount').value = e.amount;
    document.getElementById('editExpenseModal').classList.remove('hidden');
};
window.closeExpenseModal = () => document.getElementById('editExpenseModal').classList.add('hidden');
window.saveExpenseEdit = () => {
    updateDoc(doc(db, 'rozpocet_naklady', document.getElementById('editExpId').value), {
        date: document.getElementById('editExpDate').value, name: document.getElementById('editExpName').value,
        category: document.getElementById('editExpCatSelect').value, amount: Number(document.getElementById('editExpAmount').value)
    });
    window.closeExpenseModal();
};

// --- HOSTÉ A DĚTI ---
window.renderAdminChildrenAges = () => {
    const num = document.getElementById('guestChildren').value; const cont = document.getElementById('adminChildrenAgesContainer');
    if(!cont) return; cont.innerHTML = '';
    for(let i=0; i<num; i++) {
        cont.innerHTML += `<div style="margin-top:5px; display:flex; gap:10px; align-items:center;"><label style="font-size:0.85rem;">Věk dítěte ${i+1}:</label>
                <select class="admin-child-age-select" style="padding:5px;"><option value="Malé (0-3)">Malé (0-3 roky)</option><option value="Střední (4-10)">Střední (4-10 let)</option><option value="Velké (11+)">Velké (11+ let)</option></select></div>`;
    }
};

window.renderEditModalChildrenAges = () => {
    const num = document.getElementById('editNumChildren').value; const cont = document.getElementById('editModalChildrenAgesContainer');
    if(!cont) return; cont.innerHTML = '';
    for(let i=0; i<num; i++) {
        cont.innerHTML += `<div style="margin-top:5px; display:flex; gap:10px; align-items:center;"><label style="font-size:0.85rem;">Věk dítěte ${i+1}:</label>
                <select class="edit-child-age-select" style="padding:5px;"><option value="Malé (0-3)">Malé (0-3 roky)</option><option value="Střední (4-10)">Střední (4-10 let)</option><option value="Velké (11+)">Velké (11+ let)</option></select></div>`;
    }
};

window.renderGuestsView = () => {
    const tbody = document.getElementById('guestTableBody'); 
    if(!tbody) return;
    
    let filtered = [...allGuestsData];
    const nInput = (document.getElementById('filterGuestName')?.value || '').toLowerCase().split(',').map(s=>s.trim()).filter(s=>s);
    const cInput = (document.getElementById('filterGuestCity')?.value || '').toLowerCase().split(',').map(s=>s.trim()).filter(s=>s);
    const dateInput = document.getElementById('filterGuestDate')?.value || '';
    const sides = Array.from(document.querySelectorAll('.filter-side:checked')).map(cb=>cb.value);
    const statuses = Array.from(document.querySelectorAll('.filter-status:checked')).map(cb=>cb.value);
    const sortType = document.getElementById('sortGuestDate')?.value || 'desc';

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

    tbody.innerHTML = '';
    let stats = { total:0, confirmed:0, declined:0, nevesta:0, zenich:0, spolecny:0, cities:{}, children: { 'Malé (0-3)':0, 'Střední (4-10)':0, 'Velké (11+)':0 } };

    filtered.forEach(g => {
        stats.total++;
        if(g.status === 'Potvrzeno') stats.confirmed++;
        if(g.status === 'Nezúčastní se') stats.declined++;
        if(g.side === 'Nevěsta') stats.nevesta++; else if(g.side === 'Ženich') stats.zenich++; else stats.spolecny++;
        let city = g.city ? g.city.trim() : 'Nezadáno';
        stats.cities[city] = (stats.cities[city] || 0) + 1;

        let childInfo = g.numChildren > 0 ? `<br><small style="color:#d81b60;">👶 ${g.numChildren} dětí (${g.childrenAges?.join(', ') || ''})</small>` : '';
        
        // Započítat děti do číselníků POUZE pokud host NEodmítl
        if (g.status !== 'Nezúčastní se' && g.childrenAges) {
            g.childrenAges.forEach(age => { if(stats.children[age] !== undefined) stats.children[age]++; });
        }

        tbody.innerHTML += `<tr class="${g.side === 'Nevěsta' ? 'side-nevesta' : (g.side === 'Ženich' ? 'side-zenich' : 'side-spolecny')}">
            <td><strong>${g.name}</strong>${childInfo}</td><td>${g.city || '-'}</td><td>${g.side}</td>
            <td style="cursor:pointer" onclick="toggleGuest('${g.id}','${g.status}')">${g.status === 'Potvrzeno' ? '✅ Potvrzeno' : (g.status === 'Nezúčastní se' ? '<span class="status-declined">❌ Odmítl/a</span>' : '📩 Pozváno')}</td>
            <td><button class="btn-small btn-secondary" onclick="openEditModal('${g.id}')">✏️</button> <button class="btn-small" onclick="deleteDoc(doc(db, 'hoste', '${g.id}'))">❌</button></td></tr>`;
    });

    let cityHtml = '<strong>Hosté z měst:</strong><br>';
    for (let [city, count] of Object.entries(stats.cities)) cityHtml += `<div class="city-badge">${city} <span>(${count}x)</span></div>`;
    
    if(document.getElementById('cityBadgesContainer')) document.getElementById('cityBadgesContainer').innerHTML = cityHtml;

    if(document.getElementById('guestStatsBlock')) {
        document.getElementById('guestStatsBlock').innerHTML = `
            <div class="stat-box" style="background:#e3f2fd;">Zobrazeno (Dospělí): <strong>${stats.total}</strong></div>
            <div class="stat-box">Nevěsta: <strong>${stats.nevesta}</strong></div>
            <div class="stat-box">Ženich: <strong>${stats.zenich}</strong></div>
            <div class="stat-box">Společní: <strong>${stats.spolecny}</strong></div>
            <div class="stat-box" style="background:#e8f5e9;">Potvrzeno: <strong style="color:#27ae60;">${stats.confirmed}</strong></div>
            <div class="stat-box" style="background:#ffebee;">Odmítlo: <strong style="color:#c62828;">${stats.declined}</strong></div>
            <div class="stat-box" style="background:#fff0f5;">Děti (0-3): <strong>${stats.children['Malé (0-3)']}</strong></div>
            <div class="stat-box" style="background:#fff0f5;">Děti (4-10): <strong>${stats.children['Střední (4-10)']}</strong></div>
            <div class="stat-box" style="background:#fff0f5;">Děti (11+): <strong>${stats.children['Velké (11+)']}</strong></div>
        `;
    }
};

const addGuestBtn = document.getElementById('addGuestBtn');
if(addGuestBtn) {
    addGuestBtn.onclick = () => {
        const name = document.getElementById('guestName').value; const numChild = Number(document.getElementById('guestChildren').value) || 0;
        const childAges = Array.from(document.querySelectorAll('.admin-child-age-select')).map(s => s.value);
        const isH = document.getElementById('isHelper') ? document.getElementById('isHelper').checked : false;
        const needsA = document.getElementById('needsAcc') ? document.getElementById('needsAcc').checked : false;

        if(name) {
            addDoc(guestsColl, { 
                name, city: document.getElementById('guestCity').value, side: document.getElementById('guestSide').value, 
                isHelper: isH, needsAcc: needsA, status: 'Pozváno', helperTask: '', helperStatus: isH ? 'pending' : '', accPlace: '', accRoom: '', accStatus: needsA ? 'pending' : '', 
                userId: myUid, submittedDate: new Date().toISOString(), numChildren: numChild, childrenAges: childAges
            });
            document.getElementById('guestName').value = ''; document.getElementById('guestCity').value = ''; document.getElementById('guestChildren').value = '';
            if(document.getElementById('adminChildrenAgesContainer')) document.getElementById('adminChildrenAgesContainer').innerHTML = '';
            if(document.getElementById('isHelper')) document.getElementById('isHelper').checked = false;
            if(document.getElementById('needsAcc')) document.getElementById('needsAcc').checked = false;
        }
    };
}

window.openEditModal = (id) => {
    const guest = allGuestsData.find(g => g.id === id);
    if (!guest) return;
    document.getElementById('editGuestId').value = id; document.getElementById('editGuestName').value = guest.name;
    document.getElementById('editGuestCity').value = guest.city || ''; document.getElementById('editGuestSide').value = guest.side || 'Nevěsta';
    document.getElementById('editNumChildren').value = guest.numChildren || 0;
    
    window.renderEditModalChildrenAges();
    const ageSelects = document.querySelectorAll('.edit-child-age-select');
    if(guest.childrenAges) { guest.childrenAges.forEach((age, index) => { if(ageSelects[index]) ageSelects[index].value = age; }); }

    if(document.getElementById('editIsHelper')) document.getElementById('editIsHelper').checked = guest.isHelper || false;
    if(document.getElementById('editNeedsAcc')) document.getElementById('editNeedsAcc').checked = guest.needsAcc || false;
    const m = document.getElementById('editModal'); if(m) m.classList.remove('hidden');
};

window.closeModal = () => { const m = document.getElementById('editModal'); if(m) m.classList.add('hidden'); };

window.saveGuestEdit = () => {
    const id = document.getElementById('editGuestId').value;
    const isH = document.getElementById('editIsHelper') ? document.getElementById('editIsHelper').checked : false;
    const needsA = document.getElementById('editNeedsAcc') ? document.getElementById('editNeedsAcc').checked : false;
    const childAges = Array.from(document.querySelectorAll('.edit-child-age-select')).map(s => s.value);
    
    const guest = allGuestsData.find(g => g.id === id);
    let hStatus = guest.helperStatus; if (isH && (!hStatus || hStatus === '')) hStatus = 'pending'; if (!isH) hStatus = '';
    let aStatus = guest.accStatus; if (needsA && (!aStatus || aStatus === '')) aStatus = 'pending'; if (!needsA) aStatus = '';

    updateDoc(doc(db, 'hoste', id), { 
        name: document.getElementById('editGuestName').value, city: document.getElementById('editGuestCity').value, side: document.getElementById('editGuestSide').value,
        numChildren: Number(document.getElementById('editNumChildren').value), childrenAges: childAges,
        isHelper: isH, needsAcc: needsA, helperStatus: hStatus, accStatus: aStatus
    });
    window.closeModal();
};

window.toggleGuest = (id, s) => { let n = 'Pozváno'; if (s === 'Pozváno') n = 'Potvrzeno'; else if (s === 'Potvrzeno') n = 'Nezúčastní se'; updateDoc(doc(db, 'hoste', id), { status: n }); };

// --- POMOCNÍCI ---
window.openCategoryEditModal = () => { window.renderModalCategoryList(); document.getElementById('categoryEditModal').classList.remove('hidden'); };
window.closeCategoryEditModal = () => document.getElementById('categoryEditModal').classList.add('hidden');

window.renderModalCategoryList = () => {
    const list = document.getElementById('modalCategoryList');
    if(!list) return;
    list.innerHTML = helperCategories.map(c => `
        <div style="display:flex; justify-content:space-between; background:#f9f9f9; padding:8px; border-radius:5px; border:1px solid #eee;">
            <span>${c}</span> <button class="btn-small btn-secondary" onclick="removeHelperCategory('${c}')">❌</button>
        </div>`).join('');
};

window.addHelperCategoryFromModal = () => {
    const input = document.getElementById('modalNewCatInput');
    if(!input) return;
    const v = input.value.trim();
    if(v && !helperCategories.includes(v)) { 
        helperCategories.push(v); 
        setDoc(doc(db, "nastaveni", myUid), {helperCategories}, {merge:true}).then(() => { input.value = ''; window.renderModalCategoryList(); window.renderHelpersView(); });
    }
};

window.removeHelperCategory = (cat) => {
    helperCategories = helperCategories.filter(c => c !== cat);
    setDoc(doc(db, "nastaveni", myUid), { helperCategories }, { merge: true }).then(() => { window.renderModalCategoryList(); window.renderHelpersView(); });
};

window.toggleHelperFilter = (cat) => {
    if(activeHelperFilters.includes(cat)) activeHelperFilters = activeHelperFilters.filter(c => c !== cat);
    else activeHelperFilters.push(cat);
    window.renderHelpersView();
};

window.renderHelpersView = () => {
    const hp = document.getElementById('helperPendingTableBody'); 
    const ha = document.getElementById('helperAssignedTableBody'); 
    if(!hp || !ha) return;
    hp.innerHTML = ''; ha.innerHTML = '';
    
    let tasksStats = {};
    helperCategories.forEach(c => tasksStats[c] = 0);

    allGuestsData.filter(g => g.isHelper).forEach(g => {
        if (g.helperStatus === 'pending') {
            hp.innerHTML += `<tr><td><strong>${g.name}</strong><br><small>Z formuláře: ${g.helperTask || 'Nic'}</small></td>
                <td><button class="btn-small btn-secondary" onclick="openHelperModal('${g.id}')">📋 Vybrat role</button></td>
                <td><button class="btn-small" onclick="updateDoc(doc(db, 'hoste', '${g.id}'), {helperStatus:'assigned'})">✅ Schválit</button></td></tr>`;
        } else {
            let tArray = (g.helperTask ? g.helperTask : 'Nepřiřazeno').split(',').map(s => s.trim()).filter(s => s);
            if(tArray.length === 0) tArray = ['Nepřiřazeno'];
            
            tArray.forEach(t => { if (tasksStats[t] === undefined) tasksStats[t] = 0; tasksStats[t] += 1; });

            let showRow = activeHelperFilters.length === 0 || activeHelperFilters.some(f => tArray.includes(f));
            if(showRow) {
                ha.innerHTML += `<tr><td><strong>${g.name}</strong></td><td>${g.helperTask || '-'}</td>
                    <td><button class="btn-small btn-secondary" onclick="openHelperModal('${g.id}')">✏️ Upravit</button></td></tr>`;
            }
        }
    });

    let hHtml = '';
    for (let [task, count] of Object.entries(tasksStats)) {
        let activeClass = activeHelperFilters.includes(task) ? 'active' : '';
        hHtml += `<div class="helper-stat-box ${activeClass}" onclick="toggleHelperFilter('${task}')">${task} <strong>${count}x</strong></div>`;
    }
    if(document.getElementById('helperStatsBlock')) document.getElementById('helperStatsBlock').innerHTML = hHtml;
};

window.openHelperModal = (id) => {
    const g = allGuestsData.find(x => x.id === id);
    if(!g) return;
    document.getElementById('modalHelperId').value = id;
    const cont = document.getElementById('modalHelperCheckboxes');
    if(cont) {
        cont.innerHTML = helperCategories.map(c => `
            <label style="padding:10px; background:#f9f9f9; border-radius:8px; border:1px solid #eee;">
                <input type="checkbox" value="${c}" ${(g.helperTask || '').includes(c) ? 'checked' : ''}> ${c}
            </label>
        `).join('');
    }
    const modal = document.getElementById('helperEditModal');
    if(modal) modal.classList.remove('hidden');
};

window.saveHelperRoles = () => {
    const id = document.getElementById('modalHelperId').value;
    const roles = Array.from(document.querySelectorAll('#modalHelperCheckboxes input:checked')).map(cb => cb.value).join(', ');
    updateDoc(doc(db, 'hoste', id), { helperTask: roles });
    window.closeHelperModal();
};

window.closeHelperModal = () => {
    const m = document.getElementById('helperEditModal');
    if(m) m.classList.add('hidden');
};

// --- UBYTOVÁNÍ A KAPACITA ---
function getRoomCapacity(name) {
    let n = name.toLowerCase();
    if(n.includes('jedno')) return 1; if(n.includes('dvou') || n.includes('dvoj')) return 2; if(n.includes('tří') || n.includes('tri') || n.includes('troj')) return 3;
    if(n.includes('čtyř') || n.includes('ctyr')) return 4; if(n.includes('pěti') || n.includes('peti')) return 5;
    if(n.includes('šesti') || n.includes('sesti')) return 6;
    let m = n.match(/(\d+)(?=-?lůž|-?luz)/); if(m) return parseInt(m[1]); 
    return 2;
}

window.renderAccView = () => {
    const placesCont = document.getElementById('accPlacesContainer'); 
    const aPending = document.getElementById('accPendingTableBody'); 
    const aAssigned = document.getElementById('accAssignedTableBody'); 
    if(!placesCont || !aPending || !aAssigned) return;

    placesCont.innerHTML = ''; aPending.innerHTML = ''; aAssigned.innerHTML = '';
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
        placesCont.innerHTML += `<div class="acc-place-card"><h4>${p.name} <div><button class="btn-small btn-secondary" onclick="openAccPlaceEditModal('${p.id}')">✏️ Upravit</button> <button class="btn-small" onclick="deleteDoc(doc(db, 'ubytovani_kapacity', '${p.id}'))">❌ Smazat</button></div></h4><div>${rHtml || '<i>Žádné pokoje</i>'}</div></div>`;
    });

    allGuestsData.filter(g => g.needsAcc && g.accStatus === 'pending').forEach(g => {
        aPending.innerHTML += `<tr><td><strong>${g.name}</strong></td><td>${g.accRoom || '-'}</td><td><select id="selPlace_${g.id}" style="width:100%; margin-bottom:5px;" onchange="loadRoomsForSelect('${g.id}', this.value)">${selectPlacesHtml}</select><select id="selRoom_${g.id}" style="width:100%; display:none;"><option value="">-- Nejdřív vyberte místo --</option></select></td><td><button class="btn-small" onclick="approveAcc('${g.id}')">Schválit</button></td></tr>`;
    });

    const filterSelect = document.getElementById('filterAccAssignedPlace');
    if(filterSelect && filterSelect.options.length <= 1 && accPlacesData.length > 0) {
        let opts = '<option value="">-- Všechna místa --</option>';
        accPlacesData.forEach(p => opts += `<option value="${p.name}">${p.name}</option>`);
        filterSelect.innerHTML = opts;
    }

    const selFilterPlace = document.getElementById('filterAccAssignedPlace')?.value || '';
    const selFilterRoom = (document.getElementById('filterAccAssignedRoom')?.value || '').toLowerCase();
    const selFilterName = (document.getElementById('filterAccAssignedName')?.value || '').toLowerCase();

    allGuestsData.filter(g => g.needsAcc && g.accStatus === 'assigned').forEach(g => {
        if(selFilterPlace && g.accPlace !== selFilterPlace) return;
        if(selFilterRoom && !(g.accRoom || '').toLowerCase().includes(selFilterRoom)) return;
        if(selFilterName && !g.name.toLowerCase().includes(selFilterName)) return;

        let options = `<option value="">-- Vybrat místo a pokoj --</option>` + accPlacesData.map(p => p.rooms.map(r => `<option value="${p.name}|${r}" ${g.accPlace===p.name && g.accRoom===r ? 'selected':''}>${p.name}: ${r}</option>`).join('')).join('');
        
        aAssigned.innerHTML += `
            <tr>
                <td><strong>${g.name}</strong></td>
                <td>${g.accPlace}</td>
                <td>
                    <div id="disp_room_${g.id}" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                        <span>${g.accRoom}</span>
                        <button class="btn-small btn-secondary" onclick="toggleAccEdit('${g.id}')">✏️ Upravit</button>
                    </div>
                    <div id="edit_box_${g.id}" class="hidden" style="display:flex; gap:5px; flex-wrap:wrap; margin-top:5px;">
                        <select id="edit_sel_${g.id}" style="flex:1;">${options}</select>
                        <button class="btn-small" onclick="saveAccEdit('${g.id}')">✔ Uložit</button>
                        <button class="btn-small btn-secondary" onclick="updateDoc(doc(db, 'hoste', '${g.id}'), {accStatus: 'pending'})" title="Vrátit do žádostí">↩️ Do žádostí</button>
                    </div>
                </td>
            </tr>`;
    });
};

window.toggleAccEdit = (id) => {
    document.getElementById(`disp_room_${id}`).classList.add('hidden');
    document.getElementById(`edit_box_${id}`).classList.remove('hidden');
};

window.saveAccEdit = (id) => {
    const v = document.getElementById(`edit_sel_${id}`).value.split('|');
    if(v.length === 2) { updateDoc(doc(db, 'hoste', id), {accPlace: v[0], accRoom: v[1]}); }
};

window.openAccPlaceEditModal = (id) => {
    const place = accPlacesData.find(p => p.id === id);
    if (!place) return;
    currentEditAccPlace = JSON.parse(JSON.stringify(place));
    document.getElementById('editAccPlaceId').value = id;
    document.getElementById('editAccPlaceName').value = currentEditAccPlace.name;
    window.renderModalAccRooms();
    document.getElementById('editAccPlaceModal').classList.remove('hidden');
};

window.renderModalAccRooms = () => {
    const container = document.getElementById('editAccRoomsContainer');
    if(!container) return;
    container.innerHTML = currentEditAccPlace.rooms.map((r, i) => `
        <div style="display:flex; gap:5px; margin-bottom:5px;">
            <input type="text" class="editable-input" value="${r}" onchange="currentEditAccPlace.rooms[${i}] = this.value">
            <button class="btn-small btn-secondary" onclick="removeRoomFromModal(${i})">❌</button>
        </div>
    `).join('');
};

window.addRoomToModal = () => { currentEditAccPlace.rooms.push("Nový pokoj"); window.renderModalAccRooms(); };
window.removeRoomFromModal = (index) => { currentEditAccPlace.rooms.splice(index, 1); window.renderModalAccRooms(); };

window.saveAccPlaceEdit = () => {
    const id = document.getElementById('editAccPlaceId').value;
    const newName = document.getElementById('editAccPlaceName').value;
    updateDoc(doc(db, 'ubytovani_kapacity', id), { name: newName, rooms: currentEditAccPlace.rooms.filter(r => r.trim() !== '') });
    document.getElementById('editAccPlaceModal').classList.add('hidden');
};

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

window.loadRoomsForSelect = (guestId, placeId) => {
    const roomSelect = document.getElementById(`selRoom_${guestId}`);
    if(!placeId || !roomSelect) { if(roomSelect) roomSelect.style.display = 'none'; return; }
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

window.deleteMyAccountAndData = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const confirmDelete = confirm("Opravdu chcete nenávratně smazat svůj účet a VŠECHNA svá data ze svatby? Tuto akci nelze vzít zpět.");
    if (!confirmDelete) return;

    const uid = user.uid;

    try {
        const guestsSnap = await getDocs(query(guestsColl, where("userId", "==", uid))); guestsSnap.forEach(d => deleteDoc(d.ref));
        const tasksSnap = await getDocs(query(tasksColl, where("userId", "==", uid))); tasksSnap.forEach(d => deleteDoc(d.ref));
        const budgetPlanSnap = await getDocs(query(budgetPlanColl, where("userId", "==", uid))); budgetPlanSnap.forEach(d => deleteDoc(d.ref));
        const expensesSnap = await getDocs(query(expensesColl, where("userId", "==", uid))); expensesSnap.forEach(d => deleteDoc(d.ref));
        const accSnap = await getDocs(query(accColl, where("userId", "==", uid))); accSnap.forEach(d => deleteDoc(d.ref));
        const shopSnap = await getDocs(query(shoppingColl, where("userId", "==", uid))); shopSnap.forEach(d => deleteDoc(d.ref));
        await deleteDoc(doc(db, "nastaveni", uid));
        await deleteUser(user);
        alert("Váš účet a všechna data byla úspěšně a bezpečně smazána.");
    } catch (error) {
        if(error.code === 'auth/requires-recent-login') alert("Z bezpečnostních důvodů se prosím odhlaste, znovu přihlaste a zkuste to znovu.");
        else alert("Chyba při mazání dat: " + error.message);
    }
};

// --- GLOBÁLNÍ EXPORTY ---
window.doc = doc; window.db = db; window.deleteDoc = deleteDoc; window.updateDoc = updateDoc;

window.copyShareUrl = () => {
    const copyText = document.getElementById("shareUrlInput");
    if(copyText) { copyText.select(); navigator.clipboard.writeText(copyText.value); alert("Odkaz zkopírován!"); }
};
