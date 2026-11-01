"""Publishing checks run in throwaway repositories, without touching project Git."""

from pathlib import Path
import shutil
import subprocess
import sys

import pytest

SOURCE = Path(__file__).resolve().parents[2] / "scripts/check-public-files"
pytestmark = pytest.mark.skipif(shutil.which("git") is None, reason="Publishing checks require Git CLI")


@pytest.fixture
def public_repo(tmp_path):
    subprocess.run(["git", "init", "--quiet", str(tmp_path)], check=True)
    (tmp_path / "scripts").mkdir()
    shutil.copy2(SOURCE, tmp_path / "scripts/check-public-files")
    (tmp_path / ".gitignore").write_text(".env*\n!.env.example\n*.dump\n")
    return tmp_path


def check(root):
    return subprocess.run(
        [sys.executable, str(root / "scripts/check-public-files")],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )


def test_public_source_and_empty_environment_example_pass(public_repo):
    (public_repo / "README.md").write_text("Work in progress, no private data.\n")
    (public_repo / ".env.example").write_text("DJANGO_SECRET_KEY=\nPOSTGRES_PASSWORD=\n")
    (public_repo / ".env.local").write_text("DJANGO_SECRET_KEY=local-unpublished-fixture\n")
    assert check(public_repo).returncode == 0


def test_copied_environment_secret_is_blocked_without_printing_it(public_repo):
    private = "only-local-" + "fixture-value-for-check"
    (public_repo / ".env.local").write_text(f"DJANGO_SECRET_KEY={private}\n")
    (public_repo / "accidental.txt").write_text(f"copied={private}")
    result = check(public_repo)
    assert result.returncode == 1
    assert "local environment secret" in result.stderr
    assert private not in result.stdout + result.stderr


def test_forced_tracked_environment_file_is_blocked(public_repo):
    (public_repo / ".env.local").write_text("POSTGRES_PASSWORD=\n")
    subprocess.run(["git", "-C", str(public_repo), "add", "-f", ".env.local"], check=True)
    result = check(public_repo)
    assert result.returncode == 1
    assert "ignored file already tracked" in result.stderr


def test_nonempty_example_and_unknown_binary_are_blocked(public_repo):
    (public_repo / ".env.example").write_text("POSTGRES_PASSWORD=not-an-empty-placeholder\n")
    (public_repo / "personal-photo.bin").write_bytes(b"\x00not-reviewed")
    result = check(public_repo)
    assert result.returncode == 1
    assert "nonempty example secret" in result.stderr
    assert "unreviewed binary file" in result.stderr


def test_private_key_is_blocked_without_printing_its_contents(public_repo):
    marker = "-----BEGIN " + "PRIVATE KEY-----"
    (public_repo / "accidental.txt").write_text(marker + "\nsynthetic-value\n")
    result = check(public_repo)
    assert result.returncode == 1
    assert "private key" in result.stderr
    assert marker not in result.stdout + result.stderr
