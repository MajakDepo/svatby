import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// --- TVOJE KONFIGURACE ---
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

// Kolekce
const tasksColl = collection(db, "ukoly");
const guestsColl = collection(db, "hoste");

// Elementy
const authSection = document.getElementById('authSection'), appSection = document.getElementById('appSection');
const taskInput = document.getElementById('taskInput'), taskList = document.getElementById('taskList');
const guestName = document.getElementById('guestName'), guestSide = document.getElementById('guestSide'), guestTable = document.getElementById('guestTableBody');
const totalGuestsEl = document.getElementById('totalGuests'), confirmedGuestsEl = document.getElementById('confirmedGuests');

let unsubs = []; // Pole pro odhlášení sledování dat

// --- AUTH LOGIKA ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        authSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        initData(user.uid);
    } else {
        authSection.classList.remove('hidden');
        appSection.classList.add('hidden');
        unsubs.forEach(un => un()); // Zastavit sledování
    }
});

document.getElementById('registerBtn').onclick = () => createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value).catch(e => alert(e.message));
document.getElementById('loginBtn').onclick = () => signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value).catch(e => alert(e.message));
document.getElementById('logoutBtn').onclick = () => signOut(auth);

// --- DATA INICIALIZACE ---
function initData(uid) {
    // Sledování Úkolů
    const qTasks = query(tasksColl, where("userId", "==", uid));
    const unsubTasks = onSnapshot(qTasks, (snap) => {
        taskList.innerHTML = '';
        snap.forEach(d => renderTask(d.id, d.data()));
    }, err => console.error("Chyba úkolů: ", err));

    // Sledování Hostů
    const qGuests = query(guestsColl, where("userId", "==", uid));
    const unsubGuests = onSnapshot(qGuests, (snap) => {
        guestTable.innerHTML = '';
        let total = 0, confirmed = 0;
        snap.forEach(d => {
            const g = d.data();
            total++;
            if(g.status === 'Potvrzeno') confirmed++;
            renderGuest(d.id, g);
        });
        totalGuestsEl.textContent = total;
        confirmedGuestsEl.textContent = confirmed;
    }, err => console.error("Chyba hostů: ", err));

    unsubs = [unsubTasks, unsubGuests];
}

// --- ÚKOLY ---
document.getElementById('addBtn').onclick = async () => {
    if (!taskInput.value.trim()) return;
    await addDoc(tasksColl, { text: taskInput.value, completed: false, userId: auth.currentUser.uid, ts: Date.now() });
    taskInput.value = '';
};

function renderTask(id, t) {
    const li = document.createElement('li');
    if (t.completed) li.classList.add('completed');
    li.innerHTML = `<span>${t.text}</span> <button class="btn-small" onclick="deleteTask('${id}')">❌</button>`;
    li.querySelector('span').onclick = () => updateDoc(doc(db, "ukoly", id), { completed: !t.completed });
    taskList.appendChild(li);
}
window.deleteTask = (id) => deleteDoc(doc(db, "ukoly", id));

// --- HOSTÉ ---
document.getElementById('addGuestBtn').onclick = async () => {
    if (!guestName.value.trim()) return;
    await addDoc(guestsColl, { 
        name: guestName.value, 
        side: guestSide.value, 
        status: 'Pozváno', 
        userId: auth.currentUser.uid 
    });
    guestName.value = '';
};

function renderGuest(id, g) {
    const tr = document.createElement('tr');
    const statusClass = g.status === 'Potvrzeno' ? 'status-confirmed' : 'status-invited';
    tr.innerHTML = `
        <td>${g.name}</td>
        <td>${g.side}</td>
        <td class="${statusClass}" style="cursor:pointer" onclick="toggleGuest('${id}', '${g.status}')">${g.status}</td>
        <td><button class="btn-small btn-secondary" onclick="deleteGuest('${id}')">Smazat</button></td>
    `;
    guestTable.appendChild(tr);
}

window.toggleGuest = (id, cur) => {
    const next = cur === 'Pozváno' ? 'Potvrzeno' : 'Pozváno';
    updateDoc(doc(db, "hoste", id), { status: next });
};
window.deleteGuest = (id) => deleteDoc(doc(db, "hoste", id));
