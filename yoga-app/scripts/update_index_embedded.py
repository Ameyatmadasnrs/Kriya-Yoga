"""Legacy entry point: confirm that book data stays in canonical JSON files."""
from pathlib import Path

def validate():
    root = Path(__file__).resolve().parent.parent
    html = (root / "index.html").read_text(encoding="utf-8")
    forbidden = ("embeddedBookData", "embeddedImageMap", "embeddedImagePositions")
    found = [block_id for block_id in forbidden if f'id=\"{block_id}\"' in html]
    if found:
        raise SystemExit("Inline data blocks found in index.html: " + ", ".join(found))
    for relative in ("data/book.json", "data/image-positions.json", "data/practice-plans.json"):
        if not (root / relative).is_file():
            raise SystemExit("Missing canonical data file: " + relative)
    print("Canonical JSON sources are present; index.html contains no embedded data.")

if __name__ == "__main__":
    validate()
