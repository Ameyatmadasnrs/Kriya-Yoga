import json
import os

def populate():
    # Load book data to get page ranges for each topic
    with open('yoga-app/data/book.json', 'r', encoding='utf-8') as f:
        book_data = json.load(f)

    # Load image map
    image_map_path = 'yoga-app/assets/images/image-map.json'
    with open(image_map_path, 'r', encoding='utf-8') as f:
        image_map = json.load(f)

    # Flatten book topics with their page ranges
    topics_ranges = []
    for lesson_num, lesson in book_data['lessons'].items():
        for topic_num, topic in lesson['topics'].items():
            topics_ranges.append({
                'lesson': lesson_num,
                'topic': topic_num,
                'start_page': topic['start_page'],
                'end_page': topic['end_page'],
                'name': topic['name']
            })

    # Update each image in the map
    for img in image_map:
        page = img.get('pdf_page')
        if not page:
            continue

        # Find which topic this page belongs to
        found = False
        for tr in topics_ranges:
            if tr['start_page'] <= page <= tr['end_page']:
                img['lesson'] = tr['lesson']
                img['topic'] = tr['topic']
                img['topic_title'] = tr['name']
                found = True
                break

        if not found:
            # Maybe it's a cover or front matter
            img['lesson'] = ""
            img['topic'] = ""

    # Save updated image map
    with open(image_map_path, 'w', encoding='utf-8') as f:
        json.dump(image_map, f, ensure_ascii=False, indent=2)

    print(f"Updated {len(image_map)} images in image-map.json")

if __name__ == "__main__":
    populate()
