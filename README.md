# DEADLINE//CTRL — Assignment Deadline Optimizer
### College Data Structures Lab Mini-Project (Second Year)

> A deadline-aware dual-interface scheduling system engineered with manually implemented Data Structures in C (C11) and an arcade-inspired interactive web application for GitHub Pages.

---

## 1. Project Overview & Problem Statement

Engineering students constantly juggle overlapping assignments, lab practicals, term projects, and viva preparations. Many of these academic tasks have strict dependencies (e.g., *Project Architecture* must precede *Coding*, which in turn must precede *Report Preparation*). 

Traditional to-do apps sort tasks purely by date or simple urgency tags. This approach fails when:
1. A task with an urgent deadline cannot be started because its prerequisite is unfinished.
2. Independent high-priority tasks sit idle while students work on blocked assignments.
3. Circular dependencies cause deadlock.

**Our Solution:**
**DEADLINE//CTRL** pairs **Kahn's Topological Sorting Algorithm** with a **Binary Min-Heap Priority Queue** to generate an executable, dependency-resolved task sequence. It deterministically balances deadlines, task importance, and required effort.

The system is delivered in two complementary forms:
- **C11 Terminal CLI**: A clean, menu-driven academic program with aligned ASCII tables and a live viva inspection tool.
- **Arcade Web Application**: A futuristic cyberpunk HUD interface deployable to **GitHub Pages** featuring an interactive SVG dependency graph, dynamic 7-day workload distribution chart, and local storage persistence.

Both interfaces share identical scheduling logic and exchange records via a unified text file format (`planner.txt`).

---

## 2. System Architecture & Project Structure

```
assignment-deadline-optimizer/
|
|-- cli/
|   |-- main.c               # Menu-driven C application (C11, standard libraries only)
|   |-- test_engine.c        # Automated algorithm test suite (Tests A-F)
|   |-- deadline.exe         # Compiled CLI binary
|   |-- test_engine.exe      # Compiled test suite binary
|
|-- docs/                    # GitHub Pages Web Application
|   |-- index.html           # Single-page arcade HUD command center
|   |-- style.css            # Cyberpunk arcade visual styling & neon variables
|   |-- ds.js                # Handwritten JavaScript Data Structures & scheduling engine
|   |-- app.js               # UI controller, SVG graph renderer, workload chart, storage
|
|-- samples/
|   |-- planner.txt          # Canonical sample student dataset (ADO_V1 format)
|   |-- test_cycle.txt       # Sample circular deadlock dataset (Tests cycle detection)
|
|-- planner.txt              # Root link for CLI execution
|-- README.md                # Comprehensive documentation & Viva guide
```

---

## 3. Manually Implemented Data Structures

Both the C application and the web engine avoid black-box libraries or built-in array sorts for scheduling. All structures are implemented by hand:

| Data Structure | Implementation Details | Academic Purpose |
|---|---|---|
| **Binary Min-Heap** | Array-based heap with `heapifyUp` and `heapifyDown` | Selects the highest-priority eligible assignment in $O(\log V)$ time |
| **Directed Graph** | Adjacency list using dynamically allocated `Node` pointers | Encodes prerequisites and unlocks dependent tasks ($u \to v$) |
| **FIFO Queue** | Linear array with front (`f`) and rear (`r`) indices | Drives BFS reachability and cycle prevention |
| **Hash Table** | 37 buckets with separate chaining (`HashEntry*`) | Provides $O(1)$ average assignment lookup by Task ID |

### Why These Data Structures Over Simple Arrays?
1. **Min-Heap vs. Repeated Array Scan:** An unsorted array requires scanning all $N$ elements ($O(N)$) each time the next task is picked, yielding $O(N^2)$ overall. A Binary Min-Heap extracts the root in $O(1)$ and restores the heap property in $O(\log N)$ time, achieving $O(N \log N)$.
2. **Adjacency List vs. Adjacency Matrix:** Assignments typically have 1–3 prerequisites. An adjacency matrix consumes $O(V^2)$ memory and requires checking all $V$ potential targets. An adjacency list uses $O(V + E)$ space and traverses only actual dependent tasks.
3. **Hash Table vs. Linear Search:** Looking up prerequisites by arbitrary integer IDs (e.g., ID 108) in an array requires $O(N)$ linear scans. With a bucket-chained Hash Table, ID resolution is $O(1)$ on average.

---

## 4. Scheduling Heuristic & Comparator

When Kahn's algorithm identifies tasks whose prerequisites are complete ($\text{inDegree} = 0$), they are inserted into the **Binary Min-Heap**. The heap uses a 4-key deterministic comparator:

1. **Earliest Deadline First:** Lexicographical ISO date comparison (`YYYY-MM-DD`).
2. **Higher Importance Level:** (Scale 1–5, 5 being critical practicals/exams).
3. **Shorter Duration:** Minimizes wait times for downstream dependents.
4. **Smaller Task ID:** Final tie-breaker for deterministic output.

### Urgency Visualization Score (0–100%)
To provide intuitive visual feedback on the neon dashboard without distorting the heap comparator, a separate deterministic Urgency Index is calculated:

$$\text{Score} = \min\left(100, \max\left(5, \text{round}(\text{DeadlineFactor} + \text{ImportanceFactor} + \text{EffortFactor})\right)\right)$$

- **Overdue tasks:** Automatically assigned **100% (CRITICAL)**.
- **Deadline proximity:** Due today = 50 pts, Tomorrow = 42 pts, $\le 2$ days = 35 pts, $\le 4$ days = 25 pts, $\le 7$ days = 15 pts.
- **Importance Factor:** $(\text{Importance} / 5.0) \times 40$ pts (ranges 8–40).
- **Effort Factor:** $\ge 8$ hrs = 10 pts, $\ge 4$ hrs = 6 pts, $\ge 2$ hrs = 3 pts, $< 2$ hrs = 1 pt.

**Color Thresholds:**
- $\ge 80\%$: **CRITICAL** (Neon Red `#FF365E`)
- $\ge 60\%$: **HIGH** (Amber `#FFCC45`)
- $\ge 35\%$: **MEDIUM** (Electric Blue `#00BFFF`)
- $< 35\%$: **LOW** (Neon Green `#39FF88`)

---

## 5. Time & Space Complexity Analysis

| Operation | Time Complexity | Space Complexity |
|---|---|---|
| **Graph Construction** | $O(V + E)$ | $O(V + E)$ |
| **Hash Table Lookup** | $O(1)$ average, $O(V)$ worst | $O(V)$ |
| **Heapify Up / Down** | $O(\log V)$ | $O(1)$ auxiliary |
| **Kahn's Topological Sort with Heap** | $O((V + E) \log V)$ | $O(V)$ |
| **Cycle Reachability BFS** | $O(V + E)$ | $O(V)$ |

Where $V$ is the number of assignments (vertices) and $E$ is the number of prerequisite dependency relations (edges).

---

## 6. Viva Demonstration & Dry Runs

The application includes a built-in **Data Structure Operations Inspector** (CLI Menu Option 8 and Web HUD Button).

### A. Heap Insertion & Extraction Dry Run
Suppose tasks $T_1$ (Due: Oct 28) and $T_2$ (Due: Oct 27) are eligible:
1. `insertHeap(T1)`: Array `[T1]`, size = 1.
2. `insertHeap(T2)`: Added at index 1 (`[T1, T2]`). `heapifyUp` compares $T_2$ with $T_1$. Since Oct 27 < Oct 28, $T_2$ swaps with $T_1$. Array becomes `[T2, T1]`.
3. `deleteHeap()`: Root $T_2$ is extracted. Last element $T_1$ replaces root. Size decreases to 1. `heapifyDown` verifies heap property. Next task is correctly $T_2$.

### B. Graph Adjacency List & Indegree Dry Run
Given: Task 106 depends on Task 102; Task 102 depends on Task 104.
- In Graph: `adj[104] -> [102]`, `adj[102] -> [106]`.
- Initial active indegrees: `inDegree[104] = 0`, `inDegree[102] = 1`, `inDegree[106] = 1`.
- Task 104 is processed first. Its edge reduces `inDegree[102]` to 0. Task 102 enters the heap.
- Once Task 102 is extracted, its edge reduces `inDegree[106]` to 0. Task 106 enters the heap.

### C. Cycle Detection Mechanism
Suppose $A \to B \to C \to A$:
- Every task in the cycle has $\text{inDegree} \ge 1$.
- No task enters the Min-Heap initially ($\text{size} = 0$).
- Total processed tasks ($0$) < unfinished tasks ($3$).
- The algorithm terminates and reports: `Cycle detected among tasks: #A, #B, #C`.

---

## 7. Data Persistence & File Format

The shared text format uses the versioned `ADO_V1` specification:

```text
ADO_V1
T|101|DS Lab Experiment 5|2026-10-28|3.0|5|0|
T|102|OOPJ Mini-Project Coding|2026-10-31|6.0|4|0|104
T|103|COA Assignment Sheet|2026-11-04|2.5|3|0|
T|104|OOPJ Project Architecture|2026-10-29|2.0|4|1|
T|105|Operating Systems Viva Prep|2026-10-30|4.0|5|0|
T|106|OOPJ Project Report & PPT|2026-11-02|3.5|4|0|102
T|107|Mathematics Assignment 3|2026-11-06|2.0|2|0|
T|108|Computer Networks Practical|2026-10-27|2.0|4|0|
```

**Field Order:**
`T | ID | Title | Deadline | Hours | Importance | Completed | Dependencies`
- `Dependencies` are comma-separated parent IDs.
- Both C and JavaScript validate dates, positive hours, importance range (1–5), and reject circular dependencies.

---

## 8. Compilation & Execution Instructions

### A. Terminal C Application (Windows VS Code / GCC)

1. Open PowerShell or Command Prompt in the project folder:
   ```powershell
   cd d:\Deadline
   ```

2. Compile the application with strict C11 compliance:
   ```powershell
   gcc -std=c11 -Wall -Wextra cli/main.c -o cli/deadline.exe
   ```

3. Run the interactive terminal program:
   ```powershell
   .\cli\deadline.exe
   ```

4. Run the automated algorithmic test suite:
   ```powershell
   gcc -std=c11 -Wall -Wextra cli/test_engine.c -o cli/test_engine.exe
   .\cli\test_engine.exe
   ```

### B. Running the Web Application Locally

The website uses pure vanilla web standards (HTML5, CSS3, ES6 JavaScript) without build steps, Node packages, or external frameworks.

- **Option 1 (Direct):** Double-click `docs/index.html` to open it in Google Chrome, Microsoft Edge, or Firefox.
- **Option 2 (Local Server):** If using VS Code, right-click `docs/index.html` and choose **"Open with Live Server"**.

### C. Deploying to GitHub Pages

1. Push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: complete Assignment Deadline Optimizer mini-project"
   git remote add origin https://github.com/<your-username>/assignment-deadline-optimizer.git
   git push -u origin main
   ```
2. In your repository on GitHub, navigate to **Settings** &rarr; **Pages**.
3. Under **Build and deployment** &rarr; **Branch**, select `main` and set the folder to `/docs`.
4. Click **Save**. Your site will be live within seconds at:
   `https://<your-username>.github.io/assignment-deadline-optimizer/`

---

## 9. Verification & Test Suite Summary

| Test Case | Scenario | Expected Behavior | CLI Result | Web Result |
|---|---|---|---|---|
| **Test A** | 3 independent assignments | Correct ordering by deadline & importance | PASSED | PASSED |
| **Test B** | Chain: $A \to B \to C$ | $A$ scheduled before $B$; $B$ before $C$ | PASSED | PASSED |
| **Test C** | Prerequisites: $A \to C$, $B \to C$ | $C$ cannot be scheduled until both $A$ and $B$ clear | PASSED | PASSED |
| **Test D** | Cycle: $A \to B \to C \to A$ | Cycle detected; locks reported; deadlock prevented | PASSED | PASSED |
| **Test E** | Dynamic completion | Completing $A$ unlocks dependent task $B$ | PASSED | PASSED |
| **Test F** | Tie-breakers | Compares importance, then hours, then task ID | PASSED | PASSED |
| **Test G** | Data portability | Import/Export between C and Web matches 100% | PASSED | PASSED |
| **Test H** | Persistence | State persists across browser refresh and CLI restart | PASSED | PASSED |

---

## 10. Academic Attribution
- **Course:** Data Structures & Algorithms Lab (Year 2)
- **Topic:** Graph Algorithms, Priority Queues, Hash Tables & Scheduling Heuristics
- **Developed by:** College Engineering Pair Programming Team
