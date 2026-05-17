const app = {
  currentTaskId: 1,
  completedTasks: new Set(),

  init() {
    this.cacheDOM();
    this.bindEvents();
    this.loadProgress();
    this.renderTaskList();
    this.loadTask(this.currentTaskId);
  },

  cacheDOM() {
    this.taskListEl = document.getElementById("taskList");
    this.taskTitleEl = document.getElementById("taskTitle");
    this.taskNumberEl = document.getElementById("taskNumber");
    this.taskDifficultyEl = document.getElementById("taskDifficulty");
    this.taskDescriptionEl = document.getElementById("taskDescription");
    this.codeEditor = document.getElementById("codeEditor");
    this.progressFill = document.getElementById("progressFill");
    this.progressText = document.getElementById("progressText");
    this.resultPanel = document.getElementById("resultPanel");
    this.resultIcon = document.getElementById("resultIcon");
    this.resultTitle = document.getElementById("resultTitle");
    this.resultMessage = document.getElementById("resultMessage");
    this.submitBtn = document.getElementById("submitBtn");
    this.errorToast = document.getElementById("errorToast");
  },

  bindEvents() {
    document.getElementById("submitBtn").addEventListener("click", () => this.submitCode());
    document.getElementById("clearBtn").addEventListener("click", () => this.clearCode());
    document.getElementById("nextTaskBtn").addEventListener("click", () => this.nextTask());
  },

  loadProgress() {
    const saved = localStorage.getItem("completedTasks");
    if (saved) {
      this.completedTasks = new Set(JSON.parse(saved));
    }
    const savedCurrent = localStorage.getItem("currentTaskId");
    if (savedCurrent) {
      this.currentTaskId = parseInt(savedCurrent, 10);
    }
  },

  saveProgress() {
    localStorage.setItem("completedTasks", JSON.stringify([...this.completedTasks]));
    localStorage.setItem("currentTaskId", this.currentTaskId.toString());
  },

  renderTaskList() {
    const tasks = getAllTasks();
    this.taskListEl.innerHTML = tasks.map(task => `
      <div class="task-item ${task.id === this.currentTaskId ? 'active' : ''} ${this.completedTasks.has(task.id) ? 'completed' : ''}"
           data-task-id="${task.id}">
        <div class="task-item-number">Задача ${task.id}</div>
        <div class="task-item-title">${task.title}</div>
      </div>
    `).join("");

    this.taskListEl.querySelectorAll(".task-item").forEach(item => {
      item.addEventListener("click", () => {
        this.loadTask(parseInt(item.dataset.taskId, 10));
      });
    });

    this.updateProgress();
  },

  updateProgress() {
    const tasks = getAllTasks();
    const completed = this.completedTasks.size;
    const total = tasks.length;
    const percent = Math.round((completed / total) * 100);
    this.progressFill.style.width = `${percent}%`;
    this.progressText.textContent = `${completed} из ${total} задач`;
  },

  loadTask(taskId) {
    const task = getTaskById(taskId);
    if (!task) return;

    this.currentTaskId = taskId;
    this.resultPanel.classList.remove("show");
    this.codeEditor.value = "";

    this.taskNumberEl.textContent = `Задача ${task.id}`;
    this.taskTitleEl.textContent = task.title;
    this.taskDifficultyEl.textContent = task.difficulty;
    this.taskDifficultyEl.className = `task-difficulty difficulty-${task.difficulty}`;
    this.taskDescriptionEl.innerHTML = this.formatDescription(task.description);

    this.renderTaskList();
    this.saveProgress();
  },

  formatDescription(text) {
    return text
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  },

  async submitCode() {
    const code = this.codeEditor.value.trim();
    if (!code) {
      this.showError("Введите код");
      return;
    }

    this.setLoading(true);

    try {
      const task = getTaskById(this.currentTaskId);
      const result = await verifyCode(task, code);
      this.showResult(result);
    } catch (error) {
      this.showError(`Ошибка: ${error.message}`);
    } finally {
      this.setLoading(false);
    }
  },

  showResult(result) {
    this.resultPanel.className = `result-panel show ${result.correct ? 'result-success' : 'result-error'}`;
    this.resultIcon.textContent = result.correct ? "✓" : "✗";
    this.resultTitle.textContent = result.correct ? "Верно!" : "Есть ошибки";

    let message = `<p>${result.feedback}</p>`;

    if (result.errors && result.errors.length > 0) {
      message += `<h4>Ошибки:</h4><ul>`;
      result.errors.forEach(err => message += `<li>${err}</li>`);
      message += `</ul>`;
    }

    if (result.hints && result.hints.length > 0) {
      message += `<h4>Подсказки:</h4><ul>`;
      result.hints.forEach(hint => message += `<li>${hint}</li>`);
      message += `</ul>`;
    }

    this.resultMessage.innerHTML = message;

    if (result.correct) {
      this.completedTasks.add(this.currentTaskId);
      this.updateProgress();
      this.saveProgress();
    }

    const nextBtn = document.getElementById("nextTaskBtn");
    nextBtn.style.display = (result.correct && this.currentTaskId < getAllTasks().length) ? "inline-flex" : "none";
  },

  clearCode() {
    this.codeEditor.value = "";
    this.resultPanel.classList.remove("show");
  },

  nextTask() {
    const tasks = getAllTasks();
    const idx = tasks.findIndex(t => t.id === this.currentTaskId);
    if (idx < tasks.length - 1) {
      this.loadTask(tasks[idx + 1].id);
    }
  },

  setLoading(loading) {
    this.submitBtn.disabled = loading;
    this.submitBtn.innerHTML = loading ? '⏳ Проверка...' : '✓ Проверить';
  },

  showError(msg) {
    this.errorToast.textContent = msg;
    this.errorToast.classList.add("show");
    setTimeout(() => this.errorToast.classList.remove("show"), 5000);
  }
};

document.addEventListener("DOMContentLoaded", () => app.init());