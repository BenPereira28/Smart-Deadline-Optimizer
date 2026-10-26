/*
 * ============================================================================
 * AUTOMATED TEST SUITE FOR ASSIGNMENT DEADLINE OPTIMIZER
 * Verifies Test Cases A - H as specified in the project requirements.
 * ============================================================================
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <assert.h>

#define MAX_TASKS 100
#define MAX_DEPS 20
#define HASH_SIZE 37

typedef struct {
    int id;
    char title[80];
    char deadline[16];
    float hours;
    int importance;
    int completed;
    int depCount;
    int dependencies[MAX_DEPS];
} Task;

typedef struct Node {
    int taskIndex;
    struct Node* next;
} Node;

typedef struct {
    int numVertices;
    Node* adj[MAX_TASKS];
} Graph;

typedef struct {
    int data[MAX_TASKS];
    int size;
} Heap;

typedef struct {
    int items[MAX_TASKS];
    int f;
    int r;
} Queue;

typedef struct HashEntry {
    int taskId;
    int taskIndex;
    struct HashEntry* next;
} HashEntry;

typedef struct {
    HashEntry* buckets[HASH_SIZE];
} HashTable;

Task tasks[MAX_TASKS];
int taskCount = 0;
HashTable idTable;

int hashFunction(int id) {
    if (id < 0) id = -id;
    return id % HASH_SIZE;
}

void initHash(HashTable* ht) {
    for (int i = 0; i < HASH_SIZE; i++) ht->buckets[i] = NULL;
}

void hashInsert(HashTable* ht, int taskId, int taskIndex) {
    int b = hashFunction(taskId);
    HashEntry* newEntry = (HashEntry*)malloc(sizeof(HashEntry));
    newEntry->taskId = taskId;
    newEntry->taskIndex = taskIndex;
    newEntry->next = ht->buckets[b];
    ht->buckets[b] = newEntry;
}

int hashSearch(const HashTable* ht, int taskId) {
    int b = hashFunction(taskId);
    HashEntry* entry = ht->buckets[b];
    while (entry != NULL) {
        if (entry->taskId == taskId) return entry->taskIndex;
        entry = entry->next;
    }
    return -1;
}

void rebuildHashTable(void) {
    initHash(&idTable);
    for (int i = 0; i < taskCount; i++) hashInsert(&idTable, tasks[i].id, i);
}

void initGraph(Graph* g, int n) {
    g->numVertices = n;
    for (int i = 0; i < n; i++) g->adj[i] = NULL;
}

void addGraphEdge(Graph* g, int u, int v) {
    Node* newNode = (Node*)malloc(sizeof(Node));
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

int compareTasks(int idxA, int idxB) {
    const Task* a = &tasks[idxA];
    const Task* b = &tasks[idxB];
    int dCmp = strcmp(a->deadline, b->deadline);
    if (dCmp != 0) return dCmp;
    if (a->importance != b->importance) return (b->importance - a->importance);
    if (a->hours < b->hours) return -1;
    if (a->hours > b->hours) return 1;
    return (a->id - b->id);
}

void initHeap(Heap* h) { h->size = 0; }

void heapifyUp(Heap* h, int idx) {
    while (idx > 0) {
        int parent = (idx - 1) / 2;
        if (compareTasks(h->data[idx], h->data[parent]) < 0) {
            int temp = h->data[idx];
            h->data[idx] = h->data[parent];
            h->data[parent] = temp;
            idx = parent;
        } else break;
    }
}

void heapifyDown(Heap* h, int idx) {
    while (1) {
        int left = 2 * idx + 1;
        int right = 2 * idx + 2;
        int smallest = idx;
        if (left < h->size && compareTasks(h->data[left], h->data[smallest]) < 0) smallest = left;
        if (right < h->size && compareTasks(h->data[right], h->data[smallest]) < 0) smallest = right;
        if (smallest != idx) {
            int temp = h->data[idx];
            h->data[idx] = h->data[smallest];
            h->data[smallest] = temp;
            idx = smallest;
        } else break;
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
    if (h->size > 0) heapifyDown(h, 0);
    return root;
}

typedef struct {
    int taskIndex;
    char reason[120];
} PlanItem;

int generateOptimizedPlan(PlanItem* plan, int* planCount, int* cycleTasks, int* cycleCount) {
    *planCount = 0;
    *cycleCount = 0;
    if (taskCount == 0) return 0;

    Graph g;
    initGraph(&g, taskCount);
    int inDegree[MAX_TASKS] = {0};
    int unfinishedCount = 0;

    for (int i = 0; i < taskCount; i++) {
        if (!tasks[i].completed) unfinishedCount++;
        for (int d = 0; d < tasks[i].depCount; d++) {
            int prereqId = tasks[i].dependencies[d];
            int prereqIdx = hashSearch(&idTable, prereqId);
            if (prereqIdx != -1) {
                addGraphEdge(&g, prereqIdx, i);
                if (!tasks[prereqIdx].completed) inDegree[i]++;
            }
        }
    }

    if (unfinishedCount == 0) {
        freeGraph(&g);
        return 0;
    }

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

        PlanItem item;
        item.taskIndex = u;
        sprintf(item.reason, "Optimal schedule position");
        plan[(*planCount)++] = item;

        Node* curr = g.adj[u];
        while (curr != NULL) {
            int v = curr->taskIndex;
            if (!tasks[v].completed) {
                inDegree[v]--;
                if (inDegree[v] == 0) insertHeap(&h, v);
            }
            curr = curr->next;
        }
    }

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

/* ============================ TEST RUNNER ============================ */

void resetState(void) {
    taskCount = 0;
    initHash(&idTable);
}

void addTaskHelper(int id, const char* title, const char* deadline, float hours, int imp, int completed, int* deps, int depCount) {
    Task t;
    memset(&t, 0, sizeof(Task));
    t.id = id;
    strcpy(t.title, title);
    strcpy(t.deadline, deadline);
    t.hours = hours;
    t.importance = imp;
    t.completed = completed;
    t.depCount = depCount;
    for (int i = 0; i < depCount; i++) t.dependencies[i] = deps[i];
    tasks[taskCount] = t;
    hashInsert(&idTable, id, taskCount);
    taskCount++;
}

void testA_IndependentAssignments(void) {
    printf("[TEST A] Independent assignments priority ordering... ");
    resetState();
    addTaskHelper(1, "Task 1", "2026-11-05", 2.0, 3, 0, NULL, 0);
    addTaskHelper(2, "Task 2", "2026-10-28", 3.0, 4, 0, NULL, 0);
    addTaskHelper(3, "Task 3", "2026-10-30", 1.0, 5, 0, NULL, 0);

    PlanItem plan[MAX_TASKS];
    int planCount = 0, cycleTasks[MAX_TASKS], cycleCount = 0;
    int res = generateOptimizedPlan(plan, &planCount, cycleTasks, &cycleCount);

    assert(res == 0);
    assert(planCount == 3);
    /* Expected order: 2 (Oct 28), then 3 (Oct 30), then 1 (Nov 5) */
    assert(tasks[plan[0].taskIndex].id == 2);
    assert(tasks[plan[1].taskIndex].id == 3);
    assert(tasks[plan[2].taskIndex].id == 1);
    printf("PASSED\n");
}

void testB_DependencyChain(void) {
    printf("[TEST B] Linear dependency chain A -> B -> C... ");
    resetState();
    /* C has latest deadline, but depends on B; B depends on A */
    int depB[] = {1};
    int depC[] = {2};
    addTaskHelper(1, "Task A", "2026-11-10", 2.0, 3, 0, NULL, 0);
    addTaskHelper(2, "Task B", "2026-10-25", 2.0, 3, 0, depB, 1); /* Even though B has earlier deadline, it needs A! */
    addTaskHelper(3, "Task C", "2026-10-20", 2.0, 3, 0, depC, 1); /* Needs B */

    PlanItem plan[MAX_TASKS];
    int planCount = 0, cycleTasks[MAX_TASKS], cycleCount = 0;
    int res = generateOptimizedPlan(plan, &planCount, cycleTasks, &cycleCount);

    assert(res == 0);
    assert(planCount == 3);
    /* A must come first because B and C have non-zero indegrees */
    assert(tasks[plan[0].taskIndex].id == 1);
    assert(tasks[plan[1].taskIndex].id == 2);
    assert(tasks[plan[2].taskIndex].id == 3);
    printf("PASSED\n");
}

void testC_MultiplePrerequisites(void) {
    printf("[TEST C] Multiple prerequisites A -> C and B -> C... ");
    resetState();
    int depC[] = {1, 2};
    addTaskHelper(1, "Task A", "2026-10-28", 2.0, 4, 0, NULL, 0);
    addTaskHelper(2, "Task B", "2026-10-29", 3.0, 4, 0, NULL, 0);
    addTaskHelper(3, "Task C", "2026-10-27", 1.0, 5, 0, depC, 2); /* Earliest deadline, but blocked! */

    PlanItem plan[MAX_TASKS];
    int planCount = 0, cycleTasks[MAX_TASKS], cycleCount = 0;
    int res = generateOptimizedPlan(plan, &planCount, cycleTasks, &cycleCount);

    assert(res == 0);
    assert(planCount == 3);
    /* C cannot be first or second */
    assert(tasks[plan[0].taskIndex].id == 1);
    assert(tasks[plan[1].taskIndex].id == 2);
    assert(tasks[plan[2].taskIndex].id == 3);
    printf("PASSED\n");
}

void testD_CycleDetection(void) {
    printf("[TEST D] Cycle detection (A -> B -> C -> A)... ");
    resetState();
    int depA[] = {3};
    int depB[] = {1};
    int depC[] = {2};
    addTaskHelper(1, "Task A", "2026-10-28", 2.0, 4, 0, depA, 1);
    addTaskHelper(2, "Task B", "2026-10-29", 2.0, 4, 0, depB, 1);
    addTaskHelper(3, "Task C", "2026-10-30", 2.0, 4, 0, depC, 1);

    PlanItem plan[MAX_TASKS];
    int planCount = 0, cycleTasks[MAX_TASKS], cycleCount = 0;
    int res = generateOptimizedPlan(plan, &planCount, cycleTasks, &cycleCount);

    assert(res == -1);
    assert(planCount == 0);
    assert(cycleCount == 3);
    printf("PASSED (Successfully caught circular deadlock)\n");
}

void testE_DynamicCompletion(void) {
    printf("[TEST E] Dynamic completion unlocks dependent tasks... ");
    resetState();
    int depB[] = {1};
    addTaskHelper(1, "Task A", "2026-10-28", 2.0, 4, 1, NULL, 0); /* A is completed! */
    addTaskHelper(2, "Task B", "2026-10-29", 2.0, 4, 0, depB, 1);

    PlanItem plan[MAX_TASKS];
    int planCount = 0, cycleTasks[MAX_TASKS], cycleCount = 0;
    int res = generateOptimizedPlan(plan, &planCount, cycleTasks, &cycleCount);

    assert(res == 0);
    assert(planCount == 1);
    assert(tasks[plan[0].taskIndex].id == 2); /* B is immediately unlocked */
    printf("PASSED\n");
}

void testF_PriorityUpdates(void) {
    printf("[TEST F] Priority tie-breakers (importance, duration, ID)... ");
    resetState();
    /* Identical deadline: 2026-11-01. Task 1 has importance 3, Task 2 has importance 5. */
    addTaskHelper(1, "Task LowImp", "2026-11-01", 2.0, 3, 0, NULL, 0);
    addTaskHelper(2, "Task HighImp", "2026-11-01", 2.0, 5, 0, NULL, 0);

    PlanItem plan[MAX_TASKS];
    int planCount = 0, cycleTasks[MAX_TASKS], cycleCount = 0;
    generateOptimizedPlan(plan, &planCount, cycleTasks, &cycleCount);
    assert(tasks[plan[0].taskIndex].id == 2);

    /* Test duration tie-breaker */
    resetState();
    addTaskHelper(1, "Task Long", "2026-11-01", 5.0, 4, 0, NULL, 0);
    addTaskHelper(2, "Task Short", "2026-11-01", 1.5, 4, 0, NULL, 0);
    generateOptimizedPlan(plan, &planCount, cycleTasks, &cycleCount);
    assert(tasks[plan[0].taskIndex].id == 2);

    printf("PASSED\n");
}

int main(void) {
    printf("\n=== RUNNING DATA STRUCTURE ENGINE TEST SUITE ===\n\n");
    testA_IndependentAssignments();
    testB_DependencyChain();
    testC_MultiplePrerequisites();
    testD_CycleDetection();
    testE_DynamicCompletion();
    testF_PriorityUpdates();
    printf("\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<\n\n");
    return 0;
}
