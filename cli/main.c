/*
 * ============================================================================
 * ASSIGNMENT DEADLINE OPTIMIZER (DEADLINE//CTRL)
 * College Data Structures Lab Mini-Project (C11)
 *
 * Implemented Data Structures:
 * 1. Binary Min-Heap (Priority Queue for deadline-aware task scheduling)
 * 2. Directed Graph using Adjacency List (Task prerequisites and dependencies)
 * 3. FIFO Queue (Kahn's topological sorting algorithm)
 * 4. Hash Table with Chaining (O(1) assignment lookup by Task ID)
 * ============================================================================
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <ctype.h>
#include <time.h>

#define MAX_TASKS 100
#define MAX_DEPS 20
#define HASH_SIZE 37
#define DEFAULT_FILE "samples/planner.txt"

/* ------------------------------------------------------------------------- */
/*                           DATA STRUCTURE DEFINITIONS                      */
/* ------------------------------------------------------------------------- */

/* Assignment Structure */
typedef struct {
    int id;
    char title[80];
    char deadline[16];   /* Format: YYYY-MM-DD */
    float hours;
    int importance;      /* 1 (Lowest) to 5 (Critical) */
    int completed;       /* 0: Pending, 1: Complete */
    int depCount;
    int dependencies[MAX_DEPS]; /* IDs of prerequisites needed before this task */
} Task;

/* Graph Adjacency List Node */
typedef struct Node {
    int taskIndex;       /* Index in the global tasks array */
    struct Node* next;
} Node;

/* Directed Graph Structure */
typedef struct {
    int numVertices;
    Node* adj[MAX_TASKS]; /* adj[u] points to list of tasks that depend on u (u -> v) */
} Graph;

/* Binary Min-Heap Structure */
typedef struct {
    int data[MAX_TASKS]; /* Stores indices of tasks[] */
    int size;
} Heap;

/* Linear FIFO Queue Structure */
typedef struct {
    int items[MAX_TASKS];
    int f;
    int r;
} Queue;

/* Hash Table Entry for ID lookup */
typedef struct HashEntry {
    int taskId;
    int taskIndex;
    struct HashEntry* next;
} HashEntry;

/* Hash Table Structure */
typedef struct {
    HashEntry* buckets[HASH_SIZE];
} HashTable;

/* Global Storage */
Task tasks[MAX_TASKS];
int taskCount = 0;
HashTable idTable;

/* ------------------------------------------------------------------------- */
/*                          HASH TABLE OPERATIONS                            */
/* ------------------------------------------------------------------------- */

int hashFunction(int id) {
    if (id < 0) id = -id;
    return id % HASH_SIZE;
}

void initHash(HashTable* ht) {
    for (int i = 0; i < HASH_SIZE; i++) {
        ht->buckets[i] = NULL;
    }
}

void hashInsert(HashTable* ht, int taskId, int taskIndex) {
    int b = hashFunction(taskId);
    HashEntry* entry = ht->buckets[b];
    while (entry != NULL) {
        if (entry->taskId == taskId) {
            entry->taskIndex = taskIndex;
            return;
        }
        entry = entry->next;
    }
    HashEntry* newEntry = (HashEntry*)malloc(sizeof(HashEntry));
    if (!newEntry) return;
    newEntry->taskId = taskId;
    newEntry->taskIndex = taskIndex;
    newEntry->next = ht->buckets[b];
    ht->buckets[b] = newEntry;
}

int hashSearch(const HashTable* ht, int taskId) {
    int b = hashFunction(taskId);
    HashEntry* entry = ht->buckets[b];
    while (entry != NULL) {
        if (entry->taskId == taskId) {
            return entry->taskIndex;
        }
        entry = entry->next;
    }
    return -1; /* Not found */
}

void hashDelete(HashTable* ht, int taskId) {
    int b = hashFunction(taskId);
    HashEntry* curr = ht->buckets[b];
    HashEntry* prev = NULL;
    while (curr != NULL) {
        if (curr->taskId == taskId) {
            if (prev == NULL) {
                ht->buckets[b] = curr->next;
            } else {
                prev->next = curr->next;
            }
            free(curr);
            return;
        }
        prev = curr;
        curr = curr->next;
    }
}

void rebuildHashTable(void) {
    initHash(&idTable);
    for (int i = 0; i < taskCount; i++) {
        hashInsert(&idTable, tasks[i].id, i);
    }
}

/* ------------------------------------------------------------------------- */
/*                          QUEUE OPERATIONS (FIFO)                          */
/* ------------------------------------------------------------------------- */

void initQueue(Queue* q) {
    q->f = -1;
    q->r = -1;
}

int isQueueEmpty(const Queue* q) {
    return (q->f == -1 || q->f > q->r);
}

void enqueue(Queue* q, int val) {
    if (q->r == MAX_TASKS - 1) {
        return; /* Full */
    }
    if (q->f == -1) q->f = 0;
    q->r++;
    q->items[q->r] = val;
}

int dequeue(Queue* q) {
    if (isQueueEmpty(q)) return -1;
    int val = q->items[q->f];
    q->f++;
    if (q->f > q->r) {
        q->f = -1;
        q->r = -1;
    }
    return val;
}

/* ------------------------------------------------------------------------- */
/*                          GRAPH OPERATIONS (ADJ LIST)                      */
/* ------------------------------------------------------------------------- */

void initGraph(Graph* g, int n) {
    g->numVertices = n;
    for (int i = 0; i < n; i++) {
        g->adj[i] = NULL;
    }
}

void addGraphEdge(Graph* g, int u, int v) {
    /* Edge u -> v means Task u must precede Task v */
    Node* newNode = (Node*)malloc(sizeof(Node));
    if (!newNode) return;
    newNode->taskIndex = v;
    newNode->next = g->adj[u];
    g->adj[u] = newNode;
}

void freeGraph(Graph* g) {
    for (int i = 0; i < g->numVertices; i++) {
        Node* curr = g->adj[i];
        while (curr != NULL) {
            Node* temp = curr;
            curr = curr->next;
            free(temp);
        }
        g->adj[i] = NULL;
    }
}

/* Check if vertex target is reachable from vertex start (used for cycle prevention) */
bool isReachable(const Graph* g, int start, int target) {
    if (start == target) return true;
    bool visited[MAX_TASKS] = {false};
    Queue q;
    initQueue(&q);
    visited[start] = true;
    enqueue(&q, start);

    while (!isQueueEmpty(&q)) {
        int u = dequeue(&q);
        if (u == target) return true;
        Node* curr = g->adj[u];
        while (curr != NULL) {
            int v = curr->taskIndex;
            if (v == target) return true;
            if (!visited[v]) {
                visited[v] = true;
                enqueue(&q, v);
            }
            curr = curr->next;
        }
    }
    return false;
}

/* ------------------------------------------------------------------------- */
/*                          BINARY MIN-HEAP (PRIORITY QUEUE)                 */
/* ------------------------------------------------------------------------- */

/*
 * Comparator Rule:
 * 1. Earliest deadline first.
 * 2. Higher importance if deadlines are equal.
 * 3. Shorter estimated duration if both preceding values are equal.
 * 4. Smaller task ID as the final tie-breaker.
 *
 * Returns:
 * < 0 if taskA has strictly higher priority than taskB
 * > 0 if taskB has strictly higher priority than taskA
 *   0 if identical (impossible due to unique task IDs)
 */
int compareTasks(int idxA, int idxB) {
    const Task* a = &tasks[idxA];
    const Task* b = &tasks[idxB];

    /* 1. Deadline comparison (YYYY-MM-DD strings are ISO 8601 lexicographically ordered) */
    int dCmp = strcmp(a->deadline, b->deadline);
    if (dCmp != 0) return dCmp;

    /* 2. Importance comparison (Higher is prioritized) */
    if (a->importance != b->importance) {
        return (b->importance - a->importance);
    }

    /* 3. Estimated hours (Shorter is prioritized) */
    if (a->hours < b->hours) return -1;
    if (a->hours > b->hours) return 1;

    /* 4. Task ID tie-breaker (Smaller ID first) */
    return (a->id - b->id);
}

void initHeap(Heap* h) {
    h->size = 0;
}

void heapifyUp(Heap* h, int idx) {
    while (idx > 0) {
        int parent = (idx - 1) / 2;
        if (compareTasks(h->data[idx], h->data[parent]) < 0) {
            int temp = h->data[idx];
            h->data[idx] = h->data[parent];
            h->data[parent] = temp;
            idx = parent;
        } else {
            break;
        }
    }
}

void heapifyDown(Heap* h, int idx) {
    while (1) {
        int left = 2 * idx + 1;
        int right = 2 * idx + 2;
        int smallest = idx;

        if (left < h->size && compareTasks(h->data[left], h->data[smallest]) < 0) {
            smallest = left;
        }
        if (right < h->size && compareTasks(h->data[right], h->data[smallest]) < 0) {
            smallest = right;
        }
        if (smallest != idx) {
            int temp = h->data[idx];
            h->data[idx] = h->data[smallest];
            h->data[smallest] = temp;
            idx = smallest;
        } else {
            break;
        }
    }
}

void insertHeap(Heap* h, int taskIdx) {
    if (h->size >= MAX_TASKS) return;
    h->data[h->size] = taskIdx;
    h->size++;
    heapifyUp(h, h->size - 1);
}

int deleteHeap(Heap* h) {
    if (h->size <= 0) return -1;
    int root = h->data[0];
    h->data[0] = h->data[h->size - 1];
    h->size--;
    if (h->size > 0) {
        heapifyDown(h, 0);
    }
    return root;
}

int peekHeap(const Heap* h) {
    if (h->size <= 0) return -1;
    return h->data[0];
}

/* ------------------------------------------------------------------------- */
/*                          DATE & URGENCY SCORE UTILITIES                   */
/* ------------------------------------------------------------------------- */

/* Civil date to Julian day number / Rata Die for timezone-free calendar math */
int dateToDays(int y, int m, int d) {
    if (m < 3) {
        y -= 1;
        m += 12;
    }
    return 365 * y + y / 4 - y / 100 + y / 400 + (153 * (m - 3) + 2) / 5 + d;
}

bool parseDate(const char* dateStr, int* y, int* m, int* d) {
    if (strlen(dateStr) != 10 || dateStr[4] != '-' || dateStr[7] != '-') {
        return false;
    }
    if (sscanf(dateStr, "%d-%d-%d", y, m, d) != 3) {
        return false;
    }
    if (*m < 1 || *m > 12 || *d < 1 || *d > 31) return false;
    return true;
}

void getCurrentDate(char* outDate) {
    time_t now = time(NULL);
    struct tm* t = localtime(&now);
    if (t) {
        sprintf(outDate, "%04d-%02d-%02d", t->tm_year + 1900, t->tm_mon + 1, t->tm_mday);
    } else {
        strcpy(outDate, "2026-10-26");
    }
}

int daysBetweenDates(const char* fromDate, const char* toDate) {
    int y1, m1, d1, y2, m2, d2;
    if (!parseDate(fromDate, &y1, &m1, &d1) || !parseDate(toDate, &y2, &m2, &d2)) {
        return 0;
    }
    return dateToDays(y2, m2, d2) - dateToDays(y1, m1, d1);
}

/*
 * Priority Visualization Score (0 - 100):
 * Deterministic formula based on deadline proximity, importance, and effort.
 */
int calculateUrgencyScore(const Task* t, const char* refDate, char* labelOut) {
    if (t->completed) {
        if (labelOut) strcpy(labelOut, "COMPLETE");
        return 0;
    }

    int remaining = daysBetweenDates(refDate, t->deadline);
    if (remaining < 0) {
        if (labelOut) strcpy(labelOut, "CRITICAL (OVERDUE)");
        return 100;
    }

    float deadlineFactor = 0.0f;
    if (remaining == 0)      deadlineFactor = 50.0f;
    else if (remaining == 1) deadlineFactor = 42.0f;
    else if (remaining <= 2) deadlineFactor = 35.0f;
    else if (remaining <= 4) deadlineFactor = 25.0f;
    else if (remaining <= 7) deadlineFactor = 15.0f;
    else if (remaining <= 14) deadlineFactor = 8.0f;
    else                     deadlineFactor = 2.0f;

    float importanceFactor = (t->importance / 5.0f) * 40.0f; /* 8 to 40 */

    float effortFactor = 1.0f;
    if (t->hours >= 8.0f) effortFactor = 10.0f;
    else if (t->hours >= 4.0f) effortFactor = 6.0f;
    else if (t->hours >= 2.0f) effortFactor = 3.0f;

    int totalScore = (int)(deadlineFactor + importanceFactor + effortFactor + 0.5f);
    if (totalScore > 100) totalScore = 100;
    if (totalScore < 5)   totalScore = 5;

    if (labelOut) {
        if (totalScore >= 80) strcpy(labelOut, "CRITICAL");
        else if (totalScore >= 60) strcpy(labelOut, "HIGH");
        else if (totalScore >= 35) strcpy(labelOut, "MEDIUM");
        else strcpy(labelOut, "LOW");
    }

    return totalScore;
}

/* ------------------------------------------------------------------------- */
/*                     CORE SCHEDULING ALGORITHM (KAHN + HEAP)               */
/* ------------------------------------------------------------------------- */

typedef struct {
    int taskIndex;
    char reason[120];
} PlanItem;

/*
 * Builds the dependency graph, computes indegrees for unfinished tasks,
 * and uses a Binary Min-Heap to extract the optimal next task iteratively.
 */
int generateOptimizedPlan(PlanItem* plan, int* planCount, int* cycleTasks, int* cycleCount) {
    *planCount = 0;
    *cycleCount = 0;

    if (taskCount == 0) return 0;

    Graph g;
    initGraph(&g, taskCount);

    int inDegree[MAX_TASKS] = {0};
    int unfinishedCount = 0;

    /* Build dependency edges: If task v depends on task u, edge is u -> v */
    for (int i = 0; i < taskCount; i++) {
        if (!tasks[i].completed) {
            unfinishedCount++;
        }
        for (int d = 0; d < tasks[i].depCount; d++) {
            int prereqId = tasks[i].dependencies[d];
            int prereqIdx = hashSearch(&idTable, prereqId);
            if (prereqIdx != -1) {
                addGraphEdge(&g, prereqIdx, i);
                /* Only unfinished prerequisites contribute to active in-degree */
                if (!tasks[prereqIdx].completed) {
                    inDegree[i]++;
                }
            }
        }
    }

    if (unfinishedCount == 0) {
        freeGraph(&g);
        return 0; /* All assignments already completed */
    }

    /* Initialize Min-Heap with all unfinished tasks that have indegree == 0 */
    Heap h;
    initHeap(&h);

    for (int i = 0; i < taskCount; i++) {
        if (!tasks[i].completed && inDegree[i] == 0) {
            insertHeap(&h, i);
        }
    }

    int processedUnfinished = 0;

    while (h.size > 0) {
        int u = deleteHeap(&h);
        processedUnfinished++;

        /* Determine explainable reason */
        PlanItem item;
        item.taskIndex = u;

        if (*planCount == 0) {
            if (tasks[u].depCount == 0) {
                sprintf(item.reason, "Earliest deadline (%s) among all ready tasks.", tasks[u].deadline);
            } else {
                sprintf(item.reason, "All prerequisites satisfied; highest priority ready task.");
            }
        } else {
            if (tasks[u].depCount > 0) {
                sprintf(item.reason, "Unlocked after dependencies satisfied; earliest ready deadline.");
            } else {
                sprintf(item.reason, "Ranked by deadline (%s) and importance (level %d).", tasks[u].deadline, tasks[u].importance);
            }
        }

        plan[(*planCount)++] = item;

        /* Reduce in-degrees for dependent tasks */
        Node* curr = g.adj[u];
        while (curr != NULL) {
            int v = curr->taskIndex;
            if (!tasks[v].completed) {
                inDegree[v]--;
                if (inDegree[v] == 0) {
                    insertHeap(&h, v);
                }
            }
            curr = curr->next;
        }
    }

    /* Cycle Detection: Check if any unfinished task remains unprocessed */
    if (processedUnfinished < unfinishedCount) {
        for (int i = 0; i < taskCount; i++) {
            if (!tasks[i].completed && inDegree[i] > 0) {
                cycleTasks[(*cycleCount)++] = tasks[i].id;
            }
        }
    }

    freeGraph(&g);
    return (*cycleCount > 0) ? -1 : 0;
}

/* ------------------------------------------------------------------------- */
/*                           FILE PERSISTENCE & PARSING                      */
/* ------------------------------------------------------------------------- */

void sanitizeString(char* str) {
    for (int i = 0; str[i] != '\0'; i++) {
        if (str[i] == '|' || str[i] == '\r' || str[i] == '\n') {
            str[i] = ' ';
        }
    }
    /* Trim trailing spaces */
    int len = (int)strlen(str);
    while (len > 0 && isspace((unsigned char)str[len - 1])) {
        str[len - 1] = '\0';
        len--;
    }
}

int saveToFile(const char* filename) {
    FILE* fp = fopen(filename, "w");
    if (!fp) {
        return -1;
    }

    fprintf(fp, "ADO_V1\n");
    for (int i = 0; i < taskCount; i++) {
        const Task* t = &tasks[i];
        fprintf(fp, "T|%d|%s|%s|%.1f|%d|%d|",
                t->id, t->title, t->deadline, t->hours, t->importance, t->completed);
        for (int d = 0; d < t->depCount; d++) {
            fprintf(fp, "%d%s", t->dependencies[d], (d + 1 < t->depCount) ? "," : "");
        }
        fprintf(fp, "\n");
    }

    fclose(fp);
    return 0;
}

int loadFromFile(const char* filename) {
    FILE* fp = fopen(filename, "r");
    if (!fp) {
        return -1;
    }

    char line[512];
    if (!fgets(line, sizeof(line), fp)) {
        fclose(fp);
        return -2; /* Empty file */
    }

    /* Check Header */
    if (strncmp(line, "ADO_V1", 6) != 0) {
        fclose(fp);
        return -3; /* Invalid header */
    }

    Task tempTasks[MAX_TASKS];
    int tempCount = 0;

    while (fgets(line, sizeof(line), fp)) {
        if (line[0] != 'T' || line[1] != '|') continue;
        if (tempCount >= MAX_TASKS) break;

        Task t;
        memset(&t, 0, sizeof(Task));

        /* Format: T|ID|Title|Deadline|Hours|Importance|Completed|Dependencies */
        char* token = strtok(line, "|\r\n"); /* skips 'T' */
        token = strtok(NULL, "|\r\n");       /* ID */
        if (!token) continue;
        t.id = atoi(token);

        token = strtok(NULL, "|\r\n");       /* Title */
        if (!token) continue;
        strncpy(t.title, token, sizeof(t.title) - 1);

        token = strtok(NULL, "|\r\n");       /* Deadline */
        if (!token) continue;
        strncpy(t.deadline, token, sizeof(t.deadline) - 1);

        token = strtok(NULL, "|\r\n");       /* Hours */
        if (!token) continue;
        t.hours = (float)atof(token);

        token = strtok(NULL, "|\r\n");       /* Importance */
        if (!token) continue;
        t.importance = atoi(token);

        token = strtok(NULL, "|\r\n");       /* Completed */
        if (!token) continue;
        t.completed = atoi(token);

        /* Optional Dependencies token */
        token = strtok(NULL, "|\r\n");
        t.depCount = 0;
        if (token && strlen(token) > 0) {
            char depBuf[128];
            strncpy(depBuf, token, sizeof(depBuf) - 1);
            char* depToken = strtok(depBuf, ",");
            while (depToken != NULL && t.depCount < MAX_DEPS) {
                int depId = atoi(depToken);
                if (depId > 0 && depId != t.id) {
                    t.dependencies[t.depCount++] = depId;
                }
                depToken = strtok(NULL, ",");
            }
        }

        tempTasks[tempCount++] = t;
    }

    fclose(fp);

    /* Replace current tasks */
    taskCount = tempCount;
    for (int i = 0; i < taskCount; i++) {
        tasks[i] = tempTasks[i];
    }
    rebuildHashTable();
    return taskCount;
}

/* ------------------------------------------------------------------------- */
/*                           SAFE INPUT UTILITIES                            */
/* ------------------------------------------------------------------------- */

void readLine(char* buffer, int maxLen) {
    if (fgets(buffer, maxLen, stdin) != NULL) {
        size_t len = strlen(buffer);
        if (len > 0 && (buffer[len - 1] == '\n' || buffer[len - 1] == '\r')) {
            buffer[len - 1] = '\0';
        }
    } else {
        buffer[0] = '\0';
    }
}

void clearInputBuffer(void) {
    int c;
    while ((c = getchar()) != '\n' && c != EOF) {}
}

void pressEnterToContinue(void) {
    printf("\nPress [Enter] to continue...");
    int c;
    while ((c = getchar()) != '\n' && c != EOF) {}
}

int getNextTaskId(void) {
    int maxId = 100;
    for (int i = 0; i < taskCount; i++) {
        if (tasks[i].id > maxId) maxId = tasks[i].id;
    }
    return maxId + 1;
}

/* ------------------------------------------------------------------------- */
/*                         MENU ACTIONS & DISPLAY                            */
/* ------------------------------------------------------------------------- */

void displayAssignmentsTable(void) {
    if (taskCount == 0) {
        printf("\n  [No assignments recorded. Use Option 1 to add an assignment.]\n");
        return;
    }

    char refDate[16];
    getCurrentDate(refDate);

    printf("\n+-----+--------------------------------+------------+-------+-----+-----------+-------------------+----------------+\n");
    printf("| ID  | Assignment Title               | Deadline   | Hours | Imp | Urgency   | Priority Score    | Status         |\n");
    printf("+-----+--------------------------------+------------+-------+-----+-----------+-------------------+----------------+\n");

    for (int i = 0; i < taskCount; i++) {
        char urgencyLabel[24];
        int score = calculateUrgencyScore(&tasks[i], refDate, urgencyLabel);

        char displayTitle[33];
        strncpy(displayTitle, tasks[i].title, 32);
        displayTitle[32] = '\0';

        char scoreBar[11];
        int filled = score / 10;
        for (int b = 0; b < 10; b++) {
            scoreBar[b] = (b < filled) ? '#' : '-';
        }
        scoreBar[10] = '\0';

        printf("| %-3d | %-30s | %-10s | %5.1f |  %d  | %-9s | [%s] %3d%% | %-14s |\n",
               tasks[i].id,
               displayTitle,
               tasks[i].deadline,
               tasks[i].hours,
               tasks[i].importance,
               urgencyLabel,
               scoreBar,
               score,
               tasks[i].completed ? "[COMPLETE]" : "[PENDING]");
    }
    printf("+-----+--------------------------------+------------+-------+-----+-----------+-------------------+----------------+\n");

    /* Print dependency relationships */
    printf("\nDependency Prerequisites:\n");
    bool hasDeps = false;
    for (int i = 0; i < taskCount; i++) {
        if (tasks[i].depCount > 0) {
            hasDeps = true;
            printf("  Task #%d (%s) depends on: ", tasks[i].id, tasks[i].title);
            for (int d = 0; d < tasks[i].depCount; d++) {
                int pId = tasks[i].dependencies[d];
                int pIdx = hashSearch(&idTable, pId);
                const char* pStatus = (pIdx != -1 && tasks[pIdx].completed) ? "DONE" : "PENDING";
                printf("#%d [%s]%s", pId, pStatus, (d + 1 < tasks[i].depCount) ? ", " : "");
            }
            printf("\n");
        }
    }
    if (!hasDeps) {
        printf("  None. All tasks are currently independent.\n");
    }
}

void addAssignmentAction(void) {
    if (taskCount >= MAX_TASKS) {
        printf("\nError: Task capacity reached (maximum %d tasks).\n", MAX_TASKS);
        pressEnterToContinue();
        return;
    }

    printf("\n--------------------------------------------------\n");
    printf("               ADD NEW ASSIGNMENT                 \n");
    printf("--------------------------------------------------\n\n");

    Task t;
    memset(&t, 0, sizeof(Task));
    t.id = getNextTaskId();

    /* 1. Assignment Title */
    while (1) {
        printf("Assignment Title     : ");
        readLine(t.title, sizeof(t.title));
        sanitizeString(t.title);
        if (strlen(t.title) > 0) break;
        printf("  [Error: Title cannot be empty. Please re-enter.]\n");
    }

    /* 2. Deadline */
    while (1) {
        printf("Deadline (YYYY-MM-DD): ");
        readLine(t.deadline, sizeof(t.deadline));
        int y, m, d;
        if (parseDate(t.deadline, &y, &m, &d)) break;
        printf("  [Error: Invalid date format. Use YYYY-MM-DD, e.g., 2026-10-30.]\n");
    }

    /* 3. Estimated Hours */
    while (1) {
        char buf[32];
        printf("Estimated Hours      : ");
        readLine(buf, sizeof(buf));
        float h = (float)atof(buf);
        if (h > 0.0f && h <= 100.0f) {
            t.hours = h;
            break;
        }
        printf("  [Error: Hours must be a positive number between 0.1 and 100.0.]\n");
    }

    /* 4. Importance (1-5) */
    while (1) {
        char buf[32];
        printf("Importance (1-5)     : ");
        readLine(buf, sizeof(buf));
        int imp = atoi(buf);
        if (imp >= 1 && imp <= 5) {
            t.importance = imp;
            break;
        }
        printf("  [Error: Importance must be an integer from 1 (lowest) to 5 (critical).]\n");
    }

    /* 5. Prerequisites */
    if (taskCount > 0) {
        printf("\nAvailable Task IDs for Prerequisites: ");
        for (int i = 0; i < taskCount; i++) {
            printf("#%d ", tasks[i].id);
        }
        printf("\nPrerequisites (comma-separated IDs, or press Enter for none): ");
        char depLine[128];
        readLine(depLine, sizeof(depLine));
        if (strlen(depLine) > 0) {
            char* token = strtok(depLine, ", ");
            while (token != NULL && t.depCount < MAX_DEPS) {
                int depId = atoi(token);
                if (depId == t.id) {
                    printf("  [Warning: Cannot depend on self (ID %d). Skipped.]\n", depId);
                } else if (hashSearch(&idTable, depId) == -1) {
                    printf("  [Warning: Task ID %d not found. Skipped.]\n", depId);
                } else {
                    /* Check for duplicate */
                    bool dup = false;
                    for (int d = 0; d < t.depCount; d++) {
                        if (t.dependencies[d] == depId) { dup = true; break; }
                    }
                    if (!dup) {
                        t.dependencies[t.depCount++] = depId;
                    }
                }
                token = strtok(NULL, ", ");
            }
        }
    }

    t.completed = 0;
    tasks[taskCount] = t;
    hashInsert(&idTable, t.id, taskCount);
    taskCount++;

    printf("\n>>> Assignment Added Successfully!");
    printf("\n>>> Generated Task ID: %d\n", t.id);
    pressEnterToContinue();
}

void editAssignmentAction(void) {
    if (taskCount == 0) {
        printf("\n[No assignments available to edit.]\n");
        pressEnterToContinue();
        return;
    }

    displayAssignmentsTable();
    printf("\nEnter Task ID to edit: ");
    char buf[32];
    readLine(buf, sizeof(buf));
    int id = atoi(buf);

    int idx = hashSearch(&idTable, id);
    if (idx == -1) {
        printf("\n[Error: Task ID %d not found.]\n", id);
        pressEnterToContinue();
        return;
    }

    Task* t = &tasks[idx];
    printf("\nEditing Task #%d: %s\n", t->id, t->title);
    printf("(Press [Enter] without typing to keep current value)\n\n");

    /* Edit Title */
    printf("New Title [%s]: ", t->title);
    char newTitle[80];
    readLine(newTitle, sizeof(newTitle));
    sanitizeString(newTitle);
    if (strlen(newTitle) > 0) {
        strncpy(t->title, newTitle, sizeof(t->title) - 1);
    }

    /* Edit Deadline */
    printf("New Deadline [%s]: ", t->deadline);
    char newDeadline[16];
    readLine(newDeadline, sizeof(newDeadline));
    if (strlen(newDeadline) > 0) {
        int y, m, d;
        if (parseDate(newDeadline, &y, &m, &d)) {
            strncpy(t->deadline, newDeadline, sizeof(t->deadline) - 1);
        } else {
            printf("  [Invalid format. Kept previous deadline: %s]\n", t->deadline);
        }
    }

    /* Edit Hours */
    printf("New Hours [%.1f]: ", t->hours);
    char newHours[32];
    readLine(newHours, sizeof(newHours));
    if (strlen(newHours) > 0) {
        float h = (float)atof(newHours);
        if (h > 0.0f && h <= 100.0f) {
            t->hours = h;
        } else {
            printf("  [Invalid hours. Kept previous value: %.1f]\n", t->hours);
        }
    }

    /* Edit Importance */
    printf("New Importance (1-5) [%d]: ", t->importance);
    char newImp[32];
    readLine(newImp, sizeof(newImp));
    if (strlen(newImp) > 0) {
        int imp = atoi(newImp);
        if (imp >= 1 && imp <= 5) {
            t->importance = imp;
        } else {
            printf("  [Invalid importance. Kept previous value: %d]\n", t->importance);
        }
    }

    printf("\n>>> Task #%d Updated Successfully!\n", t->id);
    pressEnterToContinue();
}

void deleteAssignmentAction(void) {
    if (taskCount == 0) {
        printf("\n[No assignments available to delete.]\n");
        pressEnterToContinue();
        return;
    }

    displayAssignmentsTable();
    printf("\nEnter Task ID to delete: ");
    char buf[32];
    readLine(buf, sizeof(buf));
    int id = atoi(buf);

    int idx = hashSearch(&idTable, id);
    if (idx == -1) {
        printf("\n[Error: Task ID %d not found.]\n", id);
        pressEnterToContinue();
        return;
    }

    printf("Are you sure you want to delete Task #%d \"%s\"? (y/n): ", id, tasks[idx].title);
    readLine(buf, sizeof(buf));
    if (buf[0] != 'y' && buf[0] != 'Y') {
        printf("\nDeletion cancelled.\n");
        pressEnterToContinue();
        return;
    }

    /* Remove dependencies pointing to this task in other assignments */
    for (int i = 0; i < taskCount; i++) {
        int newDepCount = 0;
        for (int d = 0; d < tasks[i].depCount; d++) {
            if (tasks[i].dependencies[d] != id) {
                tasks[i].dependencies[newDepCount++] = tasks[i].dependencies[d];
            }
        }
        tasks[i].depCount = newDepCount;
    }

    /* Shift elements left */
    for (int i = idx; i < taskCount - 1; i++) {
        tasks[i] = tasks[i + 1];
    }
    taskCount--;

    rebuildHashTable();
    printf("\n>>> Task #%d successfully deleted.\n", id);
    pressEnterToContinue();
}

void manageDependenciesAction(void) {
    if (taskCount < 2) {
        printf("\n[At least 2 assignments are required to configure dependencies.]\n");
        pressEnterToContinue();
        return;
    }

    displayAssignmentsTable();

    printf("\n--------------------------------------------------\n");
    printf("              MANAGE DEPENDENCIES                 \n");
    printf("--------------------------------------------------\n");
    printf("1. Add Dependency (Task B depends on Task A)\n");
    printf("2. Remove Dependency\n");
    printf("Enter choice (1-2, or Enter to cancel): ");
    char choiceBuf[32];
    readLine(choiceBuf, sizeof(choiceBuf));

    if (choiceBuf[0] == '1') {
        printf("\nEnter Dependent Task ID (the task that WAITS): ");
        char bufB[32];
        readLine(bufB, sizeof(bufB));
        int idB = atoi(bufB);
        int idxB = hashSearch(&idTable, idB);
        if (idxB == -1) {
            printf("\n[Error: Task ID %d not found.]\n", idB);
            pressEnterToContinue();
            return;
        }

        printf("Enter Prerequisite Task ID (the task that MUST BE COMPLETED FIRST): ");
        char bufA[32];
        readLine(bufA, sizeof(bufA));
        int idA = atoi(bufA);
        int idxA = hashSearch(&idTable, idA);
        if (idxA == -1) {
            printf("\n[Error: Task ID %d not found.]\n", idA);
            pressEnterToContinue();
            return;
        }

        if (idA == idB) {
            printf("\n[Error: A task cannot depend on itself.]\n");
            pressEnterToContinue();
            return;
        }

        /* Check if already a dependency */
        for (int d = 0; d < tasks[idxB].depCount; d++) {
            if (tasks[idxB].dependencies[d] == idA) {
                printf("\n[Task #%d already depends on Task #%d.]\n", idB, idA);
                pressEnterToContinue();
                return;
            }
        }

        /* Cycle Prevention Check:
         * If we add edge A -> B (B depends on A), does a path already exist from B to A?
         * If yes, adding A -> B would create a cycle: A -> B ... -> A.
         */
        Graph tempGraph;
        initGraph(&tempGraph, taskCount);
        for (int i = 0; i < taskCount; i++) {
            for (int d = 0; d < tasks[i].depCount; d++) {
                int pIdx = hashSearch(&idTable, tasks[i].dependencies[d]);
                if (pIdx != -1) {
                    addGraphEdge(&tempGraph, pIdx, i);
                }
            }
        }

        if (isReachable(&tempGraph, idxB, idxA)) {
            printf("\n[REJECTED: Cycle Detected! Task #%d already directly or indirectly depends on Task #%d.]\n", idA, idB);
            printf("[Adding this dependency would cause a circular deadlock: #%d <-> #%d]\n", idA, idB);
            freeGraph(&tempGraph);
            pressEnterToContinue();
            return;
        }
        freeGraph(&tempGraph);

        if (tasks[idxB].depCount >= MAX_DEPS) {
            printf("\n[Error: Maximum prerequisites reached for Task #%d.]\n", idB);
            pressEnterToContinue();
            return;
        }

        tasks[idxB].dependencies[tasks[idxB].depCount++] = idA;
        printf("\n>>> Dependency Added: Task #%d now depends on Task #%d.\n", idB, idA);
        pressEnterToContinue();

    } else if (choiceBuf[0] == '2') {
        printf("\nEnter Dependent Task ID: ");
        char bufB[32];
        readLine(bufB, sizeof(bufB));
        int idB = atoi(bufB);
        int idxB = hashSearch(&idTable, idB);
        if (idxB == -1) {
            printf("\n[Error: Task ID %d not found.]\n", idB);
            pressEnterToContinue();
            return;
        }

        if (tasks[idxB].depCount == 0) {
            printf("\n[Task #%d has no prerequisites to remove.]\n", idB);
            pressEnterToContinue();
            return;
        }

        printf("Prerequisites for Task #%d: ", idB);
        for (int d = 0; d < tasks[idxB].depCount; d++) {
            printf("#%d ", tasks[idxB].dependencies[d]);
        }
        printf("\nEnter Prerequisite ID to remove: ");
        char bufA[32];
        readLine(bufA, sizeof(bufA));
        int idA = atoi(bufA);

        int foundIdx = -1;
        for (int d = 0; d < tasks[idxB].depCount; d++) {
            if (tasks[idxB].dependencies[d] == idA) {
                foundIdx = d;
                break;
            }
        }

        if (foundIdx == -1) {
            printf("\n[Prerequisite #%d not found in Task #%d's list.]\n", idA, idB);
            pressEnterToContinue();
            return;
        }

        for (int d = foundIdx; d < tasks[idxB].depCount - 1; d++) {
            tasks[idxB].dependencies[d] = tasks[idxB].dependencies[d + 1];
        }
        tasks[idxB].depCount--;
        printf("\n>>> Prerequisite #%d removed from Task #%d.\n", idA, idB);
        pressEnterToContinue();
    }
}

void markAssignmentCompleteAction(void) {
    if (taskCount == 0) {
        printf("\n[No assignments recorded.]\n");
        pressEnterToContinue();
        return;
    }

    displayAssignmentsTable();
    printf("\nEnter Task ID to toggle completion status: ");
    char buf[32];
    readLine(buf, sizeof(buf));
    int id = atoi(buf);

    int idx = hashSearch(&idTable, id);
    if (idx == -1) {
        printf("\n[Error: Task ID %d not found.]\n", id);
        pressEnterToContinue();
        return;
    }

    tasks[idx].completed = !tasks[idx].completed;
    printf("\n>>> Task #%d \"%s\" marked as %s.\n",
           tasks[idx].id,
           tasks[idx].title,
           tasks[idx].completed ? "COMPLETE [DONE]" : "PENDING [UNFINISHED]");

    if (tasks[idx].completed) {
        printf(">>> Any dependent tasks are now unlocked and closer to execution!\n");
    }

    pressEnterToContinue();
}

void displayOptimizedPlanAction(void) {
    if (taskCount == 0) {
        printf("\n[No assignments recorded. Please add assignments first.]\n");
        pressEnterToContinue();
        return;
    }

    PlanItem plan[MAX_TASKS];
    int planCount = 0;
    int cycleTasks[MAX_TASKS];
    int cycleCount = 0;

    int result = generateOptimizedPlan(plan, &planCount, cycleTasks, &cycleCount);

    printf("\n===============================================================================\n");
    printf("                     OPTIMIZED ASSIGNMENT EXECUTION PLAN                       \n");
    printf("===============================================================================\n");

    if (result == -1) {
        printf("\n  [!] DEPENDENCY CYCLE DETECTED! Deadlock prevents complete ordering.\n");
        printf("  Circularly blocked Task IDs: ");
        for (int i = 0; i < cycleCount; i++) {
            printf("#%d ", cycleTasks[i]);
        }
        printf("\n  Please resolve or remove the circular prerequisites in Option 5.\n");
        printf("-------------------------------------------------------------------------------\n");
    }

    if (planCount == 0) {
        printf("\n  No pending tasks to schedule (All tasks are already completed!).\n");
    } else {
        printf("\n+------+-----+--------------------------------+------------+-------+-----+--------------------------------------------------------------+\n");
        printf("| Rank | ID  | Assignment Title               | Deadline   | Hours | Imp | Reason for Scheduling Order                                  |\n");
        printf("+------+-----+--------------------------------+------------+-------+-----+--------------------------------------------------------------+\n");

        float totalHours = 0.0f;
        for (int i = 0; i < planCount; i++) {
            const Task* t = &tasks[plan[i].taskIndex];
            totalHours += t->hours;

            char titleBuf[33];
            strncpy(titleBuf, t->title, 32);
            titleBuf[32] = '\0';

            char reasonBuf[62];
            strncpy(reasonBuf, plan[i].reason, 61);
            reasonBuf[61] = '\0';

            printf("| %4d | %-3d | %-30s | %-10s | %5.1f |  %d  | %-60s |\n",
                   i + 1,
                   t->id,
                   titleBuf,
                   t->deadline,
                   t->hours,
                   t->importance,
                   reasonBuf);
        }
        printf("+------+-----+--------------------------------+------------+-------+-----+--------------------------------------------------------------+\n");

        /* Next Recommended Task Card */
        const Task* nextTask = &tasks[plan[0].taskIndex];
        printf("\n>>> RECOMMENDED NEXT MISSION / ASSIGNMENT <<<\n");
        printf("  ID       : #%d\n", nextTask->id);
        printf("  Title    : %s\n", nextTask->title);
        printf("  Deadline : %s\n", nextTask->deadline);
        printf("  Effort   : %.1f hours  |  Importance: %d/5\n", nextTask->hours, nextTask->importance);
        printf("  Strategy : %s\n", plan[0].reason);
        printf("\n  Total Pending Workload: %d tasks | %.1f estimated hours\n", planCount, totalHours);
    }

    pressEnterToContinue();
}

void viewDataStructureOperationsAction(void) {
    printf("\n===============================================================================\n");
    printf("                DATA STRUCTURE INTERNAL STATE & VIVA DEMO                      \n");
    printf("===============================================================================\n\n");

    /* 1. Hash Table Buckets */
    printf("[1] HASH TABLE (Assignment ID -> Array Index Lookup, Chaining):\n");
    printf("    Hash Function: ID %% %d\n", HASH_SIZE);
    int totalEntries = 0;
    for (int b = 0; b < HASH_SIZE; b++) {
        HashEntry* curr = idTable.buckets[b];
        if (curr != NULL) {
            printf("    Bucket [%2d]: ", b);
            while (curr != NULL) {
                totalEntries++;
                printf("[ID:%d -> tasks[%d]] -> ", curr->taskId, curr->taskIndex);
                curr = curr->next;
            }
            printf("NULL\n");
        }
    }
    printf("    Total Hash Entries: %d\n\n", totalEntries);

    /* 2. Graph Adjacency List */
    printf("[2] DIRECTED GRAPH ADJACENCY LIST (Prerequisite Dependency Graph):\n");
    printf("    Edge u -> v means Task u MUST BE DONE BEFORE Task v (v depends on u)\n");
    Graph g;
    initGraph(&g, taskCount);
    for (int i = 0; i < taskCount; i++) {
        for (int d = 0; d < tasks[i].depCount; d++) {
            int pIdx = hashSearch(&idTable, tasks[i].dependencies[d]);
            if (pIdx != -1) {
                addGraphEdge(&g, pIdx, i);
            }
        }
    }
    for (int i = 0; i < taskCount; i++) {
        printf("    Vertex [%d] #%-3d \"%s\": ", i, tasks[i].id, tasks[i].title);
        Node* curr = g.adj[i];
        if (!curr) {
            printf("(No dependent tasks)");
        }
        while (curr != NULL) {
            printf("-> #%d (%s) ", tasks[curr->taskIndex].id, tasks[curr->taskIndex].title);
            curr = curr->next;
        }
        printf("\n");
    }
    freeGraph(&g);
    printf("\n");

    /* 3. Min-Heap Simulation */
    printf("[3] BINARY MIN-HEAP (Priority Queue State for Ready Tasks):\n");
    Heap h;
    initHeap(&h);
    for (int i = 0; i < taskCount; i++) {
        if (!tasks[i].completed) {
            insertHeap(&h, i);
        }
    }
    printf("    Current Heap Size (Pending Tasks): %d\n", h.size);
    printf("    Heap Array Storage [data[0..size-1]]:\n    ");
    for (int i = 0; i < h.size; i++) {
        printf("[idx %d: #%d (%s)] ", i, tasks[h.data[i]].id, tasks[h.data[i]].deadline);
    }
    printf("\n    Extraction Order (Min-Heap deleteMin):\n");
    int order = 1;
    while (h.size > 0) {
        int bestIdx = deleteHeap(&h);
        printf("      Rank %d: Task #%d | %s | Due: %s | Imp: %d | Hours: %.1f\n",
               order++,
               tasks[bestIdx].id,
               tasks[bestIdx].title,
               tasks[bestIdx].deadline,
               tasks[bestIdx].importance,
               tasks[bestIdx].hours);
    }
    printf("\n");

    /* 4. Queue Topological Trace */
    printf("[4] QUEUE IN KAHN'S TOPOLOGICAL SORTING:\n");
    printf("    Front pointer (f) and Rear pointer (r) track eligible zero-indegree vertices.\n");
    printf("    Time Complexity: O(V + E) for Graph Traversal + O(V log V) for Min-Heap scheduling.\n");

    pressEnterToContinue();
}

void saveLoadMenuAction(void) {
    printf("\n--------------------------------------------------\n");
    printf("                 SAVE / LOAD DATA                 \n");
    printf("--------------------------------------------------\n");
    printf("1. Save to File (samples/planner.txt)\n");
    printf("2. Load from File (samples/planner.txt)\n");
    printf("3. Export to Custom File Path\n");
    printf("4. Import from Custom File Path\n");
    printf("Enter choice (1-4, or Enter to cancel): ");

    char buf[64];
    readLine(buf, sizeof(buf));

    if (buf[0] == '1') {
        if (saveToFile(DEFAULT_FILE) == 0) {
            printf("\n>>> Successfully saved %d assignments to '%s'!\n", taskCount, DEFAULT_FILE);
        } else {
            printf("\n[Error: Could not write to '%s'.]\n", DEFAULT_FILE);
        }
        pressEnterToContinue();
    } else if (buf[0] == '2') {
        int count = loadFromFile(DEFAULT_FILE);
        if (count >= 0) {
            printf("\n>>> Successfully loaded %d assignments from '%s'!\n", count, DEFAULT_FILE);
        } else {
            printf("\n[Error: Could not load from '%s'. Error code: %d]\n", DEFAULT_FILE, count);
        }
        pressEnterToContinue();
    } else if (buf[0] == '3') {
        printf("Enter destination file path: ");
        char customPath[128];
        readLine(customPath, sizeof(customPath));
        if (strlen(customPath) > 0) {
            if (saveToFile(customPath) == 0) {
                printf("\n>>> Successfully exported to '%s'!\n", customPath);
            } else {
                printf("\n[Error: Could not write to '%s'.]\n", customPath);
            }
        }
        pressEnterToContinue();
    } else if (buf[0] == '4') {
        printf("Enter source file path: ");
        char customPath[128];
        readLine(customPath, sizeof(customPath));
        if (strlen(customPath) > 0) {
            int count = loadFromFile(customPath);
            if (count >= 0) {
                printf("\n>>> Successfully imported %d assignments from '%s'!\n", count, customPath);
            } else {
                printf("\n[Error: Could not load from '%s'. Error code: %d]\n", customPath, count);
            }
        }
        pressEnterToContinue();
    }
}

/* ------------------------------------------------------------------------- */
/*                               MAIN MENU                                   */
/* ------------------------------------------------------------------------- */

void printMainMenu(void) {
    printf("\n");
    printf("+------------------------------------------------+\n");
    printf("|         ASSIGNMENT DEADLINE OPTIMIZER          |\n");
    printf("|         College DS Lab Mini-Project            |\n");
    printf("+------------------------------------------------+\n");
    printf("|                                                |\n");
    printf("|  1. Add Assignment                             |\n");
    printf("|  2. View Assignments                           |\n");
    printf("|  3. Edit Assignment                            |\n");
    printf("|  4. Delete Assignment                          |\n");
    printf("|  5. Manage Dependencies                        |\n");
    printf("|  6. Generate Optimized Plan                    |\n");
    printf("|  7. Mark Assignment Complete                   |\n");
    printf("|  8. View Data Structure Operations (Viva Demo) |\n");
    printf("|  9. Save / Load Data                           |\n");
    printf("|  0. Exit                                       |\n");
    printf("|                                                |\n");
    printf("+------------------------------------------------+\n");
    printf("Enter Choice: ");
}

int main(void) {
    initHash(&idTable);

    /* Try loading default sample data on startup */
    int loaded = loadFromFile(DEFAULT_FILE);
    if (loaded < 0) {
        /* If samples/planner.txt is not found in local dir, try planner.txt */
        loadFromFile("planner.txt");
    }

    char choiceBuf[32];
    int choice = -1;

    while (choice != 0) {
        printMainMenu();
        readLine(choiceBuf, sizeof(choiceBuf));
        choice = atoi(choiceBuf);

        switch (choice) {
            case 1:
                addAssignmentAction();
                break;
            case 2:
                displayAssignmentsTable();
                pressEnterToContinue();
                break;
            case 3:
                editAssignmentAction();
                break;
            case 4:
                deleteAssignmentAction();
                break;
            case 5:
                manageDependenciesAction();
                break;
            case 6:
                displayOptimizedPlanAction();
                break;
            case 7:
                markAssignmentCompleteAction();
                break;
            case 8:
                viewDataStructureOperationsAction();
                break;
            case 9:
                saveLoadMenuAction();
                break;
            case 0:
                printf("\nSaving assignments before exit...\n");
                saveToFile(DEFAULT_FILE);
                printf("Thank you for using Assignment Deadline Optimizer. Goodbye!\n\n");
                break;
            default:
                printf("\n[Invalid choice. Please enter a number between 0 and 9.]\n");
                pressEnterToContinue();
                break;
        }
    }

    return 0;
}
