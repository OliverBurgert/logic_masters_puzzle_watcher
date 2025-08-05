// ==UserScript==
// @name         Logic Masters Puzzle Watcher
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  Watch favorite users for new/unsolved puzzles on Logic Masters Deutschland
// @author       Oliver Burgert
// @match        https://logic-masters.de/*
// @license      GPL-3.0-or-later
// @updateURL    https://raw.githubusercontent.com/OliverBurgert/logic_masters_puzzle_watcher/main/logic-masters-puzzle-watcher.user.js
// @downloadURL  https://raw.githubusercontent.com/OliverBurgert/logic_masters_puzzle_watcher/main/logic-masters-puzzle-watcher.user.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
    const DAILY_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    // Storage keys
    const STORAGE_KEYS = {
        FAVORITE_USERS: 'lm_favorite_users',
        LAST_CHECK: 'lm_last_check',
        PUZZLE_DATA: 'lm_puzzle_data'
    };

    // Initialize storage if needed
    function initStorage() {
        if (!GM_getValue(STORAGE_KEYS.FAVORITE_USERS)) {
            GM_setValue(STORAGE_KEYS.FAVORITE_USERS, JSON.stringify([]));
        }
        if (!GM_getValue(STORAGE_KEYS.PUZZLE_DATA)) {
            GM_setValue(STORAGE_KEYS.PUZZLE_DATA, JSON.stringify({}));
        }
    }

    // Get favorite users list
    function getFavoriteUsers() {
        return JSON.parse(GM_getValue(STORAGE_KEYS.FAVORITE_USERS, '[]'));
    }

    // Save favorite users list
    function saveFavoriteUsers(users) {
        GM_setValue(STORAGE_KEYS.FAVORITE_USERS, JSON.stringify(users));
    }

    // Get puzzle data
    function getPuzzleData() {
        return JSON.parse(GM_getValue(STORAGE_KEYS.PUZZLE_DATA, '{}'));
    }

    // Save puzzle data
    function savePuzzleData(data) {
        GM_setValue(STORAGE_KEYS.PUZZLE_DATA, JSON.stringify(data));
    }

    // Get last check timestamp
    function getLastCheck() {
        return GM_getValue(STORAGE_KEYS.LAST_CHECK, 0);
    }

    // Save last check timestamp
    function saveLastCheck(timestamp) {
        GM_setValue(STORAGE_KEYS.LAST_CHECK, timestamp);
    }

    // Check if we need to update data
    function shouldCheck() {
        const lastCheck = getLastCheck();
        const now = Date.now();
        return (now - lastCheck) >= CHECK_INTERVAL;
    }

    // Parse puzzle data from HTML
    function parsePuzzleData(html, username) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Check for error message first
        const errorElement = doc.querySelector('p.rp_error');
        if (errorElement) {
            throw new Error('User does not exist');
        }

        const puzzleRows = doc.querySelectorAll('table.rp_raetselliste tr');

        const puzzles = [];

        for (let i = 1; i < puzzleRows.length; i++) { // Skip header row
            const row = puzzleRows[i];
            const cells = row.querySelectorAll('td');

            if (cells.length >= 4) {
                const statusImg = cells[0].querySelector('img');
                const puzzleLink = cells[1].querySelector('a');
                const solvedCount = cells[2].textContent.trim();
                const ratingCell = cells[3];

                if (statusImg && puzzleLink) {
                    const status = statusImg.getAttribute('title');
                    const difficultyImg = ratingCell.querySelector('img');
                    const ratingSpan = ratingCell.querySelector('span');

                    // Extract description span text (e.g. "von <user> (gelöst am ...)")
                    const descriptionSpan = cells[1].querySelector('span');
                    const descriptionText = descriptionSpan ? descriptionSpan.textContent.trim().toLowerCase() : '';

                    // Only include new or unsolved puzzles (German and English versions)
                    if (
                        (status === 'neu' && !descriptionText.includes('gelöst am')) ||
                        (status === 'neu' && !descriptionText.includes('gelöst Heute')) ||
                        (status === 'new' && !descriptionText.includes('solved on')) ||
                        (status === 'new' && !descriptionText.includes('solved today')) ||
                        status === 'ungeloest' ||
                        status === 'unsolved'
                    ) {
                        puzzles.push({
                            name: puzzleLink.textContent.trim(),
                            link: puzzleLink.getAttribute('href'),
                            status: status,
                            solved: solvedCount,
                            difficulty: difficultyImg ? difficultyImg.getAttribute('alt') : '?',
                            difficultyTitle: difficultyImg ? difficultyImg.getAttribute('title') : '',
                            rating: ratingSpan ? ratingSpan.textContent.trim() : 'N/A'
                        });
                    }
                }
            }
        }

        return puzzles;
    }

    // Fetch puzzle data for a user
    function fetchUserPuzzles(username) {
        return new Promise((resolve, reject) => {
            const url = `https://logic-masters.de/Raetselportal/Benutzer/eingestellt.php?name=${username}`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: function(response) {
                    if (response.status === 200) {
                        try {
                            const puzzles = parsePuzzleData(response.responseText, username);
                            resolve({ username, puzzles, error: null });
                        } catch (e) {
                            resolve({ username, puzzles: [], error: 'Failed to parse puzzle data' });
                        }
                    } else {
                        resolve({ username, puzzles: [], error: 'User does not exist' });
                    }
                },
                onerror: function() {
                    resolve({ username, puzzles: [], error: 'Network error' });
                }
            });
        });
    }

    // Update puzzle data for all favorite users
    async function updatePuzzleData() {
        const favoriteUsers = getFavoriteUsers();
        const puzzleData = {};

        const promises = favoriteUsers.map(user => fetchUserPuzzles(user));
        const results = await Promise.all(promises);

        results.forEach(result => {
            puzzleData[result.username] = {
                puzzles: result.puzzles,
                error: result.error,
                lastUpdate: Date.now()
            };
        });

        savePuzzleData(puzzleData);
        saveLastCheck(Date.now());

        return puzzleData;
    }

    // Create the widget HTML
    function createWidget() {
        const widget = document.createElement('div');
        widget.className = 'box menu';
        widget.id = 'puzzle-watcher-widget';

        widget.innerHTML = `
            <h2>Puzzle Watcher</h2>
            <div style="margin-bottom: 10px;">
                <input type="text" id="new-user-input" placeholder="Username" style="width: 100px; margin-bottom: 5px;">
                <br>
                <button id="add-user-btn" style="font-size: 11px; margin-right: 5px;">Add User</button>
                <button id="refresh-btn" style="font-size: 11px;">Refresh</button>
            </div>
            <div id="puzzle-results"></div>
        `;

        return widget;
    }

    // Update widget display
    function updateWidgetDisplay() {
        const resultsDiv = document.getElementById('puzzle-results');
        if (!resultsDiv) return;

        const favoriteUsers = getFavoriteUsers();
        const puzzleData = getPuzzleData();

        let html = '';

        if (favoriteUsers.length === 0) {
            html = '<p style="font-size: 11px;">No users being watched.</p>';
        } else {
            favoriteUsers.forEach(username => {
                const userData = puzzleData[username];

                html += `<div style="border-bottom: 1px solid #ccc; margin-bottom: 10px; padding-bottom: 5px;">`;
                html += `<div style="font-weight: bold; font-size: 12px;">`;
                html += `<a href="/Raetselportal/Benutzer/eingestellt.php?name=${username}" style="text-decoration: none;">${username}</a>`;
                html += ` <button class="remove-user-btn" data-username="${username}" style="font-size: 9px; margin-left: 5px;">Remove</button>`;
                html += `</div>`;

                if (!userData) {
                    html += `<p style="font-size: 10px; color: #666;">Not checked yet...</p>`;
                } else if (userData.error) {
                    html += `<p style="font-size: 10px; color: #f00;">${userData.error}</p>`;
                } else if (userData.puzzles.length === 0) {
                    html += `<p style="font-size: 10px; color: #666;">No new puzzles</p>`;
                } else {
                    userData.puzzles.forEach(puzzle => {
                        html += `<div style="margin: 2px 0 2px 15px; font-size: 10px; display: flex; align-items: baseline; gap: 4px; flex-wrap: wrap;">`;
                        html += `<a href="${puzzle.link}" style="text-decoration: none; display: inline;">${puzzle.name}</a>`;
                        html += `<span style="color: #666; font-size: 9px; display: inline;">(Level ${puzzle.difficulty}, ${puzzle.rating}, ${puzzle.solved} solved)</span>`;
                        html += `</div>`;
                    });
                }
                html += `</div>`;
            });
        }

        resultsDiv.innerHTML = html;

        const removeButtons = resultsDiv.querySelectorAll('.remove-user-btn');
        removeButtons.forEach(button => {
            button.addEventListener('click', function () {
                const username = this.getAttribute('data-username');
                removeUser(username);
            });
        });
    }

    // Add user to favorites
    function addUser() {
        const input = document.getElementById('new-user-input');
        const username = input.value.trim();

        if (username) {
            const favoriteUsers = getFavoriteUsers();
            if (!favoriteUsers.includes(username)) {
                favoriteUsers.push(username);
                saveFavoriteUsers(favoriteUsers);
                refreshData();
                updateWidgetDisplay();
            }
            input.value = '';
        }
    }

    // Remove user from favorites
    function removeUser(username) {
        const favoriteUsers = getFavoriteUsers();
        const index = favoriteUsers.indexOf(username);
        if (index > -1) {
            favoriteUsers.splice(index, 1);
            saveFavoriteUsers(favoriteUsers);

            // Also remove their data
            const puzzleData = getPuzzleData();
            delete puzzleData[username];
            savePuzzleData(puzzleData);

            updateWidgetDisplay();
        }
    }

    // Refresh puzzle data
    async function refreshData() {
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.textContent = 'Loading...';
            refreshBtn.disabled = true;
        }

        try {
            await updatePuzzleData();
            updateWidgetDisplay();
        } finally {
            if (refreshBtn) {
                refreshBtn.textContent = 'Refresh';
                refreshBtn.disabled = false;
            }
        }
    }

    // Make functions globally available for onclick handlers
    window.removeUser = removeUser;

    // Initialize everything
    function init() {
        initStorage();

        // Find the left column and add our widget
        const leftColumn = document.querySelector('.leftcolumn');
        if (leftColumn) {
            const widget = createWidget();
            leftColumn.appendChild(widget);

            // Add event listeners
            document.getElementById('add-user-btn').addEventListener('click', addUser);
            document.getElementById('refresh-btn').addEventListener('click', refreshData);

            // Allow adding user with Enter key
            document.getElementById('new-user-input').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    addUser();
                }
            });

            // Update display with current data
            updateWidgetDisplay();

            // Check if we need to update data automatically
            if (shouldCheck()) {
                refreshData();
            }
        }
    }

    // Wait for the page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
