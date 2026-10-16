# 🧘 Ancient Yoga & Kriya - Premium Learning Application

A premium mobile-first web application for studying the complete course of Ancient Tantric Techniques of Yoga and Kriya.

## ✨ Features

### Core Learning Experience
- **📚 Course Content** - 12 lessons with 84 topics in the available Russian OCR text
- **📖 Beautiful Reading Interface** - Clean, distraction-free reading with premium typography
- **🔍 Full-Text Search** - Find any topic or concept instantly
- **📊 Progress Tracking** - Visual progress bars for each lesson and overall completion

### Personal Organization
- **🔖 Bookmarks** - Save important pages for quick access
- **❤️ Favorites** - Mark key topics you want to revisit
- **🏆 Achievements** - Unlock badges as you progress through the course

### Practice Tools
- **🔥 Daily Streak** - Track your daily practice consistency
- **📈 Statistics** - View your learning statistics and achievements

### Premium UI/UX
- **🎨 Beautiful Design** - Inspired by Apple Books, Headspace, and Calm
- **📱 Responsive Layout** - Works perfectly on mobile, tablet, and desktop
- **🌙 Smooth Animations** - Polished transitions and interactions
- **💾 Local Progress** - Bookmarks, favorites, and progress are stored in this browser

## 🚀 Getting Started

No package installation or build step is required. Run the app through a local web server so the browser can load its JSON data and images.

### For Development
```bash
# Windows PowerShell, from this folder
python -m http.server 8000

# Then open http://localhost:8000

# Or use any static file server
npx serve .
```

## 📁 Project Structure

```
yoga-app/
├── index.html          # Main HTML file
├── styles.css          # Premium CSS styles
├── app.js              # Application logic
├── README.md           # This file
├── data/
│   ├── book.json       # Canonical course text (12 lessons, 84 topics)
│   ├── image-positions.json # Curated image-to-topic links and text anchors
│   └── practice-plans.json  # Practice plan data
├── scripts/
│   └── repair_ocr_line_breaks.py # Repairs line-wrap splits against ../data
└── assets/images/
    ├── img001.jpg ...  # Scanned illustrations
    └── image-map.json  # Image metadata synchronized from image positions
```

## 🎯 How to Use

1. **Start Learning** - Select Lesson 1 from the sidebar menu
2. **Read Topics** - Click on any topic to begin reading
3. **Track Progress** - Your progress is automatically saved
4. **Use Features**:
   - 🔖 Bookmark important pages
   - ❤️ Add topics to favorites
   - 🔍 Search across all content

## 🏆 Achievement System

Unlock achievements as you learn:
- 🌟 First Step - Start your first lesson
- 🔍 Explorer - Complete 5 topics
- 📖 Student - Complete 10 topics
- 🔥 Consistent - 3 day streak
- ⚡ Devoted - 7 day streak
- 🎯 Halfway - 50% course completion
- 🏆 Master - Complete all lessons

## 💾 Data Storage

Book text and practice material load from `data/*.json`. User data is stored locally in browser localStorage:
- Bookmarks
- Favorites
- Reading progress
- Personal notes
- Achievements
- Daily streak

No data is sent to any server - everything stays on your device.

## 🎨 Design Philosophy

The application combines the best elements from:
- **Apple Books** - Clean reading experience
- **Headspace** - Calm, meditative interface
- **Calm** - Soothing color palette
- **Duolingo** - Gamified progress tracking
- **Notion** - Organized content structure

## 📄 License

This application uses the complete text from "Ancient Tantric Techniques of Yoga and Kriya" by Swami Satyananda Saraswati.

---

Built with ❤️ for yoga practitioners worldwide
