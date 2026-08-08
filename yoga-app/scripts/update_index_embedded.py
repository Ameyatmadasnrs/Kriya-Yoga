import json
import re

def update():
    # Load data
    with open('yoga-app/data/book.json', 'r', encoding='utf-8') as f:
        book_data = json.load(f)

    with open('yoga-app/assets/images/image-map.json', 'r', encoding='utf-8') as f:
        image_map = json.load(f)

    # Read index.html
    with open('yoga-app/index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # Update embedded book data
    book_json_str = json.dumps(book_data, ensure_ascii=False, indent=2)
    html = re.sub(
        r'<script id="embeddedBookData" type="application/json">.*?</script>',
        f'<script id="embeddedBookData" type="application/json">\n{book_json_str}\n</script>',
        html,
        flags=re.DOTALL
    )

    # Update embedded image map
    image_map_str = json.dumps(image_map, ensure_ascii=False, indent=2)
    html = re.sub(
        r'<script id="embeddedImageMap" type="application/json">.*?</script>',
        f'<script id="embeddedImageMap" type="application/json">\n{image_map_str}\n</script>',
        html,
        flags=re.DOTALL
    )

    with open('yoga-app/index.html', 'w', encoding='utf-8') as f:
        f.write(html)

    print("Updated embedded data in index.html")

if __name__ == "__main__":
    update()
