/**
 * ============================================================================
 * ASSIGNMENT DEADLINE OPTIMIZER (DEADLINE//CTRL)
 * Frontend Application Controller & Interactive Visualizer
 * ============================================================================
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'DEADLINE_CTRL_TASKS';

    // Standard Demo Dataset (College Student Scenario)
    const DEFAULT_DEMO_DATA = [
        { id: 101, title: 'DS Lab Experiment 5', deadline: '2026-10-28', hours: 3.0, importance: 5, completed: 0, dependencies: [] },
        { id: 102, title: 'OOPJ Mini-Project Coding', deadline: '2026-10-31', hours: 6.0, importance: 4, completed: 0, dependencies: [104] },
        { id: 103, title: 'COA Assignment Sheet', deadline: '2026-11-04', hours: 2.5, importance: 3, completed: 0, dependencies: [] },
        { id: 104, title: 'OOPJ Project Architecture', deadline: '2026-10-29', hours: 2.0, importance: 4, completed: 1, dependencies: [] },
        { id: 105, title: 'Operating Systems Viva Prep', deadline: '2026-10-30', hours: 4.0, importance: 5, completed: 0, dependencies: [] },
        { id: 106, title: 'OOPJ Project Report & PPT', deadline: '2026-11-02', hours: 3.5, importance: 4, completed: 0, dependencies: [102] },
        { id: 107, title: 'Mathematics Assignment 3', deadline: '2026-11-06', hours: 2.0, importance: 2, completed: 0, dependencies: [] },
        { id: 108, title: 'Computer Networks Practical', deadline: '2026-10-27', hours: 2.0, importance: 4, completed: 0, dependencies: [] }
    ];

    // Application State
    let tasks = [];
    let currentFilter = 'all';
    let searchQuery = '';
    let selectedTaskId = null;

    // SVG Graph Transform State
    let graphZoom = 1;
    let graphPanX = 40;
    let graphPanY = 40;
    let isPanning = false;
    let startPanX = 0;
    let startPanY = 0;

    /* ------------------------------------------------------------------------- */
    /*                         INITIALIZATION & PERSISTENCE                      */
    /* ------------------------------------------------------------------------- */

    function init() {
        loadTasksFromStorage();
        initClock();
        bindEvents();
        renderAll();
    }

    function initClock() {
        const clockEl = document.getElementById('hudClock');
        const updateClock = () => {
            const today = DS.getTodayString();
            if (clockEl) clockEl.textContent = today;
        };
        updateClock();
        setInterval(updateClock, 60000);
    }

    function loadTasksFromStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    tasks = parsed;
                    return;
                }
            }
        } catch (e) {
            console.warn('Failed to read localStorage:', e);
        }
        // First visit or empty: load demo dataset
        tasks = JSON.parse(JSON.stringify(DEFAULT_DEMO_DATA));
        saveTasksToStorage();
    }

    function saveTasksToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
            const saveStatusEl = document.getElementById('hudSaveStatus');
            if (saveStatusEl) {
                saveStatusEl.style.opacity = '1';
                setTimeout(() => { saveStatusEl.style.opacity = '0.9'; }, 800);
            }
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
            showToast('Failed to save data locally', 'danger');
        }
    }

    function getNextId() {
        let maxId = 100;
        for (const t of tasks) {
            if (t.id > maxId) maxId = t.id;
        }
        return maxId + 1;
    }

    function getTaskById(id) {
        return tasks.find(t => t.id === id) || null;
    }

    /* ------------------------------------------------------------------------- */
    /*                              UI RENDERING                                 */
    /* ------------------------------------------------------------------------- */

    function renderAll() {
        updateTelemetry();
        renderDashboard();
        renderAssignmentsTable();
        renderOptimizer();
        renderGraph();
    }

    function updateTelemetry() {
        const pendingCount = tasks.filter(t => !t.completed).length;
        const hudPendingEl = document.getElementById('hudPendingCount');
        if (hudPendingEl) hudPendingEl.textContent = pendingCount;

        const statPending = document.getElementById('statPending');
        const statCompleted = document.getElementById('statCompleted');
        const statDue48 = document.getElementById('statDue48');
        const statOverdue = document.getElementById('statOverdue');

        const completedCount = tasks.filter(t => t.completed).length;
        const todayStr = DS.getTodayString();

        let due48Count = 0;
        let overdueCount = 0;

        for (const t of tasks) {
            if (!t.completed) {
                const days = DS.daysBetweenDates(todayStr, t.deadline);
                if (days < 0) overdueCount++;
                else if (days <= 2) due48Count++;
            }
        }

        if (statPending) statPending.textContent = pendingCount;
        if (statCompleted) statCompleted.textContent = completedCount;
        if (statDue48) statDue48.textContent = due48Count;
        if (statOverdue) statOverdue.textContent = overdueCount;
    }

    /* ----------------- 1. DASHBOARD ----------------- */

    function renderDashboard() {
        const { plan } = DS.generateOptimizedPlan(tasks);
        renderNextMission(plan);
        renderPriorityQueue();
        renderWorkloadChart();
    }

    function renderNextMission(plan) {
        const missionEl = document.getElementById('nextMissionContent');
        const missionBadge = document.getElementById('missionRankBadge');
        if (!missionEl) return;

        if (!plan || plan.length === 0) {
            const allDone = tasks.length > 0 && tasks.every(t => t.completed);
            missionBadge.textContent = 'STANDBY';
            missionEl.innerHTML = `
                <div style="padding: 24px; text-align: center; color: var(--text-muted);">
                    <div style="font-size: 2rem; margin-bottom: 8px;">${allDone ? '&#127881;' : '&#9749;'}</div>
                    <div style="font-size: 1.1rem; color: #fff; font-weight: 700;">
                        ${allDone ? 'ALL OBJECTIVES COMPLETED' : 'NO PENDING MISSIONS'}
                    </div>
                    <div style="font-size: 0.85rem; margin-top: 4px;">
                        ${allDone ? 'Great job! You have cleared every assignment deadline.' : 'Add new assignments to generate an execution plan.'}
                    </div>
                </div>
            `;
            return;
        }

        const nextItem = plan[0];
        const nextTask = nextItem.task;
        const urgency = DS.calculateUrgencyScore(nextTask);

        missionBadge.textContent = 'RECOMMENDED NEXT';
        missionEl.innerHTML = `
            <div class="mission-card">
                <div class="mission-badge" style="background: ${urgency.color}; color: #040810;">
                    ${urgency.label} &bull; ${urgency.score}% URGENCY
                </div>
                <div class="mission-title">#${nextTask.id} &bull; ${escapeHtml(nextTask.title)}</div>
                
                <div class="mission-meta-grid">
                    <div class="meta-item">
                        <div class="meta-label">DEADLINE</div>
                        <div class="meta-val">${nextTask.deadline}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">TIME REMAINING</div>
                        <div class="meta-val" style="color: ${urgency.daysRemaining < 0 ? 'var(--neon-red)' : 'var(--primary-blue)'};">
                            ${urgency.daysRemaining < 0 ? `${Math.abs(urgency.daysRemaining)}d OVERDUE` : urgency.daysRemaining === 0 ? 'DUE TODAY' : `${urgency.daysRemaining} days`}
                        </div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">ESTIMATED EFFORT</div>
                        <div class="meta-val">${nextTask.hours.toFixed(1)} Hours</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">IMPORTANCE</div>
                        <div class="meta-val">${'&#9733;'.repeat(nextTask.importance)}${'&#9734;'.repeat(5 - nextTask.importance)}</div>
                    </div>
                </div>

                <div class="mission-reason">
                    <strong>STRATEGY:</strong> ${escapeHtml(nextItem.reason)}
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 14px;">
                    <button class="btn btn-neon-green" onclick="window.appToggleComplete(${nextTask.id})">
                        <span>&#10003;</span> Mark Mission Complete
                    </button>
                </div>
            </div>
        `;
    }

    function renderPriorityQueue() {
        const listEl = document.getElementById('priorityQueueList');
        if (!listEl) return;

        // Pending tasks sorted by min-heap comparator
        const pendingTasks = tasks.filter(t => !t.completed);
        const heap = new DS.BinaryMinHeap();
        for (const t of pendingTasks) {
            heap.insert(t);
        }

        const sorted = [];
        while (heap.size() > 0) {
            sorted.push(heap.extractMin());
        }

        if (sorted.length === 0) {
            listEl.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.85rem;">
                    No pending assignments in priority queue.
                </div>
            `;
            return;
        }

        let html = '';
        sorted.slice(0, 6).forEach((task, index) => {
            const urgency = DS.calculateUrgencyScore(task);
            const scoreClass = urgency.score >= 80 ? 'score-critical' :
                               urgency.score >= 60 ? 'score-high' :
                               urgency.score >= 35 ? 'score-medium' : 'score-low';

            html += `
                <div class="priority-item-card">
                    <div class="priority-item-header">
                        <span class="priority-item-rank">RANK #${index + 1}</span>
                        <span class="priority-score-badge ${scoreClass}">${urgency.label} &bull; ${urgency.score}%</span>
                    </div>
                    <div class="priority-item-title">#${task.id} &bull; ${escapeHtml(task.title)}</div>
                    <div class="priority-item-meta">
                        <span>Due: ${task.deadline}</span>
                        <span>Effort: ${task.hours.toFixed(1)}h</span>
                        <span>Imp: ${task.importance}/5</span>
                    </div>
                    <div class="priority-bar-wrap">
                        <div class="priority-bar-track">
                            <div class="priority-bar-fill" style="width: ${urgency.score}%; background: ${urgency.color}; box-shadow: 0 0 10px ${urgency.color};"></div>
                        </div>
                    </div>
                </div>
            `;
        });

        listEl.innerHTML = html;
    }

    function renderWorkloadChart() {
        const svg = document.getElementById('workloadSvg');
        const tooltip = document.getElementById('chartTooltip');
        if (!svg) return;

        const todayStr = DS.getTodayString();
        const days = [];
        const workloadMap = {};

        // Generate next 7 days
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${day}`;
            days.push(dateStr);
            workloadMap[dateStr] = { hours: 0, count: 0, tasks: [], overdue: false };
        }

        // Group tasks by deadline
        for (const t of tasks) {
            const rem = DS.daysBetweenDates(todayStr, t.deadline);
            if (workloadMap[t.deadline]) {
                workloadMap[t.deadline].hours += t.hours;
                workloadMap[t.deadline].count += 1;
                workloadMap[t.deadline].tasks.push(t);
            } else if (rem < 0 && !t.completed) {
                // Pile overdue workload onto today's bar
                workloadMap[todayStr].hours += t.hours;
                workloadMap[todayStr].count += 1;
                workloadMap[todayStr].tasks.push(t);
                workloadMap[todayStr].overdue = true;
            }
        }

        // Calculate max hours for scaling
        let maxHours = 5;
        days.forEach(d => {
            if (workloadMap[d].hours > maxHours) maxHours = workloadMap[d].hours;
        });
        maxHours = Math.ceil(maxHours / 2) * 2; // round up to multiple of 2

        const svgWidth = 520;
        const svgHeight = 220;
        const padLeft = 40;
        const padBottom = 30;
        const padTop = 20;
        const chartW = svgWidth - padLeft - 20;
        const chartH = svgHeight - padBottom - padTop;
        const barWidth = Math.floor(chartW / days.length) - 14;

        let svgHtml = '';

        // Horizontal Grid Lines
        for (let step = 0; step <= maxHours; step += Math.max(2, Math.floor(maxHours / 4))) {
            const y = padTop + chartH - (step / maxHours) * chartH;
            svgHtml += `
                <line x1="${padLeft}" y1="${y}" x2="${svgWidth - 10}" y2="${y}" stroke="rgba(0,191,255,0.1)" stroke-width="1" />
                <text x="${padLeft - 8}" y="${y + 4}" fill="#93A4BF" font-family="'JetBrains Mono', monospace" font-size="10" text-anchor="end">${step}h</text>
            `;
        }

        // Bars
        days.forEach((dateStr, i) => {
            const data = workloadMap[dateStr];
            const barH = data.hours > 0 ? (data.hours / maxHours) * chartH : 4;
            const x = padLeft + i * (barWidth + 14) + 6;
            const y = padTop + chartH - barH;

            const remDays = DS.daysBetweenDates(todayStr, dateStr);
            let barColor = 'var(--primary-blue)';
            if (data.overdue || remDays <= 1) barColor = 'var(--neon-red)';
            else if (remDays <= 2) barColor = 'var(--neon-amber)';

            const label = remDays === 0 ? 'Today' : dateStr.slice(5);

            svgHtml += `
                <g class="chart-bar" data-date="${dateStr}" data-hours="${data.hours}" data-count="${data.count}">
                    <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="${barColor}" opacity="0.85" />
                    <text x="${x + barWidth / 2}" y="${svgHeight - 10}" fill="#93A4BF" font-family="'JetBrains Mono', monospace" font-size="10" text-anchor="middle">${label}</text>
                    ${data.hours > 0 ? `<text x="${x + barWidth / 2}" y="${y - 6}" fill="#fff" font-family="'JetBrains Mono', monospace" font-size="10" text-anchor="middle">${data.hours.toFixed(1)}h</text>` : ''}
                </g>
            `;
        });

        svg.innerHTML = svgHtml;

        // Tooltip interaction
        svg.querySelectorAll('.chart-bar').forEach(bar => {
            bar.addEventListener('mouseenter', (e) => {
                const date = bar.getAttribute('data-date');
                const hours = bar.getAttribute('data-hours');
                const count = bar.getAttribute('data-count');
                const tasksOnDate = workloadMap[date]?.tasks || [];

                let taskListHtml = tasksOnDate.map(t => `&bull; #${t.id} ${escapeHtml(t.title)} (${t.hours}h)`).join('<br>');
                if (!taskListHtml) taskListHtml = 'No tasks scheduled';

                tooltip.innerHTML = `
                    <div style="font-weight: 700; color: var(--primary-blue); margin-bottom: 4px;">${date}</div>
                    <div>Workload: <strong>${hours} hrs</strong> (${count} tasks)</div>
                    <div style="margin-top: 6px; font-size: 0.7rem; color: #cbd5e1; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">${taskListHtml}</div>
                `;
                tooltip.style.opacity = '1';
            });

            bar.addEventListener('mousemove', (e) => {
                const rect = svg.getBoundingClientRect();
                tooltip.style.left = `${e.clientX - rect.left + 15}px`;
                tooltip.style.top = `${e.clientY - rect.top - 20}px`;
            });

            bar.addEventListener('mouseleave', () => {
                tooltip.style.opacity = '0';
            });
        });
    }

    /* ----------------- 2. ASSIGNMENTS TABLE ----------------- */

    function renderAssignmentsTable() {
        const tbody = document.getElementById('assignmentsTableBody');
        if (!tbody) return;

        let filtered = tasks;

        // Apply Status Filter
        if (currentFilter === 'pending') {
            filtered = filtered.filter(t => !t.completed);
        } else if (currentFilter === 'completed') {
            filtered = filtered.filter(t => t.completed);
        } else if (currentFilter === 'overdue') {
            const today = DS.getTodayString();
            filtered = filtered.filter(t => !t.completed && DS.daysBetweenDates(today, t.deadline) < 0);
        }

        // Apply Search Filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(t => t.title.toLowerCase().includes(q) || String(t.id).includes(q));
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 30px; color: var(--text-muted);">
                        No assignments matching criteria.
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        filtered.forEach(task => {
            const urgency = DS.calculateUrgencyScore(task);
            const scoreClass = urgency.score >= 80 ? 'score-critical' :
                               urgency.score >= 60 ? 'score-high' :
                               urgency.score >= 35 ? 'score-medium' : 'score-low';

            // Render prerequisites tags
            let depHtml = '';
            if (task.dependencies && task.dependencies.length > 0) {
                depHtml = task.dependencies.map(depId => {
                    const p = getTaskById(depId);
                    const isDone = p && p.completed;
                    return `<span class="dep-tag ${isDone ? 'resolved' : 'unresolved'}" title="${p ? escapeHtml(p.title) : 'Unknown'}">#${depId} ${isDone ? '&#10003;' : '&#9203;'}</span>`;
                }).join('');
            } else {
                depHtml = '<span style="color: var(--text-muted); font-size: 0.75rem;">None</span>';
            }

            html += `
                <tr class="${task.completed ? 'row-completed' : ''}">
                    <td><strong style="color: var(--primary-blue); font-family: var(--font-mono);">#${task.id}</strong></td>
                    <td>
                        <div style="font-weight: 600; color: #fff;">${escapeHtml(task.title)}</div>
                    </td>
                    <td style="font-family: var(--font-mono);">${task.deadline}</td>
                    <td style="font-family: var(--font-mono);">${task.hours.toFixed(1)}h</td>
                    <td style="color: var(--neon-amber);">${'&#9733;'.repeat(task.importance)}</td>
                    <td>
                        <div class="priority-bar-wrap">
                            <div class="priority-bar-track" style="width: 80px;">
                                <div class="priority-bar-fill" style="width: ${urgency.score}%; background: ${urgency.color};"></div>
                            </div>
                            <span class="priority-score-badge ${scoreClass}" style="min-width: 50px;">${urgency.score}%</span>
                        </div>
                    </td>
                    <td>${depHtml}</td>
                    <td>
                        <span class="status-badge" style="background: ${task.completed ? 'var(--neon-green-dark)' : 'var(--primary-blue-dark)'}; color: ${task.completed ? 'var(--neon-green)' : 'var(--primary-blue)'}; border-color: ${task.completed ? 'var(--neon-green)' : 'var(--primary-blue)'};">
                            ${task.completed ? 'COMPLETED' : 'PENDING'}
                        </span>
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button class="btn btn-sm ${task.completed ? 'btn-outline' : 'btn-neon-green'}" onclick="window.appToggleComplete(${task.id})" title="${task.completed ? 'Mark Pending' : 'Mark Complete'}">
                            ${task.completed ? '&#8634;' : '&#10003;'}
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="window.appEditTask(${task.id})" title="Edit">
                            &#9998;
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="window.appDeleteTask(${task.id})" title="Delete">
                            &times;
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    /* ----------------- 3. OPTIMIZER ----------------- */

    function renderOptimizer() {
        const timelineEl = document.getElementById('optimizerTimeline');
        const cycleBanner = document.getElementById('cycleWarningBanner');
        const cycleDetails = document.getElementById('cycleTaskDetails');
        const blockedSection = document.getElementById('blockedTasksSection');
        const blockedList = document.getElementById('blockedTasksList');
        if (!timelineEl) return;

        const { plan, cycleDetected, cycleTasks } = DS.generateOptimizedPlan(tasks);

        // Cycle Warning
        if (cycleDetected) {
            cycleBanner.style.display = 'flex';
            cycleDetails.textContent = `Circular deadlock detected among Task IDs: ${cycleTasks.map(id => '#' + id).join(', ')}. These tasks cannot be scheduled until prerequisites are resolved.`;
        } else {
            cycleBanner.style.display = 'none';
        }

        if (plan.length === 0) {
            timelineEl.innerHTML = `
                <div style="padding: 30px; text-align: center; color: var(--text-muted); background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                    ${tasks.length === 0 ? 'No assignments available to schedule.' : 'All assignments have been completed! No pending tasks remaining.'}
                </div>
            `;
        } else {
            let html = '';
            plan.forEach((item, index) => {
                const t = item.task;
                const urgency = DS.calculateUrgencyScore(t);

                html += `
                    <div class="timeline-step ${index === 0 ? 'first-step' : ''}">
                        <div class="step-marker">${item.rank}</div>
                        <div class="step-title-wrap">
                            <span class="step-title">#${t.id} &bull; ${escapeHtml(t.title)}</span>
                            <span class="priority-score-badge" style="background: ${urgency.color}22; color: ${urgency.color}; border: 1px solid ${urgency.color};">
                                ${urgency.label} &bull; ${urgency.score}%
                            </span>
                        </div>
                        <div style="display: flex; gap: 16px; font-size: 0.8rem; color: var(--text-muted); font-family: var(--font-mono); margin-bottom: 8px;">
                            <span>Deadline: <strong style="color: #fff;">${t.deadline}</strong></span>
                            <span>Duration: <strong style="color: #fff;">${t.hours.toFixed(1)}h</strong></span>
                            <span>Importance: <strong style="color: var(--neon-amber);">${t.importance}/5</strong></span>
                        </div>
                        <div class="step-reason-badge">
                            &#9656; ${escapeHtml(item.reason)}
                        </div>
                    </div>
                `;
            });
            timelineEl.innerHTML = html;
        }

        // Render Blocked Tasks (tasks that currently have unfinished prerequisites)
        const blockedTasks = tasks.filter(t => {
            if (t.completed) return false;
            if (!t.dependencies || t.dependencies.length === 0) return false;
            return t.dependencies.some(pId => {
                const prereq = getTaskById(pId);
                return !prereq || !prereq.completed;
            });
        });

        if (blockedTasks.length > 0) {
            blockedSection.style.display = 'block';
            let bHtml = '';
            blockedTasks.forEach(t => {
                const unfulfilled = t.dependencies.filter(pId => {
                    const p = getTaskById(pId);
                    return !p || !p.completed;
                });

                bHtml += `
                    <div class="priority-item-card" style="border-left: 3px solid var(--neon-amber);">
                        <div class="priority-item-header">
                            <span class="priority-item-title">#${t.id} &bull; ${escapeHtml(t.title)}</span>
                            <span class="status-badge" style="background: var(--neon-amber-dark); color: var(--neon-amber); border-color: var(--neon-amber);">BLOCKED</span>
                        </div>
                        <div style="font-size: 0.78rem; color: var(--text-muted); font-family: var(--font-mono);">
                            Waiting on prerequisite tasks: ${unfulfilled.map(id => '#' + id).join(', ')}
                        </div>
                    </div>
                `;
            });
            blockedList.innerHTML = bHtml;
        } else {
            blockedSection.style.display = 'none';
        }
    }

    /* ----------------- 4. INTERACTIVE DEPENDENCY GRAPH ----------------- */

    function renderGraph() {
        const svg = document.getElementById('graphSvg');
        const edgesGroup = document.getElementById('graphEdgesGroup');
        const nodesGroup = document.getElementById('graphNodesGroup');
        const zoomGroup = document.getElementById('graphZoomGroup');
        if (!svg || !edgesGroup || !nodesGroup) return;

        edgesGroup.innerHTML = '';
        nodesGroup.innerHTML = '';

        if (tasks.length === 0) return;

        // Apply current zoom and pan
        zoomGroup.setAttribute('transform', `translate(${graphPanX}, ${graphPanY}) scale(${graphZoom})`);

        // Topological Layer Assignment for deterministic positioning
        const layers = {};
        const inDegree = {};
        const nodePositions = {};
        const taskMap = {};

        tasks.forEach(t => {
            taskMap[t.id] = t;
            inDegree[t.id] = 0;
            layers[t.id] = 0;
        });

        tasks.forEach(t => {
            (t.dependencies || []).forEach(pId => {
                if (taskMap[pId]) {
                    inDegree[t.id]++;
                }
            });
        });

        // Compute layer (longest path from root)
        let changed = true;
        let iter = 0;
        while (changed && iter < tasks.length + 1) {
            changed = false;
            iter++;
            tasks.forEach(t => {
                (t.dependencies || []).forEach(pId => {
                    if (layers[t.id] <= layers[pId]) {
                        layers[t.id] = layers[pId] + 1;
                        changed = true;
                    }
                });
            });
        }

        // Group tasks by layer
        const layerBuckets = {};
        tasks.forEach(t => {
            const l = layers[t.id] || 0;
            if (!layerBuckets[l]) layerBuckets[l] = [];
            layerBuckets[l].push(t);
        });

        const nodeW = 160;
        const nodeH = 65;
        const layerSpacingX = 220;
        const rowSpacingY = 90;

        // Assign coordinate positions
        Object.keys(layerBuckets).forEach(lStr => {
            const l = parseInt(lStr, 10);
            const bucket = layerBuckets[l];
            bucket.forEach((t, rowIdx) => {
                nodePositions[t.id] = {
                    x: l * layerSpacingX + 20,
                    y: rowIdx * rowSpacingY + 30
                };
            });
        });

        // Render Edges
        tasks.forEach(t => {
            const destPos = nodePositions[t.id];
            (t.dependencies || []).forEach(pId => {
                const srcPos = nodePositions[pId];
                if (srcPos && destPos) {
                    const startX = srcPos.x + nodeW;
                    const startY = srcPos.y + nodeH / 2;
                    const endX = destPos.x;
                    const endY = destPos.y + nodeH / 2;

                    // Smooth bezier curve
                    const dx = (endX - startX) * 0.5;
                    const pathData = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

                    const isPrereqDone = taskMap[pId]?.completed;
                    const marker = isPrereqDone ? 'url(#arrow-green)' : 'url(#arrow)';
                    const edgeColor = isPrereqDone ? 'var(--neon-green)' : 'var(--primary-blue)';

                    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    pathEl.setAttribute('d', pathData);
                    pathEl.setAttribute('class', `graph-edge ${isPrereqDone ? '' : 'active'}`);
                    pathEl.setAttribute('stroke', edgeColor);
                    pathEl.setAttribute('marker-end', marker);
                    pathEl.setAttribute('data-source', pId);
                    pathEl.setAttribute('data-target', t.id);
                    edgesGroup.appendChild(pathEl);
                }
            });
        });

        // Render Nodes
        tasks.forEach(t => {
            const pos = nodePositions[t.id];
            const isBlocked = (t.dependencies || []).some(pId => taskMap[pId] && !taskMap[pId].completed);
            const urgency = DS.calculateUrgencyScore(t);

            let strokeColor = 'var(--primary-blue)';
            let statusIcon = '&#9679;';
            if (t.completed) {
                strokeColor = 'var(--neon-green)';
                statusIcon = '&#10003;';
            } else if (isBlocked) {
                strokeColor = 'var(--neon-amber)';
                statusIcon = '&#9203;';
            } else if (urgency.score >= 80) {
                strokeColor = 'var(--neon-red)';
                statusIcon = '&#9888;';
            }

            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', `graph-node ${selectedTaskId === t.id ? 'selected' : ''}`);
            g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
            g.setAttribute('data-id', t.id);

            // Truncate title
            const shortTitle = t.title.length > 17 ? t.title.slice(0, 16) + '...' : t.title;

            g.innerHTML = `
                <rect width="${nodeW}" height="${nodeH}" rx="6" fill="#101827" stroke="${strokeColor}" stroke-width="1.8" />
                <text x="10" y="20" fill="${strokeColor}" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="700">#${t.id}</text>
                <text x="${nodeW - 10}" y="20" fill="${strokeColor}" font-family="'JetBrains Mono', monospace" font-size="11" text-anchor="end">${statusIcon}</text>
                <text x="10" y="38" fill="#F5F7FF" font-family="'Rajdhani', sans-serif" font-size="13" font-weight="600">${escapeHtml(shortTitle)}</text>
                <text x="10" y="54" fill="#93A4BF" font-family="'JetBrains Mono', monospace" font-size="10">${t.deadline} &bull; ${t.hours}h</text>
            `;

            g.addEventListener('click', (e) => {
                e.stopPropagation();
                selectGraphNode(t.id);
            });

            nodesGroup.appendChild(g);
        });
    }

    function selectGraphNode(taskId) {
        selectedTaskId = taskId;
        renderGraph();

        const task = getTaskById(taskId);
        const drawer = document.getElementById('nodeDrawer');
        const drawerContent = document.getElementById('nodeDrawerContent');
        if (!task || !drawer || !drawerContent) return;

        const urgency = DS.calculateUrgencyScore(task);
        const prereqs = (task.dependencies || []).map(id => getTaskById(id)).filter(Boolean);
        const dependents = tasks.filter(t => (t.dependencies || []).includes(taskId));

        drawerContent.innerHTML = `
            <div style="margin-bottom: 12px;">
                <span class="priority-score-badge" style="background: ${urgency.color}22; color: ${urgency.color}; border: 1px solid ${urgency.color};">
                    ${urgency.label} &bull; ${urgency.score}%
                </span>
            </div>
            <h3 style="font-size: 1.15rem; color: #fff; margin-bottom: 6px;">#${task.id} &bull; ${escapeHtml(task.title)}</h3>
            <div style="font-size: 0.8rem; color: var(--text-muted); font-family: var(--font-mono); margin-bottom: 16px;">
                Status: <strong>${task.completed ? 'COMPLETED' : 'PENDING'}</strong>
            </div>

            <div class="mission-meta-grid" style="margin-bottom: 16px;">
                <div class="meta-item">
                    <div class="meta-label">DEADLINE</div>
                    <div class="meta-val">${task.deadline}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">DURATION</div>
                    <div class="meta-val">${task.hours.toFixed(1)}h</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">IMPORTANCE</div>
                    <div class="meta-val">${task.importance}/5</div>
                </div>
            </div>

            <!-- Prerequisites list -->
            <div style="margin-bottom: 14px;">
                <div class="telemetry-label" style="margin-bottom: 6px;">PREREQUISITES (Must do first)</div>
                ${prereqs.length > 0 ? prereqs.map(p => `
                    <div style="font-size: 0.8rem; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.06); color: ${p.completed ? 'var(--neon-green)' : 'var(--neon-amber)'}; font-family: var(--font-mono);">
                        ${p.completed ? '&#10003;' : '&#9203;'} #${p.id} ${escapeHtml(p.title)}
                    </div>
                `).join('') : '<div style="color: var(--text-muted); font-size: 0.78rem;">None</div>'}
            </div>

            <!-- Dependent tasks list -->
            <div style="margin-bottom: 20px;">
                <div class="telemetry-label" style="margin-bottom: 6px;">DEPENDENTS (Unlocked by this task)</div>
                ${dependents.length > 0 ? dependents.map(d => `
                    <div style="font-size: 0.8rem; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.06); color: var(--primary-blue); font-family: var(--font-mono);">
                        &rarr; #${d.id} ${escapeHtml(d.title)}
                    </div>
                `).join('') : '<div style="color: var(--text-muted); font-size: 0.78rem;">None</div>'}
            </div>

            <div style="display: flex; gap: 8px;">
                <button class="btn btn-sm ${task.completed ? 'btn-outline' : 'btn-neon-green'}" onclick="window.appToggleComplete(${task.id})">
                    ${task.completed ? 'Mark Pending' : 'Mark Complete'}
                </button>
                <button class="btn btn-sm btn-outline" onclick="window.appEditTask(${task.id})">
                    Edit
                </button>
            </div>
        `;

        drawer.classList.add('open');
    }

    /* ------------------------------------------------------------------------- */
    /*                         TASK MUTATIONS & CYCLE CHECKS                     */
    /* ------------------------------------------------------------------------- */

    function checkWouldCreateCycle(taskId, newPrereqs) {
        // Construct temporary directed graph
        const count = tasks.length + 1;
        const tempGraph = new DS.DirectedGraph(count);
        const tempHt = new DS.HashTable(37);

        const tempTasks = JSON.parse(JSON.stringify(tasks));
        let targetIdx = tempTasks.findIndex(t => t.id === taskId);
        if (targetIdx === -1) {
            targetIdx = tempTasks.length;
            tempTasks.push({ id: taskId, dependencies: newPrereqs });
        } else {
            tempTasks[targetIdx].dependencies = newPrereqs;
        }

        for (let i = 0; i < tempTasks.length; i++) {
            tempHt.insert(tempTasks[i].id, i);
        }

        for (let i = 0; i < tempTasks.length; i++) {
            const deps = tempTasks[i].dependencies || [];
            for (let d = 0; d < deps.length; d++) {
                const pIdx = tempHt.search(deps[d]);
                if (pIdx !== -1) {
                    tempGraph.addEdge(pIdx, i);
                }
            }
        }

        // For each prerequisite p, if there is a path from target to p, adding p -> target creates a cycle!
        for (const pId of newPrereqs) {
            const pIdx = tempHt.search(pId);
            if (pIdx !== -1 && tempGraph.isReachable(targetIdx, pIdx)) {
                return true;
            }
        }

        return false;
    }

    function saveTask(taskData) {
        if (taskData.id) {
            // Edit existing
            const idx = tasks.findIndex(t => t.id === taskData.id);
            if (idx !== -1) {
                tasks[idx] = { ...tasks[idx], ...taskData };
                showToast(`Task #${taskData.id} updated`, 'success');
            }
        } else {
            // Add new
            const newId = getNextId();
            tasks.push({
                id: newId,
                title: taskData.title,
                deadline: taskData.deadline,
                hours: taskData.hours,
                importance: taskData.importance,
                completed: 0,
                dependencies: taskData.dependencies || []
            });
            showToast(`Assignment #${newId} created`, 'success');
        }

        saveTasksToStorage();
        renderAll();
    }

    function deleteTask(taskId) {
        if (!confirm(`Are you sure you want to delete Assignment #${taskId}?`)) return;

        // Remove from dependencies of other tasks
        tasks.forEach(t => {
            if (t.dependencies) {
                t.dependencies = t.dependencies.filter(id => id !== taskId);
            }
        });

        tasks = tasks.filter(t => t.id !== taskId);
        if (selectedTaskId === taskId) {
            selectedTaskId = null;
            document.getElementById('nodeDrawer')?.classList.remove('open');
        }

        saveTasksToStorage();
        renderAll();
        showToast(`Assignment #${taskId} deleted`, 'danger');
    }

    function toggleComplete(taskId) {
        const task = getTaskById(taskId);
        if (!task) return;

        task.completed = task.completed ? 0 : 1;
        saveTasksToStorage();
        renderAll();

        if (selectedTaskId === taskId) {
            selectGraphNode(taskId);
        }

        showToast(
            task.completed ? `Mission #${taskId} marked Complete! Unlocked dependent tasks.` : `Task #${taskId} marked Pending.`,
            task.completed ? 'success' : 'default'
        );
    }

    /* ------------------------------------------------------------------------- */
    /*                         MODALS & FORMS HANDLING                           */
    /* ------------------------------------------------------------------------- */

    function openTaskModal(taskId = null) {
        const modal = document.getElementById('taskModal');
        const modalTitle = document.getElementById('taskModalTitle');
        const formId = document.getElementById('formTaskId');
        const formTitle = document.getElementById('formTitle');
        const formDeadline = document.getElementById('formDeadline');
        const formHours = document.getElementById('formHours');
        const formImp = document.getElementById('formImportance');
        const formDepGrid = document.getElementById('formDepGrid');
        const depError = document.getElementById('formDepError');

        if (!modal) return;
        depError.textContent = '';

        if (taskId) {
            const task = getTaskById(taskId);
            if (!task) return;
            modalTitle.textContent = `Edit Assignment #${task.id}`;
            formId.value = task.id;
            formTitle.value = task.title;
            formDeadline.value = task.deadline;
            formHours.value = task.hours;
            formImp.value = task.importance;
        } else {
            modalTitle.textContent = 'Add New Assignment';
            formId.value = '';
            formTitle.value = '';
            formDeadline.value = DS.getTodayString();
            formHours.value = '2.5';
            formImp.value = '4';
        }

        // Render available prerequisite checkboxes
        const currentId = taskId ? parseInt(taskId, 10) : null;
        const currentTask = currentId ? getTaskById(currentId) : null;
        const existingDeps = currentTask?.dependencies || [];

        let depHtml = '';
        const eligiblePrereqs = tasks.filter(t => t.id !== currentId);
        if (eligiblePrereqs.length === 0) {
            depHtml = '<div style="color: var(--text-muted); font-size: 0.78rem; grid-column: 1 / -1;">No existing tasks available to set as prerequisites.</div>';
        } else {
            eligiblePrereqs.forEach(t => {
                const isChecked = existingDeps.includes(t.id) ? 'checked' : '';
                depHtml += `
                    <label class="dep-checkbox-item">
                        <input type="checkbox" name="depTask" value="${t.id}" ${isChecked}>
                        <span>#${t.id} ${escapeHtml(t.title)}</span>
                    </label>
                `;
            });
        }
        formDepGrid.innerHTML = depHtml;

        modal.classList.add('open');
    }

    function closeTaskModal() {
        document.getElementById('taskModal')?.classList.remove('open');
    }

    /* ----------------- DATA STRUCTURE INSPECTOR MODAL ----------------- */

    function openDsInspectorModal() {
        const modal = document.getElementById('dsInspectorModal');
        const hashOut = document.getElementById('inspectorHashOutput');
        const heapOut = document.getElementById('inspectorHeapOutput');
        const graphOut = document.getElementById('inspectorGraphOutput');
        if (!modal) return;

        // 1. Hash Table
        const ht = new DS.HashTable(37);
        tasks.forEach((t, i) => ht.insert(t.id, i));
        const buckets = ht.getBucketEntries();
        let hashHtml = '';
        if (buckets.length === 0) {
            hashHtml = '<div>Hash table is currently empty.</div>';
        } else {
            buckets.forEach(b => {
                const chain = b.entries.map(e => `[ID:${e.taskId} &rarr; tasks[${e.taskIndex}]]`).join(' &rarr; ');
                hashHtml += `<div style="margin-bottom: 3px;"><strong style="color: var(--primary-blue);">Bucket [${b.bucketIndex}]:</strong> ${chain} &rarr; null</div>`;
            });
        }
        hashOut.innerHTML = hashHtml;

        // 2. Binary Min-Heap
        const heap = new DS.BinaryMinHeap();
        tasks.filter(t => !t.completed).forEach(t => heap.insert(t));
        let heapHtml = `<div>Pending Tasks in Heap: <strong>${heap.size()}</strong></div><div style="margin-top: 6px;">`;
        heap.data.forEach((t, i) => {
            heapHtml += `<div style="padding: 2px 0;">[idx ${i}]: Task #${t.id} (${t.deadline}, Imp:${t.importance}, ${t.hours}h)</div>`;
        });
        heapHtml += '</div>';
        heapOut.innerHTML = heapHtml;

        // 3. Directed Graph
        const g = new DS.DirectedGraph(tasks.length);
        tasks.forEach((t, i) => {
            (t.dependencies || []).forEach(pId => {
                const pIdx = tasks.findIndex(task => task.id === pId);
                if (pIdx !== -1) g.addEdge(pIdx, i);
            });
        });

        let graphHtml = '';
        tasks.forEach((t, i) => {
            const neighbors = g.getNeighbors(i).map(vIdx => `#${tasks[vIdx].id} (${escapeHtml(tasks[vIdx].title)})`);
            graphHtml += `
                <div style="padding: 2px 0;">
                    <strong style="color: var(--primary-blue);">Vertex [${i}] #${t.id}:</strong> 
                    ${neighbors.length > 0 ? neighbors.join(' &rarr; ') : '<span style="color: var(--text-muted);">(No dependents)</span>'}
                </div>
            `;
        });
        graphOut.innerHTML = graphHtml;

        modal.classList.add('open');
    }

    function closeDsInspectorModal() {
        document.getElementById('dsInspectorModal')?.classList.remove('open');
    }

    /* ------------------------------------------------------------------------- */
    /*                         EVENT BINDINGS & ACTIONS                          */
    /* ------------------------------------------------------------------------- */

    function bindEvents() {
        // Navigation Tabs
        document.querySelectorAll('.nav-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const targetTab = btn.getAttribute('data-tab');
                document.getElementById(`tab-${targetTab}`)?.classList.add('active');
                if (targetTab === 'graph') renderGraph();
            });
        });

        // Filters in Assignments View
        document.querySelectorAll('.filter-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.getAttribute('data-filter');
                renderAssignmentsTable();
            });
        });

        // Search Input
        const searchInput = document.getElementById('taskSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                renderAssignmentsTable();
            });
        }

        // Open Add Modal
        document.getElementById('btnOpenAddModal')?.addEventListener('click', () => openTaskModal());

        // Close Modal buttons
        document.getElementById('btnCloseTaskModal')?.addEventListener('click', closeTaskModal);
        document.getElementById('btnCancelTaskModal')?.addEventListener('click', closeTaskModal);

        // Close Drawer button
        document.getElementById('btnCloseDrawer')?.addEventListener('click', () => {
            document.getElementById('nodeDrawer')?.classList.remove('open');
            selectedTaskId = null;
            renderGraph();
        });

        // Task Form Submit
        document.getElementById('taskForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const idVal = document.getElementById('formTaskId').value;
            const title = document.getElementById('formTitle').value.trim();
            const deadline = document.getElementById('formDeadline').value;
            const hours = parseFloat(document.getElementById('formHours').value);
            const importance = parseInt(document.getElementById('formImportance').value, 10);
            const depError = document.getElementById('formDepError');

            // Collect checked dependencies
            const checkedBoxes = document.querySelectorAll('input[name="depTask"]:checked');
            const dependencies = Array.from(checkedBoxes).map(cb => parseInt(cb.value, 10));

            // Cycle prevention check
            const taskId = idVal ? parseInt(idVal, 10) : null;
            if (checkWouldCreateCycle(taskId, dependencies)) {
                depError.textContent = 'REJECTED: Adding these prerequisites introduces a circular deadlock (cycle)!';
                return;
            }

            saveTask({
                id: taskId,
                title,
                deadline,
                hours,
                importance,
                dependencies
            });

            closeTaskModal();
        });

        // Recalculate Optimizer Button
        document.getElementById('btnRunOptimizer')?.addEventListener('click', () => {
            renderOptimizer();
            showToast('Execution sequence recalculated', 'success');
        });

        // Viva DS Inspector
        document.getElementById('btnDsInspector')?.addEventListener('click', openDsInspectorModal);
        document.getElementById('btnCloseDsModal')?.addEventListener('click', closeDsInspectorModal);
        document.getElementById('btnDismissDsModal')?.addEventListener('click', closeDsInspectorModal);

        // Export File (planner.txt)
        document.getElementById('btnExportFile')?.addEventListener('click', () => {
            const fileContent = DS.serializePlannerFile(tasks);
            const blob = new Blob([fileContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'planner.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Exported planner.txt successfully', 'success');
        });

        // Import File
        const fileInput = document.getElementById('fileInput');
        document.getElementById('btnImportFile')?.addEventListener('click', () => {
            fileInput.value = '';
            fileInput.click();
        });

        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importedTasks = DS.parsePlannerFile(event.target.result);
                    if (importedTasks.length === 0) {
                        showToast('Imported file contained no valid assignments.', 'danger');
                        return;
                    }
                    tasks = importedTasks;
                    saveTasksToStorage();
                    renderAll();
                    showToast(`Successfully imported ${importedTasks.length} assignments!`, 'success');
                } catch (err) {
                    showToast(`Import error: ${err.message}`, 'danger');
                }
            };
            reader.readAsText(file);
        });

        // Demo Data Button
        document.getElementById('btnDemoData')?.addEventListener('click', () => {
            if (confirm('Load demo student assignments? This will replace current records.')) {
                tasks = JSON.parse(JSON.stringify(DEFAULT_DEMO_DATA));
                saveTasksToStorage();
                renderAll();
                showToast('Standard demo assignments loaded', 'success');
            }
        });

        // Reset Data Button
        document.getElementById('btnResetData')?.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear ALL assignments?')) {
                tasks = [];
                saveTasksToStorage();
                renderAll();
                showToast('All local assignments cleared', 'default');
            }
        });

        // Graph Zoom & Pan Controls
        document.getElementById('btnZoomIn')?.addEventListener('click', () => {
            graphZoom = Math.min(graphZoom + 0.15, 2.0);
            renderGraph();
        });
        document.getElementById('btnZoomOut')?.addEventListener('click', () => {
            graphZoom = Math.max(graphZoom - 0.15, 0.4);
            renderGraph();
        });
        document.getElementById('btnZoomReset')?.addEventListener('click', () => {
            graphZoom = 1.0;
            graphPanX = 40;
            graphPanY = 40;
            renderGraph();
        });

        // Graph Drag Pan
        const graphSvg = document.getElementById('graphSvg');
        if (graphSvg) {
            graphSvg.addEventListener('mousedown', (e) => {
                if (e.target.closest('.graph-node')) return;
                isPanning = true;
                startPanX = e.clientX - graphPanX;
                startPanY = e.clientY - graphPanY;
            });

            window.addEventListener('mousemove', (e) => {
                if (!isPanning) return;
                graphPanX = e.clientX - startPanX;
                graphPanY = e.clientY - startPanY;
                document.getElementById('graphZoomGroup')?.setAttribute(
                    'transform',
                    `translate(${graphPanX}, ${graphPanY}) scale(${graphZoom})`
                );
            });

            window.addEventListener('mouseup', () => {
                isPanning = false;
            });
        }
    }

    /* ----------------- TOAST NOTIFICATIONS ----------------- */

    function showToast(message, type = 'default') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type === 'success' ? 'toast-success' : type === 'danger' ? 'toast-danger' : ''}`;
        toast.innerHTML = `<span>${type === 'success' ? '&#10003;' : type === 'danger' ? '&#9888;' : '&#9679;'}</span> <span>${escapeHtml(message)}</span>`;

        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Expose helpers for inline click handlers in HTML strings
    window.appToggleComplete = toggleComplete;
    window.appEditTask = openTaskModal;
    window.appDeleteTask = deleteTask;

    // Start App when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
