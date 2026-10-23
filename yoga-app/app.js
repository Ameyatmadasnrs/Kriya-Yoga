// Yoga Application - Main JavaScript (Enhanced Premium Version)
class YogaApp {
    constructor() {
        this.data = null;
        this.imagePositions = [];
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

        this.init();
    }

    async init() {
        try {
            await this.loadData();
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
        this.renderLessonsList();
        this.showWelcomePage();
    }

    async loadData() {
        const getJson = async (url, required = true) => {
            const response = await fetch(url);
            if (!response.ok) {
                if (!required) return null;
                throw new Error(`Не удалось загрузить ${url}: HTTP ${response.status}`);
            }
            return response.json();
        };

        [this.data, this.imagePositions, this.practicePlans] = await Promise.all([
            getJson('data/book.json'),
            getJson('data/image-positions.json'),
            getJson('data/practice-plans.json', false)
        ]);

        if (!this.data || !this.data.lessons) {
            throw new Error('Файл data/book.json не содержит структуру уроков.');
        }
        document.getElementById('appTitle').textContent = this.data.title.split('.')[0];
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
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

        // Menu toggle
        document.getElementById('menuToggle').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('sidebarOverlay').addEventListener('click', () => this.closeSidebar());
        
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
            lessonEl.querySelector('.lesson-title').addEventListener('click', (e) => {
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

    renderTopic(lessonNum, topicNum, topic) {
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

        const isBookmarked = this.bookmarks.some(b => b.lesson === lessonNum && b.topic === topicNum);
        const isFavorite = this.favorites.some(f => f.lesson === lessonNum && f.topic === topicNum);
        
        contentArea.innerHTML = `
            <div class="page-header topic-page-header">
                <div class="lesson-kicker">Урок ${lessonNum}</div>
                <div class="page-heading-group">
                    <h1>${topic.name}</h1>
                    <div class="subtitle">Тема ${topicNum}</div>
                </div>
            </div>
            
            <div class="page-content">
                ${formattedContent}
            </div>
            
            <div class="page-number">Тема ${topicNum} из ${Object.keys(this.data.lessons[lessonNum].topics).length}</div>
            
            <div class="content-actions">
                <button class="action-btn ${isBookmarked ? 'active' : ''}" onclick="app.toggleBookmark('${lessonNum}', '${topicNum}')">
                    ${isBookmarked ? '⭐ Закладка' : '🔖 Добавить закладку'}
                </button>
                <button class="action-btn ${isFavorite ? 'active' : ''}" onclick="app.toggleFavorite('${lessonNum}', '${topicNum}')">
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

    navigateTopic(direction) {
        const lessonNum = this.currentLesson;
        const topicNum = parseInt(this.currentTopic);
        const lesson = this.data.lessons[lessonNum];
        const topicKeys = Object.keys(lesson.topics).map(Number).sort((a, b) => a - b);
        const currentIndex = topicKeys.indexOf(topicNum);
        const newIndex = currentIndex + direction;
        
        if (newIndex >= 0 && newIndex < topicKeys.length) {
            // Stay in same lesson
            this.loadTopic(lessonNum, topicKeys[newIndex].toString());
        } else if (direction < 0 && currentIndex === 0) {
            // Go to previous lesson's last topic
            const prevLessonNum = parseInt(lessonNum) - 1;
            if (prevLessonNum >= 1) {
                const prevLesson = this.data.lessons[prevLessonNum.toString()];
                if (prevLesson) {
                    const lastTopic = Math.max(...Object.keys(prevLesson.topics).map(Number));
                    this.loadTopic(prevLessonNum.toString(), lastTopic.toString());
                }
            }
        } else if (direction > 0 && currentIndex === topicKeys.length - 1) {
            // Go to next lesson's first topic
            const nextLessonNum = parseInt(lessonNum) + 1;
            const nextLesson = this.data.lessons[nextLessonNum.toString()];
            if (nextLesson) {
                const firstTopic = Math.min(...Object.keys(nextLesson.topics).map(Number));
                this.loadTopic(nextLessonNum.toString(), firstTopic.toString());
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
            'противопоказания', 'примечания', 'внимание', 'рекомендации',
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
            'приготовления', 'количество повторений'
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

        const isSectionHeading = line => {
            const normalized = headingKey(line);
            return sectionHeadings.has(normalized)
                || /^(?:упражнение|вариант|этап|стадия|часть|движение)\s*\d+(?:.*)?$/i.test(line.trim());
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
        const joinWrappedLines = lines => {
            let text = '';
            lines.flatMap(line => String(line).split('\n')).forEach(line => {
                let next = line.trim();
                if (!next) return;
                const left = text.match(/([А-Яа-яЁё]+)$/);
                const right = next.match(/^([А-Яа-яЁё]+)(?=[^А-Яа-яЁё]|$)/);
                const splitKey = left && right
                    ? `${left[1].toLocaleLowerCase('ru')} ${right[1].toLocaleLowerCase('ru')}`
                    : '';
                if (splitKey && knownLineWrapSplits.has(splitKey)) {
                    text = text.slice(0, -left[1].length) + left[1] + right[1];
                    next = next.slice(right[1].length).trimStart();
                }
                if (next) text += `${text && !/^[,.;:!?)]/.test(next) ? ' ' : ''}${next}`;
            });
            return text.replace(/\s+/g, ' ').trim();
        };

        const renderParagraph = sourceParagraph => {
            const lines = sourceParagraph.split('\n').map(line => line.trim()).filter(Boolean);
            if (!lines.length) return '';

            const output = [];
            let bodyLines = [];
            let listItems = [];

            const flushBody = () => {
                if (!bodyLines.length) return;
                const body = joinWrappedLines(bodyLines);
                if (body) output.push(`<p>${escapeText(body)}</p>`);
                bodyLines = [];
            };
            const flushList = () => {
                if (!listItems.length) return;
                output.push(`<ol>${listItems.map(item => `<li>${escapeText(joinWrappedLines([item]))}</li>`).join('')}</ol>`);
                listItems = [];
            };

            lines.forEach(line => {
                const normalized = headingKey(line);
                const isSection = isSectionHeading(line) && !/[.!?…][»”\"')\]]?$/.test(line.trim());
                const isExercise = exerciseHeadings.has(normalized);
                const isPrintedTopicHeading = /^Урок\s+\d+\.\s*\S/i.test(line)
                    || /(?:\.\s*){2,}/.test(line);
                const isCapsHeading = line.length < 100
                    && /[А-ЯЁ]/.test(line)
                    && line === line.toLocaleUpperCase('ru')
                    && /[А-ЯЁ]/.test(line.replace(/[\d\s.\-–—]/g, ''));

                if (isSection || isExercise || isPrintedTopicHeading || isCapsHeading) {
                    flushList();
                    flushBody();
                    output.push(`<${isSection ? 'h4' : 'h3'}>${escapeText(line)}</${isSection ? 'h4' : 'h3'}>`);
                    return;
                }

                const numberedItem = line.match(/^\d+[.)]\s+(.+)$/);
                if (numberedItem) {
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

            flushList();
            flushBody();
            return output.join('');
        };

        const pageSegments = [];
        for (let i = 0; i < parts.length; i += 2) {
            let segmentText = parts[i];
            if (!segmentText?.trim()) continue;

            // Source-page headers are repeated scan furniture, not part of
            // the lesson. Remove only metadata-backed or repeated headings at
            // the beginning of a page segment; leave book JSON untouched.
            if (i > 0) {
                const lines = segmentText.split('\n');
                let atPageTop = true;
                segmentText = lines.filter(line => {
                    const value = line.trim();
                    if (!value) return !atPageTop;
                    if (atPageTop && (isPageRunningHeader(value)
                        || headingKey(value) === headingKey('Йога и крийя. Вводный курс'))) {
                        atPageTop = false;
                        return false;
                    }
                    atPageTop = false;
                    return true;
                }).join('\n');
            }
            pageSegments.push({
                page: i > 0 ? Number(parts[i - 1]) : null,
                text: segmentText
            });
        }

        // A few confirmed OCR line wraps fall exactly across a printed-page
        // marker. Join only the whitelisted fragments, leaving all other page
        // boundaries and source text untouched.
        for (let index = 1; index < pageSegments.length; index++) {
            const previousLines = pageSegments[index - 1].text.split('\n');
            const currentLines = pageSegments[index].text.split('\n');
            let previousLineIndex = previousLines.length - 1;
            while (previousLineIndex >= 0 && !previousLines[previousLineIndex].trim()) previousLineIndex--;
            const currentLineIndex = currentLines.findIndex(line => line.trim());
            if (previousLineIndex < 0 || currentLineIndex < 0) continue;

            const leftMatch = previousLines[previousLineIndex].match(/([А-Яа-яЁё]+)\s*$/);
            const rightMatch = currentLines[currentLineIndex].match(/^\s*([А-Яа-яЁё]+)(?=[^А-Яа-яЁё]|$)/);
            if (!leftMatch || !rightMatch) continue;

            const splitKey = `${leftMatch[1].toLocaleLowerCase('ru')} ${rightMatch[1].toLocaleLowerCase('ru')}`;
            if (!knownLineWrapSplits.has(splitKey)) continue;

            previousLines[previousLineIndex] = previousLines[previousLineIndex].replace(
                /([А-Яа-яЁё]+)\s*$/,
                (_, fragment) => `${fragment}${rightMatch[1]}`
            );
            currentLines[currentLineIndex] = currentLines[currentLineIndex].replace(
                /^\s*[А-Яа-яЁё]+/,
                ''
            );
            pageSegments[index - 1].text = previousLines.join('\n');
            pageSegments[index].text = currentLines.join('\n');
        }

        // Keep page numbers while cleaning the text so repeated or short anchors
        // can be resolved near the page where the source places the illustration.
        const paragraphEntries = [];
        pageSegments.forEach(({ page, text }) => {
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
                if (displayParagraph) paragraphEntries.push({ page, text: displayParagraph });
            });
        });

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
                        page: entry.page,
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
                    const pageDistance = entry.page !== null && entry.page !== undefined
                        ? Math.abs(Number(entry.page) - Number(pos.pdf_page))
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
            let cursor = 0;
            for (let index = 0; index < events.length;) {
                const offset = Math.min(entry.text.length, events[index].offset);
                if (offset > cursor) htmlResult += renderParagraph(entry.text.slice(cursor, offset));
                const group = [];
                while (index < events.length && Math.min(entry.text.length, events[index].offset) === offset) {
                    group.push(events[index].pos);
                    index++;
                }
                group.forEach(pos => { htmlResult += this.generateImageHtmlFromPos(pos); });
                cursor = Math.max(cursor, offset);
            }
            if (events.length) {
                if (cursor < entry.text.length) htmlResult += renderParagraph(entry.text.slice(cursor));
            } else {
                htmlResult += renderParagraph(entry.text);
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
        // In the original PDF there are no separate captions under illustrations.
        // pos.caption is preserved as internal metadata for matching algorithms and
        // accessibility (alt attribute), while the visible caption block is only
        // displayed if an authentic caption is literally present in the source.
        const visibleCaption = pos.original_caption || '';
        return `
            <div class="topic-image-container">
                <img src="assets/images/${filename}"
                     alt="${caption}"
                     class="topic-image"
                     loading="lazy"
                     onerror="this.style.display='none'">
                ${visibleCaption ? `<div class="image-caption">${visibleCaption}</div>` : ''}
            </div>`;
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

    toggleBookmark(lessonNum, topicNum) {
        const existingIndex = this.bookmarks.findIndex(b => 
            b.lesson === lessonNum && b.topic === topicNum
        );
        
        if (existingIndex >= 0) {
            this.bookmarks.splice(existingIndex, 1);
            this.showToast('Закладка удалена');
        } else {
            const lesson = this.data.lessons[lessonNum];
            const topic = lesson.topics[topicNum];
            this.bookmarks.push({
                lesson: lessonNum,
                topic: topicNum,
                name: topic.name,
                added: Date.now()
            });
            this.showToast('Закладка добавлена');
        }
        
        this.saveUserData();
        this.renderTopic(lessonNum, topicNum, topic);
    }

    toggleFavorite(lessonNum, topicNum) {
        const existingIndex = this.favorites.findIndex(f => f.lesson === lessonNum && f.topic === topicNum);
        
        if (existingIndex >= 0) {
            this.favorites.splice(existingIndex, 1);
            this.showToast('Удалено из избранного');
        } else {
            const lesson = this.data.lessons[lessonNum];
            const topic = lesson.topics[topicNum];
            this.favorites.push({
                lesson: lessonNum,
                topic: topicNum,
                name: topic.name,
                added: Date.now()
            });
            this.showToast('Добавлено в избранное');
        }
        
        this.saveUserData();
        this.renderTopic(lessonNum, topicNum, topic);
    }

    showBookmarks() {
        const container = document.getElementById('bookmarksList');
        
        if (this.bookmarks.length === 0) {
            container.innerHTML = '<p style="padding: 1rem; color: #666;">Закладок пока нет</p>';
        } else {
            container.innerHTML = this.bookmarks.map((bookmark, index) => `
                <div class="list-item">
                    <button type="button" class="list-item-info" onclick="app.loadBookmark(${index})">
                        <div class="list-item-title">Урок ${bookmark.lesson}, Тема ${bookmark.topic}</div>
                        <div class="list-item-subtitle">${bookmark.name}</div>
                    </button>
                    <button type="button" class="remove-btn" onclick="app.removeBookmark(${index})">Удалить</button>
                </div>
            `).join('');
        }
        
        this.openModal('bookmarksModal');
    }

    loadBookmark(index) {
        const bookmark = this.bookmarks[index];
        this.loadTopic(bookmark.lesson, bookmark.topic);
        this.closeModal('bookmarksModal');
    }

    removeBookmark(index) {
        this.bookmarks.splice(index, 1);
        this.saveUserData();
        this.showBookmarks();
        this.showToast('Закладка удалена');
    }

    showFavorites() {
        const container = document.getElementById('favoritesList');
        
        if (this.favorites.length === 0) {
            container.innerHTML = '<p style="padding: 1rem; color: #666;">Избранного пока нет</p>';
        } else {
            container.innerHTML = this.favorites.map((fav, index) => `
                <div class="list-item">
                    <button type="button" class="list-item-info" onclick="app.loadFavorite(${index})">
                        <div class="list-item-title">Урок ${fav.lesson}, Тема ${fav.topic}</div>
                        <div class="list-item-subtitle">${fav.name}</div>
                    </button>
                    <button type="button" class="remove-btn" onclick="app.removeFavorite(${index})">Удалить</button>
                </div>
            `).join('');
        }
        
        this.openModal('favoritesModal');
    }

    loadFavorite(index) {
        const fav = this.favorites[index];
        this.loadTopic(fav.lesson, fav.topic);
        this.closeModal('favoritesModal');
    }

    removeFavorite(index) {
        this.favorites.splice(index, 1);
        this.saveUserData();
        this.showFavorites();
        this.showToast('Удалено из избранного');
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

    performSearch(query) {
        const resultsContainer = document.getElementById('searchResults');
        
        if (!query || query.length < 2) {
            resultsContainer.innerHTML = '';
            return;
        }
        
        const results = [];
        const lowerQuery = query.toLowerCase();
        
        // Search through all topics in lessons, sorted
        const sortedLessons = Object.entries(this.data.lessons)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

        for (const [lessonNum, lesson] of sortedLessons) {
            const sortedTopics = Object.entries(lesson.topics)
                .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

            for (const [topicNum, topic] of sortedTopics) {
                const text = topic.text.toLowerCase();
                const name = topic.name.toLowerCase();

                if (text.includes(lowerQuery) || name.includes(lowerQuery)) {
                    // Find context around the match in text
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
                        lesson: lessonNum,
                        topic: topicNum,
                        name: topic.name,
                        snippet: '...' + snippet + '...',
                        startPage: topic.start_page
                    });
                }
            }
        }
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<p style="padding: 1rem; color: #666;">Ничего не найдено</p>';
        } else {
            resultsContainer.innerHTML = results.slice(0, 50).map(result => `
                <button type="button" class="list-item" onclick="app.loadSearchResult('${result.lesson}', '${result.topic}')">
                    <div class="list-item-info">
                        <div class="list-item-title">Урок ${result.lesson}, Тема ${result.topic}: ${result.name}</div>
                        <div class="list-item-subtitle" style="font-size: 0.85rem; color: #666;">${result.snippet}</div>
                    </div>
                </button>
            `).join('');
        }
    }

    loadSearchResult(lessonNum, topicNum) {
        this.loadTopic(lessonNum, topicNum);
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

    showWelcomePage() {
        const contentArea = document.getElementById('contentArea');
        const lessonsCount = Object.keys(this.data.lessons).length;
        
        // Count total topics from lessons structure
        let topicsCount = 0;
        for (const lesson of Object.values(this.data.lessons)) {
            topicsCount += Object.keys(lesson.topics).length;
        }
        
        contentArea.innerHTML = `
            <div class="page-header">
                <h1>${this.data.title}</h1>
                <div class="subtitle">Добро пожаловать в приложение для изучения Крийя Йоги</div>
            </div>
            
            <div class="page-content">
                <div class="welcome-image-container">
                    <img src="assets/images/img001.jpg" alt="Эмблема на обложке книги" class="welcome-image" onerror="this.style.display='none'">
                </div>
                <p class="welcome-intro">Это приложение содержит полный курс древних тантрических техник йоги и крийи.</p>
                
                <h3>О курсе</h3>
                <p>Курс состоит из <strong>${lessonsCount} уроков</strong>, включающих <strong>${topicsCount} тем</strong> по различным аспектам йогической практики:</p>
                <ul class="welcome-topic-list">
                    <li>Крийя йога</li>
                    <li>Хатха йога (асаны, шаткармы)</li>
                    <li>Пранаяма (дыхательные техники)</li>
                    <li>Медитация и осознание</li>
                    <li>Мудры</li>
                    <li>Философия йоги</li>
                </ul>
                
                <h3>Как пользоваться приложением</h3>
                <ul class="welcome-guide-list">
                    <li>Выбирайте уроки и темы в меню слева</li>
                    <li>Используйте поиск для быстрого нахождения информации</li>
                    <li>Добавляйте важные страницы в закладки</li>
                    <li>Отмечайте избранные темы для быстрого доступа</li>
                    <li>Отслеживайте свой прогресс обучения</li>
                </ul>
                
                <h3>Функции приложения</h3>
                <div class="welcome-feature-grid">
                    <div class="feature-card">
                        <div class="feature-icon" aria-hidden="true">📚</div>
                        <strong>Уроки</strong>
                        <p>${lessonsCount} уроков с темами</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon" aria-hidden="true">🔖</div>
                        <strong>Закладки</strong>
                        <p>${this.bookmarks.length} сохранено</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon" aria-hidden="true">❤️</div>
                        <strong>Избранное</strong>
                        <p>${this.favorites.length} тем</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon" aria-hidden="true">📊</div>
                        <strong>Прогресс</strong>
                        <p>Отслеживание обучения</p>
                    </div>
                </div>
                
                <p class="welcome-note">
                    Начните свое путешествие в мир йоги, выбрав первый урок в меню слева.
                </p>
            </div>
        `;
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        this.modalReturnFocus = document.activeElement;
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        const initialFocus = modal.id === 'searchModal'
            ? modal.querySelector('#searchInput')
            : modal.querySelector('button:not([disabled])');
        if (initialFocus) initialFocus.focus();
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        if (this.modalReturnFocus && this.modalReturnFocus.isConnected) this.modalReturnFocus.focus();
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
