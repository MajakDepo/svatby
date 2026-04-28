// Pole pro ukládání úkolů
let tasks = [];

// Funkce pro přidání úkolu
function addTask() {
    const input = document.getElementById('taskInput');
    const taskText = input.value.trim();

    if (taskText !== '') {
        const newTask = {
            id: Date.now(),
            text: taskText,
            completed: false
        };
        
        tasks.push(newTask);
        input.value = ''; // Vyčištění pole
        renderTasks();
    } else {
        alert('Prosím, zadej nějaký text úkolu.');
    }
}

// Funkce pro smazání úkolu
function deleteTask(id) {
    tasks = tasks.filter(task => task.id !== id);
    renderTasks();
}

// Funkce pro označení úkolu jako hotového
function toggleTask(id) {
    tasks = tasks.map(task => {
        if (task.id === id) {
            return { ...task, completed: !task.completed };
        }
        return task;
    });
    renderTasks();
}

// Funkce pro vykreslení úkolů na obrazovku
function renderTasks() {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = ''; // Smazat aktuální seznam

    tasks.forEach(task => {
        const li = document.createElement('li');
        if (task.completed) {
            li.classList.add('completed');
        }

        // Název úkolu s možností na něj kliknout a označit ho jako hotový
        const span = document.createElement('span');
        span.textContent = task.text;
        span.style.cursor = 'pointer';
        span.onclick = () => toggleTask(task.id);

        // Tlačítko pro smazání
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '❌';
        deleteBtn.style.backgroundColor = 'transparent';
        deleteBtn.style.padding = '0';
        deleteBtn.onclick = () => deleteTask(task.id);

        li.appendChild(span);
        li.appendChild(deleteBtn);
        taskList.appendChild(li);
    });
}
