// Yoga Application - Main JavaScript (Enhanced Premium Version)
class YogaApp {
    constructor() {
        this.data = null;
        this.currentLesson = null;
        this.currentTopic = null;
        this.bookmarks = [];
        this.favorites = [];
        this.readProgress = {};
        this.notes = {};
        this.highlights = {};
        this.sidebarOpen = true;
        this.searchQuery = '';
        this.dailyStreak = 0;
        this.lastVisitDate = null;
        this.achievements = [];
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.loadUserData();
        this.checkDailyStreak();
        this.renderLessonsList();
        this.showWelcomePage();
    }

    async loadData() {
        try {
            const response = await fetch('data/book.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.data = await response.json();
            document.getElementById('appTitle').textContent = this.data.title.split('.')[0];
        } catch (error) {
            console.error('Error loading data via fetch:', error);
            // Fallback: Try to load data embedded in HTML for local file access
            this.loadEmbeddedData();
        }
    }

    loadEmbeddedData() {
        // Check if data is embedded in a script tag (for local file access)
        const embeddedData = document.getElementById('embeddedBookData');
        if (embeddedData && embeddedData.textContent) {
            try {
                this.data = JSON.parse(embeddedData.textContent);
                document.getElementById('appTitle').textContent = this.data.title.split('.')[0];
                console.log('Loaded embedded book data successfully');
                return;
            } catch (e) {
                console.error('Error parsing embedded data:', e);
            }
        }
        console.error('Error loading data: Please run this app via a local server (e.g., python -m http.server) or use VS Code Live Server extension.');
        this.showToast('Запустите через локальный сервер или используйте Live Server в VS Code');
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
            { id: 'all_lessons', name: 'Мастер', desc: 'Все уроки пройдены', check: () => Object.keys(this.readProgress).length >= 72 }
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
        // Menu toggle
        document.getElementById('menuToggle').addEventListener('click', () => this.toggleSidebar());
        
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

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.show').forEach(modal => {
                    modal.classList.remove('show');
                });
            }
        });
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('show');
        } else {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
        }
        this.sidebarOpen = !sidebar.classList.contains('collapsed') && !sidebar.classList.contains('show');
    }

    renderLessonsList() {
        const container = document.getElementById('lessonsList');
        container.innerHTML = '';

        for (const [lessonNum, lesson] of Object.entries(this.data.lessons)) {
            const lessonEl = document.createElement('div');
            lessonEl.className = 'lesson-item';
            lessonEl.dataset.lesson = lessonNum;
            
            const topicCount = Object.keys(lesson.topics).length;
            
            lessonEl.innerHTML = `
                <div class="lesson-title">Урок ${lessonNum}</div>
                <ul class="topic-list">
                    ${Object.entries(lesson.topics).map(([topicNum, topic]) => `
                        <li class="topic-item" data-lesson="${lessonNum}" data-topic="${topicNum}">
                            Тема ${topicNum}: ${topic.name}
                        </li>
                    `).join('')}
                </ul>
            `;
            
            container.appendChild(lessonEl);
        }

        // Add click handlers
        container.querySelectorAll('.topic-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const lesson = item.dataset.lesson;
                const topic = item.dataset.topic;
                this.loadTopic(lesson, topic);
                
                // Update active states
                container.querySelectorAll('.topic-item').forEach(t => t.classList.remove('active'));
                item.classList.add('active');
                container.querySelectorAll('.lesson-item').forEach(l => l.classList.remove('active'));
                container.querySelector(`.lesson-item[data-lesson="${lesson}"]`).classList.add('active');
                
                // Close sidebar on mobile
                if (window.innerWidth <= 768) {
                    document.getElementById('sidebar').classList.remove('show');
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
        
        const topic = lesson.topics[topicNum];
        this.renderTopic(lessonNum, topicNum, topic);
        this.updateReadingProgress(lessonNum, topicNum);
    }

    renderTopic(lessonNum, topicNum, topic) {
        const contentArea = document.getElementById('contentArea');
        
        // Format the text content
        const formattedContent = this.formatContent(topic.text);
        
        const isBookmarked = this.bookmarks.some(b => b.lesson === lessonNum && b.topic === topicNum);
        const isFavorite = this.favorites.some(f => f.lesson === lessonNum && f.topic === topicNum);
        
        contentArea.innerHTML = `
            <div class="page-header">
                <h1>Урок ${lessonNum}</h1>
                <div class="subtitle">Тема ${topicNum}: ${topic.name}</div>
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

        // Scroll to top
        document.getElementById('mainContent').scrollTop = 0;
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

    formatContent(text) {
        if (!text) return '';
        
        // Split into paragraphs and process each
        let paragraphs = text.split('\n\n');
        
        return paragraphs.map(p => {
            p = p.trim();
            if (!p) return '';
            
            // Check if it's a header
            if (p.match(/^[А-ЯЁ][А-ЯЁ\s]+$/i) && p.length < 60) {
                return `<h3>${p}</h3>`;
            }
            
            // Replace common patterns
            p = p.replace(/\n/g, '<br>');
            
            // Wrap in paragraph tag
            return `<p>${p}</p>`;
        }).filter(p => p).join('');
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
                    <div class="list-item-info" onclick="app.loadBookmark(${index})">
                        <div class="list-item-title">Урок ${bookmark.lesson}, Тема ${bookmark.topic}</div>
                        <div class="list-item-subtitle">${bookmark.name}</div>
                    </div>
                    <button class="remove-btn" onclick="app.removeBookmark(${index})">Удалить</button>
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
                    <div class="list-item-info" onclick="app.loadFavorite(${index})">
                        <div class="list-item-title">Урок ${fav.lesson}, Тема ${fav.topic}</div>
                        <div class="list-item-subtitle">${fav.name}</div>
                    </div>
                    <button class="remove-btn" onclick="app.removeFavorite(${index})">Удалить</button>
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
        
        // Search through all topics in lessons
        for (const [lessonNum, lesson] of Object.entries(this.data.lessons)) {
            for (const [topicNum, topic] of Object.entries(lesson.topics)) {
                const text = topic.text.toLowerCase();
                
                if (text.includes(lowerQuery)) {
                    // Find context around the match
                    const index = text.indexOf(lowerQuery);
                    const start = Math.max(0, index - 50);
                    const end = Math.min(topic.text.length, index + query.length + 50);
                    const snippet = topic.text.substring(start, end).replace(/\n/g, ' ');
                    
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
                <div class="list-item" onclick="app.loadTopic('${result.lesson}', '${result.topic}')">
                    <div class="list-item-info">
                        <div class="list-item-title">Урок ${result.lesson}, Тема ${result.topic}: ${result.name}</div>
                        <div class="list-item-subtitle" style="font-size: 0.85rem; color: #666;">${result.snippet}</div>
                    </div>
                </div>
            `).join('');
        }
    }

    loadSearchResult(sectionKey, pageIndex) {
        // Handled by loadTopic now
        this.closeModal('searchModal');
    }

    renderFrontMatterPage(page) {
        const contentArea = document.getElementById('contentArea');
        const formattedContent = this.formatContent(page.text);
        
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
                <p>Это приложение содержит полный курс древних тантрических техник йоги и крийи.</p>
                
                <h3>О курсе</h3>
                <p>Курс состоит из <strong>${lessonsCount} уроков</strong>, включающих <strong>${topicsCount} тем</strong> по различным аспектам йогической практики:</p>
                <ul style="margin: 1rem 0 1rem 2rem; line-height: 1.8;">
                    <li>Крийя йога</li>
                    <li>Хатха йога (асаны, шаткармы)</li>
                    <li>Пранаяма (дыхательные техники)</li>
                    <li>Медитация и осознание</li>
                    <li>Мудры</li>
                    <li>Философия йоги</li>
                </ul>
                
                <h3>Как пользоваться приложением</h3>
                <ul style="margin: 1rem 0 1rem 2rem; line-height: 1.8;">
                    <li>Выбирайте уроки и темы в меню слева</li>
                    <li>Используйте поиск для быстрого нахождения информации</li>
                    <li>Добавляйте важные страницы в закладки</li>
                    <li>Отмечайте избранные темы для быстрого доступа</li>
                    <li>Отслеживайте свой прогресс обучения</li>
                </ul>
                
                <h3>Функции приложения</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;">
                    <div style="padding: 1rem; background: var(--bg-color); border-radius: 8px;">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">📚</div>
                        <strong>Уроки</strong>
                        <p style="font-size: 0.9rem; margin-top: 0.3rem;">${lessonsCount} уроков с темами</p>
                    </div>
                    <div style="padding: 1rem; background: var(--bg-color); border-radius: 8px;">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔖</div>
                        <strong>Закладки</strong>
                        <p style="font-size: 0.9rem; margin-top: 0.3rem;">${this.bookmarks.length} сохранено</p>
                    </div>
                    <div style="padding: 1rem; background: var(--bg-color); border-radius: 8px;">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">❤️</div>
                        <strong>Избранное</strong>
                        <p style="font-size: 0.9rem; margin-top: 0.3rem;">${this.favorites.length} тем</p>
                    </div>
                    <div style="padding: 1rem; background: var(--bg-color); border-radius: 8px;">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">📊</div>
                        <strong>Прогресс</strong>
                        <p style="font-size: 0.9rem; margin-top: 0.3rem;">Отслеживание обучения</p>
                    </div>
                </div>
                
                <p style="margin-top: 2rem; text-align: center; color: var(--primary-color); font-style: italic;">
                    Начните свое путешествие в мир йоги, выбрав первый урок в меню слева.
                </p>
            </div>
        `;
    }

    openModal(modalId) {
        document.getElementById(modalId).classList.add('show');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('show');
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
