// ... (začátek app.js zůstává stejný až po funkci initApp) ...

function initApp(uid) {
    // Přidáme informaci o odkazu pro hosty na začátek sekce Hosté
    const guestSection = document.getElementById('guests');
    const shareUrl = `${window.location.origin}${window.location.pathname.replace('index.html','')}/formular.html?uid=${uid}`;
    
    // Pokud tam box s odkazem ještě není, přidáme ho
    if(!document.getElementById('shareBox')) {
        const shareBox = document.createElement('div');
        shareBox.id = 'shareBox';
        shareBox.className = 'card';
        shareBox.style.background = '#e8f5e9';
        shareBox.innerHTML = `
            <p><strong>Odkaz pro hosty:</strong> Sdílejte tento odkaz s hosty pro vyplnění údajů:</p>
            <input type="text" readonly value="${shareUrl}" style="width:80%; display:inline-block">
            <button class="btn-small" onclick="navigator.clipboard.writeText('${shareUrl}'); alert('Odkaz zkopírován!')">Kopírovat</button>
        `;
        guestSection.prepend(shareBox);
    }

    // Sledování Hostů (upraveno pro zobrazení datumu a úprav)
    unsubs.push(onSnapshot(query(guestsColl, where("userId", "==", uid)), snap => {
        const gBody = document.getElementById('guestTableBody');
        const hBody = document.getElementById('helperTableBody');
        const aBody = document.getElementById('accTableBody');
        gBody.innerHTML = ''; hBody.innerHTML = ''; aBody.innerHTML = '';
        
        currentGuests = [];
        let stats = { total:0, confirmed:0, nevesta:0, zenich:0, spolecny:0, cities:{}, tasks:{} };

        snap.forEach(d => {
            const g = d.data(); g.id = d.id;
            currentGuests.push(g);

            stats.total++;
            if(g.status === 'Potvrzeno') stats.confirmed++;
            if(g.side === 'Nevěsta') stats.nevesta++;
            else if(g.side === 'Ženich') stats.zenich++;
            else stats.spolecny++;
            
            let city = g.city ? g.city.trim() : 'Nezadáno';
            stats.cities[city] = (stats.cities[city] || 0) + 1;

            const tr = document.createElement('tr');
            let colorClass = g.side === 'Nevěsta' ? 'side-nevesta' : (g.side === 'Ženich' ? 'side-zenich' : 'side-spolecny');
            tr.className = colorClass;
            tr.innerHTML = `
                <td><strong>${g.name}</strong><br><small style="color:#888">${g.submittedDate ? 'Vyplněno: '+g.submittedDate : ''}</small></td>
                <td>${g.city || '-'}</td>
                <td>${g.side}</td>
                <td style="cursor:pointer" onclick="toggleGuest('${g.id}','${g.status}')">${g.status === 'Potvrzeno' ? '✅ Potvrzeno' : '📩 Pozváno'}</td>
                <td>
                    <button class="btn-small btn-secondary" onclick="openEditModal('${g.id}')">✏️</button>
                    <button class="btn-small" onclick="deleteDoc(doc(db, 'hoste', '${g.id}'))">❌</button>
                </td>
            `;
            gBody.appendChild(tr);

            if (g.isHelper) {
                let taskName = g.helperTask ? g.helperTask.trim() : 'Zatím nepřiřazeno';
                stats.tasks[taskName] = (stats.tasks[taskName] || 0) + 1;
                const trH = document.createElement('tr');
                trH.innerHTML = `<td><strong>${g.name}</strong></td><td><input type="text" class="editable-input" value="${g.helperTask || ''}" onchange="updateDoc(doc(db, 'hoste', '${g.id}'), {helperTask: this.value})"></td>`;
                hBody.appendChild(trH);
            }

            if (g.needsAcc) {
                const trA = document.createElement('tr');
                trA.innerHTML = `
                    <td><strong>${g.name}</strong></td>
                    <td><input type="text" class="editable-input" value="${g.accPlace || ''}" onchange="updateDoc(doc(db, 'hoste', '${g.id}'), {accPlace: this.value})"></td>
                    <td><input type="text" class="editable-input" value="${g.accRoom || ''}" onchange="updateDoc(doc(db, 'hoste', '${g.id}'), {accRoom: this.value})"></td>
                `;
                aBody.appendChild(trA);
            }
        });
        renderGuestStats(stats);
    }));
}
// ... (zbytek app.js zůstává stejný) ...
