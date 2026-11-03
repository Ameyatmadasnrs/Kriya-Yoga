// Yoga Application - Main JavaScript (Enhanced Premium Version)
// Multi-Course Configuration (Volume I & Volume II)
const COURSES = {
    course1: {
        id: 'course1',
        vol: 1,
        title: 'Вводный курс (Том I)',
        shortTitle: 'Том I',
        subtitle: 'Вводный курс',
        fullTitle: 'Древние тантрические техники йоги и крийи. Том I. Вводный курс',
        dataFile: 'data/book.json',
        positionsFile: 'data/image-positions.json',
        practicePlansFile: 'data/practice-plans.json',
        imageFolder: 'assets/images/',
        lessonsRange: 'Уроки 1–12'
    },
    course2: {
        id: 'course2',
        vol: 2,
        title: 'Продвинутый курс (Том II)',
        shortTitle: 'Том II',
        subtitle: 'Продвинутый курс',
        fullTitle: 'Древние тантрические техники йоги и крийи. Том II. Продвинутый курс',
        dataFile: 'data/book2.json',
        positionsFile: 'data/image-positions2.json',
        practicePlansFile: null,
        imageFolder: 'assets/images2/',
        lessonsRange: 'Уроки 13–24'
    }
};

class YogaApp {
    constructor() {
        this.currentCourse = localStorage.getItem('yogaApp_course') || 'course1';
        if (!COURSES[this.currentCourse]) this.currentCourse = 'course1';
        this.coursesData = { course1: null, course2: null };
        this.coursesImagePositions = { course1: [], course2: [] };
        this.data = null;
        this.imagePositions = [];
        this.practicePlans = null;
        this.currentLesson = null;
        this.currentTopic = null;
        this.bookmarks = [];
        this.favorites = [];
        this.readProgress = {};
        this.notes = {};
        this.highlights = {};
        this.sidebarOpen = true;
        this.modalReturnFocus = null;
        this.searchQuery = '';
        this.dailyStreak = 0;
        this.lastVisitDate = null;
        this.achievements = [];
        this.expandedLessons = new Set();
        this.theme = localStorage.getItem('yogaApp_theme') || 'normal';
        this.activeSelection = null;

        this.init();
    }

    async init() {
        try {
            await this.loadCourseData(this.currentCourse);
        } catch (error) {
            console.error('Error loading application data:', error);
            document.getElementById('contentArea').innerHTML = `
                <div class="page-content">
                    <h2>Не удалось загрузить материалы книги</h2>
                    <p>Запустите приложение через локальный веб-сервер и обновите страницу.</p>
                </div>`;
            return;
        }
        this.applyTheme();
        this.setupEventListeners();
        this.loadUserData();
        this.checkDailyStreak();
        this.updateCourseUI();
        this.renderLessonsList();
        const restored = await this.restoreActiveViewOnStartup();
        if (!restored) {
            this.showWelcomePage();
        }
        setTimeout(() => this.prefetchOtherCourseData(), 300);
    }

    async loadCourseData(courseId) {
        const courseConfig = COURSES[courseId] || COURSES.course1;
        const getJson = async (url, required = true) => {
            const response = await fetch(url);
            if (!response.ok) {
                if (!required) return null;
                throw new Error(`Не удалось загрузить ${url}: HTTP ${response.status}`);
            }
            return response.json();
        };

        if (!this.coursesData[courseId]) {
            const promises = [
                getJson(courseConfig.dataFile),
                getJson(courseConfig.positionsFile)
            ];
            if (courseConfig.practicePlansFile) {
                promises.push(getJson(courseConfig.practicePlansFile, false));
            } else {
                promises.push(Promise.resolve(null));
            }

            const [bookData, positionsData, practicePlans] = await Promise.all(promises);

            if (!bookData || !bookData.lessons) {
                throw new Error(`Файл ${courseConfig.dataFile} не содержит структуру уроков.`);
            }

            this.coursesData[courseId] = bookData;
            this.coursesImagePositions[courseId] = positionsData || [];
            if (practicePlans) this.practicePlans = practicePlans;
        }

        this.data = this.coursesData[courseId];
        this.imagePositions = this.coursesImagePositions[courseId];
        this.currentCourse = courseId;
        localStorage.setItem('yogaApp_course', courseId);

        const appTitleEl = document.getElementById('appTitle');
        if (appTitleEl) {
            appTitleEl.textContent = `Крийя Йога · ${courseConfig.shortTitle}`;
            appTitleEl.title = courseConfig.fullTitle;
        }
    }

    async prefetchOtherCourseData() {
        const otherId = this.currentCourse === 'course1' ? 'course2' : 'course1';
        if (!this.coursesData[otherId]) {
            try {
                const courseConfig = COURSES[otherId];
                const [bookData, positionsData] = await Promise.all([
                    fetch(courseConfig.dataFile).then(r => r.json()),
                    fetch(courseConfig.positionsFile).then(r => r.json())
                ]);
                this.coursesData[otherId] = bookData;
                this.coursesImagePositions[otherId] = positionsData || [];
            } catch (err) {
                console.warn('Could not prefetch other course:', err);
            }
        }
    }

    async switchCourse(courseId, targetLesson = null, targetTopic = null) {
        if (!COURSES[courseId]) return;
        await this.loadCourseData(courseId);
        this.updateCourseUI();
        this.renderLessonsList();

        if (targetLesson && targetTopic) {
            this.loadTopic(String(targetLesson), String(targetTopic));
        } else {
            this.showWelcomePage();
        }
    }

    updateCourseUI() {
        document.querySelectorAll('.course-tab').forEach(tab => {
            const isSelected = tab.dataset.course === this.currentCourse;
            tab.classList.toggle('active', isSelected);
            tab.setAttribute('aria-selected', String(isSelected));
        });
        const appTitleEl = document.getElementById('appTitle');
        if (appTitleEl && COURSES[this.currentCourse]) {
            appTitleEl.textContent = `Крийя Йога · ${COURSES[this.currentCourse].shortTitle}`;
        }
    }

    checkDailyStreak() {
        const today = new Date().toDateString();
        const lastVisit = localStorage.getItem('yogaApp_lastVisit');

        if (lastVisit) {
            const lastDate = new Date(lastVisit);
            const diffDays = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                this.dailyStreak = parseInt(localStorage.getItem('yogaApp_streak') || '0') + 1;
            } else if (diffDays > 1) {
                this.dailyStreak = 1;
            } else {
                this.dailyStreak = parseInt(localStorage.getItem('yogaApp_streak') || '1');
            }
        } else {
            this.dailyStreak = 1;
        }

        localStorage.setItem('yogaApp_lastVisit', new Date().toISOString());
        localStorage.setItem('yogaApp_streak', this.dailyStreak.toString());

        // Check achievements
        this.checkAchievements();
    }

    checkAchievements() {
        const achievementChecks = [
            { id: 'first_lesson', name: 'Первый шаг', desc: 'Начните первый урок', check: () => Object.keys(this.readProgress).length >= 1 },
            { id: 'five_topics', name: 'Исследователь', desc: 'Пройдите 5 тем', check: () => Object.keys(this.readProgress).length >= 5 },
            { id: 'ten_topics', name: 'Ученик', desc: 'Пройдите 10 тем', check: () => Object.keys(this.readProgress).length >= 10 },
            { id: 'streak_3', name: 'Постоянный', desc: '3 дня подряд', check: () => this.dailyStreak >= 3 },
            { id: 'streak_7', name: 'Преданный', desc: '7 дней подряд', check: () => this.dailyStreak >= 7 },
            { id: 'all_lessons', name: 'Мастер', desc: 'Все уроки пройдены', check: () => {
                const totalTopics = Object.values(this.data.lessons).reduce(
                    (total, lesson) => total + Object.keys(lesson.topics).length, 0
                );
                return Object.keys(this.readProgress).length >= totalTopics;
            } }
        ];

        const savedAchievements = JSON.parse(localStorage.getItem('yogaApp_achievements') || '[]');

        for (const achievement of achievementChecks) {
            if (!savedAchievements.includes(achievement.id) && achievement.check()) {
                savedAchievements.push(achievement.id);
                this.achievements = savedAchievements;
                this.showToast(`🏆 Достижение: ${achievement.name}!`);
            }
        }

        this.achievements = savedAchievements;
        localStorage.setItem('yogaApp_achievements', JSON.stringify(this.achievements));
    }

    setupEventListeners() {
        // Theme toggle
        document.querySelectorAll('.course-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const courseId = tab.dataset.course;
                if (courseId && courseId !== this.currentCourse) {
                    this.switchCourse(courseId);
                }
            });
        });

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

        // Menu toggle
        document.getElementById('menuToggle').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('sidebarOverlay').addEventListener('click', () => this.closeSidebar());

        // App title click returns to welcome page
        document.getElementById('appTitle')?.addEventListener('click', () => this.showWelcomePage());

        // Debounced scroll listener to save reading position per volume
        let scrollTimer = null;
        window.addEventListener('scroll', () => {
            if (!this.currentLesson || !this.currentTopic) return;
            if (scrollTimer) clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => this.saveLastReadPosition(), 350);
        }, { passive: true });
        window.addEventListener('beforeunload', () => this.saveLastReadPosition());

        // Header buttons
        document.getElementById('searchBtn').addEventListener('click', () => this.openModal('searchModal'));
        document.getElementById('bookmarksBtn').addEventListener('click', () => this.showBookmarks());
        document.getElementById('favoritesBtn').addEventListener('click', () => this.showFavorites());
        document.getElementById('progressBtn').addEventListener('click', () => this.showProgress());

        // Modal close buttons
        document.getElementById('closeSearch').addEventListener('click', () => this.closeModal('searchModal'));
        document.getElementById('closeBookmarks').addEventListener('click', () => this.closeModal('bookmarksModal'));
        document.getElementById('closeFavorites').addEventListener('click', () => this.closeModal('favoritesModal'));
        document.getElementById('closeProgress').addEventListener('click', () => this.closeModal('progressModal'));
        document.getElementById('closeNotes').addEventListener('click', () => this.closeModal('notesModal'));

        // Search functionality
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => this.performSearch(e.target.value));

        // Close modals on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // Floating selection bookmark button
        const popoverBtn = document.getElementById('popoverBookmarkBtn');
        if (popoverBtn) {
            popoverBtn.addEventListener('mousedown', (e) => {
                // Prevent mousedown from clearing the selection before click fires
                e.preventDefault();
            });
            popoverBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.bookmarkSelectedText();
            });
        }

        // Comprehensive selection detection: debounced selectionchange + mouseup/touchend/pointerup
        let selectionTimeout = null;
        const triggerSelectionCheck = (delay = 40) => {
            if (selectionTimeout) clearTimeout(selectionTimeout);
            selectionTimeout = setTimeout(() => this.handleTextSelection(), delay);
        };

        document.addEventListener('selectionchange', () => triggerSelectionCheck(60));
        document.addEventListener('mouseup', () => triggerSelectionCheck(20));
        document.addEventListener('touchend', () => triggerSelectionCheck(40));
        document.addEventListener('pointerup', () => triggerSelectionCheck(20));
        document.addEventListener('keyup', (e) => {
            if (e.key === 'Shift' || e.key.startsWith('Arrow')) {
                triggerSelectionCheck(30);
            } else if (e.key === 'Escape') {
                this.hideSelectionPopover();
            }
        });

        // Hide popover if clicking outside
        document.addEventListener('mousedown', (e) => {
            if (!e.target.closest('#selectionBookmarkPopover')) {
                if (!e.target.closest('#bookmarksBtn') && !e.target.closest('#bookmarksModal')) {
                    setTimeout(() => {
                        const sel = window.getSelection();
                        if (!sel || sel.isCollapsed) {
                            this.hideSelectionPopover();
                        }
                    }, 50);
                }
            }
        });

        // Reposition smoothly on scroll instead of instantly hiding
        window.addEventListener('scroll', () => {
            if (this.activeSelection) {
                this.repositionSelectionPopover();
            }
        }, { passive: true });

        window.addEventListener('resize', () => {
            const sidebar = document.getElementById('sidebar');
            const mainContent = document.getElementById('mainContent');
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('collapsed');
                mainContent.classList.remove('expanded');
                this.closeSidebar();
            } else {
                sidebar.classList.remove('show');
                document.getElementById('sidebarOverlay').classList.remove('show');
                document.body.classList.remove('sidebar-open');
                this.sidebarOpen = !sidebar.classList.contains('collapsed');
                document.getElementById('menuToggle').setAttribute('aria-expanded', String(this.sidebarOpen));
                document.getElementById('menuToggle').setAttribute('aria-label', this.sidebarOpen ? 'Свернуть меню уроков' : 'Открыть меню уроков');
            }
        });
        if (window.innerWidth <= 768) this.closeSidebar();

        // Escape closes the active dialog; Tab remains inside it until it is closed.
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.querySelector('.modal.show');
                if (modal) this.closeModal(modal.id);
                else if (document.getElementById('sidebar').classList.contains('show')) this.closeSidebar();
                return;
            }

            if (e.key === 'Tab') {
                const modal = document.querySelector('.modal.show .modal-content');
                if (!modal) return;
                const focusable = [...modal.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
                    .filter(element => element.offsetParent !== null);
                if (!focusable.length) {
                    e.preventDefault();
                    modal.focus();
                    return;
                }
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');

        if (window.innerWidth <= 768) {
            const open = !sidebar.classList.contains('show');
            sidebar.classList.toggle('show', open);
            document.getElementById('sidebarOverlay').classList.toggle('show', open);
            document.body.classList.toggle('sidebar-open', open);
            this.sidebarOpen = open;
        } else {
            const collapsed = !sidebar.classList.contains('collapsed');
            sidebar.classList.toggle('collapsed', collapsed);
            mainContent.classList.toggle('expanded', collapsed);
            this.sidebarOpen = !collapsed;
        }
        document.getElementById('menuToggle').setAttribute('aria-expanded', String(this.sidebarOpen));
        document.getElementById('menuToggle').setAttribute('aria-label', this.sidebarOpen ? 'Свернуть меню уроков' : 'Открыть меню уроков');
    }

    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.remove('show');
        document.getElementById('sidebarOverlay').classList.remove('show');
        document.body.classList.remove('sidebar-open');
        this.sidebarOpen = false;
        document.getElementById('menuToggle').setAttribute('aria-expanded', 'false');
        document.getElementById('menuToggle').setAttribute('aria-label', 'Открыть меню уроков');
    }

    toggleTheme() {
        this.theme = this.theme === 'normal' ? 'vedic' : 'normal';
        localStorage.setItem('yogaApp_theme', this.theme);
        this.applyTheme();
    }

    applyTheme() {
        if (this.theme === 'vedic') {
            document.body.classList.add('vedic-theme');
        } else {
            document.body.classList.remove('vedic-theme');
        }
    }

    renderLessonsList() {
        const container = document.getElementById('lessonsList');
        container.innerHTML = '';

        // Sort lessons numerically
        const sortedLessons = Object.entries(this.data.lessons)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

        for (const [lessonNum, lesson] of sortedLessons) {
            const lessonEl = document.createElement('div');
            const isExpanded = this.expandedLessons.has(lessonNum);
            lessonEl.className = `lesson-item ${isExpanded ? 'expanded' : 'collapsed'} ${this.currentLesson === lessonNum ? 'active' : ''}`;
            lessonEl.dataset.lesson = lessonNum;

            // Sort topics numerically
            const sortedTopics = Object.entries(lesson.topics)
                .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

            lessonEl.innerHTML = `
                <button type="button" class="lesson-title" aria-expanded="${isExpanded}" aria-controls="topics-${lessonNum}">Урок ${lessonNum}</button>
                <ul class="topic-list" id="topics-${lessonNum}">
                    ${sortedTopics.map(([topicNum, topic]) => `
                        <li>
                            <button type="button" class="topic-item ${this.currentLesson === lessonNum && this.currentTopic === topicNum ? 'active' : ''}"
                                data-lesson="${lessonNum}" data-topic="${topicNum}"
                                ${this.currentLesson === lessonNum && this.currentTopic === topicNum ? 'aria-current="page"' : ''}>
                                Тема ${topicNum}: ${topic.name}
                            </button>
                        </li>
                    `).join('')}
                </ul>
            `;

            // Toggle expansion on title click
            lessonEl.querySelector('.lesson-title')?.addEventListener('click', (e) => {
                e.stopPropagation();
                const currentlyExpanded = this.expandedLessons.has(lessonNum);
                if (currentlyExpanded) {
                    this.expandedLessons.delete(lessonNum);
                    lessonEl.classList.remove('expanded');
                    lessonEl.classList.add('collapsed');
                    lessonEl.querySelector('.lesson-title').setAttribute('aria-expanded', 'false');
                } else {
                    this.expandedLessons.add(lessonNum);
                    lessonEl.classList.add('expanded');
                    lessonEl.classList.remove('collapsed');
                    lessonEl.querySelector('.lesson-title').setAttribute('aria-expanded', 'true');
                }
            });

            container.appendChild(lessonEl);
        }

        // Add click handlers for topics
        container.querySelectorAll('.topic-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const lesson = item.dataset.lesson;
                const topic = item.dataset.topic;
                this.loadTopic(lesson, topic);

                // Close sidebar on mobile
                if (window.innerWidth <= 768) {
                    this.closeSidebar();
                }
            });
        });
    }

    loadTopic(lessonNum, topicNum) {
        this.hideSelectionPopover();
        this.activeSelection = null;
        this.currentLesson = lessonNum;
        this.currentTopic = topicNum;

        const lesson = this.data.lessons[lessonNum];
        if (!lesson || !lesson.topics[topicNum]) {
            console.error('Topic not found:', lessonNum, topicNum);
            return;
        }

        // Ensure lesson is expanded
        this.expandedLessons.add(lessonNum);

        const topic = lesson.topics[topicNum];
        this.renderLessonsList(); // Refresh nav to show active and expanded states
        this.renderTopic(lessonNum, topicNum, topic);
        this.updateReadingProgress(lessonNum, topicNum);
    }

    renderTopic(lessonNum, topicNum, topic = null) {
        topic = topic || this.data.lessons[lessonNum]?.topics[topicNum];
        if (!topic) return;
        this.currentLesson = String(lessonNum);
        this.currentTopic = String(topicNum);
        const contentArea = document.getElementById('contentArea');

        // Check if this is a practice program topic
        let formattedContent = '';
        const isPracticePlan = topic.name.toLowerCase().includes('программа ежедневных занятий');

        if (isPracticePlan && this.practicePlans && this.practicePlans[lessonNum]) {
            formattedContent = this.renderPracticePlanHtml(lessonNum);
        } else {
            // Format the text content with smart image placement based on PDF layout
            formattedContent = this.formatContent(topic.text, topic.start_page);
        }

        const isBookmarked = this.bookmarks.some(b => (b.course || 'course1') === this.currentCourse && String(b.lesson) === String(lessonNum) && String(b.topic) === String(topicNum));
        const isFavorite = this.favorites.some(f => (f.course || 'course1') === this.currentCourse && String(f.lesson) === String(lessonNum) && String(f.topic) === String(topicNum));

        contentArea.innerHTML = `
            <div class="page-header topic-page-header">
                <div class="lesson-kicker">Урок ${lessonNum}</div>
                <div class="page-heading-group">
                    <h1>${topic.name}</h1>
                    <div class="subtitle">Тема ${topicNum}</div>
                    <div class="content-actions top-actions">
                        <button class="action-btn ${isBookmarked ? 'active' : ''}" onclick="app.toggleBookmark('${lessonNum}', '${topicNum}')" type="button">
                            ${isBookmarked ? '⭐ Закладка' : '🔖 Добавить закладку'}
                        </button>
                        <button class="action-btn ${isFavorite ? 'active' : ''}" onclick="app.toggleFavorite('${lessonNum}', '${topicNum}')" type="button">
                            ${isFavorite ? '❤️ В избранном' : '🤍 В избранное'}
                        </button>
                    </div>
                </div>
            </div>

            <div class="page-content">
                ${formattedContent}
            </div>

            <div class="page-number">Тема ${topicNum} из ${Object.keys(this.data.lessons[lessonNum].topics).length}</div>

            <div class="content-actions">
                <button class="action-btn ${isBookmarked ? 'active' : ''}" onclick="app.toggleBookmark('${lessonNum}', '${topicNum}')" type="button">
                    ${isBookmarked ? '⭐ Закладка' : '🔖 Добавить закладку'}
                </button>
                <button class="action-btn ${isFavorite ? 'active' : ''}" onclick="app.toggleFavorite('${lessonNum}', '${topicNum}')" type="button">
                    ${isFavorite ? '❤️ В избранном' : '🤍 В избранное'}
                </button>
            </div>

            <div class="content-nav">
                <button class="nav-btn" id="prevBtn">← Назад</button>
                <button class="nav-btn" id="nextBtn">Вперед →</button>
            </div>
        `;

        // Setup navigation
        document.getElementById('prevBtn').addEventListener('click', () => this.navigateTopic(-1));
        document.getElementById('nextBtn').addEventListener('click', () => this.navigateTopic(1));

        // Reset both possible scroll containers after replacing the page, then
        // align the actual topic heading below the sticky toolbar.
        const mainContent = document.getElementById('mainContent');
        const topicHeading = contentArea.querySelector('.topic-page-header');
        mainContent.scrollTop = 0;
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        requestAnimationFrame(() => {
            topicHeading?.scrollIntoView({ block: 'start', behavior: 'instant' });
        });
    }

    async navigateTopic(direction) {
        const lessonNum = this.currentLesson;
        const topicNum = parseInt(this.currentTopic);
        const lesson = this.data.lessons[lessonNum];
        if (!lesson) return;
        const topicKeys = Object.keys(lesson.topics).map(Number).sort((a, b) => a - b);
        const currentIndex = topicKeys.indexOf(topicNum);
        const newIndex = currentIndex + direction;

        if (newIndex >= 0 && newIndex < topicKeys.length) {
            this.loadTopic(lessonNum, topicKeys[newIndex].toString());
        } else if (direction < 0 && currentIndex === 0) {
            const lessonKeys = Object.keys(this.data.lessons).map(Number).sort((a, b) => a - b);
            const currentLessonIdx = lessonKeys.indexOf(parseInt(lessonNum));
            if (currentLessonIdx > 0) {
                const prevLessonNum = lessonKeys[currentLessonIdx - 1].toString();
                const prevLesson = this.data.lessons[prevLessonNum];
                const lastTopic = Math.max(...Object.keys(prevLesson.topics).map(Number));
                this.loadTopic(prevLessonNum, lastTopic.toString());
            } else if (this.currentCourse === 'course2') {
                await this.switchCourse('course1', '12', '6');
            }
        } else if (direction > 0 && currentIndex === topicKeys.length - 1) {
            const lessonKeys = Object.keys(this.data.lessons).map(Number).sort((a, b) => a - b);
            const currentLessonIdx = lessonKeys.indexOf(parseInt(lessonNum));
            if (currentLessonIdx < lessonKeys.length - 1) {
                const nextLessonNum = lessonKeys[currentLessonIdx + 1].toString();
                const nextLesson = this.data.lessons[nextLessonNum];
                const firstTopic = Math.min(...Object.keys(nextLesson.topics).map(Number));
                this.loadTopic(nextLessonNum, firstTopic.toString());
            } else if (this.currentCourse === 'course1') {
                await this.switchCourse('course2', '13', '1');
            }
        }
    }

    /**
     * Renders structured practice plan as a visual UI
     */
    renderPracticePlanHtml(lessonNum) {
        const lessonPlan = this.practicePlans[lessonNum];
        if (!lessonPlan) return '<p>Программа занятий не найдена.</p>';

        let html = `
            <div class="practice-plan-container">
                <div class="practice-intro">
                    На этом этапе крайне важно придерживаться регулярной практики.
                    Ниже приведены структурированные программы занятий, составленные на основе рекомендаций из книги.
                </div>
        `;

        lessonPlan.programs.forEach((prog, idx) => {
            html += `
                <div class="practice-program-card">
                    <div class="program-header">
                        <h3>${prog.name}</h3>
                        <span class="program-duration">⏱ ${prog.duration}</span>
                    </div>
                    <div class="practice-table-wrapper">
                        <table class="practice-table">
                            <thead>
                                <tr>
                                    <th>Практика</th>
                                    <th>Повторения</th>
                                    <th>Мин.</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            prog.items.forEach((item, itemIdx) => {
                html += `
                    <tr class="practice-row" data-duration="${item.minutes}">
                        <td class="practice-name">
                            <span class="practice-order">${String(itemIdx + 1).padStart(2, '0')}</span>
                            ${item.practice}
                        </td>
                        <td class="practice-reps">${item.reps}</td>
                        <td class="practice-mins">${item.minutes}</td>
                    </tr>
                `;
            });

            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        return html;
    }

    /**
     * Formats book text into HTML, dynamically inserting images from image-positions.json
     * using text anchors for precise placement.
     */
    formatContent(text, startPage = 0) {
        if (!text) return '';

        // Get precise positions for images in this topic
        const relevantPositions = this.imagePositions.filter(pos =>
            String(pos.lesson) === String(this.currentLesson) &&
            String(pos.topic) === String(this.currentTopic)
        ).sort((a, b) => a.pdf_page - b.pdf_page || a.image_filename.localeCompare(b.image_filename));

        // Split text by PDF page markers: \n(\d+)\n
        const parts = text.split(/\n(\d+)\n/);

        let htmlResult = '';
        let placedImages = new Set();
        let firstContentParagraph = true;
        const topicData = this.data.lessons[this.currentLesson]?.topics[this.currentTopic];
        const topicNameKey = topicData?.name
            ?.toLocaleLowerCase('ru')
            .replace(/[^а-яёa-z0-9]/g, '') || '';
        const headingKey = value => value
            .toLocaleLowerCase('ru')
            .replace(/[^а-яёa-z0-9]/g, '');

        // These labels occur as standalone OCR lines throughout the source.
        // Keep their wording intact and restore their role in the book hierarchy.
        const sectionHeadings = new Set([
            'поза', 'подготовка', 'исходное положение', 'положение',
            'техника выполнения', 'выполнение', 'дыхание', 'осознание',
            'последовательность', 'продолжительность занятий',
            'дыхание осознание и продолжительность', 'польза практики',
            'благотворное действие', 'ограничения и предосторожности',
            'противопоказания', 'примечания', 'примечание', 'внимание', 'рекомендации',
            'оборудование', 'функции носа', 'резюме', 'ограничения',
            'последовательность выполнения', 'последовательность и время занятий',
            'осознание и продолжительность', 'дыхание и осознание',
            'общие советы', 'польза', 'полезное действие', 'приготовление воды',
            'время и частота выполнения', 'ошибки которых следует избегать',
            'меры предосторожности', 'место и время', 'развитие осознания',
            'определение', 'заключение', 'движение и укрывание', 'желудок',
            'дополнительные подробности', 'упоминания в древних текстах',
            'различные методы регулирования праны', 'анатомия', 'мантра',
            'словесные инструкции', 'положение тела', 'начальное положение',
            'конечное положение', 'основные положения', 'ограничения и противопоказания',
            'приготовления', 'количество повторений',
            'терминология', 'упоминания в текстах', 'атрибуты', 'обоснование',
            'варианты', 'правила', 'важные правила', 'физиология', 'символика',
            'советы', 'дополнительные замечания', 'предостережение',
            'практические указания', 'время занятий', 'частота занятий',
            'время и частота занятий', 'продолжительность',
            'подготовка к другим практикам', 'осознание и дыхание',
            'основная техника', 'характеристики чакр', 'практика'
        ].map(headingKey));

        // Exercise names and image captions already present in the book data are
        // safe heading candidates only when they occupy a complete source line.
        const exerciseHeadings = new Set();
        Object.values(this.data.lessons || {}).forEach(lesson => {
            Object.values(lesson.topics || {}).forEach(item => {
                if (item.name) exerciseHeadings.add(headingKey(item.name));
            });
        });
        this.imagePositions.forEach(pos => {
            const caption = String(pos.caption || '').trim();
            if (!caption || /^логотип\s*:/i.test(caption)) return;
            exerciseHeadings.add(headingKey(caption));
            exerciseHeadings.add(headingKey(caption.split('(')[0]));
            exerciseHeadings.add(headingKey(caption.replace(/^техника выполнения\s+/i, '')));
            exerciseHeadings.add(headingKey(caption.replace(/\s*\([^)]*\)\s*$/, '')));
        });

        // Some repeated page headers contain OCR differences from the topic
        // metadata. Repetition at page boundaries is enough to identify them as
        // scan furniture without guessing or changing the underlying wording.
        const pageHeaderCounts = new Map();
        Object.values(this.data.lessons[this.currentLesson]?.topics || {}).forEach(item => {
            const sourceText = item.text || '';
            for (const match of sourceText.matchAll(/\n\d{1,4}\n\s*(Урок\s+\d+\.\s*[^\n]{2,120})/gi)) {
                const key = headingKey(match[1]);
                pageHeaderCounts.set(key, (pageHeaderCounts.get(key) || 0) + 1);
            }
        });

        const isPageRunningHeader = value => {
            const match = value.trim().match(/^Урок\s+(\d+)\.\s*(.+)$/i);
            if (!match) return false;
            if ((pageHeaderCounts.get(headingKey(value)) || 0) >= 2) return true;
            const lesson = this.data.lessons[match[1]];
            return Object.values(lesson?.topics || {}).some(item =>
                headingKey(item.name || '') === headingKey(match[2])
            );
        };

        const isStageHeading = line => {
            const trimmed = line.trim();
            if (trimmed.length > 90 || /[.!?…][»”"')\]]?$/.test(trimmed)) return false;
            return /^(?:[а-яёa-z0-9\s–—\-]+[:–—\-]\s*)?(?:упражнение|вариант|этап|стадия|часть|движение|позиция|положение)\s*\d+(?:.*)?$/i.test(trimmed);
        };

        const isSectionHeading = line => {
            const normalized = headingKey(line);
            return sectionHeadings.has(normalized) || isStageHeading(line);
        };

        const isShlokaOrQuote = str => {
            const s = str.trim();
            if (!s) return false;
            if (/^«[^»]{10,800}»(?:\s*\([^)]+\))?\.?$/.test(s)) return true;
            if (s.length < 450 && /(?:валока|шлока|стих|гл\.|глава)\s*\d+/i.test(s)) return true;
            if (s.length < 350 && /(?:Хеваджра\s*Тантра|Бхагавадгита|Упанишад|Катха\s*упанишада|Хатха\s*[-–—]?\s*йога\s*прадипика|Гхеранда\s*самхита|Шива\s*самхита|Мф\.\s*\d+|Ин\.\s*\d+)/i.test(s)) return true;
            return false;
        };

        const escapeText = value => value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // These splits were checked against the source PDF. Join only these
        // confirmed line-wrap fragments in rendered text; keep book data intact.
        const knownLineWrapSplits = new Set([
            'автома тически', 'бес сознательный', 'био плазменное',
            'биолюми несценции', 'бо лее', 'бо лезнях',
            'бы тия', 'быва ет', 'важ ные',
            'ви дим', 'внеш нем', 'внутрен ней',
            'внутрен ний', 'во прос', 'возмож но',
            'воспользовать ся', 'вспы шек', 'встречавшее ся',
            'вы дох', 'вы сокое', 'выпол нения',
            'выс шим', 'высо ким', 'го ловы',
            'гото вы', 'движе нии', 'де лая',
            'дей ствуют', 'дейст вия', 'действи тельности',
            'действо вать', 'до стичь', 'ежеднев но',
            'за метите', 'за нятие', 'заболевания ми',
            'зависимос ти', 'заме нить', 'зре ния',
            'йо га', 'йо ге', 'каж дый',
            'кни ги', 'ко лено', 'ко нец',
            'ко торой', 'ко торые', 'коленя ми',
            'конкрет но', 'кото рые', 'край ней',
            'лю дей', 'мед ленно', 'менструаль ных',
            'ми зинец', 'мож но', 'на правлены',
            'на пример', 'наблюдате лем', 'наклоняй те',
            'напри мер', 'неестест венно', 'некото рым',
            'необходи мую', 'непосредственно го', 'нормаль ное',
            'об ласти', 'об ратной', 'облегче ния',
            'образу ет', 'объек ты', 'ограничен ной',
            'одно временно', 'одновремен но', 'ожи дать',
            'ор ганизмом', 'особенно сти', 'осозна нием',
            'от вет', 'от личаются', 'оттачива ется',
            'очи щенной', 'переста ли', 'перечислен ных',
            'по верхностью', 'по рождается', 'по скольку',
            'поверни те', 'под готовкой', 'под держания',
            'покоит ся', 'пол ностью', 'последст вия',
            'постепен но', 'пото му', 'пра вая',
            'пра вую', 'пре пятствовать', 'превраще ния',
            'при держиваться', 'приветству ют', 'про цедуре',
            'про центов', 'про явлением', 'проведе ния',
            'работа ют', 'раздели ли', 'рас слабление',
            'расслабля ет', 'сде лать', 'скован ности',
            'сле дующий', 'слы шали', 'сможе те',
            'со гнув', 'составля ет', 'состо яние',
            'спи не', 'спо собны', 'становить ся',
            'сти муляции', 'су ществует', 'сущест вует',
            'те ло', 'тем ноты', 'то го',
            'умст венной', 'упраж нение', 'упражне нии',
            'ус мотрение', 'факто ром', 'целеустремленнос тью',
            'чашеч кой', 'чрезмер но', 'энтузиаз мом',
            'это го', 'эф фективно'
        ]);
        // These additional splits were confirmed at printed-page boundaries
        // in the source PDF. Keep them page-scoped so ordinary phrases such as
        // «что бы» elsewhere in the book are never joined by a broad rule.
        const knownPageWrapSplits = new Set([
            'предва рительная', 'энергети ческий', 'воспроиз водства',
            'элект рических', 'психи ческих', 'предосторож ности',
            'выпол няется', 'пола гаем', 'есте ственная', 'предла гать',
            'сосредото чиваться', 'пере живать', 'фено мены',
            'взаи модействии', 'устанавли вается', 'что бы',
            'испыты вали', 'подав ляйте', 'психоло гически',
            'соответ ствует', 'обеспе чивает', 'потра тили',
            'пред ставление', 'со ответствующий', 'од ной',
            'тка ней', 'силь ную', 'необходи мость',
            'слаби тельных', 'реко мендовал', 'происхо дит',
            'сред ства', 'оказыва ется', 'по вышают',
            'бо лезни', 'настоя щими'
        ]);
        const joinWrappedLines = lines => {
            let text = '';
            lines.flatMap(line => String(line).split('\n')).forEach(line => {
                let next = line.trim();
                if (!next) return;
                const left = text.match(/([А-Яа-яЁё]+)[-–—]?$/);
                const right = next.match(/^([А-Яа-яЁё]+)(?=[^А-Яа-яЁё]|$)/);
                const splitKey = left && right
                    ? `${left[1].toLocaleLowerCase('ru')} ${right[1].toLocaleLowerCase('ru')}`
                    : '';
                if (splitKey && knownLineWrapSplits.has(splitKey)) {
                    text = text.slice(0, -left[1].length).replace(/[-–—]$/, '') + left[1] + right[1];
                    next = next.slice(right[1].length).trimStart();
                } else if (/[-–—]$/.test(text) && right) {
                    text = text.replace(/[-–—]$/, '') + right[1];
                    next = next.slice(right[1].length).trimStart();
                }
                if (next) text += `${text && !/^[,.;:!?)]/.test(next) ? ' ' : ''}${next}`;
            });
            return text.replace(/\s+/g, ' ').trim();
        };

        let paraIndex = 0;
        const renderParagraph = (sourceParagraph, isSequentialShort = false) => {
            const lines = sourceParagraph.split('\n').map(line => line.trim()).filter(Boolean);
            if (!lines.length) return '';

            const output = [];
            let bodyLines = [];
            let listItems = [];
            let bulletItems = [];

            const flushBullets = () => {
                if (!bulletItems.length) return;
                output.push(`<ul data-para-id="p-${paraIndex++}">${bulletItems.map(item => `<li>${escapeText(joinWrappedLines([item]))}</li>`).join('')}</ul>`);
                bulletItems = [];
            };
            const flushList = () => {
                if (!listItems.length) return;
                output.push(`<ol data-para-id="p-${paraIndex++}">${listItems.map(item => `<li>${escapeText(joinWrappedLines([item]))}</li>`).join('')}</ol>`);
                listItems = [];
            };
            const flushBody = () => {
                if (!bodyLines.length) return;
                const body = joinWrappedLines(bodyLines);
                if (body) {
                    const pid = `p-${paraIndex++}`;
                    if (isShlokaOrQuote(body)) {
                        output.push(`<blockquote class="shloka-quote" data-para-id="${pid}">${escapeText(body)}</blockquote>`);
                    } else {
                        const isCompact = isSequentialShort && body.length < 75;
                        output.push(`<p${isCompact ? ' class="compact-p"' : ''} data-para-id="${pid}">${escapeText(body)}</p>`);
                    }
                }
                bodyLines = [];
            };

            lines.forEach(line => {
                const normalized = headingKey(line);
                const isStage = isStageHeading(line);
                const isSection = isSectionHeading(line) && !/[.!?…][»”"')\]]?$/.test(line.trim());
                const isExercise = exerciseHeadings.has(normalized);
                const isPrintedTopicHeading = /^Урок\s+\d+\.\s*\S/i.test(line)
                    || /(?:\.\s*){2,}/.test(line);
                const isCapsHeading = line.length < 100
                    && /[А-ЯЁ]/.test(line)
                    && line === line.toLocaleUpperCase('ru')
                    && /[А-ЯЁ]/.test(line.replace(/[\d\s.\-–—]/g, ''));

                if (isSection || isExercise || isPrintedTopicHeading || isCapsHeading) {
                    flushBullets();
                    flushList();
                    flushBody();
                    const pid = `p-${paraIndex++}`;
                    if (isStage) {
                        output.push(`<h4 class="stage-heading" data-para-id="${pid}">${escapeText(line)}</h4>`);
                    } else if (isSection) {
                        output.push(`<h4 data-para-id="${pid}">${escapeText(line)}</h4>`);
                    } else {
                        output.push(`<h3 data-para-id="${pid}">${escapeText(line)}</h3>`);
                    }
                    return;
                }

                const bulletItem = line.match(/^[-–—*•]\s+(.+)$/);
                if (bulletItem) {
                    flushList();
                    flushBody();
                    bulletItems.push(bulletItem[1]);
                    return;
                } else if (bulletItems.length) {
                    flushBullets();
                }

                const numberedItem = line.match(/^\d+[.)]\s+(.+)$/);
                if (numberedItem) {
                    flushBullets();
                    flushBody();
                    listItems.push(numberedItem[1]);
                } else if (listItems.length) {
                    const startsNewParagraph = /^(?:Эти|Все|Кроме того|В целом|В результате|Поэтому|Однако|Теперь|На самом деле|В данном случае|Именно|Существуют|Процедура|Начинайте|Не следует)(?:\s|$)/.test(line);
                    if (startsNewParagraph) {
                        flushList();
                        bodyLines.push(line);
                    } else {
                        listItems[listItems.length - 1] += `\n${line}`;
                    }
                } else {
                    bodyLines.push(line);
                }
            });

            flushBullets();
            flushList();
            flushBody();
            return output.join('');
        };

        const pageSegments = [];
        for (let i = 0; i < parts.length; i += 2) {
            let segmentText = parts[i];
            if (!segmentText?.trim()) continue;

            const pageNumber = i > 0 ? Number(parts[i - 1]) : null;
            const topFootnotes = [];

            // Source-page headers are repeated scan furniture, not part of
            // the lesson. Remove only metadata-backed or repeated headings at
            // the beginning of a page segment; leave book JSON untouched.
            if (i > 0) {
                const lines = segmentText.split('\n');
                let atPageTop = true;
                const filteredLines = [];
                for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                    const value = lines[lineIndex].trim();
                    if (!value) {
                        if (!atPageTop) filteredLines.push(lines[lineIndex]);
                        continue;
                    }
                    if (atPageTop && (isPageRunningHeader(value)
                        || headingKey(value) === headingKey('Йога и крийя. Вводный курс') || headingKey(value) === headingKey('Йога и крийя. Продвинутый курс'))) {
                        continue;
                    }
                    atPageTop = false;
                    filteredLines.push(lines[lineIndex]);
                }

                // Footnotes printed in the footer of the source page often end up
                // at the very top of the OCR segment following the page marker,
                // cutting across body sentences and word-wraps. Extract them so
                // the body continues cleanly, and place them as dedicated footnotes.
                while (filteredLines.length > 0) {
                    const firstLine = filteredLines[0].trim();
                    if (!firstLine.startsWith('*')) break;
                    let endIdx = 0;
                    while (endIdx < filteredLines.length) {
                        const val = filteredLines[endIdx].trim();
                        if (!val) break;
                        if (/\((?:ред|ред\.)\)\.?$/.test(val) || val.endsWith('в результате')) {
                            endIdx++;
                            break;
                        }
                        endIdx++;
                    }
                    const fnText = filteredLines.slice(0, endIdx).join('\n').trim();
                    topFootnotes.push(fnText);
                    filteredLines.splice(0, endIdx);
                    while (filteredLines.length > 0 && !filteredLines[0].trim()) {
                        filteredLines.shift();
                    }
                }
                segmentText = filteredLines.join('\n');
            }

            pageSegments.push({
                page: pageNumber,
                text: segmentText,
                footnotes: topFootnotes
            });
        }

        // Confirmed OCR word wraps can cross a printed-page boundary. Join
        // only whitelisted fragments, then keep their continued paragraph
        // together in the reader instead of showing a false paragraph gap.
        const continuedPageBreaks = new Set();
        for (let index = 1; index < pageSegments.length; index++) {
            const previousLines = pageSegments[index - 1].text.split('\n');
            const currentLines = pageSegments[index].text.split('\n');
            let previousLineIndex = previousLines.length - 1;
            while (previousLineIndex >= 0 && !previousLines[previousLineIndex].trim()) previousLineIndex--;
            const currentLineIndex = currentLines.findIndex(line => line.trim());
            if (previousLineIndex < 0 || currentLineIndex < 0) continue;

            const leftLine = previousLines[previousLineIndex].trimEnd();
            const rightLine = currentLines[currentLineIndex].trimStart();
            const leftMatch = leftLine.match(/([А-Яа-яЁё]+)[-–—]?$/);
            const rightMatch = rightLine.match(/^([А-Яа-яЁё]+)(?=[^А-Яа-яЁё]|$)/);
            const splitKey = leftMatch && rightMatch
                ? `${leftMatch[1].toLocaleLowerCase('ru')} ${rightMatch[1].toLocaleLowerCase('ru')}`
                : '';
            const isHyphenPageWrap = /[-–—]$/.test(leftLine) && /^[а-яё]/.test(rightLine);
            const isKnownWordWrap = Boolean(splitKey
                && (knownLineWrapSplits.has(splitKey) || knownPageWrapSplits.has(splitKey))) || isHyphenPageWrap;
            const startsAsBodyContinuation = /^[а-яё]/.test(rightLine)
                && !/[.!?…:][»”"')\]]?$/.test(leftLine)
                && !isSectionHeading(rightLine)
                && !/^\d+[.)]\s/.test(rightLine)
                && !/^[-–—*]\s/.test(rightLine);

            // Page-top text beginning in lower case and following an unfinished
            // sentence continues the prior paragraph even when no word was split.
            if (!isKnownWordWrap && !startsAsBodyContinuation) continue;

            if (isKnownWordWrap && leftMatch && rightMatch) {
                const cleanLeft = leftMatch[1].replace(/-$/, '');
                previousLines[previousLineIndex] = previousLines[previousLineIndex].replace(
                    /([А-Яа-яЁё]+)-?$/,
                    () => `${cleanLeft}${rightMatch[1]}`
                );
                currentLines[currentLineIndex] = currentLines[currentLineIndex].replace(
                    /^\s*[А-Яа-яЁё]+/,
                    ''
                );
                pageSegments[index - 1].text = previousLines.join('\n');
                pageSegments[index].text = currentLines.join('\n');
            }
            continuedPageBreaks.add(index);
        }

        // Keep page numbers while cleaning the text so repeated or short anchors
        // can be resolved near the page where the source places the illustration.
        const paragraphEntries = [];
        pageSegments.forEach(({ page, text, footnotes }, segmentIndex) => {
            text.split(/\n\n+/).forEach(paragraph => {
                let displayParagraph = paragraph.trim();
                if (!displayParagraph) return;

                if (firstContentParagraph) {
                    const lines = displayParagraph.split('\n');
                    let lineIndex = 0;
                    while (lineIndex < lines.length && !lines[lineIndex].trim()) lineIndex++;

                    const lessonHeading = lines[lineIndex]?.trim().match(/^Урок\s+\d+\.\s*(.+)$/i);
                    if (lessonHeading && headingKey(lessonHeading[1]) === topicNameKey) {
                        lines.splice(lineIndex, 1);
                    }

                    const topicLocatorIndex = lines.findIndex((line, index) =>
                        index <= lineIndex + 2 && /^Тема\s+\d+\s*$/i.test(line.trim())
                    );
                    if (topicLocatorIndex !== -1) lines.splice(topicLocatorIndex, 1);

                    for (let pass = 0; pass < 3 && topicNameKey; pass++) {
                        while (lineIndex < lines.length && !lines[lineIndex].trim()) lineIndex++;
                        let combinedTitle = '';
                        let matchedEnd = -1;
                        for (let index = lineIndex; index < Math.min(lines.length, lineIndex + 4); index++) {
                            if (!lines[index].trim()) break;
                            combinedTitle += lines[index];
                            const candidateKey = headingKey(combinedTitle);
                            if (candidateKey === topicNameKey) {
                                matchedEnd = index;
                                break;
                            }
                            if (!topicNameKey.startsWith(candidateKey)) break;
                        }
                        if (matchedEnd < 0) break;
                        lines.splice(lineIndex, matchedEnd - lineIndex + 1);
                    }

                    displayParagraph = lines.join('\n').trim();
                }

                firstContentParagraph = false;
                if (displayParagraph) paragraphEntries.push({
                    page, text: displayParagraph, segmentIndex,
                    pageSpans: [{ start: 0, end: displayParagraph.length, page }]
                });
            });

            if (footnotes && footnotes.length) {
                footnotes.forEach(fn => {
                    paragraphEntries.push({
                        page, text: fn, segmentIndex,
                        isFootnote: true,
                        pageSpans: [{ start: 0, end: fn.length, page }]
                    });
                });
            }
        });

        // Join a confirmed word wrap or clear sentence continuation across pages.
        // Preserve source-page spans so image-anchor resolution still uses the
        // correct PDF page even though the reader presents one continuous p.
        [...continuedPageBreaks].sort((a, b) => b - a).forEach(segmentIndex => {
            const leftIndex = paragraphEntries.map((entry, index) =>
                entry.segmentIndex === segmentIndex - 1 ? index : -1
            ).filter(index => index >= 0).at(-1);
            const rightIndex = paragraphEntries.findIndex(entry => entry.segmentIndex === segmentIndex);
            if (leftIndex < 0 || rightIndex < 0 || leftIndex >= rightIndex) return;

            const left = paragraphEntries[leftIndex];
            const right = paragraphEntries[rightIndex];
            const offset = left.text.length + 1;
            left.text += `\n${right.text}`;
            left.pageSpans.push(...right.pageSpans.map(span => ({
                start: span.start + offset, end: span.end + offset, page: span.page
            })));
            paragraphEntries.splice(rightIndex, 1);
        });

        // Merge broken sentence paragraphs across double-newlines within topics
        for (let i = 0; i < paragraphEntries.length - 1; i++) {
            const left = paragraphEntries[i];
            const right = paragraphEntries[i + 1];
            if (left.isFootnote || right.isFootnote) continue;

            const leftTrim = left.text.trim();
            const rightTrim = right.text.trim();
            const leftEndsUnfinished = !/[.!?…:»”\)]\s*$/.test(leftTrim);
            const rightStartsLower = /^[а-яё]/.test(rightTrim)
                && !isSectionHeading(rightTrim)
                && !/^\d+[.)]\s/.test(rightTrim)
                && !/^[-–—*•]\s/.test(rightTrim);

            if (leftEndsUnfinished && rightStartsLower) {
                const offset = left.text.length + 1;
                left.text += `\n${right.text}`;
                if (right.pageSpans) {
                    left.pageSpans.push(...right.pageSpans.map(span => ({
                        start: span.start + offset, end: span.end + offset, page: span.page
                    })));
                }
                paragraphEntries.splice(i + 1, 1);
                i--;
            }
        }

        const normalizeWithOffsets = value => {
            let normalized = '';
            const offsets = [];
            for (let index = 0; index < value.length; index++) {
                const char = value[index].toLocaleLowerCase('ru');
                if (/[а-яёa-z0-9]/i.test(char)) {
                    normalized += char;
                    offsets.push(index);
                }
            }
            return { normalized, offsets };
        };
        const findNormalizedMatches = (value, search) => {
            const haystack = normalizeWithOffsets(value);
            const needle = normalizeWithOffsets(search).normalized;
            if (!needle) return [];
            const matches = [];
            let index = haystack.normalized.indexOf(needle);
            while (index !== -1) {
                matches.push({
                    start: haystack.offsets[index],
                    end: haystack.offsets[index + needle.length - 1] + 1
                });
                index = haystack.normalized.indexOf(needle, index + needle.length);
            }
            return matches;
        };
        const isExerciseHeadingLine = line => {
            const key = headingKey(line);
            return Boolean(key) && !isSectionHeading(line)
                && (exerciseHeadings.has(key)
                    || /^(?:позиция|положение)\s*\d+(?:.*)?$/i.test(line.trim()));
        };

        // Translate each image anchor to one text location, preferring the page
        // nearest its source-page metadata. This prevents common words such as
        // "дыхание" from binding to the first unrelated occurrence in a topic.
        const pageAtOffset = (entry, offset) => {
            const span = entry.pageSpans?.find(item => offset >= item.start && offset < item.end);
            return span?.page ?? entry.page;
        };
        const lineEntries = [];
        let globalOffset = 0;
        paragraphEntries.forEach((entry, entryIndex) => {
            entry.globalOffset = globalOffset;
            let lineOffset = 0;
            entry.text.split('\n').forEach(line => {
                const start = lineOffset;
                if (line.trim()) {
                    lineEntries.push({
                        entryIndex,
                        start,
                        end: start + line.length,
                        globalStart: globalOffset + start,
                        page: pageAtOffset(entry, start),
                        text: line.trim()
                    });
                }
                lineOffset += line.length + 1;
            });
            globalOffset += entry.text.length + 2;
        });

        const imageEvents = new Map();
        const unresolved = [];
        const addImageEvent = (entryIndex, offset, pos) => {
            const events = imageEvents.get(entryIndex) || [];
            events.push({ offset: Math.max(0, offset), pos, order: relevantPositions.indexOf(pos) });
            imageEvents.set(entryIndex, events);
            placedImages.add(pos.image_filename);
        };

        const captionHeadingMatches = (lineEntry, caption) => {
            const line = lineEntry.text;
            const captionText = String(caption || '').replace(/^техника выполнения\s+/i, '').trim();
            const fullKey = headingKey(captionText);
            const baseText = captionText.split('(')[0].trim();
            const baseKey = headingKey(baseText);
            const lineKey = headingKey(line);

            const stage = captionText.match(/стадия\s*(\d+)/i);
            if (stage && lineKey === headingKey(`Стадия ${stage[1]}`)) {
                const previousExercise = lineEntries.filter(candidate =>
                    candidate.globalStart < lineEntry.globalStart
                    && isExerciseHeadingLine(candidate.text)
                ).at(-1);
                const previousKey = headingKey(previousExercise?.text || '');
                return previousKey === baseKey || previousKey.includes(baseKey);
            }

            if (!isExerciseHeadingLine(line)) return false;
            if (fullKey && lineKey === fullKey) return true;
            if (baseKey.length >= 5 && (lineKey === baseKey || lineKey.includes(baseKey))) return true;

            const position = captionText.match(/позиция\s*(\d+)/i);
            if (position && new RegExp(`^(?:позиция|положение)${position[1]}`).test(lineKey)) return true;
            return false;
        };

        relevantPositions.forEach(pos => {
            let candidates = [];
            paragraphEntries.forEach((entry, entryIndex) => {
                findNormalizedMatches(entry.text, pos.anchor_text || '').forEach(match => {
                    const anchorPage = pageAtOffset(entry, match.start);
                    const pageDistance = anchorPage !== null && anchorPage !== undefined
                        ? Math.abs(Number(anchorPage) - Number(pos.pdf_page))
                        : Number.POSITIVE_INFINITY;
                    candidates.push({ ...match, entryIndex, pageDistance,
                        globalStart: entry.globalOffset + match.start });
                });
            });

            let anchor = null;
            if (candidates.length) {
                candidates.sort((a, b) => a.pageDistance - b.pageDistance || a.globalStart - b.globalStart);
                anchor = candidates[0];
            }

            const caption = String(pos.caption || '').trim();
            if (/^логотип\s*:/i.test(caption)) {
                addImageEvent(0, 0, pos);
                return;
            }

            let heading = null;
            const matchingHeadings = /^техника выполнения\s+/i.test(caption)
                ? []
                : lineEntries.filter(line => captionHeadingMatches(line, caption));
            if (matchingHeadings.length) {
                matchingHeadings.sort((a, b) => {
                    if (anchor) {
                        return Math.abs(a.globalStart - anchor.globalStart)
                            - Math.abs(b.globalStart - anchor.globalStart);
                    }
                    const distance = line => line.page !== null && line.page !== undefined
                        ? Math.abs(Number(line.page) - Number(pos.pdf_page))
                        : Number.POSITIVE_INFINITY;
                    return distance(a) - distance(b) || a.globalStart - b.globalStart;
                });
                heading = matchingHeadings[0];
            }

            if (anchor) {
                const entry = paragraphEntries[anchor.entryIndex];
                const remainder = entry.text.slice(anchor.end);
                const match = remainder.match(/[.!?](?:[»”"'\)\]]*)?(?=\s|$)/);
                const lineEnd = entry.text.indexOf('\n', anchor.end);
                let offset = match && match.index !== undefined
                    ? anchor.end + match.index + match[0].length
                    : lineEnd >= 0 ? lineEnd : entry.text.length;
                if (offset <= anchor.end) offset = entry.text.length;
                addImageEvent(anchor.entryIndex, offset, pos);
                return;
            }

            if (heading) {
                const captionStage = caption.match(/стадия\s*(\d+)/i);
                const captionHasStage = Boolean(captionStage);
                let nextHeading = lineEntries.find(line =>
                    line.globalStart > heading.globalStart
                    && isExerciseHeadingLine(line.text)
                );
                if (captionHasStage) {
                    nextHeading = lineEntries.find(line =>
                        line.globalStart > heading.globalStart
                        && new RegExp(`^стадия${Number(captionStage[1]) + 1}$`).test(headingKey(line.text))
                    ) || lineEntries.find(line =>
                        line.globalStart > heading.globalStart
                        && headingKey(line.text) === headingKey('Примечания')
                    ) || nextHeading;
                }
                // The last exercise in a topic has no following exercise title;
                // place its figure before the notes rather than after the topic.
                if (!nextHeading) {
                    nextHeading = lineEntries.find(line =>
                        line.globalStart > heading.globalStart
                        && headingKey(line.text) === headingKey('Примечания')
                    );
                }
                if (nextHeading) {
                    addImageEvent(nextHeading.entryIndex, nextHeading.start, pos);
                } else {
                    const lastIndex = paragraphEntries.length - 1;
                    addImageEvent(lastIndex, paragraphEntries[lastIndex]?.text.length || 0, pos);
                }
                return;
            }

            unresolved.push({
                image: pos.image_filename,
                lesson: this.currentLesson,
                topic: this.currentTopic,
                page: pos.pdf_page,
                anchor: pos.anchor_text || '',
                reason: 'Anchor and caption heading were not found in the topic text'
            });
        });

        this.unresolvedImagePositions = this.unresolvedImagePositions || [];
        this.unresolvedImagePositions = this.unresolvedImagePositions.filter(item =>
            !(String(item.lesson) === String(this.currentLesson)
                && String(item.topic) === String(this.currentTopic))
        ).concat(unresolved);
        if (unresolved.length) {
            console.warn('Unresolved image positions for this topic:', unresolved);
        }

        paragraphEntries.forEach((entry, entryIndex) => {
            const events = (imageEvents.get(entryIndex) || []).sort((a, b) => a.offset - b.offset || a.order - b.order);
            const prevLen = paragraphEntries[entryIndex - 1]?.text.length || 999;
            const nextLen = paragraphEntries[entryIndex + 1]?.text.length || 999;
            const isSeqShort = entry.text.length < 75 && (prevLen < 75 || nextLen < 75);

            let cursor = 0;
            for (let index = 0; index < events.length;) {
                const offset = Math.min(entry.text.length, events[index].offset);
                if (offset > cursor) htmlResult += renderParagraph(entry.text.slice(cursor, offset), isSeqShort);
                const group = [];
                while (index < events.length && Math.min(entry.text.length, events[index].offset) === offset) {
                    group.push(events[index].pos);
                    index++;
                }
                group.forEach(pos => { htmlResult += this.generateImageHtmlFromPos(pos); });
                cursor = Math.max(cursor, offset);
            }
            if (events.length) {
                if (cursor < entry.text.length) {
                    const chunk = entry.text.slice(cursor);
                    htmlResult += entry.isFootnote
                        ? `<div class="topic-footnote">${renderParagraph(chunk, false)}</div>`
                        : renderParagraph(chunk, isSeqShort);
                }
            } else {
                htmlResult += entry.isFootnote
                    ? `<div class="topic-footnote">${renderParagraph(entry.text, false)}</div>`
                    : renderParagraph(entry.text, isSeqShort);
            }
        });

        return htmlResult;
    }

    /**
     * Generates HTML for an image from position metadata
     */
    generateImageHtmlFromPos(pos) {
        const filename = pos.image_filename;
        const caption = pos.caption || '';
        const visibleCaption = pos.original_caption || '';
        const folder = COURSES[this.currentCourse]?.imageFolder || 'assets/images/';
        return `
            <div class="topic-image-container">
                <img src="${folder}${filename}"
                     alt="${caption}"
                     class="topic-image"
                     loading="lazy"
                     onerror="this.style.display='none'">
                ${visibleCaption ? `<div class="image-caption">${visibleCaption}</div>` : ''}
            </div>`;
    }

    escapeText(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    getCurrentReadingLocation() {
        let courseId = this.currentCourse || 'course1';
        let lessonNum = this.currentLesson;
        let topicNum = this.currentTopic;
        let activeInfo = null;

        if (lessonNum && topicNum && this.data?.lessons?.[lessonNum]?.topics?.[topicNum]) {
            activeInfo = this.getActiveParagraphInfo();
        } else {
            const lrJson = localStorage.getItem(`yogaApp_lastRead_${courseId}`);
            let lr = null;
            if (lrJson) {
                try { lr = JSON.parse(lrJson); } catch (e) {}
            }
            if (lr && lr.lesson && lr.topic && this.data?.lessons?.[lr.lesson]?.topics?.[lr.topic]) {
                lessonNum = String(lr.lesson);
                topicNum = String(lr.topic);
                activeInfo = { paraId: lr.paraId, snippet: lr.snippet };
            } else {
                lessonNum = courseId === 'course2' ? '13' : '1';
                topicNum = '1';
                activeInfo = null;
            }
        }

        lessonNum = String(lessonNum);
        topicNum = String(topicNum);
        const lesson = this.data?.lessons?.[lessonNum];
        const topic = lesson?.topics?.[topicNum];
        const topicName = topic?.name || `Урок ${lessonNum}, Тема ${topicNum}`;
        const paraId = activeInfo?.paraId || null;
        let snippet = activeInfo?.snippet || topicName;

        return {
            course: courseId,
            lesson: lessonNum,
            topic: topicNum,
            name: topicName,
            paraId,
            snippet
        };
    }

    updateReadingProgress(lessonNum, topicNum) {
        const key = `${lessonNum}-${topicNum}`;
        if (!this.readProgress[key]) {
            this.readProgress[key] = {
                lesson: lessonNum,
                topic: topicNum,
                pagesRead: 1,
                lastRead: Date.now()
            };
        } else {
            this.readProgress[key].pagesRead++;
            this.readProgress[key].lastRead = Date.now();
        }
        this.saveUserData();
    }

    getActiveParagraphInfo() {
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) return null;

        const header = document.querySelector('.header');
        const headerBottom = (header?.getBoundingClientRect().bottom || 68) + 20;

        const paras = contentArea.querySelectorAll('[data-para-id]');
        if (!paras.length) return null;

        let activeEl = null;
        for (const el of paras) {
            const rect = el.getBoundingClientRect();
            if (rect.bottom > headerBottom) {
                activeEl = el;
                break;
            }
        }
        if (!activeEl) activeEl = paras[0];

        const paraId = activeEl.getAttribute('data-para-id') || null;
        let snippet = (activeEl.textContent || '').replace(/\s+/g, ' ').trim();
        if (snippet.length > 95) {
            snippet = snippet.slice(0, 92) + '…';
        }

        return { paraId, snippet, element: activeEl };
    }

    toggleBookmark(lessonNum, topicNum) {
        lessonNum = String(lessonNum || this.currentLesson);
        topicNum = String(topicNum || this.currentTopic);

        // If the user currently has text selected in this topic, save that selection
        if (this.activeSelection && this.activeSelection.text &&
            String(this.activeSelection.lesson) === lessonNum &&
            String(this.activeSelection.topic) === topicNum) {
            this.bookmarkSelectedText();
            return;
        }

        const courseId = this.currentCourse;
        const activeInfo = this.getActiveParagraphInfo();
        const paraId = activeInfo?.paraId || null;
        const snippet = activeInfo?.snippet || '';

        const existingIndex = this.bookmarks.findIndex(b =>
            (b.course || 'course1') === courseId &&
            String(b.lesson) === lessonNum &&
            String(b.topic) === topicNum &&
            !b.selectedText
        );

        const lesson = this.data?.lessons?.[lessonNum];
        const topic = lesson?.topics?.[topicNum];
        const topicName = topic?.name || `Урок ${lessonNum}, Тема ${topicNum}`;

        let isNowBookmarked = false;
        if (existingIndex >= 0) {
            this.bookmarks.splice(existingIndex, 1);
            this.showToast('Закладка удалена');
            isNowBookmarked = this.bookmarks.some(b =>
                (b.course || 'course1') === courseId &&
                String(b.lesson) === lessonNum &&
                String(b.topic) === topicNum
            );
        } else {
            this.bookmarks.unshift({
                id: `bm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                course: courseId,
                lesson: lessonNum,
                topic: topicNum,
                name: topicName,
                paraId: paraId,
                snippet: snippet || topicName,
                added: Date.now()
            });
            this.showToast(`Место чтения сохранено: ${topicName}`);
            isNowBookmarked = true;
        }

        this.saveUserData();
        this.updateBookmarkButtonState(isNowBookmarked);
    }

    handleTextSelection() {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
            this.hideSelectionPopover();
            return;
        }

        const rawText = selection.toString();
        const text = rawText.replace(/\s+/g, ' ').trim();
        if (!text || text.length < 1) {
            this.hideSelectionPopover();
            return;
        }

        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const element = container.nodeType === 3 ? container.parentElement : container;
        if (!element) {
            this.hideSelectionPopover();
            return;
        }

        // Ignore selections inside navigation sidebar, header, or dialog modals
        if (element.closest('.sidebar') || element.closest('.header') || element.closest('.modal')) {
            this.hideSelectionPopover();
            return;
        }

        // Must be within the main reader surface
        const inMainContent = element.closest('#contentArea') || element.closest('.main-content') || element.closest('.page-content');
        if (!inMainContent) {
            this.hideSelectionPopover();
            return;
        }

        // Find enclosing paragraph or element with data-para-id
        const paraEl = element.closest('[data-para-id]') || element.querySelector?.('[data-para-id]');
        const paraId = paraEl ? paraEl.getAttribute('data-para-id') : null;
        const snippet = text.length > 95 ? text.slice(0, 92) + '…' : text;

        this.activeSelection = {
            text: text,
            snippet: snippet,
            paraId: paraId,
            course: this.currentCourse,
            lesson: String(this.currentLesson || '1'),
            topic: String(this.currentTopic || '1'),
            timestamp: Date.now()
        };

        this.showSelectionPopover(range);
    }

    showSelectionPopover(range) {
        const popover = document.getElementById('selectionBookmarkPopover');
        if (!popover || !range) return;

        let rect = range.getBoundingClientRect();
        if ((!rect || (rect.width === 0 && rect.height === 0)) && range.getClientRects) {
            const rects = range.getClientRects();
            if (rects.length > 0) {
                rect = rects[0];
            }
        }

        if (!rect || (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.bottom === 0)) {
            this.hideSelectionPopover();
            return;
        }

        const viewportWidth = window.innerWidth;
        const popoverWidth = 140;
        const padding = 12;
        let left = rect.left + rect.width / 2;
        left = Math.max(popoverWidth / 2 + padding, Math.min(viewportWidth - popoverWidth / 2 - padding, left));

        const header = document.querySelector('.header');
        const headerBottom = (header?.getBoundingClientRect().bottom || 60) + 12;

        let top = rect.top - 8;
        let placement = 'placement-top';

        if (top < headerBottom) {
            top = rect.bottom + 8;
            placement = 'placement-bottom';
        }

        popover.className = `selection-bookmark-popover show ${placement}`;
        popover.style.left = `${Math.round(left)}px`;
        popover.style.top = `${Math.round(top)}px`;
        popover.style.display = 'block';
        popover.setAttribute('aria-hidden', 'false');
    }

    repositionSelectionPopover() {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
            this.hideSelectionPopover();
            return;
        }
        try {
            const range = selection.getRangeAt(0);
            this.showSelectionPopover(range);
        } catch (e) {
            this.hideSelectionPopover();
        }
    }

    hideSelectionPopover() {
        const popover = document.getElementById('selectionBookmarkPopover');
        if (popover) {
            popover.className = 'selection-bookmark-popover';
            popover.style.display = 'none';
            popover.setAttribute('aria-hidden', 'true');
        }
    }

    bookmarkSelectedText() {
        let sel = this.activeSelection;
        if (!sel || !sel.text) {
            const currentSel = window.getSelection();
            if (currentSel && !currentSel.isCollapsed) {
                this.handleTextSelection();
                sel = this.activeSelection;
            }
        }

        if (!sel || !sel.text) {
            this.saveCurrentBookmark();
            return;
        }

        const courseId = sel.course || this.currentCourse;
        const lessonNum = String(sel.lesson || this.currentLesson);
        const topicNum = String(sel.topic || this.currentTopic);
        const lesson = this.data?.lessons?.[lessonNum];
        const topic = lesson?.topics?.[topicNum];
        const topicName = topic?.name || `Урок ${lessonNum}, Тема ${topicNum}`;

        const existingIndex = this.bookmarks.findIndex(b =>
            (b.course || 'course1') === courseId &&
            String(b.lesson) === lessonNum &&
            String(b.topic) === topicNum &&
            b.selectedText === sel.text
        );

        if (existingIndex >= 0) {
            this.bookmarks[existingIndex].added = Date.now();
            this.bookmarks[existingIndex].paraId = sel.paraId;
            this.showToast(`Закладка уже сохранена: «${sel.snippet}»`);
        } else {
            this.bookmarks.unshift({
                id: `bm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                course: courseId,
                lesson: lessonNum,
                topic: topicNum,
                name: topicName,
                paraId: sel.paraId,
                selectedText: sel.text,
                snippet: sel.snippet,
                added: Date.now()
            });
            this.showToast(`Выделенный фрагмент сохранён в закладки: «${sel.snippet}»`);
        }

        this.saveUserData();
        this.updateBookmarkButtonState(true);
        this.hideSelectionPopover();

        // Highlight the selected text right away on current page
        this.highlightSelectedText(sel.paraId, sel.text);

        // Clear native window selection
        try {
            window.getSelection()?.removeAllRanges();
        } catch (e) {}

        this.activeSelection = null;
    }

    saveCurrentBookmark() {
        // If user actively selected text in the current topic, save that selection!
        if (this.activeSelection && this.activeSelection.text &&
            String(this.activeSelection.lesson) === String(this.currentLesson) &&
            String(this.activeSelection.topic) === String(this.currentTopic) &&
            (this.activeSelection.course || this.currentCourse) === this.currentCourse) {
            this.bookmarkSelectedText();
            this.showBookmarks();
            return;
        }

        const loc = this.getCurrentReadingLocation();
        const courseId = loc.course;
        const lessonNum = loc.lesson;
        const topicNum = loc.topic;
        const topicName = loc.name;
        const paraId = loc.paraId;
        const snippet = loc.snippet;

        // Check if there is already a general bookmark (without selectedText) for this topic
        const existingIndex = this.bookmarks.findIndex(b =>
            (b.course || 'course1') === courseId &&
            String(b.lesson) === lessonNum &&
            String(b.topic) === topicNum &&
            !b.selectedText
        );

        if (existingIndex >= 0) {
            this.bookmarks[existingIndex].paraId = paraId;
            this.bookmarks[existingIndex].snippet = snippet;
            this.bookmarks[existingIndex].added = Date.now();
            this.showToast(`Закладка обновлена: ${topicName}`);
        } else {
            this.bookmarks.unshift({
                id: `bm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                course: courseId,
                lesson: lessonNum,
                topic: topicNum,
                name: topicName,
                paraId: paraId,
                snippet: snippet,
                added: Date.now()
            });
            this.showToast(`Место чтения сохранено: ${topicName}`);
        }

        this.saveUserData();
        this.updateBookmarkButtonState(true);
        this.showBookmarks();
    }

    updateBookmarkButtonState(isBookmarked) {
        document.querySelectorAll('.action-btn').forEach(btn => {
            if (btn.textContent.includes('Закладка') || btn.getAttribute('onclick')?.includes('toggleBookmark')) {
                btn.classList.toggle('active', isBookmarked);
                btn.innerHTML = isBookmarked ? '⭐ Закладка' : '🔖 Добавить закладку';
            }
        });
    }

    showBookmarks() {
        const container = document.getElementById('bookmarksList');
        const actionContainer = document.getElementById('bookmarkCurrentAction');
        const loc = this.getCurrentReadingLocation();
        const cId = loc.course || this.currentCourse;
        const badgeClass = cId === 'course2' ? 'badge-vol2' : 'badge-vol1';
        const badgeText = cId === 'course2' ? 'Том II' : 'Том I';
        const locationHintText = `Урок ${loc.lesson}, Тема ${loc.topic} · ${loc.name}`;

        // Check if there's an active text selection in the current topic
        const hasSelection = this.activeSelection && this.activeSelection.text &&
            String(this.activeSelection.lesson) === String(this.currentLesson) &&
            String(this.activeSelection.topic) === String(this.currentTopic);

        const buttonLabel = hasSelection
            ? `🔖 Сохранить выделенное: «${this.escapeText(this.activeSelection.snippet)}»`
            : `🔖 Сохранить это место чтения`;

        // The action bar is ALWAYS shown in both empty and populated states
        if (actionContainer) {
            actionContainer.innerHTML = `
                <div class="bookmark-action-bar">
                    <button class="action-btn bookmark-save-primary-btn" onclick="app.saveCurrentBookmark()" type="button">
                        ${buttonLabel}
                    </button>
                    <div class="bookmark-current-place-hint" title="${this.escapeText(locationHintText)}">
                        <span class="course-badge ${badgeClass}">${badgeText}</span>
                        <span class="place-hint-text">${this.escapeText(locationHintText)}</span>
                    </div>
                </div>
            `;
        }

        if (this.bookmarks.length === 0) {
            container.innerHTML = `
                <div class="bookmarks-empty-state">
                    <div class="empty-list-icon">🔖</div>
                    <div class="empty-list-title">Нет закладок</div>
                    <p class="empty-list-desc">Выделите слово или предложение в тексте и нажмите <strong>«В закладки»</strong>, либо нажмите кнопку выше, чтобы сохранить место чтения.</p>
                </div>
            `;
            this.openModal('bookmarksModal');
            return;
        }

        container.innerHTML = this.bookmarks.map((b, index) => {
            const bCId = b.course || 'course1';
            const bBadgeClass = bCId === 'course2' ? 'badge-vol2' : 'badge-vol1';
            const bBadgeText = bCId === 'course2' ? 'Том II' : 'Том I';
            const dateStr = b.added ? new Date(b.added).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '';
            const isSel = !!b.selectedText;
            const snippetText = b.selectedText || b.snippet || '';

            return `
                <div class="list-item" tabindex="0" role="button"
                     aria-label="Перейти к закладке: ${this.escapeText(b.name)}"
                     onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();app.loadBookmark(${index});}else if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();app.removeBookmark(${index});}">
                    <div class="list-item-content" onclick="app.loadBookmark(${index})">
                        <div class="list-item-title">
                            <span class="course-badge ${bBadgeClass}">${bBadgeText}</span>
                            ${this.escapeText(b.name)}
                        </div>
                        <div class="list-item-subtitle">Урок ${b.lesson}, Тема ${b.topic}${dateStr ? ` · ${dateStr}` : ''}</div>
                        ${snippetText ? `<div class="bookmark-snippet ${isSel ? 'is-selection' : ''}">${isSel ? '<span class="bookmark-quote-icon">📍</span> ' : ''}«${this.escapeText(snippetText)}»</div>` : ''}
                    </div>
                    <button class="list-item-remove" onclick="event.stopPropagation(); app.removeBookmark(${index})" title="Удалить закладку" aria-label="Удалить закладку" type="button">×</button>
                </div>
            `;
        }).join('');

        this.openModal('bookmarksModal');
    }

    async loadBookmark(index) {
        const bookmark = this.bookmarks[index];
        if (!bookmark) return;

        const cId = bookmark.course || 'course1';
        this.closeModal('bookmarksModal');

        const isDifferentCourse = cId !== this.currentCourse;
        const isDifferentTopic = String(this.currentLesson) !== String(bookmark.lesson) || String(this.currentTopic) !== String(bookmark.topic);

        if (isDifferentCourse) {
            await this.switchCourse(cId, bookmark.lesson, bookmark.topic);
        } else if (isDifferentTopic || !document.querySelector('.page-content')) {
            this.loadTopic(bookmark.lesson, bookmark.topic);
        }

        this.scrollToBookmarkTarget(bookmark.paraId, bookmark.selectedText);
    }

    highlightSelectedText(paraId, selectedText) {
        if (!selectedText || typeof selectedText !== 'string') return null;
        const cleanSearch = selectedText.trim();
        if (!cleanSearch) return null;

        // Clear previous highlight marks
        document.querySelectorAll('mark.bookmark-word-highlight').forEach(mark => {
            const parent = mark.parentNode;
            if (parent) {
                while (mark.firstChild) {
                    parent.insertBefore(mark.firstChild, mark);
                }
                parent.removeChild(mark);
            }
        });

        // Search in target paragraph first, then full .page-content
        let containers = [];
        if (paraId) {
            const paraEl = document.querySelector(`[data-para-id="${paraId}"]`);
            if (paraEl) containers.push(paraEl);
        }
        const pageContent = document.querySelector('.page-content');
        if (pageContent && !containers.includes(pageContent)) {
            containers.push(pageContent);
        }

        for (const container of containers) {
            // Pass 1: exact single text node match
            const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while ((node = walker.nextNode())) {
                const val = node.nodeValue || '';
                const idx = val.indexOf(cleanSearch);
                if (idx !== -1) {
                    try {
                        const midNode = node.splitText(idx);
                        midNode.splitText(cleanSearch.length);
                        const mark = document.createElement('mark');
                        mark.className = 'bookmark-word-highlight';
                        midNode.parentNode.insertBefore(mark, midNode);
                        mark.appendChild(midNode);
                        return mark;
                    } catch (e) {
                        // ignore and continue
                    }
                }
            }

            // Pass 2: normalized single text node match
            const normSearch = cleanSearch.replace(/\s+/g, ' ');
            const walker2 = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
            while ((node = walker2.nextNode())) {
                const val = node.nodeValue || '';
                const normVal = val.replace(/\s+/g, ' ');
                const normIdx = normVal.indexOf(normSearch);
                if (normIdx !== -1) {
                    try {
                        const matchLen = Math.min(cleanSearch.length, val.length - normIdx);
                        const midNode = node.splitText(normIdx);
                        midNode.splitText(matchLen);
                        const mark = document.createElement('mark');
                        mark.className = 'bookmark-word-highlight';
                        midNode.parentNode.insertBefore(mark, midNode);
                        mark.appendChild(midNode);
                        return mark;
                    } catch (e) {
                        // ignore
                    }
                }
            }

            // Pass 3: cross-node search
            const walker3 = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
            let fullText = '';
            const nodeMap = [];
            while ((node = walker3.nextNode())) {
                const str = node.nodeValue || '';
                const start = fullText.length;
                fullText += str;
                const end = fullText.length;
                nodeMap.push({ node, start, end });
            }

            let matchStart = fullText.indexOf(cleanSearch);
            let matchLength = cleanSearch.length;
            if (matchStart === -1) {
                const normFull = fullText.replace(/\s+/g, ' ');
                matchStart = normFull.indexOf(normSearch);
                matchLength = normSearch.length;
            }

            if (matchStart !== -1) {
                const matchEnd = matchStart + matchLength;
                let startNode = null, startOffset = 0;
                let endNode = null, endOffset = 0;

                for (const item of nodeMap) {
                    if (!startNode && matchStart >= item.start && matchStart < item.end) {
                        startNode = item.node;
                        startOffset = matchStart - item.start;
                    }
                    if (matchEnd > item.start && matchEnd <= item.end) {
                        endNode = item.node;
                        endOffset = matchEnd - item.start;
                        break;
                    }
                }

                if (startNode && endNode) {
                    try {
                        const range = document.createRange();
                        range.setStart(startNode, Math.min(startOffset, startNode.nodeValue.length));
                        range.setEnd(endNode, Math.min(endOffset, endNode.nodeValue.length));
                        const mark = document.createElement('mark');
                        mark.className = 'bookmark-word-highlight';
                        try {
                            range.surroundContents(mark);
                        } catch (err) {
                            mark.appendChild(range.extractContents());
                            range.insertNode(mark);
                        }
                        return mark;
                    } catch (e) {
                        // ignore
                    }
                }
            }
        }

        return null;
    }

    scrollToBookmarkTarget(paraId, selectedText) {
        const doScroll = () => {
            const header = document.querySelector('.header');
            const headerOffset = (header?.offsetHeight || 68) + 20;

            // If selectedText is provided, try highlighting and scrolling to exact text
            if (selectedText) {
                const highlightedEl = this.highlightSelectedText(paraId, selectedText);
                if (highlightedEl) {
                    const rect = highlightedEl.getBoundingClientRect();
                    const currentY = window.scrollY || document.documentElement.scrollTop || 0;
                    const targetY = currentY + rect.top - headerOffset;
                    window.scrollTo({
                        top: Math.max(0, targetY),
                        behavior: 'smooth'
                    });
                    return;
                }
            }

            if (paraId) {
                const targetEl = document.querySelector(`[data-para-id="${paraId}"]`) || document.getElementById(paraId);
                if (targetEl) {
                    const rect = targetEl.getBoundingClientRect();
                    const currentY = window.scrollY || document.documentElement.scrollTop || 0;
                    const targetY = currentY + rect.top - headerOffset;
                    window.scrollTo({
                        top: Math.max(0, targetY),
                        behavior: 'smooth'
                    });
                    targetEl.classList.add('bookmark-target-highlight');
                    setTimeout(() => targetEl.classList.remove('bookmark-target-highlight'), 2600);
                    return;
                }
            }

            const topicHeading = document.querySelector('.topic-page-header') || document.querySelector('.page-header');
            if (topicHeading) {
                const rect = topicHeading.getBoundingClientRect();
                const currentY = window.scrollY || document.documentElement.scrollTop || 0;
                const targetY = currentY + rect.top - headerOffset;
                window.scrollTo({
                    top: Math.max(0, targetY),
                    behavior: 'smooth'
                });
            }
        };

        requestAnimationFrame(() => {
            setTimeout(doScroll, 100);
        });
    }

    removeBookmark(index) {
        this.bookmarks.splice(index, 1);
        this.saveUserData();
        this.showBookmarks();
        this.showToast('Закладка удалена');
        if (this.currentLesson && this.currentTopic) {
            const isBookmarked = this.bookmarks.some(b =>
                (b.course || 'course1') === this.currentCourse &&
                String(b.lesson) === String(this.currentLesson) &&
                String(b.topic) === String(this.currentTopic)
            );
            this.updateBookmarkButtonState(isBookmarked);
        }
    }

    showFavorites() {
        const container = document.getElementById('favoritesList');

        if (this.favorites.length === 0) {
            container.innerHTML = '<div class="empty-list">Нет избранных практик</div>';
            this.openModal('favoritesModal');
            return;
        }

        container.innerHTML = this.favorites.map((f, index) => {
            const cId = f.course || 'course1';
            const badgeClass = cId === 'course2' ? 'badge-vol2' : 'badge-vol1';
            const badgeText = cId === 'course2' ? 'Том II' : 'Том I';
            return `
                <div class="list-item">
                    <div class="list-item-content" onclick="app.loadFavorite(${index})">
                        <div class="list-item-title"><span class="course-badge ${badgeClass}">${badgeText}</span>${f.name}</div>
                        <div class="list-item-subtitle">Урок ${f.lesson}, Тема ${f.topic}</div>
                    </div>
                    <button class="list-item-remove" onclick="app.removeFavorite(${index})" title="Удалить из избранного">×</button>
                </div>
            `;
        }).join('');

        this.openModal('favoritesModal');
    }

    async loadFavorite(index) {
        const fav = this.favorites[index];
        if (fav) {
            const cId = fav.course || 'course1';
            if (cId !== this.currentCourse) {
                await this.switchCourse(cId, fav.lesson, fav.topic);
            } else {
                this.loadTopic(fav.lesson, fav.topic);
            }
            this.closeModal('favoritesModal');
        }
    }

    toggleFavorite(lessonNum, topicNum) {
        lessonNum = String(lessonNum || this.currentLesson);
        topicNum = String(topicNum || this.currentTopic);
        const courseId = this.currentCourse;
        const existingIndex = this.favorites.findIndex(f =>
            (f.course || 'course1') === courseId &&
            String(f.lesson) === lessonNum &&
            String(f.topic) === topicNum
        );
        const lesson = this.data?.lessons?.[lessonNum];
        const topic = lesson?.topics?.[topicNum];
        const topicName = topic?.name || `Урок ${lessonNum}, Тема ${topicNum}`;

        let isNowFavorite = false;
        if (existingIndex >= 0) {
            this.favorites.splice(existingIndex, 1);
            this.showToast('Удалено из избранного');
            isNowFavorite = false;
        } else {
            this.favorites.unshift({
                course: courseId,
                lesson: lessonNum,
                topic: topicNum,
                name: topicName,
                added: Date.now()
            });
            this.showToast(`Добавлено в избранное: ${topicName}`);
            isNowFavorite = true;
        }
        this.saveUserData();
        this.updateFavoriteButtonState(isNowFavorite);
    }

    updateFavoriteButtonState(isFavorite) {
        document.querySelectorAll('.action-btn').forEach(btn => {
            if (btn.textContent.includes('избранн') || btn.getAttribute('onclick')?.includes('toggleFavorite')) {
                btn.classList.toggle('active', isFavorite);
                btn.innerHTML = isFavorite ? '❤️ В избранном' : '🤍 В избранное';
            }
        });
    }

    removeFavorite(index) {
        this.favorites.splice(index, 1);
        this.saveUserData();
        this.showFavorites();
        this.showToast('Удалено из избранного');
        if (this.currentLesson && this.currentTopic) {
            const isFavorite = this.favorites.some(f =>
                (f.course || 'course1') === this.currentCourse &&
                String(f.lesson) === String(this.currentLesson) &&
                String(f.topic) === String(this.currentTopic)
            );
            this.updateFavoriteButtonState(isFavorite);
        }
    }

    showProgress() {
        // Count total topics from lessons structure
        let totalTopics = 0;
        for (const lesson of Object.values(this.data.lessons)) {
            totalTopics += Object.keys(lesson.topics).length;
        }
        const topicsRead = Object.keys(this.readProgress).length;
        const percentage = Math.round((topicsRead / totalTopics) * 100);

        const container = document.getElementById('progressContent');
        container.innerHTML = `
            <div class="progress-overview">
                <div class="progress-percentage">${percentage}%</div>
                <div class="progress-label">Пройдено материала</div>
                <div style="margin-top: 0.5rem; font-size: 0.9rem;">
                    ${topicsRead} из ${totalTopics} тем
                </div>
            </div>

            <div class="progress-details">
                <h3 style="margin-bottom: 1rem;">Прогресс по урокам</h3>
                ${Object.entries(this.data.lessons).map(([lessonNum, lesson]) => {
                    const topicKeys = Object.keys(lesson.topics);
                    const completedTopics = topicKeys.filter(t =>
                        this.readProgress[`${lessonNum}-${t}`]
                    ).length;
                    const lessonPercentage = Math.round((completedTopics / topicKeys.length) * 100);

                    return `
                        <div class="lesson-progress">
                            <div class="lesson-progress-name">Урок ${lessonNum}</div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${lessonPercentage}%"></div>
                            </div>
                            <span style="margin-left: 0.5rem; font-size: 0.85rem;">${completedTopics}/${topicKeys.length}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        this.openModal('progressModal');
    }

    async performSearch(query) {
        const resultsContainer = document.getElementById('searchResults');

        if (!query || query.length < 2) {
            resultsContainer.innerHTML = '';
            return;
        }

        // Ensure both courses are loaded for search
        if (!this.coursesData.course1 || !this.coursesData.course2) {
            await this.prefetchOtherCourseData();
        }

        const results = [];
        const lowerQuery = query.toLowerCase();

        for (const [cKey, cCfg] of Object.entries(COURSES)) {
            const cData = this.coursesData[cKey];
            if (!cData || !cData.lessons) continue;

            const sortedLessons = Object.entries(cData.lessons)
                .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

            for (const [lessonNum, lesson] of sortedLessons) {
                const sortedTopics = Object.entries(lesson.topics)
                    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

                for (const [topicNum, topic] of sortedTopics) {
                    const text = topic.text.toLowerCase();
                    const name = topic.name.toLowerCase();

                    if (text.includes(lowerQuery) || name.includes(lowerQuery)) {
                        const index = text.indexOf(lowerQuery);
                        let snippet = '';
                        if (index !== -1) {
                            const start = Math.max(0, index - 50);
                            const end = Math.min(topic.text.length, index + query.length + 50);
                            snippet = topic.text.substring(start, end).replace(/\n/g, ' ');
                        } else {
                            snippet = topic.text.substring(0, 100).replace(/\n/g, ' ');
                        }

                        results.push({
                            course: cKey,
                            lesson: lessonNum,
                            topic: topicNum,
                            name: topic.name,
                            snippet: snippet
                        });
                    }
                }
            }
        }

        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">Ничего не найдено</div>';
            return;
        }

        resultsContainer.innerHTML = results.map(result => {
            const isVol2 = result.course === 'course2';
            const badgeClass = isVol2 ? 'badge-vol2' : 'badge-vol1';
            const badgeText = isVol2 ? 'Том II' : 'Том I';
            return `
                <div class="search-result-item" onclick="app.loadSearchResult('${result.course}', '${result.lesson}', '${result.topic}')">
                    <div class="search-result-title"><span class="course-badge ${badgeClass}">${badgeText}</span>Урок ${result.lesson}, Тема ${result.topic}: ${result.name}</div>
                    <div class="search-result-snippet">...${result.snippet}...</div>
                </div>
            `;
        }).join('');
    }

    async loadSearchResult(courseId, lessonNum, topicNum) {
        if (courseId && courseId !== this.currentCourse) {
            await this.switchCourse(courseId, lessonNum, topicNum);
        } else {
            this.loadTopic(lessonNum, topicNum);
        }
        this.closeModal('searchModal');
    }

    renderFrontMatterPage(page) {
        const contentArea = document.getElementById('contentArea');
        const formattedContent = this.formatContent(page.text, page.page);

        contentArea.innerHTML = `
            <div class="page-header">
                <h1>${this.data.title}</h1>
            </div>

            <div class="page-content">
                ${formattedContent}
            </div>

            <div class="page-number">Страница ${page.page}</div>
        `;
    }

    saveLastReadPosition() {
        if (!this.currentLesson || !this.currentTopic || !this.data) return;
        const courseId = this.currentCourse;
        const activeInfo = this.getActiveParagraphInfo();
        const lesson = this.data.lessons?.[this.currentLesson];
        const topic = lesson?.topics?.[this.currentTopic];

        const lastRead = {
            course: courseId,
            lesson: String(this.currentLesson),
            topic: String(this.currentTopic),
            topicName: topic?.name || `Урок ${this.currentLesson}, Тема ${this.currentTopic}`,
            paraId: activeInfo?.paraId || null,
            snippet: activeInfo?.snippet || '',
            scrollTop: window.scrollY || document.documentElement.scrollTop || 0,
            timestamp: Date.now()
        };

        try {
            localStorage.setItem(`yogaApp_lastRead_${courseId}`, JSON.stringify(lastRead));
            localStorage.setItem('yogaApp_activeView', JSON.stringify({
                course: courseId,
                lesson: String(this.currentLesson),
                topic: String(this.currentTopic),
                paraId: activeInfo?.paraId || null
            }));
        } catch (e) {
            console.warn('Could not save last read position:', e);
        }
    }

    async resumeCourse(courseId) {
        if (!COURSES[courseId]) return;
        const savedJson = localStorage.getItem(`yogaApp_lastRead_${courseId}`);
        let lastRead = null;
        if (savedJson) {
            try { lastRead = JSON.parse(savedJson); } catch (e) {}
        }

        if (lastRead && lastRead.lesson && lastRead.topic) {
            await this.switchCourse(courseId, lastRead.lesson, lastRead.topic);
            if (lastRead.paraId) {
                this.scrollToBookmarkTarget(lastRead.paraId);
            }
        } else {
            const defaultLesson = courseId === 'course2' ? '13' : '1';
            await this.switchCourse(courseId, defaultLesson, '1');
        }
    }

    async restoreActiveViewOnStartup() {
        const savedViewJson = localStorage.getItem('yogaApp_activeView');
        if (!savedViewJson) return false;

        try {
            const activeView = JSON.parse(savedViewJson);
            if (activeView && activeView.course && activeView.lesson && activeView.topic && COURSES[activeView.course]) {
                if (activeView.course !== this.currentCourse) {
                    await this.loadCourseData(activeView.course);
                    this.updateCourseUI();
                    this.renderLessonsList();
                }
                this.loadTopic(String(activeView.lesson), String(activeView.topic));
                if (activeView.paraId) {
                    this.scrollToBookmarkTarget(activeView.paraId);
                }
                return true;
            }
        } catch (e) {
            console.warn('Could not restore active view:', e);
        }
        return false;
    }

    showWelcomePage() {
        try { localStorage.removeItem('yogaApp_activeView'); } catch (e) {}
        this.currentLesson = null;
        this.currentTopic = null;
        const contentArea = document.getElementById('contentArea');
        const activeCourse = COURSES[this.currentCourse] || COURSES.course1;
        const isVol1 = this.currentCourse === 'course1';
        const coverImg = isVol1 ? 'assets/images/img001.jpg' : 'assets/images2/img_v2_001.png';

        const lr1Json = localStorage.getItem('yogaApp_lastRead_course1');
        const lr2Json = localStorage.getItem('yogaApp_lastRead_course2');
        let lr1 = null, lr2 = null;
        if (lr1Json) { try { lr1 = JSON.parse(lr1Json); } catch (e) {} }
        if (lr2Json) { try { lr2 = JSON.parse(lr2Json); } catch (e) {} }

        const vol1BtnText = lr1
            ? `Продолжить: Урок ${lr1.lesson}, Тема ${lr1.topic}`
            : (isVol1 ? 'Читать Том I' : 'Перейти к Тому I');
        const vol2BtnText = lr2
            ? `Продолжить: Урок ${lr2.lesson}, Тема ${lr2.topic}`
            : (!isVol1 ? 'Читать Том II' : 'Перейти к Тому II');

        const vol1Action = lr1 ? "app.resumeCourse('course1')" : "app.switchCourse('course1', '1', '1')";
        const vol2Action = lr2 ? "app.resumeCourse('course2')" : "app.switchCourse('course2', '13', '1')";

        contentArea.innerHTML = `
            <div class="page-header">
                <h1>Древние тантрические техники йоги и крийи</h1>
                <div class="subtitle">Свами Сатьянанда Сарасвати · Систематический курс в трёх томах</div>
            </div>

            <div class="page-content">
                <div class="welcome-image-container">
                    <img src="${coverImg}" alt="Обложка тома" class="welcome-image" onerror="this.style.display='none'">
                </div>
                <p class="welcome-intro">Полное практическое руководство по древним тантрическим техникам йоги и крийи Бихарской школы йоги. Выберите курс для изучения:</p>

                <div class="welcome-courses-grid">
                    <div class="course-card ${isVol1 ? 'active-course' : ''}">
                        <div class="course-card-header">
                            <span class="course-card-badge badge-vol1">Том I</span>
                            ${isVol1 ? '<span style="font-size:0.8rem; color:var(--brand); font-weight:600;">Текущий том</span>' : ''}
                        </div>
                        <h4>Вводный курс</h4>
                        <p>12 уроков (84 темы): основы хатха-йоги, шаткармы (джала нети), начальные асаны, пранаяма, осознание и расслабление (йога-нидра).</p>
                        <button class="course-card-btn" onclick="${vol1Action}">
                            ${vol1BtnText}
                        </button>
                    </div>

                    <div class="course-card ${!isVol1 ? 'active-course' : ''}">
                        <div class="course-card-header">
                            <span class="course-card-badge badge-vol2">Том II</span>
                            ${!isVol1 ? '<span style="font-size:0.8rem; color:var(--accent); font-weight:600;">Текущий том</span>' : ''}
                        </div>
                        <h4>Продвинутый курс</h4>
                        <p>12 уроков (74 темы): углубленная карма-йога и бхакти-йога, тантра, чакры (от Муладхары до Аджны), бандхи, мудры и аджапа-джапа.</p>
                        <button class="course-card-btn" onclick="${vol2Action}">
                            ${vol2BtnText}
                        </button>
                    </div>
                </div>

                <h3>О текущем томе (${activeCourse.title})</h3>
                <p>В этом томе представлено <strong>${Object.keys(this.data.lessons).length} уроков</strong> и <strong>${Object.values(this.data.lessons).reduce((tot, l) => tot + Object.keys(l.topics).length, 0)} тем</strong>. Выберите интересующий урок в боковом меню слева или начните с первого урока курса.</p>

                <h3>Возможности приложения</h3>
                <div class="welcome-feature-grid">
                    <div class="feature-card">
                        <div class="feature-icon">🔖</div>
                        <div class="feature-title">Закладки</div>
                        <div class="feature-desc">Сохраняйте важные места в обоих томах</div>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon">❤️</div>
                        <div class="feature-title">Избранное</div>
                        <div class="feature-desc">Создавайте список любимых практик</div>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon">🔍</div>
                        <div class="feature-title">Поиск</div>
                        <div class="feature-desc">Быстрый сквозной поиск по обоим томам книги</div>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon">📊</div>
                        <div class="feature-title">Прогресс</div>
                        <div class="feature-desc">Следите за своими достижениями в обучении</div>
                    </div>
                </div>
            </div>
        `;
    }

    openModal(modalId) {
        this.hideSelectionPopover();
        const modal = document.getElementById(modalId);
        if (!modal) return;
        this.modalReturnFocus = document.activeElement;
        const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        const initialFocus = modal.id === 'searchModal'
            ? modal.querySelector('#searchInput')
            : modal.querySelector('button:not([disabled])');
        if (initialFocus) {
            try { initialFocus.focus({ preventScroll: true }); } catch (e) { initialFocus.focus(); }
        }
        if (Math.abs((window.scrollY || document.documentElement.scrollTop || 0) - currentScrollY) > 5) {
            window.scrollTo({ top: currentScrollY, behavior: 'instant' });
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        if (this.modalReturnFocus && this.modalReturnFocus.isConnected) {
            try { this.modalReturnFocus.focus({ preventScroll: true }); } catch (e) { this.modalReturnFocus.focus(); }
        }
        this.modalReturnFocus = null;
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    saveUserData() {
        localStorage.setItem('yogaApp_bookmarks', JSON.stringify(this.bookmarks));
        localStorage.setItem('yogaApp_favorites', JSON.stringify(this.favorites));
        localStorage.setItem('yogaApp_progress', JSON.stringify(this.readProgress));
    }

    loadUserData() {
        const bookmarks = localStorage.getItem('yogaApp_bookmarks');
        const favorites = localStorage.getItem('yogaApp_favorites');
        const progress = localStorage.getItem('yogaApp_progress');

        if (bookmarks) this.bookmarks = JSON.parse(bookmarks);
        if (favorites) this.favorites = JSON.parse(favorites);
        if (progress) this.readProgress = JSON.parse(progress);
    }
}

// Initialize the app
const app = new YogaApp();
