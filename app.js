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
    // Sledování Úkolů
    unsubs.push(onSnapshot(query(tasksColl, where("userId", "==", uid)), snap => {
        const list = document.getElementById('taskList'); list.innerHTML = '';
        snap.forEach(d => {
            const t = d.data();
            const li = document.createElement('li');
            li.className = t.completed ? 'completed' : '';
            li.innerHTML = `<span>${t.text}</span> <button class="btn-small" onclick="deleteDoc(doc(db, 'ukoly', '${d.id}'))">❌</button>`;
            li.querySelector('span').onclick = () => updateDoc(doc(db, 'ukoly', d.id), { completed: !t.completed });
            list.appendChild(li);
        });
    }));

    // Sledování Hostů (A propisování do Pomocníků a Ubytování)
    unsubs.push(onSnapshot(query(guestsColl, where("userId", "==", uid)), snap => {
        const gBody = document.getElementById('guestTableBody');
        const hBody = document.getElementById('helperTableBody');
        const aBody = document.getElementById('accTableBody');
        
        gBody.innerHTML = ''; hBody.innerHTML = ''; aBody.innerHTML = '';

        snap.forEach(d => {
            const g = d.data();
            const id = d.id;

            // 1. Hlavní tabulka hostů
            const tr = document.createElement('tr');
            let colorClass = g.side === 'Nevěsta' ? 'side-nevesta' : (g.side === 'Ženich' ? 'side-zenich' : 'side-spolecny');
            tr.className = colorClass;
            tr.innerHTML = `
                <td><strong>${g.name}</strong></td>
                <td>${g.city || '-'}</td>
                <td>${g.side}</td>
                <td style="cursor:pointer" onclick="toggleGuest('${id}','${g.status}')">${g.status === 'Potvrzeno' ? '✅ Potvrzeno' : '📩 Pozváno'}</td>
                <td><button class="btn-small" onclick="deleteDoc(doc(db, 'hoste', '${id}'))">❌</button></td>
            `;
            gBody.appendChild(tr);

            // 2. Tabulka Pomocníků (pokud je isHelper: true)
            if (g.isHelper) {
                const trH = document.createElement('tr');
                trH.innerHTML = `
                    <td>${g.name}</td>
                    <td><input type="text" class="editable-input" placeholder="Co bude dělat?" value="${g.helperTask || ''}" onchange="updateGuestField('${id}', 'helperTask', this.value)"></td>
                `;
                hBody.appendChild(trH);
            }

            // 3. Tabulka Ubytování (pokud je needsAcc: true)
            if (g.needsAcc) {
                const trA = document.createElement('tr');
                trA.innerHTML = `
                    <td>${g.name}</td>
                    <td><input type="text" class="editable-input" placeholder="Kde bude spát?" value="${g.roomInfo || ''}" onchange="updateGuestField('${id}', 'roomInfo', this.value)"></td>
                `;
                aBody.appendChild(trA);
            }
        });
    }));

    // Sledování Rozpočtu
    unsubs.push(onSnapshot(query(budgetColl, where("userId", "==", uid)), snap => {
        const tbody = document.getElementById('budgetTableBody'); tbody.innerHTML = '';
        let estTotal = 0, actTotal = 0;
        snap.forEach(d => {
            const b = d.data(); estTotal += Number(b.estimated); actTotal += Number(b.actual || 0);
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${b.name}</td><td>${b.estimated} Kč</td><td><input type="number" class="editable-input" style="width:80px" value="${b.actual || 0}" onchange="updateDoc(doc(db, 'rozpocet', '${d.id}'), {actual: Number(this.value)})"></td><td><button class="btn-small" onclick="deleteDoc(doc(db, 'rozpocet', '${d.id}'))">❌</button></td>`;
            tbody.appendChild(tr);
        });
        document.getElementById('totalEstimated').innerText = estTotal.toLocaleString() + " Kč";
        document.getElementById('totalActual').innerText = actTotal.toLocaleString() + " Kč";
    }));
}

// --- AKCE PŘIDÁVÁNÍ ---
document.getElementById('addBtn').onclick = () => {
    const val = document.getElementById('taskInput').value;
    if(val) addDoc(tasksColl, { text: val, completed: false, userId: auth.currentUser.uid });
    document.getElementById('taskInput').value = '';
};

document.getElementById('addGuestBtn').onclick = () => {
    const name = document.getElementById('guestName').value;
    const city = document.getElementById('guestCity').value;
    const side = document.getElementById('guestSide').value;
    const isHelper = document.getElementById('isHelper').checked;
    const needsAcc = document.getElementById('needsAcc').checked;

    if(name) {
        addDoc(guestsColl, { 
            name, city, side, isHelper, needsAcc, 
            status: 'Pozváno', 
            helperTask: '', roomInfo: '',
            userId: auth.currentUser.uid 
        });
        // Vyčistit formulář
        document.getElementById('guestName').value = '';
        document.getElementById('guestCity').value = '';
        document.getElementById('isHelper').checked = false;
        document.getElementById('needsAcc').checked = false;
    }
};

document.getElementById('addBudgetBtn').onclick = () => {
    const name = document.getElementById('budgetItemName').value;
    const estimated = document.getElementById('budgetEstimated').value;
    if(name && estimated) addDoc(budgetColl, { name, estimated: Number(estimated), actual: 0, userId: auth.currentUser.uid });
    document.getElementById('budgetItemName').value = ''; document.getElementById('budgetEstimated').value = '';
};

// Pomocné funkce
window.db = db; window.doc = doc; window.deleteDoc = deleteDoc; window.updateDoc = updateDoc;
window.toggleGuest = (id, s) => updateDoc(doc(db, 'hoste', id), { status: s === 'Pozváno' ? 'Potvrzeno' : 'Pozváno' });
window.updateGuestField = (id, field, val) => {
    let data = {}; data[field] = val;
    updateDoc(doc(db, 'hoste', id), data);
};
