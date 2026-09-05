document.addEventListener("DOMContentLoaded", () => {
    
    // --- LOGIK FÜR DIE EINSTELLUNGSSEITE (settings.html) ---
    const apiKeyInput = document.getElementById('apiKey');
    const saveKeyBtn = document.getElementById('saveKey');
    const exportBackupBtn = document.getElementById('exportBackupBtn');
    const importBackupBtn = document.getElementById('importBackupBtn');
    const importFile = document.getElementById('importFile');

    if (apiKeyInput && saveKeyBtn) {
        const savedKey = localStorage.getItem('groq_api_key');
        if (savedKey) apiKeyInput.value = savedKey;

        saveKeyBtn.addEventListener('click', () => {
            const key = apiKeyInput.value.trim();
            if(key) {
                localStorage.setItem('groq_api_key', key);
                window.location.href = 'index.html'; 
            } else {
                alert("Bitte gib einen gültigen Key ein.");
            }
        });

        if (exportBackupBtn) {
            exportBackupBtn.addEventListener('click', () => {
                const savedRecipes = localStorage.getItem('saved_recipes') || '[]';
                const blob = new Blob([savedRecipes], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'meine_rezepte_backup.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        }

        if (importBackupBtn && importFile) {
            importBackupBtn.addEventListener('click', () => importFile.click());

            importFile.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const importedData = JSON.parse(e.target.result);
                        if (Array.isArray(importedData)) {
                            const existingData = JSON.parse(localStorage.getItem('saved_recipes') || '[]');
                            const mergedData = [...existingData, ...importedData];
                            const uniqueData = [...new Set(mergedData)]; 
                            localStorage.setItem('saved_recipes', JSON.stringify(uniqueData));
                            alert('Backup erfolgreich geladen!');
                        } else {
                            alert('Die Datei hat das falsche Format.');
                        }
                    } catch (error) {
                        alert('Fehler beim Lesen der Backup-Datei.');
                    }
                    importFile.value = ''; 
                };
                reader.readAsText(file);
            });
        }
    }

    // --- LOGIK FÜR DIE HAUPTSEITE (index.html) ---
    const ingredientsInput = document.getElementById('ingredients');
    const searchRecipeBtn = document.getElementById('searchRecipe');
    const recipeResult = document.getElementById('recipeResult');
    const resultCard = document.getElementById('resultCard');
    const loading = document.getElementById('loading');
    
    // Buttons
    const saveRecipeBtn = document.getElementById('saveRecipeBtn');
    const shareRecipeBtn = document.getElementById('shareRecipeBtn');
    const printRecipeBtn = document.getElementById('printRecipeBtn');
    
    const savedRecipesList = document.getElementById('savedRecipesList');
    const wakeLockBtn = document.getElementById('wakeLockBtn');

    if (searchRecipeBtn) {
        
        const currentKey = localStorage.getItem('groq_api_key');
        if (!currentKey) window.location.href = 'settings.html';

        let wakeLock = null;

        const requestWakeLock = async () => {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                wakeLockBtn.classList.add('active');
                wakeLockBtn.innerText = '💡 Bleibt an';
                wakeLock.addEventListener('release', () => {
                    wakeLockBtn.classList.remove('active');
                    wakeLockBtn.innerText = '💡 Display an';
                });
            } catch (err) {
                console.warn(`Wake Lock Fehler: ${err.message}`);
            }
        };

        const releaseWakeLock = async () => {
            if (wakeLock !== null) {
                await wakeLock.release();
                wakeLock = null;
            }
        };

        if (wakeLockBtn) {
            wakeLockBtn.addEventListener('click', () => {
                if (wakeLock !== null) releaseWakeLock();
                else requestWakeLock();
            });
            document.addEventListener('visibilitychange', async () => {
                if (wakeLock !== null && document.visibilityState === 'visible') requestWakeLock();
            });
        }

        let currentRecipeText = "";

        searchRecipeBtn.addEventListener('click', async () => {
            const key = localStorage.getItem('groq_api_key');
            const ingredients = ingredientsInput.value.trim();

            if (!ingredients) return alert("Bitte gib ein paar Zutaten ein.");

            loading.classList.remove('hidden');
            resultCard.classList.add('hidden');

            try {
                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: "qwen3.6-27b",
                        messages: [
                            { role: "system", content: "Du bist ein kreativer Koch. Der Nutzer nennt dir Zutaten. Erstelle ein einfaches Rezept, das primär diese Zutaten verwendet. Gib dem Rezept einen Titel, liste die Zutaten auf und schreibe eine kurze Anleitung." },
                            { role: "user", content: `Ich habe: ${ingredients}.` }
                        ],
                        temperature: 0.7
                    })
                });

                if (response.status === 401) {
                    localStorage.removeItem('groq_api_key');
                    alert("Dein API-Key ist ungültig. Bitte trage ihn neu ein.");
                    window.location.href = 'settings.html';
                    return;
                }

                const data = await response.json();
                if (data.error) throw new Error(data.error.message);

                currentRecipeText = data.choices[0].message.content;
                recipeResult.innerHTML = marked.parse(currentRecipeText);
                resultCard.classList.remove('hidden');

            } catch (error) {
                recipeResult.innerText = `Fehler: ${error.message}`;
                resultCard.classList.remove('hidden');
            } finally {
                loading.classList.add('hidden');
            }
        });

        // --- DRUCKEN LOGIK ---
        window.printRecipeText = (markdownText) => {
            // Öffnet ein neues, verstecktes Fenster nur für den Druck
            const printWindow = window.open('', '_blank');
            if(!printWindow) {
                alert("Bitte erlaube Pop-ups für diese Seite, um drucken zu können.");
                return;
            }
            
            // Schreibt das saubere HTML in das neue Fenster
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Rezept</title>
                    <style>
                        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #000; padding: 20px; max-width: 800px; margin: 0 auto; }
                        h1, h2, h3 { margin-top: 0; color: #222; }
                        ul, ol { padding-left: 20px; }
                        @media print {
                            @page { margin: 2cm; }
                        }
                    </style>
                </head>
                <body>
                    ${marked.parse(markdownText)}
                    <script>
                        // Druck-Dialog automatisch öffnen, dann Fenster schließen
                        window.onload = () => { 
                            setTimeout(() => { 
                                window.print(); 
                                window.close(); 
                            }, 250);
                        };
                    <\/script>
                </body>
                </html>
            `);
            printWindow.document.close();
        };

        if (printRecipeBtn) {
            printRecipeBtn.addEventListener('click', () => {
                if (currentRecipeText) window.printRecipeText(currentRecipeText);
            });
        }

        // --- TEILEN LOGIK ---
        if (shareRecipeBtn) {
            shareRecipeBtn.addEventListener('click', async () => {
                if (!currentRecipeText) return;
                if (navigator.share) {
                    try { await navigator.share({ title: 'Rezept', text: currentRecipeText }); } 
                    catch (err) { console.log('Teilen abgebrochen.'); }
                } else {
                    alert('Dein Browser unterstützt das direkte Teilen nicht.');
                }
            });
        }

        // --- REZEPTE ANZEIGEN / SPEICHERN ---
        const loadSavedRecipes = () => {
            const saved = JSON.parse(localStorage.getItem('saved_recipes') || '[]');
            savedRecipesList.innerHTML = '';
            
            if(saved.length === 0) {
                savedRecipesList.innerHTML = '<p><small>Noch keine Rezepte gespeichert.</small></p>';
                return;
            }

            saved.forEach((recipe, index) => {
                const recipeContainer = document.createElement('div');
                recipeContainer.style.borderBottom = '1px solid #ccc';
                recipeContainer.style.padding = '15px 0';
                
                const title = recipe.split('\n')[0].replace(/[*#]/g, '').substring(0, 40) + '...';

                recipeContainer.innerHTML = `
                    <details>
                        <summary style="cursor: pointer; font-weight: bold; margin-bottom: 10px; color: #333; font-size: 1.1em;">🍽️ ${title}</summary>
                        <div class="markdown-body" style="background: #f1f1f1; padding: 15px; border-radius: 8px; margin-bottom: 10px; color: #000;">
                            ${marked.parse(recipe)}
                        </div>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <button onclick="shareSavedRecipe(${index})" style="background: #9C27B0; padding: 8px; flex: 1; color: white; border: none; border-radius: 5px; cursor: pointer; min-width: 80px;">📤 Teilen</button>
                            <button onclick="printSavedRecipe(${index})" style="background: #607D8B; padding: 8px; flex: 1; color: white; border: none; border-radius: 5px; cursor: pointer; min-width: 80px;">🖨️ Drucken</button>
                            <button onclick="deleteRecipe(${index})" style="background: #f44336; padding: 8px; flex: 1; color: white; border: none; border-radius: 5px; cursor: pointer; min-width: 80px;">🗑️ Löschen</button>
                        </div>
                    </details>
                `;
                savedRecipesList.appendChild(recipeContainer);
            });
        };

        saveRecipeBtn.addEventListener('click', () => {
            if (!currentRecipeText) return;
            const saved = JSON.parse(localStorage.getItem('saved_recipes') || '[]');
            saved.push(currentRecipeText);
            localStorage.setItem('saved_recipes', JSON.stringify(saved));
            alert('Rezept wurde gespeichert!');
            loadSavedRecipes();
        });

        window.deleteRecipe = (index) => {
            if(confirm("Dieses Rezept wirklich löschen?")) {
                const saved = JSON.parse(localStorage.getItem('saved_recipes') || '[]');
                saved.splice(index, 1);
                localStorage.setItem('saved_recipes', JSON.stringify(saved));
                loadSavedRecipes();
            }
        };

        window.shareSavedRecipe = async (index) => {
            const saved = JSON.parse(localStorage.getItem('saved_recipes') || '[]');
            if (navigator.share) {
                try { await navigator.share({ title: 'Rezept', text: saved[index] }); } 
                catch (err) { console.log('Teilen abgebrochen.'); }
            } else {
                alert('Dein Browser unterstützt das direkte Teilen nicht.');
            }
        };

        // Aufruf für den Drucken-Button in der Liste
        window.printSavedRecipe = (index) => {
            const saved = JSON.parse(localStorage.getItem('saved_recipes') || '[]');
            if (saved[index]) window.printRecipeText(saved[index]);
        };

        loadSavedRecipes();
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.error('SW Fehler', err));
    });
}
