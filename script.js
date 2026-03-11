/**
 * @typedef {Object} Task
 * @property {string} id - 고유 식별자
 * @property {string} text - 할 일 텍스트
 * @property {boolean} completed - 완료 여부
 * @property {number} createdAt - 생성 시간(타임스탬프)
 * @property {string} category - 카테고리 ('work', 'personal', 'study')
 */

/**
 * =======================
 * 1. 전역 DOM 요소 참조
 * =======================
 */
const DOM = {
    taskInput: document.getElementById('task-input'),
    addBtn: document.getElementById('add-btn'),
    taskList: document.getElementById('task-list'),
    categorySelect: document.getElementById('category-select'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    searchInput: document.getElementById('search-input'),
    sortSelect: document.getElementById('sort-select'),
    clearCompletedBtn: document.getElementById('clear-completed-btn'),
    emptyState: document.getElementById('empty-state'),
    remainingBadge: document.getElementById('remaining-badge'),
    overallText: document.getElementById('overall-text'),
    overallBar: document.getElementById('overall-bar'),
    workBar: document.getElementById('work-bar'),
    personalBar: document.getElementById('personal-bar'),
    studyBar: document.getElementById('study-bar'),
    todayCount: document.getElementById('today-count'),
    motivationText: document.getElementById('motivation-text'),
    exportBtn: document.getElementById('export-btn'),
    importBtn: document.getElementById('import-btn'),
    importInput: document.getElementById('import-input'),
    dailyQuote: document.getElementById('daily-quote'),
    toastContainer: document.getElementById('toast-container')
};

/**
 * =======================
 * 2. 상태 (State)
 * =======================
 */
let tasks = [];
let currentFilter = 'all';
let searchQuery = '';
let currentSort = 'date'; // 'date', 'category', 'status', 'manual'
let editingId = null;
let isDarkMode = false;
let draggedItemId = null; // 드래그 앤 드롭 전용
let locallyDeletedTasks = []; // Undo 복구를 위한 큐 보관 (최근 1건)

const QUOTES = [
    "작은 성취가 모여 큰 성공을 이룹니다.",
    "시작이 반이다, 오늘 할 일을 내일로 미루지 마세요.",
    "당신의 하루를 스스로 디자인하세요.",
    "가장 큰 위험은 아무런 위험을 감수하지 않는 것입니다.",
    "계획 없는 목표는 한낱 꿈에 불과합니다."
];

/**
 * 카테고리별 자동 분류를 위한 키워드 맵 (Keyword Map)
 */
const CATEGORY_KEYWORDS = {
    work: ['업무', '회의', '미팅', '메일', '보고서', '프로젝트', '출근', '퇴근', '마감', '결재', '기획', '개발'],
    study: ['공부', '인강', '책', '독서', '시험', '복습', '예습', '과제', '강의', '학습', '학원', '도서관'],
    personal: ['운동', '헬스', '쇼핑', '점심', '저녁', '식사', '병원', '약속', '여행', '청소', '빨래', '가족', '친구', '휴식']
};

/**
 * =======================
 * 3. 유틸리티 함수
 * =======================
 */

/**
 * 디바운싱: 반복되는 함수 호출을 그룹화하여 최상의 퍼포먼스 유지 (검색, 저장 등에 활용)
 */
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * 로컬 스토리지에 데이터 저장 (디바운싱 적용)
 */
const debouncedSaveTasks = debounce(() => {
    try {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    } catch (e) {
        console.error('용량 초과 등의 이유로 저장에 실패했습니다.', e);
        showToast('데이터 저장 중 오류가 발생했습니다.');
    }
}, 300);

function saveConfig() {
    localStorage.setItem('filter', currentFilter);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('sort', currentSort);
}

/**
 * 토스트 메시지 시스템 (Undo 지원)
 */
function showToast(message, actionText = null, actionCallback = null) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'alert');

    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    if (actionText && actionCallback) {
        const actionBtn = document.createElement('button');
        actionBtn.className = 'toast-action';
        actionBtn.textContent = actionText;
        actionBtn.addEventListener('click', () => {
            actionCallback();
            toast.classList.add('hiding');
        });
        toast.appendChild(actionBtn);
    }

    DOM.toastContainer.appendChild(toast);

    // 4초 후 자동 제거
    setTimeout(() => {
        if (!toast.classList.contains('hiding')) {
            toast.classList.add('hiding');
            toast.addEventListener('animationend', () => toast.remove());
        }
    }, 4000);
}

/**
 * 랜덤 격언 설정
 */
function setRandomQuote() {
    const today = new Date().toDateString();
    let storedQuoteData = localStorage.getItem('dailyQuote');
    let quoteJSON = null;

    if (storedQuoteData) {
        try { quoteJSON = JSON.parse(storedQuoteData); } catch(e) {}
    }

    if (quoteJSON && quoteJSON.date === today) {
        DOM.dailyQuote.textContent = `"${quoteJSON.quote}"`;
    } else {
        const randomIndex = Math.floor(Math.random() * QUOTES.length);
        const newQuote = QUOTES[randomIndex];
        DOM.dailyQuote.textContent = `"${newQuote}"`;
        localStorage.setItem('dailyQuote', JSON.stringify({ date: today, quote: newQuote }));
    }
}

/**
 * 입력된 텍스트를 기반으로 카테고리를 자동 유추하는 함수
 */
function autoDetectCategory(text) {
    if (!text) return null;
    
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(keyword => text.includes(keyword))) {
            return category;
        }
    }
    return null;
}

/**
 * =======================
 * 4. 핵심 데이터 조작 함수
 * =======================
 */

function addTask(text) {
    if (!text.trim()) return;

    // 중복 검사 (대소문자 무시)
    const isDuplicate = tasks.some(t => t.text.toLowerCase() === text.trim().toLowerCase());
    if (isDuplicate && !confirm('이미 동일한 이름의 할 일이 있습니다. 그래도 추가하시겠습니까?')) {
        return;
    }

    const newTask = {
        id: crypto.randomUUID ? crypto.randomUUID() : `task-${Date.now()}`,
        text: text.trim(),
        completed: false,
        createdAt: Date.now(),
        category: DOM.categorySelect ? DOM.categorySelect.value : 'work'
    };
    
    // 새 항목은 정렬에 상관없이 위에 보이고 싶다면 unshift 고려가능하지만, 기본 로직상 배열에 push 후 정렬로 커버.
    // 수동 정렬을 지원하기 때문에 일단 배열 끝에 추가
    tasks.push(newTask);
    debouncedSaveTasks();
    renderTasks();
    
    // 접근성 포커스 리턴
    DOM.taskInput.focus();
}

function updateTask(id, newText, newCategory) {
    const target = tasks.find(t => t.id === id);
    // 텍스트 변동이 있고, 중복되는 기존 항목이 있는 경우
    if (target && target.text !== newText && tasks.some(t => t.id !== id && t.text.toLowerCase() === newText.toLowerCase())) {
        if (!confirm('이미 동일한 내용이 있습니다. 정말 변경하시겠습니까?')) return;
    }

    tasks = tasks.map(task => 
        task.id === id ? { ...task, text: newText.trim(), category: newCategory } : task
    );
    editingId = null;
    debouncedSaveTasks();
    renderTasks();
}

function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    debouncedSaveTasks();
    renderTasks();

    if (task.completed) {
        // 완료 시 소소한 응원 메시지
        DOM.motivationText.textContent = "잘 하셨어요! 계속 멋지게 해내세요! 🎉";
    }
}

function deleteTask(id) {
    const targetToDel = tasks.find(task => task.id === id);
    if (!targetToDel) return;

    locallyDeletedTasks = [targetToDel]; // 하나만 스택 유지
    tasks = tasks.filter(task => task.id !== id);
    debouncedSaveTasks();
    renderTasks();

    showToast(`'${targetToDel.text.substring(0, 10)}${targetToDel.text.length > 10 ? '...' : ''}' 삭제됨`, '실행 취소', () => {
        if (locallyDeletedTasks.length > 0) {
            tasks.push(locallyDeletedTasks.pop());
            debouncedSaveTasks();
            renderTasks();
        }
    });
}

/**
 * =======================
 * 5. 드래그 앤 드롭 및 정렬 로직
 * =======================
 */

function handleDragStart(e, id) {
    // 수동 정렬 모드일 때만 드래그 허용
    if (currentSort !== 'manual') {
        showToast('드래그 수동 정렬은 "수동정렬" 옵션에서만 가능합니다.');
        e.preventDefault();
        return;
    }
    draggedItemId = id;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    // Firefox 대응
    e.dataTransfer.setData('text/plain', id);
}

function handleDragOver(e) {
    if (currentSort !== 'manual') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const item = e.currentTarget;
    item.classList.add('drag-over');
}

function handleDragLeave(e) {
    if (currentSort !== 'manual') return;
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e, targetId) {
    if (currentSort !== 'manual') return;
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
    
    if (draggedItemId && draggedItemId !== targetId) {
        // 배열 위치 교환
        const draggedIndex = tasks.findIndex(t => t.id === draggedItemId);
        const targetIndex = tasks.findIndex(t => t.id === targetId);
        
        const [movedItem] = tasks.splice(draggedIndex, 1);
        tasks.splice(targetIndex, 0, movedItem);
        
        debouncedSaveTasks();
        renderTasks();
    }
    draggedItemId = null;
}

function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    draggedItemId = null;
}

/**
 * 정렬 방식에 따라 배열을 복사본으로 정렬 반환
 */
function getSortedTasks(taskListToProcess) {
    // 수동 정렬은 배열 순서 그대로 리턴
    if (currentSort === 'manual') return taskListToProcess;

    return [...taskListToProcess].sort((a, b) => {
        switch (currentSort) {
            case 'date':
                // 최신순
                return b.createdAt - a.createdAt;
            case 'category':
                // 카테고리 (가나다) -> 내부적으로 영문 기준이므로 localeCompare 사용
                return a.category.localeCompare(b.category);
            case 'status':
                // 미완료 우선, 그 다음 최신순
                if (a.completed === b.completed) return b.createdAt - a.createdAt;
                return a.completed ? 1 : -1;
            default:
                return 0;
        }
    });
}


/**
 * =======================
 * 6. 렌더링 (View) 로직
 * =======================
 */

/**
 * 대시보드 진행률 및 동기 부여 메시지
 */
function updateDashboard() {
    const total = tasks.length;
    const completedTasksList = tasks.filter(t => t.completed);
    const completed = completedTasksList.length;
    const overallPercent = total === 0 ? 0 : Math.round((completed / total) * 100);
    
    // 스크린 리더와 텍스트 갱신
    const overallMsg = `${completed}/${total} 완료 (${overallPercent}%)`;
    DOM.overallText.textContent = overallMsg;
    DOM.overallText.setAttribute('aria-label', `전체 진행률: ${overallMsg}`);
    
    DOM.overallBar.style.width = `${overallPercent}%`;
    
    ['work', 'personal', 'study'].forEach(cat => {
        const catTasks = tasks.filter(t => t.category === cat);
        const catCompleted = catTasks.filter(t => t.completed).length;
        const catPercent = catTasks.length === 0 ? 0 : Math.round((catCompleted / catTasks.length) * 100);
        
        const targetBar = DOM[`${cat}Bar`];
        if (targetBar) targetBar.style.width = `${catPercent}%`;
    });
    
    const startOfToday = new Date().setHours(0,0,0,0);
    const addedToday = tasks.filter(t => t.createdAt >= startOfToday).length;
    DOM.todayCount.textContent = addedToday;
    DOM.remainingBadge.textContent = total - completed;

    // 완료율 기반 랜덤 응원 메시지
    if (total > 0 && overallPercent === 100) {
        DOM.motivationText.textContent = "모든 목표를 달성했습니다! 오늘 하루 멋졌어요 🏆";
    } else if (total > 0 && overallPercent >= 50) {
        DOM.motivationText.textContent = "절반 이상 해냈어요! 조금만 더 힘내세요 💪";
    } else if (total > 0 && overallPercent === 0) {
        DOM.motivationText.textContent = "첫 번째 할 일을 완료해 보세요! 시작이 반입니다 ✨";
    }
}

/**
 * 현재 필터 상태에 따라 버튼 'aria-pressed' 및 UI 처리
 */
function updateFilterButtons() {
    DOM.filterBtns.forEach(btn => {
        const isActive = btn.dataset.filter === currentFilter;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive.toString());
    });
}

function getTimeAgo(timestamp) {
    const rtf = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });
    const elapsed = Date.now() - timestamp;
    
    const seconds = Math.round(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return rtf.format(-days, 'day');
    if (hours > 0) return rtf.format(-hours, 'hour');
    if (minutes > 0) return rtf.format(-minutes, 'minute');
    return '방금 전';
}

function getCategoryName(category) {
    const names = { 'work': '업무', 'personal': '개인', 'study': '공부'};
    return names[category] || category;
}

/**
 * 할 일 목록 핵심 렌더러 - DOM 최적화를 위해 DocumentFragment 활용
 */
function renderTasks() {
    updateDashboard();
    
    let filteredTasks = tasks;
    
    // 1. 검색어 필터링
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredTasks = filteredTasks.filter(task => task.text.toLowerCase().includes(query));
    }
    
    // 2. 카테고리 탭 필터링
    if (currentFilter !== 'all') {
        filteredTasks = filteredTasks.filter(task => task.category === currentFilter);
    }

    // 3. 정렬 옵션 결합
    filteredTasks = getSortedTasks(filteredTasks);

    // 4. 빈 상태 UI 처리
    if (filteredTasks.length === 0) {
        DOM.emptyState.classList.remove('hidden');
        DOM.taskList.innerHTML = '';
        return;
    } else {
        DOM.emptyState.classList.add('hidden');
    }
    
    // DocumentFragment를 이용한 렌더링 성능 최적화 (대량 요소 리플로우 방지)
    const fragment = document.createDocumentFragment();

    filteredTasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        
        // 수동 정렬을 위한 HTML5 Drag Api 설정
        li.setAttribute('draggable', currentSort === 'manual' ? 'true' : 'false');
        li.addEventListener('dragstart', (e) => handleDragStart(e, task.id));
        li.addEventListener('dragover', handleDragOver);
        li.addEventListener('dragleave', handleDragLeave);
        li.addEventListener('drop', (e) => handleDrop(e, task.id));
        li.addEventListener('dragend', handleDragEnd);

        // 드래그 그립 아이콘 (수동정렬 상태일때만 표시)
        if (currentSort === 'manual') {
            const dragHandle = document.createElement('span');
            dragHandle.className = 'drag-handle';
            dragHandle.textContent = '⠿';
            dragHandle.setAttribute('aria-hidden', 'true');
            li.appendChild(dragHandle);
        }

        // 상태 체크박스
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox';
        checkbox.checked = task.completed;
        checkbox.setAttribute('aria-label', `${task.text} 완료 처리`);
        checkbox.addEventListener('change', () => toggleTask(task.id));
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'task-content';

        // 편집 모드 분기
        if (editingId === task.id && !task.completed) {
            const editContainer = document.createElement('div');
            editContainer.className = 'edit-container';
            
            const editSelect = document.createElement('select');
            editSelect.className = 'edit-select';
            editSelect.setAttribute('aria-label', '카테고리 수정');
            
            ['work', 'personal', 'study'].forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = getCategoryName(cat);
                if (cat === task.category) option.selected = true;
                editSelect.appendChild(option);
            });
            
            const editInput = document.createElement('input');
            editInput.type = 'text';
            editInput.className = 'edit-input';
            editInput.value = task.text;
            editInput.setAttribute('aria-label', '할 일 수정 입력란');
            
            const saveEdit = () => {
                const newText = editInput.value.trim();
                if (newText) updateTask(task.id, newText, editSelect.value);
                else {
                    editingId = null;
                    renderTasks();
                }
            };
            
            editInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') {
                    editingId = null;
                    renderTasks();
                }
            });
            
            // 인라인 텍스트 수정 중 자동 분류
            let inlineUserChanged = false;
            editSelect.addEventListener('change', () => inlineUserChanged = true);
            
            editInput.addEventListener('input', (e) => {
                if (inlineUserChanged) return;
                const text = e.target.value;
                const detectedCategory = autoDetectCategory(text);
                if (detectedCategory) {
                    editSelect.value = detectedCategory;
                }
            });

            // 포커스 아웃 시에도 저장 적용
            editInput.addEventListener('blur', () => {
                // 약간의 딜레이를 주어 버튼 클릭 겹침 등 방지
                setTimeout(saveEdit, 150);
            });

            editContainer.appendChild(editSelect);
            editContainer.appendChild(editInput);
            contentDiv.appendChild(editContainer);
            
            // 비동기 포커스 설정
            setTimeout(() => {
                editInput.focus();
                editInput.setSelectionRange(editInput.value.length, editInput.value.length);
            }, 0);
            
        } else {
            const headerDiv = document.createElement('div');
            headerDiv.className = 'task-header';

            const categoryBadge = document.createElement('span');
            categoryBadge.className = `task-category ${task.category}`;
            categoryBadge.textContent = getCategoryName(task.category);

            const timeSpan = document.createElement('span');
            timeSpan.className = 'task-time';
            timeSpan.textContent = getTimeAgo(task.createdAt);

            headerDiv.appendChild(categoryBadge);
            headerDiv.appendChild(timeSpan);

            const textSpan = document.createElement('button');
            textSpan.className = 'task-text';
            textSpan.textContent = task.text;
            textSpan.title = '클릭하여 항목 수정 (미완료 항목만 가능)';
            textSpan.style.background = 'none';
            textSpan.style.border = 'none';
            textSpan.style.textAlign = 'left';
            
            // 더블클릭 뿐 아니라 접근성(키보드 Enter)을 위해 button 요소로 텍스트 제공 및 click 사용
            if (!task.completed) {
                textSpan.addEventListener('click', () => {
                    editingId = task.id;
                    renderTasks();
                });
            }

            contentDiv.appendChild(headerDiv);
            contentDiv.appendChild(textSpan);
        }
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '✕';
        deleteBtn.setAttribute('aria-label', `${task.text} 삭제`);
        deleteBtn.addEventListener('click', () => {
            li.classList.add('removing');
            setTimeout(() => deleteTask(task.id), 300); // fadeOut 300ms 일치
        });
        
        li.appendChild(checkbox);
        li.appendChild(contentDiv);
        li.appendChild(deleteBtn);
        
        fragment.appendChild(li);
    });

    // 최종 교체
    DOM.taskList.innerHTML = '';
    DOM.taskList.appendChild(fragment);
}


/**
 * =======================
 * 7. 내보내기 및 가져오기 기능
 * =======================
 */

function exportData() {
    if (tasks.length === 0) {
        showToast('내보낼 데이터가 없습니다.');
        return;
    }
    const dataStr = JSON.stringify(tasks, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `mytasks_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showToast('데이터가 성공적으로 내보내졌습니다.');
}

function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (tasks.length > 0 && !confirm('현재 할 일 목록이 덮어씌워지거나 합쳐집니다. 가져오기 전에 백업을 권장드립니다. 진행하시겠습니까?')) {
        DOM.importInput.value = ''; // 초기화
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const importedData = JSON.parse(event.target.result);
            if (!Array.isArray(importedData)) throw new Error('올바른 배열 포맷이 아닙니다.');
            
            // 데이터 병합 (중복 방지: 고유 ID 기준, 중복 시 기존 것 덮어쓰기 or 병합. 여기선 덮어쓰기 방식을 취함)
            const newTasksMap = new Map();
            // 1. 기존 데이터 맵
            tasks.forEach(t => newTasksMap.set(t.id, t));
            // 2. 새로운 데이터로 덮어쓰기
            importedData.forEach(t => {
                if (t.id && t.text) { // 최소 필수 필드 검증
                    newTasksMap.set(t.id, t);
                }
            });

            tasks = Array.from(newTasksMap.values());
            debouncedSaveTasks();
            renderTasks();
            showToast('데이터를 성공적으로 가져왔습니다.');
            
        } catch(error) {
            console.error('Import error:', error);
            alert('유효하지 않은 JSON 파일이거나 데이터 포맷이 맞지 않습니다.');
        } finally {
            DOM.importInput.value = '';
        }
    };
    reader.readAsText(file);
}

/**
 * =======================
 * 8. 초기화(Init) 및 이벤트 선언부
 * =======================
 */

function init() {
    // 테마 복원
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark') {
        isDarkMode = true;
        document.documentElement.dataset.theme = 'dark';
        DOM.themeToggle.textContent = '☀️';
    }

    // 작업 리스트 복원
    const storedTasks = localStorage.getItem('tasks');
    if (storedTasks) {
        try {
            tasks = JSON.parse(storedTasks);
            tasks.forEach(task => { if (!task.category) task.category = 'work'; });
        } catch (e) {
            tasks = [];
        }
    }
    
    // 설정 상태 복원 (필터, 정렬)
    const storedFilter = localStorage.getItem('filter');
    if (storedFilter) currentFilter = storedFilter;
    
    const storedSort = localStorage.getItem('sort');
    if (storedSort) {
        currentSort = storedSort;
        DOM.sortSelect.value = currentSort;
    }

    setRandomQuote();
    updateFilterButtons();
    renderTasks();
}

// 카테고리 수동 변경 여부 추적 상태
let userChangedCategory = false;

DOM.categorySelect.addEventListener('change', () => {
    userChangedCategory = true;
});

// 이벤트 등록
DOM.addBtn.addEventListener('click', () => {
    addTask(DOM.taskInput.value);
    DOM.taskInput.value = '';
    userChangedCategory = false; // 추가 완료 시 초기화
});

DOM.taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addTask(DOM.taskInput.value);
        DOM.taskInput.value = '';
        userChangedCategory = false; // 추가 완료 시 초기화
    }
});

// 할 일 입력 중 키워드 감지하여 자동 분류
DOM.taskInput.addEventListener('input', (e) => {
    // 사용자가 직접 셀렉트를 바꿨다면 자동 분류를 중단
    if (userChangedCategory) return;
    
    const text = e.target.value;
    const detectedCategory = autoDetectCategory(text);
    if (detectedCategory) {
        DOM.categorySelect.value = detectedCategory;
    }
});

DOM.filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        currentFilter = e.target.dataset.filter;
        saveConfig();
        updateFilterButtons();
        renderTasks();
    });
});

DOM.themeToggle.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    document.documentElement.dataset.theme = isDarkMode ? 'dark' : 'light';
    DOM.themeToggle.textContent = isDarkMode ? '☀️' : '🌙';
    saveConfig();
});

// 검색 디바운싱
DOM.searchInput.addEventListener('input', debounce((e) => {
    searchQuery = e.target.value;
    renderTasks();
}, 250));

DOM.sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    saveConfig();
    renderTasks();
    if (currentSort === 'manual') showToast('드래그하여 항목의 위치를 수동으로 지정할 수 있습니다.');
});

DOM.clearCompletedBtn.addEventListener('click', () => {
    const completedTasksCount = tasks.filter(t => t.completed).length;
    if (completedTasksCount === 0) {
        showToast('삭제할 완료된 항목이 없습니다.');
        return;
    }
    
    if (confirm('완료된 항목을 모두 삭제하시겠습니까?')) {
        // 복구 지원 안됨을 명시
        tasks = tasks.filter(t => !t.completed);
        debouncedSaveTasks();
        renderTasks();
        showToast('완료된 항목이 모두 정리되었습니다.');
    }
});

// 내보내기/가져오기 이벤트
DOM.exportBtn.addEventListener('click', exportData);
DOM.importBtn.addEventListener('click', () => DOM.importInput.click());
DOM.importInput.addEventListener('change', handleImportFile);

// 키보드 단축키
window.addEventListener('keydown', (e) => {
    if (e.altKey) {
        switch(e.key.toLowerCase()) {
            case 'n': 
                e.preventDefault(); 
                DOM.taskInput.focus(); 
                break;
            case '1': 
                e.preventDefault(); 
                currentFilter = 'all'; saveConfig(); updateFilterButtons(); renderTasks(); 
                break;
            case '2': 
                e.preventDefault(); 
                currentFilter = 'work'; saveConfig(); updateFilterButtons(); renderTasks(); 
                break;
            case '3': 
                e.preventDefault(); 
                currentFilter = 'personal'; saveConfig(); updateFilterButtons(); renderTasks(); 
                break;
            case '4': 
                e.preventDefault(); 
                currentFilter = 'study'; saveConfig(); updateFilterButtons(); renderTasks(); 
                break;
            case 'd': 
                e.preventDefault(); 
                DOM.themeToggle.click(); 
                break;
        }
    }
});

// 1분마다 표시 시간 갱신 (진행 중 편집 방해 없이)
setInterval(() => {
    if (!editingId) renderTasks();
}, 60000);

// 앱 시작
init();
