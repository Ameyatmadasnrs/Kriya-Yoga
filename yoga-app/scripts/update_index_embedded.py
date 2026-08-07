import json
import os

def update():
    # Load latest data
    with open('yoga-app/data/book.json', 'r', encoding='utf-8') as f:
        book_json = f.read()

    with open('yoga-app/assets/images/image-map.json', 'r', encoding='utf-8') as f:
        image_map_json = f.read()

    # Read index.html
    with open('yoga-app/index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # Replace embeddedBookData
    start_tag = '<script id="embeddedBookData" type="application/json">'
    end_tag = '</script>'

    start_idx = html.find(start_tag) + len(start_tag)
    end_idx = html.find(end_tag, start_idx)

    html = html[:start_idx] + "\n" + book_json + "\n" + html[end_idx:]

    # Replace embeddedImageMap
    start_tag = '<script id="embeddedImageMap" type="application/json">'
    end_tag = '</script>'

    start_idx = html.find(start_tag) + len(start_tag)
    end_idx = html.find(end_tag, start_idx)

    html = html[:start_idx] + "\n" + image_map_json + "\n" + html[end_idx:]

    # Save updated index.html
    with open('yoga-app/index.html', 'w', encoding='utf-8') as f:
        f.write(html)

    print("Updated index.html with embedded data")

if __name__ == "__main__":
    update()
