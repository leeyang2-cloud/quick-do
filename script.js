// [1] 데이터 및 상태 초기화
let todos = JSON.parse(localStorage.getItem('todos')) || [];
let currentFilter = '전체';

// [2] DOM 요소 선택
const todoInput = document.getElementById('todoInput');
const categorySelect = document.getElementById('categorySelect');
const addBtn = document.getElementById('addBtn');
const todoList = document.getElementById('todoList');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const filterBtns = document.querySelectorAll('.filter-btn');

// [3] 핵심 로직: 렌더링 함수
function render() {
    todoList.innerHTML = '';

    // 필터링 적용
    const filteredTodos = todos.filter(todo => {
        if (currentFilter === '전체') return true;
        return todo.category === currentFilter;
    });

    // 화면에 그리기
    filteredTodos.forEach(todo => {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.isCompleted ? 'completed' : ''}`;
        li.innerHTML = `
            <span class="tag tag-${todo.category}">${todo.category}</span>
            <div class="todo-content" onclick="toggleTodo(${todo.id})">
                <span class="todo-text">${todo.content}</span>
                <span class="todo-date">생성일: ${todo.date}</span>
            </div>
            <button class="delete-btn" onclick="deleteTodo(${todo.id})">✕</button>
        `;
        todoList.appendChild(li);
    });

    // 진행률 업데이트 (전체 데이터 기준)
    const completedCount = todos.filter(t => t.isCompleted).length;
    const totalCount = todos.length;
    const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    progressBar.style.width = percent + '%';
    progressText.innerText = `${percent}% 완료 (${completedCount}/${totalCount})`;
}

// [4] 할 일 추가 함수
function addTodo() {
    const content = todoInput.value.trim();
    if (!content) return;

    // 현재 날짜/시간 생성
    const now = new Date();
    const dateStr = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

    const newTodo = {
        id: Date.now(),
        content: content,
        category: categorySelect.value,
        date: dateStr,
        isCompleted: false
    };

    todos.push(newTodo);
    saveData();
    todoInput.value = '';
    render();
}

// [5] 상태 변경 및 삭제
window.toggleTodo = function (id) {
    todos = todos.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted } : t);
    saveData();
    render();
};

window.deleteTodo = function (id) {
    if (confirm('삭제할까요?')) {
        todos = todos.filter(t => t.id !== id);
        saveData();
        render();
    }
};

function saveData() {
    localStorage.setItem('todos', JSON.stringify(todos));
}

// [6] 이벤트 리스너: 필터 버튼
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // 버튼 스타일 토글
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 필터 변경 후 다시 그리기
        currentFilter = btn.getAttribute('data-filter');
        render();
    });
});

addBtn.addEventListener('click', addTodo);
todoInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTodo(); });

// 초기 실행
render();