// 1. Importy z Firebase (Firestore i Auth)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// 2. TVOJE FIREBASE KONFIGURACE (Doplň své údaje!)
const firebaseConfig = {
  apiKey: "AIzaSyDA4wHyLuyz8LN4RVxKoclF3CAXxKPg7xc",
  authDomain: "svatebniplanovac-f8ede.firebaseapp.com",
  projectId: "svatebniplanovac-f8ede",
  storageBucket: "svatebniplanovac-f8ede.firebasestorage.app",
  messagingSenderId: "1016595614269",
  appId: "1:1016595614269:web:f1c1dddbf8bd2228e43854",
  measurementId: "G-3LK6J78T6K"
};

// 3. Inicializace
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const tasksCollection = collection(db, "ukoly");

// 4. HTML Elementy
const authSection = document.getElementById('authSection');
const appSection = document.getElementById('appSection');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');

const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');
const addBtn = document.getElementById('addBtn');

let unsubscribeTasks = null; // Proměnná pro zastavení načítání dat po odhlášení

// ---------------------------------------------------------
// SEKCE A: PŘIHLAŠOVÁNÍ A REGISTRACE
// ---------------------------------------------------------

// Sledování stavu přihlášení (spustí se automaticky při načtení a po každém přihlášení/odhlášení)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Uživatel JE přihlášen -> schováme přihlášení, ukážeme aplikaci
        authSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        loadUserTasks(user.uid); // Načteme úkoly specifické pro tohoto uživatele
    } else {
        // Uživatel NENÍ přihlášen -> ukážeme přihlášení, schováme aplikaci
        authSection.classList.remove('hidden');
        appSection.classList.add('hidden');
        if (unsubscribeTasks) unsubscribeTasks(); // Zastavíme stahování starých dat
    }
});

// Registrace nového uživatele
registerBtn.addEventListener('click', async () => {
    try {
        await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
        emailInput.value = ''; passwordInput.value = '';
    } catch (error) {
        alert("Chyba registrace: " + error.message);
    }
});

// Přihlášení existujícího uživatele
loginBtn.addEventListener('click', async () => {
    try {
        await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
        emailInput.value = ''; passwordInput.value = '';
    } catch (error) {
        alert("Chyba přihlášení: " + error.message);
    }
});

// Odhlášení
logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// ---------------------------------------------------------
// SEKCE B: LOGIKA ÚKOLŮ
// ---------------------------------------------------------

// Načítání úkolů pouze pro přihlášeného uživatele
function loadUserTasks(userId) {
    // Vytvoříme dotaz: "Najdi všechny úkoly, kde se userId rovná ID přihlášeného uživatele"
    const q = query(tasksCollection, where("userId", "==", userId));

    unsubscribeTasks = onSnapshot(q, (snapshot) => {
        taskList.innerHTML = '';
        snapshot.forEach((docSnap) => {
            renderTask(docSnap.id, docSnap.data());
        });
    });
}

function renderTask(id, task) {
    const li = document.createElement('li');
    if (task.completed) li.classList.add('completed');

    const span = document.createElement('span');
    span.textContent = task.text;
    span.style.cursor = 'pointer';
    span.onclick = () => toggleTask(id, task.completed);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '❌';
    deleteBtn.style.backgroundColor = 'transparent';
    deleteBtn.style.padding = '0';
    deleteBtn.style.color = 'black';
    deleteBtn.onclick = () => deleteTask(id);

    li.appendChild(span);
    li.appendChild(deleteBtn);
    taskList.appendChild(li);
}

// Přidání úkolu
addBtn.addEventListener('click', async () => {
    const text = taskInput.value.trim();
    if (text === '' || !auth.currentUser) return; // Zabráníme přidání, pokud chybí text nebo uživatel není přihlášen

    try {
        await addDoc(tasksCollection, {
            text: text,
            completed: false,
            userId: auth.currentUser.uid, // Tímto úkol přiřadíme konkrétnímu uživateli!
            timestamp: new Date()
        });
        taskInput.value = '';
    } catch (e) {
        console.error("Chyba: ", e);
    }
});

// Úprava úkolu
async function toggleTask(id, currentStatus) {
    await updateDoc(doc(db, "ukoly", id), { completed: !currentStatus });
}

// Smazání úkolu
async function deleteTask(id) {
    await deleteDoc(doc(db, "ukoly", id));
}
