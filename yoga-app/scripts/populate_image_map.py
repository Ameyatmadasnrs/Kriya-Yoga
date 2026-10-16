"""Sync image-to-topic associations from the curated image position records."""
import json
from pathlib import Path


def populate():
    root = Path(__file__).resolve().parent.parent
    map_path = root / "assets" / "images" / "image-map.json"
    positions_path = root / "data" / "image-positions.json"
    book_path = root / "data" / "book.json"

    image_map = json.loads(map_path.read_text(encoding="utf-8"))
    positions = json.loads(positions_path.read_text(encoding="utf-8"))
    book = json.loads(book_path.read_text(encoding="utf-8"))
    by_filename = {item["image_filename"]: item for item in positions}

    for image in image_map:
        position = by_filename.get(image["image_filename"])
        if position is None:
            image.update(lesson="", topic="", topic_title="")
            continue
        image["lesson"] = str(position["lesson"])
        image["topic"] = str(position["topic"])
        image["topic_title"] = book["lessons"][str(position["lesson"])]["topics"][str(position["topic"])]["name"]

    map_path.write_text(
        json.dumps(image_map, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Synchronized {len(image_map)} image records from curated positions.")


if __name__ == "__main__":
    populate()
