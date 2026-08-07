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
            this.data = await response.json();
            document.getElementById('appTitle').textContent = this.data.title.split('.')[0];
        } catch (error) {
            console.error('Error loading data:', error);
            this.showToast('Ошибка загрузки данных');
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
        this.currentPage = 0;
        
        const sectionKey = `L${lessonNum}T${topicNum}`;
        const section = this.data.sections[sectionKey];
        
        if (section && section.pages.length > 0) {
            this.renderPage(section, 0);
            this.updateReadingProgress(lessonNum, topicNum);
        }
    }

    renderPage(section, pageIndex) {
        if (!section || !section.pages[pageIndex]) return;
        
        const page = section.pages[pageIndex];
        const contentArea = document.getElementById('contentArea');
        
        // Format the text content
        const formattedContent = this.formatContent(page.text);
        
        const isBookmarked = this.bookmarks.some(b => b.sectionKey === `L${section.lesson}T${section.topic}` && b.pageIndex === pageIndex);
        const isFavorite = this.favorites.some(f => f.sectionKey === `L${section.lesson}T${section.topic}`);
        
        contentArea.innerHTML = `
            <div class="page-header">
                <h1>Урок ${section.lesson}</h1>
                <div class="subtitle">Тема ${section.topic}: ${section.name}</div>
            </div>
            
            <div class="page-content">
                ${formattedContent}
            </div>
            
            <div class="page-number">Страница ${page.page} из ${this.data.pages.length}</div>
            
            <div class="content-actions">
                <button class="action-btn ${isBookmarked ? 'active' : ''}" onclick="app.toggleBookmark('${section.lesson}', '${section.topic}', ${pageIndex})">
                    ${isBookmarked ? '⭐ Закладка' : '🔖 Добавить закладку'}
                </button>
                <button class="action-btn ${isFavorite ? 'active' : ''}" onclick="app.toggleFavorite('${section.lesson}', '${section.topic}')">
                    ${isFavorite ? '❤️ В избранном' : '🤍 В избранное'}
                </button>
            </div>
            
            <div class="content-nav">
                <button class="nav-btn" id="prevBtn" ${pageIndex <= 0 ? 'disabled' : ''}>← Назад</button>
                <button class="nav-btn" id="nextBtn" ${pageIndex >= section.pages.length - 1 ? 'disabled' : ''}>Вперед →</button>
            </div>
        `;

        // Setup navigation
        document.getElementById('prevBtn').addEventListener('click', () => {
            if (pageIndex > 0) {
                this.renderPage(section, pageIndex - 1);
            }
        });
        
        document.getElementById('nextBtn').addEventListener('click', () => {
            if (pageIndex < section.pages.length - 1) {
                this.renderPage(section, pageIndex + 1);
                this.updateReadingProgress(section.lesson, section.topic);
            }
        });

        // Scroll to top
        document.getElementById('mainContent').scrollTop = 0;
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

    toggleBookmark(lessonNum, topicNum, pageIndex) {
        const sectionKey = `L${lessonNum}T${topicNum}`;
        const section = this.data.sections[sectionKey];
        const existingIndex = this.bookmarks.findIndex(b => 
            b.sectionKey === sectionKey && b.pageIndex === pageIndex
        );
        
        if (existingIndex >= 0) {
            this.bookmarks.splice(existingIndex, 1);
            this.showToast('Закладка удалена');
        } else {
            this.bookmarks.push({
                sectionKey,
                lesson: lessonNum,
                topic: topicNum,
                pageIndex,
                name: section.name,
                page: section.pages[pageIndex].page,
                added: Date.now()
            });
            this.showToast('Закладка добавлена');
        }
        
        this.saveUserData();
        this.renderPage(section, pageIndex);
    }

    toggleFavorite(lessonNum, topicNum) {
        const sectionKey = `L${lessonNum}T${topicNum}`;
        const section = this.data.sections[sectionKey];
        const existingIndex = this.favorites.findIndex(f => f.sectionKey === sectionKey);
        
        if (existingIndex >= 0) {
            this.favorites.splice(existingIndex, 1);
            this.showToast('Удалено из избранного');
        } else {
            this.favorites.push({
                sectionKey,
                lesson: lessonNum,
                topic: topicNum,
                name: section.name,
                added: Date.now()
            });
            this.showToast('Добавлено в избранное');
        }
        
        this.saveUserData();
        this.renderPage(section, this.currentPage);
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
                        <div class="list-item-subtitle">${bookmark.name} • Стр. ${bookmark.page}</div>
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
        const totalSections = Object.keys(this.data.sections).length;
        const sectionsRead = Object.keys(this.readProgress).length;
        const percentage = Math.round((sectionsRead / totalSections) * 100);
        
        const container = document.getElementById('progressContent');
        container.innerHTML = `
            <div class="progress-overview">
                <div class="progress-percentage">${percentage}%</div>
                <div class="progress-label">Пройдено материала</div>
                <div style="margin-top: 0.5rem; font-size: 0.9rem;">
                    ${sectionsRead} из ${totalSections} тем
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
        
        // Search through all pages
        for (const [sectionKey, section] of Object.entries(this.data.sections)) {
            for (let i = 0; i < section.pages.length; i++) {
                const page = section.pages[i];
                const text = page.text.toLowerCase();
                
                if (text.includes(lowerQuery)) {
                    // Find context around the match
                    const index = text.indexOf(lowerQuery);
                    const start = Math.max(0, index - 50);
                    const end = Math.min(page.text.length, index + query.length + 50);
                    const snippet = page.text.substring(start, end).replace(/\n/g, ' ');
                    
                    results.push({
                        sectionKey,
                        lesson: section.lesson,
                        topic: section.topic,
                        name: section.name,
                        pageIndex: i,
                        page: page.page,
                        snippet: (start > 0 ? '...' : '') + snippet + (end < page.text.length ? '...' : '')
                    });
                }
            }
        }
        
        // Also search in front matter
        if (this.data.front_matter && this.data.front_matter.pages) {
            for (const page of this.data.front_matter.pages) {
                const text = page.text.toLowerCase();
                if (text.includes(lowerQuery)) {
                    const index = text.indexOf(lowerQuery);
                    const start = Math.max(0, index - 50);
                    const end = Math.min(page.text.length, index + query.length + 50);
                    const snippet = page.text.substring(start, end).replace(/\n/g, ' ');
                    
                    results.push({
                        sectionKey: 'front',
                        lesson: 0,
                        topic: 0,
                        name: 'Введение',
                        pageIndex: page.page - 1,
                        page: page.page,
                        snippet: (start > 0 ? '...' : '') + snippet + (end < page.text.length ? '...' : '')
                    });
                }
            }
        }
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<p style="padding: 1rem; color: #666;">Ничего не найдено</p>';
        } else {
            resultsContainer.innerHTML = results.slice(0, 50).map(result => `
                <div class="search-result-item" onclick="app.loadSearchResult('${result.sectionKey}', ${result.pageIndex})">
                    <h4>Урок ${result.lesson > 0 ? result.lesson : ''}${result.lesson > 0 ? ', Тема ' + result.topic : ''} - ${result.name}</h4>
                    <div class="snippet">${result.snippet}</div>
                    <div style="font-size: 0.8rem; color: #999; margin-top: 0.3rem;">Страница ${result.page}</div>
                </div>
            `).join('');
        }
    }

    loadSearchResult(sectionKey, pageIndex) {
        if (sectionKey === 'front') {
            // Show front matter page
            const page = this.data.front_matter.pages[pageIndex];
            if (page) {
                this.renderFrontMatterPage(page);
            }
        } else {
            const section = this.data.sections[sectionKey];
            if (section) {
                this.renderPage(section, pageIndex);
            }
        }
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
        const topicsCount = Object.keys(this.data.sections).length;
        
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
