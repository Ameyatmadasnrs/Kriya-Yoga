"""Repair line-break word splits using the text extracted from the source PDF."""
import json
import re
from collections import Counter
from pathlib import Path


WORD = re.compile(r"[а-яё]+", re.IGNORECASE)


def key(word):
    return word.casefold().replace("ё", "е")


def source_vocabulary(source_pages):
    return {key(match.group()) for text in cleaned_source_pages(source_pages) for match in WORD.finditer(text)}


def cleaned_source_pages(source_pages):
    soft_break = re.compile(
        r"(?<=[а-яё])(?:\x1a|\x17)[ \t]*\r?\n[ \t]*(?=[а-яё])",
        re.IGNORECASE,
    )
    return [soft_break.sub("", page.get("text", "")) for page in source_pages]


def source_context_ngrams(pages, start_page, end_page):
    first_pdf_page = start_page // 2 + 1
    last_pdf_page = end_page // 2 + 1
    words = []
    for page_number in range(first_pdf_page, last_pdf_page + 1):
        if 1 <= page_number <= len(pages):
            words.extend(key(match.group()) for match in WORD.finditer(pages[page_number - 1]))
    return {
        tuple(words[index:index + size])
        for size in (5, 6, 7)
        for index in range(max(0, len(words) - size + 1))
    }


def context_matches(words, index, joined, ngrams):
    start = max(0, index - 3)
    end = min(len(words), index + 5)
    phrase = tuple(key(match.group()) for match in words[start:index])
    phrase += (key(joined),)
    phrase += tuple(key(match.group()) for match in words[index + 2:end])
    return len(phrase) >= 5 and phrase in ngrams


def repair_text(text, vocabulary, context_ngrams):
    count = 0
    while True:
        words = list(WORD.finditer(text))
        result = text
        last_start = len(text) + 1
        pass_count = 0
        # Work from right to left so a failed match cannot consume an
        # overlapping candidate at the end of a line.
        for index in range(len(words) - 2, -1, -1):
            left_match, right_match = words[index], words[index + 1]
            gap = text[left_match.end():right_match.start()]
            if (
                right_match.end() > last_start
                or not gap.isspace()
                or gap.count("\n") != 1
            ):
                continue
            left = left_match.group()
            right = right_match.group()
            known_word = key(left + right) in vocabulary
            confirmed = known_word and (
                (key(left) not in vocabulary and key(right) not in vocabulary)
                or context_matches(words, index, left + right, context_ngrams)
            )
            if confirmed:
                result = result[:left_match.start()] + left + right + result[right_match.end():]
                last_start = left_match.start()
                pass_count += 1
        count += pass_count
        if not pass_count:
            return text, count
        text = result


def main():
    app_root = Path(__file__).resolve().parent.parent
    project_root = app_root.parent
    source_path = project_root / "data"
    book_path = app_root / "data" / "book.json"

    source = json.loads(source_path.read_text(encoding="utf-8"))
    book = json.loads(book_path.read_text(encoding="utf-8"))
    source_pages = cleaned_source_pages(source.get("pages", []))
    vocabulary = {key(match.group()) for page in source_pages for match in WORD.finditer(page)}
    if not vocabulary:
        raise SystemExit("The source PDF text contains no usable Russian words.")

    changes = Counter()
    for lesson_number, lesson in book["lessons"].items():
        for topic in lesson["topics"].values():
            context = source_context_ngrams(
                source_pages, topic.get("start_page", 1), topic.get("end_page", topic.get("start_page", 1))
            )
            for field in ("name", "text"):
                topic[field], count = repair_text(topic[field], vocabulary, context)
                changes[lesson_number] += count

    book_path.write_text(
        json.dumps(book, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Joined {sum(changes.values())} source-confirmed word splits.")
    print("Corrections by lesson:", dict(sorted(changes.items(), key=lambda item: int(item[0]))))


if __name__ == "__main__":
    main()
