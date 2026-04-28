// 1. Importy Firebase modulů
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 2. TVOJE FIREBASE KONFIGURACE (Zde vlož své údaje z Firebase konzole!)
const firebaseConfig = {
  apiKey: "AIzaSyDA4wHyLuyz8LN4RVxKoclF3CAXxKPg7xc",
  authDomain: "svatebniplanovac-f8ede.firebaseapp.com",
  projectId: "svatebniplanovac-f8ede",
  storageBucket: "svatebniplanovac-f8ede.firebasestorage.app",
  messagingSenderId: "1016595614269",
  appId: "1:1016595614269:web:f1c1dddbf8bd2228e43854",
  measurementId: "G-3LK6J78T6K"
};

// 3. Inicializace aplikace a databáze
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const tasksCollection = collection(db, "ukoly");

// 4. Propojení s HTML prvky
const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');
const addBtn = document.getElementById('addBtn');

// 5. Načítání dat v reálném čase (onSnapshot)
// Tato funkce automaticky naslouchá změnám. Když někdo přidá/smaže úkol, hned se to ukáže.
onSnapshot(tasksCollection, (snapshot) => {
    taskList.innerHTML = ''; // Vyčistit seznam před novým vykreslením
    snapshot.forEach((docSnap) => {
        const taskData = docSnap.data();
        const taskId = docSnap.id;
        renderTask(taskId, taskData);
    });
});

// 6. Vykreslení jednoho úkolu do HTML
function renderTask(id, task) {
    const li = document.createElement('li');
    if (task.completed) {
        li.classList.add('completed');
    }

    // Text úkolu
    const span = document.createElement('span');
    span.textContent = task.text;
    span.style.cursor = 'pointer';
    // Kliknutí na text změní stav (hotovo / nehotovo)
    span.onclick = () => toggleTask(id, task.completed);

    // Tlačítko pro smazání
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '❌';
    deleteBtn.style.backgroundColor = 'transparent';
    deleteBtn.style.padding = '0';
    deleteBtn.onclick = () => deleteTask(id);

    li.appendChild(span);
    li.appendChild(deleteBtn);
    taskList.appendChild(li);
}

// 7. Přidání nového úkolu do Firestore
async function addTask() {
    const text = taskInput.value.trim();
    
    if (text === '') {
        alert('Prosím, zadej nějaký text úkolu.');
        return;
    }

    try {
        await addDoc(tasksCollection, {
            text: text,
            completed: false,
            timestamp: new Date() // Přidáme i čas, abychom to mohli časem řadit
        });
        taskInput.value = ''; // Vyčištění pole po přidání
    } catch (e) {
        console.error("Chyba při přidávání úkolu: ", e);
        alert("Nepodařilo se přidat úkol. Zkontroluj Firebase konfiguraci.");
    }
}

// 8. Označení úkolu jako hotový / nehotový
async function toggleTask(id, currentStatus) {
    const taskRef = doc(db, "ukoly", id);
    try {
        await updateDoc(taskRef, {
            completed: !currentStatus
        });
    } catch (e) {
        console.error("Chyba při aktualizaci úkolu: ", e);
    }
}

// 9. Smazání úkolu z Firestore
async function deleteTask(id) {
    const taskRef = doc(db, "ukoly", id);
    try {
        await deleteDoc(taskRef);
    } catch (e) {
        console.error("Chyba při mazání úkolu: ", e);
    }
}

// 10. Napojení tlačítka "Přidat" na funkci addTask
addBtn.addEventListener('click', addTask);
