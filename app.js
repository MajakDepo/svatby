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

document.getElementById('loginBtn').onclick = () => signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value).catch(e => alert("Chyba: " + e.message));
document.getElementById('registerBtn').onclick = () => createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value).catch(e => alert("Chyba: " + e.message));
document.getElementById('logoutBtn').onclick = () => signOut(auth);

function initApp(uid) {
    // Sledování Úkolů
    unsubs.push(onSnapshot(query(tasksColl, where("userId", "==", uid)), snap => {
        const list = document.getElementById('taskList'); list.innerHTML = '';
        snap.forEach(d => {
            const t = d.data();
            const li = document.createElement('li');
            li.className = t.completed ? 'completed' : '';
            li.innerHTML = `<span style="cursor:pointer">${t.text}</span> <button class="btn-small" onclick="deleteDoc(doc(db, 'ukoly', '${d.id}'))">❌</button>`;
            li.querySelector('span').onclick = () => updateDoc(doc(db, 'ukoly', d.id), { completed: !t.completed });
            list.appendChild(li);
        });
    }));

    // Sledování Hostů
    unsubs.push(onSnapshot(query(guestsColl, where("userId", "==", uid)), snap => {
        const tbody = document.getElementById('guestTableBody'); tbody.innerHTML = '';
        let total = 0, confirmed = 0;
        snap.forEach(d => {
            const g = d.data(); total++; if(g.status === 'Potvrzeno') confirmed++;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${g.name}</td><td>${g.side}</td><td class="${g.status==='Potvrzeno'?'status-confirmed':''}" style="cursor:pointer" onclick="toggleGuest('${d.id}','${g.status}')">${g.status}</td><td><button class="btn-small" onclick="deleteDoc(doc(db, 'hoste', '${d.id}'))">❌</button></td>`;
            tbody.appendChild(tr);
        });
        document.getElementById('totalGuests').innerText = total;
        document.getElementById('confirmedGuests').innerText = confirmed;
    }));

    // Sledování Rozpočtu
    unsubs.push(onSnapshot(query(budgetColl, where("userId", "==", uid)), snap => {
        const tbody = document.getElementById('budgetTableBody'); tbody.innerHTML = '';
        let estTotal = 0, actTotal = 0;
        snap.forEach(d => {
            const b = d.data(); estTotal += Number(b.estimated); actTotal += Number(b.actual || 0);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${b.name}</td>
                <td>${b.estimated} Kč</td>
                <td><input type="number" class="editable-price" value="${b.actual || 0}" onchange="updateActual('${d.id}', this.value)"> Kč</td>
                <td><button class="btn-small" onclick="deleteDoc(doc(db, 'rozpocet', '${d.id}'))">❌</button></td>
            `;
            tbody.appendChild(tr);
        });
        document.getElementById('totalEstimated').innerText = estTotal.toLocaleString() + " Kč";
        document.getElementById('totalActual').innerText = actTotal.toLocaleString() + " Kč";
    }));
}

// --- AKCE ---
document.getElementById('addBtn').onclick = () => {
    const val = document.getElementById('taskInput').value;
    if(val) addDoc(tasksColl, { text: val, completed: false, userId: auth.currentUser.uid });
    document.getElementById('taskInput').value = '';
};

document.getElementById('addGuestBtn').onclick = () => {
    const name = document.getElementById('guestName').value;
    if(name) addDoc(guestsColl, { name, side: document.getElementById('guestSide').value, status: 'Pozváno', userId: auth.currentUser.uid });
    document.getElementById('guestName').value = '';
};

document.getElementById('addBudgetBtn').onclick = () => {
    const name = document.getElementById('budgetItemName').value;
    const estimated = document.getElementById('budgetEstimated').value;
    if(name && estimated) addDoc(budgetColl, { name, estimated: Number(estimated), actual: 0, userId: auth.currentUser.uid });
    document.getElementById('budgetItemName').value = ''; document.getElementById('budgetEstimated').value = '';
};

// Pomocné funkce pro globální okno (aby fungovaly v onclick v HTML)
window.db = db; window.doc = doc; window.deleteDoc = deleteDoc;
window.toggleGuest = (id, s) => updateDoc(doc(db, 'hoste', id), { status: s === 'Pozváno' ? 'Potvrzeno' : 'Pozváno' });
window.updateActual = (id, val) => updateDoc(doc(db, 'rozpocet', id), { actual: Number(val) });
