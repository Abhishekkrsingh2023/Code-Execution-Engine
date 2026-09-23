from pathlib import Path

LANGUAGES = ["c", "cpp", "java", "python"]


def create_problem_template(problem_id: str, base_dir: str = ".") -> None:
    """
    Creates the following structure:

    <base_dir>/
    └── <problem_id>/
        ├── c/
        │   └── Main.j2
        ├── cpp/
        │   └── Main.j2
        ├── java/
        │   └── Main.j2
        └── python/
            └── Main.j2
    """

    root = Path(base_dir) / problem_id

    for language in LANGUAGES:
        language_dir = root / language
        language_dir.mkdir(parents=True, exist_ok=True)

        template_file = language_dir / "Main.j2"

        # Create only if it doesn't already exist
        template_file.touch(exist_ok=True)

    print(f"✅ Template structure created at: {root.resolve()}")


if __name__ == "__main__":
    base_dir = Path(__file__).parent / "app" / "problems"

    problem_ids = [
        "0002"
    ]

    for problem_id in problem_ids:
        create_problem_template(problem_id, base_dir)