/**
 * ============================================================================
 * ASSIGNMENT DEADLINE OPTIMIZER (DEADLINE//CTRL)
 * Handwritten Data Structures & Scheduling Engine (ES6 / Vanilla JS)
 *
 * Implemented Data Structures:
 * 1. BinaryMinHeap  - Custom Priority Queue adhering to deterministic comparator
 * 2. DirectedGraph  - Adjacency List graph for dependency management & reachability
 * 3. LinearQueue    - FIFO Queue with explicit pointer logic for BFS / Kahn's
 * 4. HashTable      - Bucket-chained Hash Table for O(1) Task ID lookups
 * ============================================================================
 */

/* ------------------------------------------------------------------------- */
/*                             1. HASH TABLE                                 */
/* ------------------------------------------------------------------------- */

class HashEntry {
    constructor(taskId, taskIndex) {
        this.taskId = taskId;
        this.taskIndex = taskIndex;
        this.next = null;
    }
}

class HashTable {
    constructor(size = 37) {
        this.size = size;
        this.buckets = new Array(size).fill(null);
    }

    _hash(key) {
        return Math.abs(key) % this.size;
    }

    insert(taskId, taskIndex) {
        const b = this._hash(taskId);
        let curr = this.buckets[b];
        while (curr !== null) {
            if (curr.taskId === taskId) {
                curr.taskIndex = taskIndex;
                return;
            }
            curr = curr.next;
        }
        const newEntry = new HashEntry(taskId, taskIndex);
        newEntry.next = this.buckets[b];
        this.buckets[b] = newEntry;
    }

    search(taskId) {
        const b = this._hash(taskId);
        let curr = this.buckets[b];
        while (curr !== null) {
            if (curr.taskId === taskId) {
                return curr.taskIndex;
            }
            curr = curr.next;
        }
        return -1;
    }

    delete(taskId) {
        const b = this._hash(taskId);
        let curr = this.buckets[b];
        let prev = null;
        while (curr !== null) {
            if (curr.taskId === taskId) {
                if (prev === null) {
                    this.buckets[b] = curr.next;
                } else {
                    prev.next = curr.next;
                }
                return true;
            }
            prev = curr;
            curr = curr.next;
        }
        return false;
    }

    clear() {
        this.buckets = new Array(this.size).fill(null);
    }

    getBucketEntries() {
        const result = [];
        for (let i = 0; i < this.size; i++) {
            const list = [];
            let curr = this.buckets[i];
            while (curr !== null) {
                list.push({ taskId: curr.taskId, taskIndex: curr.taskIndex });
                curr = curr.next;
            }
            if (list.length > 0) {
                result.push({ bucketIndex: i, entries: list });
            }
        }
        return result;
    }
}

/* ------------------------------------------------------------------------- */
/*                              2. FIFO QUEUE                                */
/* ------------------------------------------------------------------------- */

class LinearQueue {
    constructor() {
        this.items = [];
        this.f = 0;
        this.r = 0;
    }

    enqueue(item) {
        this.items.push(item);
        this.r++;
    }

    dequeue() {
        if (this.isEmpty()) return null;
        const val = this.items[this.f];
        this.f++;
        return val;
    }

    isEmpty() {
        return this.f >= this.r;
    }

    size() {
        return this.r - this.f;
    }

    clear() {
        this.items = [];
        this.f = 0;
        this.r = 0;
    }
}

/* ------------------------------------------------------------------------- */
/*                         3. DIRECTED GRAPH (ADJ LIST)                      */
/* ------------------------------------------------------------------------- */

class GraphNode {
    constructor(taskIndex) {
        this.taskIndex = taskIndex;
        this.next = null;
    }
}

class DirectedGraph {
    constructor(vertexCount) {
        this.numVertices = vertexCount;
        this.adj = new Array(vertexCount).fill(null);
    }

    addEdge(u, v) {
        // Directed edge: u -> v (Task u is prerequisite for Task v)
        const node = new GraphNode(v);
        node.next = this.adj[u];
        this.adj[u] = node;
    }

    getNeighbors(u) {
        const neighbors = [];
        let curr = this.adj[u];
        while (curr !== null) {
            neighbors.push(curr.taskIndex);
            curr = curr.next;
        }
        return neighbors;
    }

    // BFS Reachability check to prevent cycles when adding edges
    isReachable(start, target) {
        if (start === target) return true;
        const visited = new Array(this.numVertices).fill(false);
        const q = new LinearQueue();

        visited[start] = true;
        q.enqueue(start);

        while (!q.isEmpty()) {
            const u = q.dequeue();
            if (u === target) return true;

            let curr = this.adj[u];
            while (curr !== null) {
                const v = curr.taskIndex;
                if (v === target) return true;
                if (!visited[v]) {
                    visited[v] = true;
                    q.enqueue(v);
                }
                curr = curr.next;
            }
        }
        return false;
    }
}

/* ------------------------------------------------------------------------- */
/*                       4. BINARY MIN-HEAP (PRIORITY QUEUE)                 */
/* ------------------------------------------------------------------------- */

class BinaryMinHeap {
    constructor(comparator = null) {
        this.data = [];
        this.comparator = comparator || this.defaultComparator;
    }

    /*
     * Comparator Rule:
     * 1. Earliest deadline first (YYYY-MM-DD string comparison).
     * 2. Higher importance if deadlines are equal.
     * 3. Shorter estimated duration if both preceding values are equal.
     * 4. Smaller task ID as the final tie-breaker.
     */
    defaultComparator(a, b) {
        // 1. Deadline
        if (a.deadline !== b.deadline) {
            return a.deadline.localeCompare(b.deadline);
        }
        // 2. Importance (higher is prioritized)
        if (a.importance !== b.importance) {
            return b.importance - a.importance;
        }
        // 3. Shorter duration
        if (a.hours !== b.hours) {
            return a.hours - b.hours;
        }
        // 4. Smaller ID
        return a.id - b.id;
    }

    size() {
        return this.data.length;
    }

    peek() {
        return this.data.length > 0 ? this.data[0] : null;
    }

    insert(task) {
        this.data.push(task);
        this.heapifyUp(this.data.length - 1);
    }

    extractMin() {
        if (this.data.length === 0) return null;
        const root = this.data[0];
        const last = this.data.pop();
        if (this.data.length > 0) {
            this.data[0] = last;
            this.heapifyDown(0);
        }
        return root;
    }

    heapifyUp(idx) {
        while (idx > 0) {
            const parent = Math.floor((idx - 1) / 2);
            if (this.comparator(this.data[idx], this.data[parent]) < 0) {
                const temp = this.data[idx];
                this.data[idx] = this.data[parent];
                this.data[parent] = temp;
                idx = parent;
            } else {
                break;
            }
        }
    }

    heapifyDown(idx) {
        const len = this.data.length;
        while (true) {
            const left = 2 * idx + 1;
            const right = 2 * idx + 2;
            let smallest = idx;

            if (left < len && this.comparator(this.data[left], this.data[smallest]) < 0) {
                smallest = left;
            }
            if (right < len && this.comparator(this.data[right], this.data[smallest]) < 0) {
                smallest = right;
            }
            if (smallest !== idx) {
                const temp = this.data[idx];
                this.data[idx] = this.data[smallest];
                this.data[smallest] = temp;
                idx = smallest;
            } else {
                break;
            }
        }
    }
}

/* ------------------------------------------------------------------------- */
/*                       5. DATE & URGENCY SCORE UTILITIES                   */
/* ------------------------------------------------------------------------- */

function dateToDays(y, m, d) {
    if (m < 3) {
        y -= 1;
        m += 12;
    }
    return Math.floor(365 * y + y / 4 - y / 100 + y / 400 + (153 * (m - 3) + 2) / 5 + d);
}

function parseDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12 || d < 1 || d > 31) {
        return null;
    }
    return { y, m, d };
}

function getTodayString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function daysBetweenDates(fromDateStr, toDateStr) {
    const f = parseDate(fromDateStr);
    const t = parseDate(toDateStr);
    if (!f || !t) return 0;
    return dateToDays(t.y, t.m, t.d) - dateToDays(f.y, f.m, f.d);
}

/*
 * Priority Visualization Score (0 - 100):
 * Identical formula to C implementation for 100% parity.
 */
function calculateUrgencyScore(task, refDate = null) {
    const reference = refDate || getTodayString();
    if (task.completed) {
        return { score: 0, label: 'COMPLETE', color: '#39FF88', daysRemaining: 0 };
    }

    const remaining = daysBetweenDates(reference, task.deadline);
    if (remaining < 0) {
        return {
            score: 100,
            label: 'CRITICAL (OVERDUE)',
            color: '#FF365E',
            daysRemaining: remaining
        };
    }

    let deadlineFactor = 2.0;
    if (remaining === 0)      deadlineFactor = 50.0;
    else if (remaining === 1) deadlineFactor = 42.0;
    else if (remaining <= 2)  deadlineFactor = 35.0;
    else if (remaining <= 4)  deadlineFactor = 25.0;
    else if (remaining <= 7)  deadlineFactor = 15.0;
    else if (remaining <= 14) deadlineFactor = 8.0;

    const importanceFactor = (task.importance / 5.0) * 40.0; // 8 to 40

    let effortFactor = 1.0;
    if (task.hours >= 8.0)      effortFactor = 10.0;
    else if (task.hours >= 4.0) effortFactor = 6.0;
    else if (task.hours >= 2.0) effortFactor = 3.0;

    let totalScore = Math.round(deadlineFactor + importanceFactor + effortFactor);
    if (totalScore > 100) totalScore = 100;
    if (totalScore < 5)   totalScore = 5;

    let label = 'LOW';
    let color = '#39FF88'; // Neon green
    if (totalScore >= 80) {
        label = 'CRITICAL';
        color = '#FF365E'; // Neon red
    } else if (totalScore >= 60) {
        label = 'HIGH';
        color = '#FFCC45'; // Amber
    } else if (totalScore >= 35) {
        label = 'MEDIUM';
        color = '#00BFFF'; // Electric blue
    }

    return { score: totalScore, label, color, daysRemaining: remaining };
}

/* ------------------------------------------------------------------------- */
/*                  6. CORE SCHEDULING ALGORITHM (KAHN + HEAP)               */
/* ------------------------------------------------------------------------- */

function generateOptimizedPlan(tasksList, refDate = null) {
    if (!tasksList || tasksList.length === 0) {
        return { plan: [], cycleDetected: false, cycleTasks: [] };
    }

    const taskCount = tasksList.length;
    const ht = new HashTable(37);
    for (let i = 0; i < taskCount; i++) {
        ht.insert(tasksList[i].id, i);
    }

    const graph = new DirectedGraph(taskCount);
    const inDegree = new Array(taskCount).fill(0);
    let unfinishedCount = 0;

    // Build directed edges: prereq -> dependent
    for (let i = 0; i < taskCount; i++) {
        const task = tasksList[i];
        if (!task.completed) unfinishedCount++;

        const deps = task.dependencies || [];
        for (let d = 0; d < deps.length; d++) {
            const prereqId = deps[d];
            const prereqIdx = ht.search(prereqId);
            if (prereqIdx !== -1) {
                graph.addEdge(prereqIdx, i);
                // Only unfinished prerequisites contribute to active in-degree
                if (!tasksList[prereqIdx].completed) {
                    inDegree[i]++;
                }
            }
        }
    }

    if (unfinishedCount === 0) {
        return { plan: [], cycleDetected: false, cycleTasks: [] };
    }

    // Initialize Min-Heap with all unfinished tasks that have inDegree === 0
    const heap = new BinaryMinHeap();
    for (let i = 0; i < taskCount; i++) {
        if (!tasksList[i].completed && inDegree[i] === 0) {
            heap.insert(tasksList[i]);
        }
    }

    const plan = [];
    let processedCount = 0;

    while (heap.size() > 0) {
        const uTask = heap.extractMin();
        const uIdx = ht.search(uTask.id);
        processedCount++;

        // Determine derived reason
        let reason = '';
        if (plan.length === 0) {
            if (!uTask.dependencies || uTask.dependencies.length === 0) {
                reason = `Earliest deadline (${uTask.deadline}) among all ready tasks.`;
            } else {
                reason = `All prerequisites satisfied; highest priority ready task.`;
            }
        } else {
            if (uTask.dependencies && uTask.dependencies.length > 0) {
                reason = `Unlocked after dependencies satisfied; earliest ready deadline.`;
            } else {
                reason = `Ranked by deadline (${uTask.deadline}) and importance (level ${uTask.importance}).`;
            }
        }

        plan.push({
            task: uTask,
            reason: reason,
            rank: plan.length + 1
        });

        // Decrement in-degree for dependent tasks
        const neighbors = graph.getNeighbors(uIdx);
        for (let n = 0; n < neighbors.length; n++) {
            const vIdx = neighbors[n];
            if (!tasksList[vIdx].completed) {
                inDegree[vIdx]--;
                if (inDegree[vIdx] === 0) {
                    heap.insert(tasksList[vIdx]);
                }
            }
        }
    }

    const cycleDetected = processedCount < unfinishedCount;
    const cycleTasks = [];
    if (cycleDetected) {
        for (let i = 0; i < taskCount; i++) {
            if (!tasksList[i].completed && inDegree[i] > 0) {
                cycleTasks.push(tasksList[i].id);
            }
        }
    }

    return { plan, cycleDetected, cycleTasks };
}

/* ------------------------------------------------------------------------- */
/*                       7. PARSING & SERIALIZATION (ADO_V1)                 */
/* ------------------------------------------------------------------------- */

function parsePlannerFile(text) {
    if (!text || typeof text !== 'string') {
        throw new Error('File content is empty.');
    }

    const lines = text.split(/\r?\n/);
    if (lines.length === 0 || !lines[0].startsWith('ADO_V1')) {
        throw new Error('Invalid file format. Header must be ADO_V1.');
    }

    const tasks = [];
    const seenIds = new Set();

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || !line.startsWith('T|')) continue;

        const parts = line.split('|');
        if (parts.length < 7) continue;

        const id = parseInt(parts[1], 10);
        if (isNaN(id) || id <= 0 || seenIds.has(id)) {
            continue; // Invalid or duplicate ID
        }
        seenIds.add(id);

        const title = parts[2].trim();
        const deadline = parts[3].trim();
        if (!parseDate(deadline)) continue; // Invalid date

        const hours = parseFloat(parts[4]);
        const importance = parseInt(parts[5], 10);
        const completed = parseInt(parts[6], 10) === 1 ? 1 : 0;

        const deps = [];
        if (parts.length >= 8 && parts[7].trim()) {
            const depTokens = parts[7].split(',');
            for (let d = 0; d < depTokens.length; d++) {
                const depId = parseInt(depTokens[d].trim(), 10);
                if (!isNaN(depId) && depId > 0 && depId !== id && !deps.includes(depId)) {
                    deps.push(depId);
                }
            }
        }

        tasks.push({
            id,
            title,
            deadline,
            hours: isNaN(hours) || hours <= 0 ? 1.0 : hours,
            importance: isNaN(importance) || importance < 1 || importance > 5 ? 3 : importance,
            completed,
            dependencies: deps
        });
    }

    return tasks;
}

function serializePlannerFile(tasksList) {
    let out = 'ADO_V1\n';
    for (let i = 0; i < tasksList.length; i++) {
        const t = tasksList[i];
        const cleanTitle = (t.title || 'Untitled').replace(/[|\r\n]/g, ' ').trim();
        const depsStr = (t.dependencies || []).join(',');
        out += `T|${t.id}|${cleanTitle}|${t.deadline}|${Number(t.hours).toFixed(1)}|${t.importance}|${t.completed ? 1 : 0}|${depsStr}\n`;
    }
    return out;
}

// Export for browser global context or module bundlers
if (typeof window !== 'undefined') {
    window.DS = {
        HashTable,
        LinearQueue,
        DirectedGraph,
        BinaryMinHeap,
        dateToDays,
        parseDate,
        getTodayString,
        daysBetweenDates,
        calculateUrgencyScore,
        generateOptimizedPlan,
        parsePlannerFile,
        serializePlannerFile
    };
}
