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
                <div class="lesson-title">Урок ${lessonNum}</div>
                <ul class="topic-list">
                    ${sortedTopics.map(([topicNum, topic]) => `
                        <li class="topic-item ${this.currentLesson === lessonNum && this.currentTopic === topicNum ? 'active' : ''}"
                            data-lesson="${lessonNum}" data-topic="${topicNum}">
                            Тема ${topicNum}: ${topic.name}
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
                } else {
                    this.expandedLessons.add(lessonNum);
                    lessonEl.classList.add('expanded');
                    lessonEl.classList.remove('collapsed');
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

        // Scroll to top - ensure both container and window scroll
        document.getElementById('mainContent').scrollTop = 0;
        window.scrollTo(0, 0);
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
                    <div class="program-actions">
                        <button class="start-practice-btn" onclick="alert('Функция таймера будет добавлена в следующем обновлении!')">
                            🧘 Начать практику
                        </button>
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
        let currentPage = parseInt(startPage);
        let placedImages = new Set();

        for (let i = 0; i < parts.length; i++) {
            if (i % 2 === 0) {
                // This is a block of text belonging to currentPage
                let segmentText = parts[i];
                if (!segmentText.trim()) continue;

                // Split segment into paragraphs
                let paragraphs = segmentText.split(/\n\n+/);

                paragraphs.forEach(p => {
                    p = p.trim();
                    if (!p) return;

                    // Header detection
                    const isHeader = p.match(/^[А-ЯЁ\d\.\s\-]+$/) && p.length < 100 && p === p.toUpperCase();
                    const normalizedHeading = p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('ru');
                    const isBookSubheading = /^(?:поза|подготовка|исходное положение|положение|техника выполнения|выполнение|дыхание|осознание|последовательность|продолжительность занятий|дыхание, осознание и продолжительность|польза практики|благотворное действие|ограничения и предосторожности|противопоказания|примечания|внимание|рекомендации)$/.test(normalizedHeading)
                        || /^(?:упражнение|вариант|этап)\s+\d+(?:[.:)]\s*.*)?$/.test(normalizedHeading);

                    // Check if any image belongs here
                    let imagesToInsert = [];
                    const normalize = (t) => t.replace(/[^а-яёa-z0-9]/gi, '').toLowerCase();
                    const normalizedP = normalize(p);

                    relevantPositions.forEach(pos => {
                        if (!placedImages.has(pos.image_filename)) {
                            const normalizedAnchor = normalize(pos.anchor_text);
                            // Search for anchor text in the paragraph
                            if (normalizedP.includes(normalizedAnchor)) {
                                imagesToInsert.push(pos);
                                placedImages.add(pos.image_filename);
                            }
                        }
                    });

                    if (isHeader) {
                        htmlResult += `<h3>${p.replace(/\n/g, ' ')}</h3>`;
                    } else if (isBookSubheading) {
                        htmlResult += `<h4>${p.replace(/\n/g, ' ')}</h4>`;
                    } else {
                        // Join hard-wrapped lines with a space to allow fluid typography
                        // and prevent arbitrary word breaking from manual PDF-style newlines.
                        let formattedText = p.replace(/\n/g, ' ');
                        htmlResult += `<p>${formattedText}</p>`;
                    }

                    // Insert images AFTER the paragraph containing their anchor
                    imagesToInsert.forEach(pos => {
                        htmlResult += this.generateImageHtmlFromPos(pos);
                    });
                });
            } else {
                // Page marker
                const pageNum = parseInt(parts[i]);
                htmlResult += `<div class="page-break-marker" title="PDF Page ${pageNum}"></div>`;
                currentPage = pageNum + 1;
            }
        }

        // Safety: Insert any images that were matched to this topic but NOT placed via anchors
        relevantPositions.forEach(pos => {
            if (!placedImages.has(pos.image_filename)) {
                htmlResult += this.generateImageHtmlFromPos(pos);
                placedImages.add(pos.image_filename);
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
        return `
            <div class="topic-image-container">
                <img src="assets/images/${filename}"
                     alt="${caption}"
                     class="topic-image"
                     loading="lazy"
                     onerror="this.style.display='none'">
                ${caption ? `<div class="image-caption">${caption}</div>` : ''}
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
                    <img src="assets/images/img001.jpg" alt="Cover Image" class="welcome-image" onerror="this.style.display='none'">
                </div>
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
